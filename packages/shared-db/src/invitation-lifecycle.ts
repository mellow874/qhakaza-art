import { asSystem } from './actor';
import { prisma } from './client';
import { fingerprintToken } from './token';

/**
 * Moving an invitation through its states.
 *
 *   CREATED -> SENT -> OPENED -> ACCEPTED -> COMPLETED
 *
 * Lives here rather than in an app because both sites drive it: artist
 * invitations are opened on Vera, collector invitations on the Collector
 * Platform, and both must reach the same record in the same way.
 *
 * EVERY TRANSITION IS GUARDED BY ITS CURRENT STATE, in the `where` clause of a
 * single `updateMany`. That is what makes them idempotent and race-safe: two
 * concurrent requests both issue the same conditional update, the database
 * serialises them, and the second matches zero rows and changes nothing. A
 * read-then-write would let both pass the check and both act.
 *
 * `asSystem` throughout: these run before the invitee has a session. The `system`
 * actor is granted exactly the invitation reads and writes it needs and nothing
 * else.
 */

/** States from which an invitation can still be used. */
const LIVE = ['CREATED', 'SENT', 'OPENED'] as const;

export type InvitationLookup = {
  id: string;
  email: string;
  recipientName: string | null;
  status: string;
  expiresAt: Date;
  /**
   * Decided here, not by the caller.
   *
   * A page that computed this would be calling Date.now() during render, which
   * is both impure and a lint error - and more importantly it would let two
   * screens disagree about whether the same invitation had expired.
   */
  isExpired: boolean;
  /** Cancelled under either the current or the original spelling. */
  isCancelled: boolean;
  recipientTypeSlug: string | null;
  grantsRole: string | null;
  acceptedByUserId: string | null;
};

/** Find an invitation by the token presented at the door. */
export async function findInvitationByToken(token: string): Promise<InvitationLookup | null> {
  const found = await asSystem((tx) =>
    tx.memberInvitation.findUnique({
      where: { tokenHash: fingerprintToken(token) },
      select: {
        id: true,
        email: true,
        recipientName: true,
        status: true,
        expiresAt: true,
        acceptedByUserId: true,
        recipientType: { select: { slug: true, grantsRole: true } },
      },
    }),
  );

  if (!found) return null;

  return {
    id: found.id,
    email: found.email,
    recipientName: found.recipientName,
    status: found.status,
    expiresAt: found.expiresAt,
    isExpired: found.expiresAt.getTime() <= Date.now(),
    isCancelled: found.status === 'CANCELLED' || found.status === 'REVOKED',
    acceptedByUserId: found.acceptedByUserId,
    recipientTypeSlug: found.recipientType?.slug ?? null,
    grantsRole: found.recipientType?.grantsRole ?? null,
  };
}

/**
 * Record that the recipient followed the link.
 *
 * Only the FIRST open moves the state; `openedAt` is the moment it was first
 * seen, not the most recent visit. Later visits are already recorded in
 * `ActivationAttempt`, which is the log for that.
 *
 * Never fails loudly: an invitation that works but whose open went unrecorded
 * is a reporting gap, not an outage.
 */
export async function markInvitationOpened(invitationId: string): Promise<void> {
  try {
    await asSystem((tx) =>
      tx.memberInvitation.updateMany({
        where: { id: invitationId, status: { in: ['CREATED', 'SENT'] } },
        data: { status: 'OPENED', openedAt: new Date() },
      }),
    );
  } catch (error) {
    console.error('markInvitationOpened failed', error);
  }
}

export type AcceptResult =
  | { ok: true; alreadyAccepted: boolean }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'CANCELLED' | 'TAKEN_BY_ANOTHER_ACCOUNT' };

/**
 * Consume an invitation on behalf of a signed-in account.
 *
 * THE SINGLE-USE GUARANTEE. The brief requires that one invitation can never
 * produce two user records, and this is where that is enforced:
 *
 *  - the conditional update only matches while the status is still live, so the
 *    second of two concurrent calls matches nothing;
 *  - `acceptedByUserId` is stamped at the same moment, so the row itself
 *    records which account it produced;
 *  - re-accepting by the SAME account returns `alreadyAccepted: true` rather
 *    than an error, which makes the whole operation idempotent — a refreshed
 *    page or a retried request is harmless;
 *  - re-accepting by a DIFFERENT account is refused outright.
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string,
): Promise<AcceptResult> {
  const invitation = await asSystem((tx) =>
    tx.memberInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, status: true, expiresAt: true, acceptedByUserId: true },
    }),
  );

  if (!invitation) return { ok: false, reason: 'NOT_FOUND' };

  if (invitation.acceptedByUserId) {
    return invitation.acceptedByUserId === userId
      ? { ok: true, alreadyAccepted: true }
      : { ok: false, reason: 'TAKEN_BY_ANOTHER_ACCOUNT' };
  }

  if (invitation.status === 'CANCELLED' || invitation.status === 'REVOKED') {
    return { ok: false, reason: 'CANCELLED' };
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    // Recorded, so the queue shows why it went nowhere rather than leaving it
    // looking merely unanswered.
    await asSystem((tx) =>
      tx.memberInvitation.updateMany({
        where: { id: invitationId, status: { in: [...LIVE] } },
        data: { status: 'EXPIRED' },
      }),
    );
    return { ok: false, reason: 'EXPIRED' };
  }

  const { count } = await asSystem((tx) =>
    tx.memberInvitation.updateMany({
      // The guard: still live, still unclaimed, still in date.
      where: {
        id: invitationId,
        status: { in: [...LIVE] },
        acceptedByUserId: null,
        expiresAt: { gt: new Date() },
      },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByUserId: userId },
    }),
  );

  if (count === 0) {
    // Lost the race. Re-read to answer accurately rather than guessing.
    const now = await asSystem((tx) =>
      tx.memberInvitation.findUnique({
        where: { id: invitationId },
        select: { acceptedByUserId: true },
      }),
    );

    return now?.acceptedByUserId === userId
      ? { ok: true, alreadyAccepted: true }
      : { ok: false, reason: 'TAKEN_BY_ANOTHER_ACCOUNT' };
  }

  return { ok: true, alreadyAccepted: false };
}

/**
 * Onboarding finished — a profile or a membership now exists.
 *
 * Idempotent for the same reason as the others: the guard is in the `where`.
 * Calling it twice is a no-op, which matters because completion is detected
 * rather than announced, and may be observed more than once.
 */
export async function completeInvitation(invitationId: string): Promise<void> {
  try {
    await asSystem((tx) =>
      tx.memberInvitation.updateMany({
        where: { id: invitationId, status: 'ACCEPTED' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
    );
  } catch (error) {
    console.error('completeInvitation failed', error);
  }
}

/**
 * Sweep invitations past their date into EXPIRED.
 *
 * The status is otherwise only corrected when someone tries to use the link, so
 * without this the admin list shows stale invitations as though they were still
 * outstanding. Safe to run repeatedly.
 */
export async function expireOverdueInvitations(): Promise<number> {
  const { count } = await prisma.memberInvitation.updateMany({
    where: { status: { in: [...LIVE] }, expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });

  return count;
}
