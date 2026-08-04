'use server';

import { prisma } from '@/lib/db';
import { contactMessageSchema } from '@/lib/validation/user';

export type ContactResult =
  { ok: true } | { ok: false; error: 'INVALID' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Records a contact enquiry.
 *
 * Deliberately stores rather than sends: no mail provider is configured, and a
 * form that quietly drops messages is worse than no form at all. Add delivery
 * here once a provider is chosen — the row is the durable record either way.
 */
export async function submitContactMessage(input: unknown): Promise<ContactResult> {
  const parsed = contactMessageSchema.safeParse(input);

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
    console.error('submitContactMessage failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
