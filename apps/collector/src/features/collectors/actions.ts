'use server';

import { headers } from 'next/headers';

import { checkLimit, prisma, recordEvent } from '@qhakaza/shared-db';
import { collectorApplicationSchema } from '@/lib/validation/collector';

export type CollectorApplicationResult =
  | { ok: true }
  | {
      ok: false;
      error: 'INVALID' | 'RATE_LIMITED' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

/** Who is asking, for rate limiting only. Never treated as an identity. */
async function callerHint(): Promise<string> {
  const headerList = await headers();
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Records a collector membership application.
 *
 * The row is the durable record: there is no mail provider configured, and the
 * verification step the form's button points at does not exist yet, so losing
 * this would lose the applicant entirely.
 *
 * Nothing here is logged on the success path and the failure path logs the
 * error only — the payload carries income bands, contact details and free text
 * about someone's wealth, none of which belongs in a log file.
 */
export async function submitCollectorApplication(
  input: unknown,
): Promise<CollectorApplicationResult> {
  const parsed = collectorApplicationSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  // After validation, so a malformed submission does not consume a real
  // applicant's allowance while they are correcting it.
  const limit = await checkLimit('intake', await callerHint());
  if (!limit.allowed) {
    await recordEvent('rate_limit.tripped', { properties: { action: 'intake' } });
    return { ok: false, error: 'RATE_LIMITED' };
  }

  try {
    /*
     * `createMany`, not `create`.
     *
     * Under RLS this table is write-only for the anonymous public: an applicant
     * may submit, and may never read intakes back — not even their own. Prisma's
     * `create()` issues INSERT ... RETURNING, and RETURNING requires SELECT
     * permission, so it would insert the row and then be refused the read-back.
     * `createMany` returns a count and asks for nothing it cannot have.
     */
    await prisma.collectorIntake.createMany({ data: [parsed.data] });
    /*
     * No properties at all on this one. An intake carries income bands and
     * free text about someone's wealth; the only safe thing to record is that
     * one arrived.
     */
    await recordEvent('intake.submitted');
    return { ok: true };
  } catch (error) {
    console.error('submitCollectorApplication failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
