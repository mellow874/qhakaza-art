'use server';

import { prisma } from '@qhakaza/shared-db';

import { considerationSchema } from '@/lib/validation/journeys';

/**
 * Membership Consideration — the collector journey that is neither full
 * onboarding nor a general enquiry.
 *
 * Writes to `CollectorIntake` with a `kind` that says which journey produced
 * it, so it arrives in the same queue as onboarding for the same people to
 * work, without near-identical tables to keep in step.
 *
 * `createMany`, not `create`: under RLS this table is write-only for the
 * public, and `create()` issues INSERT ... RETURNING, which needs a SELECT the
 * policy does not grant.
 *
 * Request Access used to live here too, gated on having onboarded. It was
 * retired in favour of the general private request form, which is a single
 * route for every kind of enquiry. `CollectorIntakeKind.ACCESS_REQUEST` is left
 * in the schema: rows written by the old form still carry it.
 */

export type JourneyResult =
  | { ok: true }
  | {
      ok: false;
      error: 'INVALID' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[issue.path.join('.')] ??= issue.message;
  return fieldErrors;
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
