'use server';

import { prisma } from '@qhakaza/shared-db';
import { privateRequestSchema } from '@/lib/validation/request';

export type PrivateRequestResult =
  | { ok: true }
  | { ok: false; error: 'INVALID' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Submits a private collector enquiry.
 *
 * Stores to ContactMessage table (same as Vera's contact form). The row is the
 * durable record — there is no mail provider configured, so a form that quietly
 * drops requests would be worse than no form at all.
 *
 * Nothing is logged on the success path; the failure path logs only the error,
 * never the payload (which contains contact details).
 */
export async function submitPrivateRequest(input: unknown): Promise<PrivateRequestResult> {
  const parsed = privateRequestSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  try {
    await prisma.contactMessage.create({ data: parsed.data });
    return { ok: true };
  } catch (error) {
    console.error('submitPrivateRequest failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
