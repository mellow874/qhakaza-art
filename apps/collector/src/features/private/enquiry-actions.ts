'use server';

import { requireRole, requireToken } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';
import { withActor } from '@qhakaza/shared-db';

import { enquirySchema } from '@/lib/validation/enquiry';

/**
 * A member's private enquiry — a question about a work, or a request for a
 * viewing. Lands as a PrivateNoteSubmission for an advisor to pick up.
 */

export type EnquiryResult =
  | { ok: true }
  | { ok: false; error: 'DENIED' | 'INVALID' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Re-validates the token and the role **server-side** before writing.
 *
 * The layout already gated the page the form was rendered on, but a server
 * action is a public HTTP endpoint: it can be called directly, with any
 * payload, by anyone who has seen the page once. Trusting the earlier check
 * would mean the gate only applies to people who navigate politely.
 */
export async function submitEnquiry(input: unknown): Promise<EnquiryResult> {
  const parsed = enquirySchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const token = await requireToken(parsed.data.token);
  if (!token.ok) return { ok: false, error: 'DENIED' };

  const grant = requireRole(await auth(), ['COLLECTOR', 'ADMIN', 'ADVISOR']);
  if (!grant.ok) return { ok: false, error: 'DENIED' };

  try {
    // One `collector` transaction for both steps, so the lookup and the write
    // are judged under the same actor — and RLS narrows the lookup to released
    // work whether or not the WHERE clause below says so.
    const written = await withActor({ role: 'collector', userId: grant.userId }, async (tx) => {
      // An artworkId is only accepted if it names a work actually released to
      // members. Otherwise a crafted request could attach an enquiry to a draft
      // and have its title read back from the advisor's screen.
      let artworkId: string | null = null;

      if (parsed.data.artworkId) {
        const released = await tx.artwork.findFirst({
          where: { id: parsed.data.artworkId, status: 'LISTED', artist: { approved: true } },
          select: { id: true },
        });
        if (!released) return false;
        artworkId = released.id;
      }

      // `createMany`: a collector may insert a note but may only read back its
      // own, and RLS evaluates the `own` predicate against Membership. Asking
      // for RETURNING here would be asking for a read the policy need not grant.
      await tx.privateNoteSubmission.createMany({
        data: [
          {
            membershipId: token.membershipId,
            artworkId,
            subject: parsed.data.subject,
            body: parsed.data.body,
            createdById: grant.userId,
          },
        ],
      });

      return true;
    });

    if (!written) return { ok: false, error: 'DENIED' };

    return { ok: true };
  } catch (error) {
    // The payload is a member's private correspondence; only the error is
    // logged, never the note.
    console.error('submitEnquiry failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
