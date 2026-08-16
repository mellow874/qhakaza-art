import { createHash, timingSafeEqual } from 'node:crypto';

import { asSystem, fingerprintToken } from '@qhakaza/shared-db';

import { isRole, type Role } from './rbac';

/**
 * Server-side guards. These are the second of the three enforcement layers:
 *
 *   1. `src/proxy.ts` fences routes at the edge — fast, bypassable.
 *   2. These guards, re-checked inside every server action and loader.
 *   3. Postgres RLS (declared in @qhakaza/shared-db, enforced from Phase 5).
 *
 * Layer 1 alone is never sufficient: middleware does not run for direct
 * data-layer access, so anything that reads or writes must call a guard here.
 */

export type Session = { user?: { id?: string; role?: unknown } | null } | null;

export type GuardFailure =
  { ok: false; reason: 'UNAUTHENTICATED' } | { ok: false; reason: 'FORBIDDEN' };

export type RoleGrant = { ok: true; userId: string; role: Role };

/**
 * Asserts the session holds one of `allowed`.
 *
 * Returns a result rather than throwing: server actions must degrade into a
 * response, and an uncaught throw in a React Server Component surfaces as a
 * generic 500 that tells the caller nothing.
 */
export function requireRole(session: Session, allowed: readonly Role[]): RoleGrant | GuardFailure {
  const user = session?.user;
  const role = user?.role;

  if (!user || !isRole(role)) return { ok: false, reason: 'UNAUTHENTICATED' };
  if (!allowed.includes(role)) return { ok: false, reason: 'FORBIDDEN' };
  if (typeof user.id !== 'string' || user.id === '') {
    return { ok: false, reason: 'UNAUTHENTICATED' };
  }

  return { ok: true, userId: user.id, role };
}

/** SHA-256 of a token. Invitations are stored hashed, never in plaintext. */
export { fingerprintToken } from '@qhakaza/shared-db';

/**
 * Constant-time comparison of two hex digests.
 *
 * Lookup is by unique index so timing is not the practical attack here, but
 * comparing secrets with `===` is a habit worth not having.
 */
export function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export type TokenRejection = 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'EXPIRED_TOKEN' | 'REVOKED_TOKEN';

export type TokenGrant = {
  ok: true;
  invitationId: string;
  membershipId: string | null;
  email: string;
};

export type TokenResult = TokenGrant | { ok: false; reason: TokenRejection; fingerprint: string };

/**
 * Validates a `/private/<token>` invitation token.
 *
 * Fails closed on every path and returns the fingerprint on rejection so the
 * caller can record an ActivationAttempt without ever handling the plaintext
 * token again. **The caller must log that attempt** — a token being probed is
 * a security signal, and a silent rejection throws it away.
 *
 * Deliberately does not say *why* a token failed to the end user; that
 * distinction is for the audit log, not for whoever is guessing.
 */
export async function requireToken(token: string | undefined | null): Promise<TokenResult> {
  if (typeof token !== 'string' || token.trim() === '') {
    return { ok: false, reason: 'MISSING_TOKEN', fingerprint: fingerprintToken('') };
  }

  const fingerprint = fingerprintToken(token);

  // The `system` context: the door must read an invitation before any actor
  // exists. RLS grants `system` SELECT on this one table and nothing else.
  const invitation = await asSystem((tx) =>
    tx.memberInvitation.findUnique({
      where: { tokenHash: fingerprint },
      select: {
        id: true,
        membershipId: true,
        email: true,
        tokenHash: true,
        status: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
  );

  if (!invitation || !digestsMatch(invitation.tokenHash, fingerprint)) {
    return { ok: false, reason: 'INVALID_TOKEN', fingerprint };
  }

  if (invitation.status === 'REVOKED' || invitation.revokedAt !== null) {
    return { ok: false, reason: 'REVOKED_TOKEN', fingerprint };
  }

  // Expiry is checked against the clock, not against the stored status: a row
  // whose status was never swept to EXPIRED is still expired.
  if (invitation.expiresAt.getTime() <= Date.now() || invitation.status === 'EXPIRED') {
    return { ok: false, reason: 'EXPIRED_TOKEN', fingerprint };
  }

  return {
    ok: true,
    invitationId: invitation.id,
    membershipId: invitation.membershipId,
    email: invitation.email,
  };
}
