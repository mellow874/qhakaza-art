'use server';

import { headers } from 'next/headers';

import { checkLimit, prisma, recordEvent } from '@qhakaza/shared-db';
import { contactMessageSchema } from '@/lib/validation/user';

export type ContactResult =
  | { ok: true }
  | {
      ok: false;
      error: 'INVALID' | 'RATE_LIMITED' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

/**
 * Who is asking, for rate limiting only.
 *
 * `x-forwarded-for` is attacker-controlled and is treated as a hint, never as
 * an identity. The worst case if it is spoofed is that a flooder gets a fresh
 * bucket per forged header - which is no worse than having no limiter, and
 * strictly better against the unsophisticated flooding this actually stops.
 */
async function callerHint(): Promise<string> {
  const headerList = await headers();
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

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

  // Checked AFTER validation, so a malformed submission does not consume a
  // legitimate person's allowance while they are fixing a typo.
  const limit = await checkLimit('contact', await callerHint());
  if (!limit.allowed) {
    await recordEvent('rate_limit.tripped', { properties: { action: 'contact' } });
    return { ok: false, error: 'RATE_LIMITED' };
  }

  try {
    await prisma.contactMessage.create({ data: parsed.data });
    // The event carries no message, no name and no address. That a message
    // arrived is the metric; what it said is not.
    await recordEvent('contact.submitted');
    return { ok: true };
  } catch (error) {
    console.error('submitContactMessage failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
