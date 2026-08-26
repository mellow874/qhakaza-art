import { headers } from 'next/headers';

import { auth } from '@qhakaza/shared-auth/server';
import { fingerprintToken, requireRole, requireToken } from '@qhakaza/shared-auth/guards';
import { asSystem, checkLimit, recordEvent } from '@qhakaza/shared-db';
import type { ActivationOutcome } from '@qhakaza/shared-db';

/**
 * The gate on `/private/<token>`.
 *
 * Called from the layout that wraps every private route, so a page added later
 * is covered whether or not its author remembers. A guard you have to remember
 * to call is a guard that will eventually be forgotten.
 *
 * WHY THE EDGE PROXY DOES NOT FENCE `/private`
 * Role fencing at the proxy would bounce an anonymous request to /login before
 * any code here runs — and anonymous requests are exactly the ones worth
 * recording, because that is what token guessing looks like. Enforcement is
 * therefore page-side, where the database is reachable and every attempt can be
 * written down. This layer is authoritative, not a convenience.
 */

/** Who may hold a private route open, once the token itself checks out. */
const PRIVATE_ROLES = ['COLLECTOR', 'ADMIN', 'ADVISOR'] as const;

export type ActivationResult =
  | { status: 'granted'; invitationId: string; membershipId: string | null; email: string }
  | { status: 'denied' }
  | { status: 'sign-in-required'; callbackUrl: string };

async function recordAttempt(input: {
  outcome: ActivationOutcome;
  tokenFingerprint: string;
  invitationId?: string | null;
}) {
  try {
    const headerList = await headers();

    // The `system` context: a failed attempt has, by definition, no valid
    // actor. RLS grants `system` INSERT here and nothing else.
    //
    // `createMany` rather than `create`: this table is append-only and grants
    // no SELECT to `system`, so INSERT ... RETURNING would be refused the
    // read-back and the whole write would appear to fail.
    await asSystem((tx) =>
      tx.activationAttempt.createMany({
        data: [
          {
            outcome: input.outcome,
            tokenFingerprint: input.tokenFingerprint,
            invitationId: input.invitationId ?? null,
            // Behind a proxy the socket address is the proxy's, so the
            // forwarded header is the only useful value. It is
            // attacker-controlled and recorded as evidence, never trusted.
            ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
            userAgent: headerList.get('user-agent'),
          },
        ],
      }),
    );
  } catch (error) {
    // Never let logging take the page down: failing closed on a write error
    // would turn an audit problem into an outage, and failing *open* silently
    // would be worse. The block below still runs either way.
    console.error('recordActivationAttempt failed', error);
  }
}

export async function activate(token: string | undefined): Promise<ActivationResult> {
  /*
   * RATE LIMITED BEFORE THE TOKEN IS EVEN LOOKED AT.
   *
   * Repeated attempts here are what token guessing looks like, and until now
   * the platform recorded them faithfully and did nothing to slow them down.
   * The check comes first so a guesser is stopped rather than merely
   * catalogued.
   *
   * A DENIAL IS STILL RECORDED. Being rate limited is itself an activation
   * attempt worth having in the forensic record - dropping it would mean the
   * one signal that matters most, sustained guessing, is the one that stops
   * being written down.
   */
  const headerList = await headers();
  const caller = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limit = await checkLimit('activation', caller);

  if (!limit.allowed) {
    await recordAttempt({
      outcome: 'RATE_LIMITED',
      tokenFingerprint: token ? fingerprintToken(token) : 'none',
    });
    await recordEvent('rate_limit.tripped', { properties: { action: 'activation' } });
    return { status: 'denied' };
  }

  const result = await requireToken(token);

  if (!result.ok) {
    await recordAttempt({ outcome: result.reason, tokenFingerprint: result.fingerprint });
    await recordEvent('invitation.failed', { properties: { reason: result.reason } });
    return { status: 'denied' };
  }

  // The token is real. A genuine invitee arriving from their email will not
  // have a session yet, so send them to sign in and back to this same URL.
  const session = await auth();
  const grant = requireRole(session, PRIVATE_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    return { status: 'sign-in-required', callbackUrl: `/private/${token}` };
  }

  if (!grant.ok) {
    await recordAttempt({
      outcome: 'ROLE_DENIED',
      tokenFingerprint: fingerprintToken(token!),
      invitationId: result.invitationId,
    });
    return { status: 'denied' };
  }

  await recordAttempt({
    outcome: 'SUCCESS',
    tokenFingerprint: fingerprintToken(token!),
    invitationId: result.invitationId,
  });
  await recordEvent('invitation.accepted');

  return {
    status: 'granted',
    invitationId: result.invitationId,
    membershipId: result.membershipId,
    email: result.email,
  };
}
