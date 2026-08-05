'use server';

import { prisma } from '@qhakaza/shared-db';
import { collectorApplicationSchema } from '@/lib/validation/collector';

export type CollectorApplicationResult =
  { ok: true } | { ok: false; error: 'INVALID' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

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

  try {
    await prisma.collectorIntake.create({ data: parsed.data });
    return { ok: true };
  } catch (error) {
    console.error('submitCollectorApplication failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
