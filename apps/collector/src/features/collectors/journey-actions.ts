'use server';

import { prisma, withActor } from '@qhakaza/shared-db';

import { accessRequestSchema, considerationSchema } from '@/lib/validation/journeys';

/**
 * The two collector journeys that are not full onboarding.
 *
 * Both write to `CollectorIntake` with a `kind` that says which journey
 * produced them, so all three arrive in one queue for the same people to work,
 * without three near-identical tables to keep in step.
 *
 * `createMany` throughout, not `create`: under RLS this table is write-only for
 * the public, and `create()` issues INSERT ... RETURNING, which needs a SELECT
 * the policy does not grant.
 */

export type JourneyResult =
  | { ok: true }
  | {
      ok: false;
      error: 'INVALID' | 'NO_INTAKE' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[issue.path.join('.')] ??= issue.message;
  return fieldErrors;
}

/**
 * Request Access — the preview window, gated on having onboarded.
 *
 * The precondition is real, not decorative: we look for an existing intake
 * against the address given. No account is required, which suits a public page,
 * but someone who has never onboarded is told so rather than quietly queued.
 */
export async function requestAccess(input: unknown): Promise<JourneyResult> {
  const parsed = accessRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const { email, accessInterest } = parsed.data;

  try {
    /*
     * Reading CollectorIntake needs staff rights — the public cannot read this
     * table, by policy. `advisor` is used for the existence check only, and the
     * only thing that leaves this block is a boolean: no intake data is
     * returned to the caller, so the check cannot be turned into a way of
     * reading someone else's application.
     */
    const hasOnboarded = await withActor({ role: 'advisor' }, async (tx) => {
      const found = await tx.collectorIntake.findFirst({
        where: { email, kind: 'INTAKE' },
        select: { id: true },
      });
      return found !== null;
    });

    if (!hasOnboarded) return { ok: false, error: 'NO_INTAKE' };

    await prisma.collectorIntake.createMany({
      data: [
        {
          kind: 'ACCESS_REQUEST',
          // Carried forward so the row is self-describing in the queue; the
          // name is not asked for again.
          fullName: email,
          email,
          accessInterest,
        },
      ],
    });

    return { ok: true };
  } catch (error) {
    console.error('requestAccess failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

/** Membership Consideration — a request to be considered without the fee. */
export async function requestMembershipConsideration(input: unknown): Promise<JourneyResult> {
  const parsed = considerationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  try {
    await prisma.collectorIntake.createMany({
      data: [{ kind: 'MEMBERSHIP_CONSIDERATION', ...parsed.data }],
    });

    return { ok: true };
  } catch (error) {
    // The note is someone explaining their circumstances. Only the error is
    // logged, never the payload.
    console.error('requestMembershipConsideration failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
