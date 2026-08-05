import { headers } from 'next/headers';

import { auth } from '@qhakaza/shared-auth/server';
import { fingerprintToken, requireRole, requireToken } from '@qhakaza/shared-auth/guards';
import { prisma } from '@qhakaza/shared-db';
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

    await prisma.activationAttempt.create({
      data: {
        outcome: input.outcome,
        tokenFingerprint: input.tokenFingerprint,
        invitationId: input.invitationId ?? null,
        // Behind a proxy the socket address is the proxy's, so the forwarded
        // header is the only useful value. It is attacker-controlled and is
        // recorded as evidence, never trusted for a decision.
        ipAddress: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        userAgent: headerList.get('user-agent'),
      },
    });
  } catch (error) {
    // Never let logging take the page down: failing closed on a write error
    // would turn an audit problem into an outage, and failing *open* silently
    // would be worse. The block below still runs either way.
    console.error('recordActivationAttempt failed', error);
  }
}

export async function activate(token: string | undefined): Promise<ActivationResult> {
  const result = await requireToken(token);

  if (!result.ok) {
    await recordAttempt({ outcome: result.reason, tokenFingerprint: result.fingerprint });
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

  return {
    status: 'granted',
    invitationId: result.invitationId,
    membershipId: result.membershipId,
    email: result.email,
  };
}
