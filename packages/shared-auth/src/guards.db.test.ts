import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

import { digestsMatch, fingerprintToken, requireRole, requireToken } from './guards';

/**
 * The invitation token gate. Everything here is an adversarial case: the
 * happy path is one test, the ways in are the other eleven.
 */

const HOUR = 60 * 60 * 1000;

async function makeInvitation(
  token: string,
  overrides: Partial<{
    expiresAt: Date;
    status: 'ISSUED' | 'REVOKED' | 'EXPIRED' | 'ACCEPTED';
    revokedAt: Date | null;
  }> = {},
) {
  return prisma.memberInvitation.create({
    data: {
      email: `invitee-${token}@test.local`,
      tokenHash: fingerprintToken(token),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + HOUR),
      status: overrides.status ?? 'ISSUED',
      revokedAt: overrides.revokedAt ?? null,
    },
  });
}

beforeEach(async () => {
  await prisma.activationAttempt.deleteMany();
  await prisma.memberInvitation.deleteMany();
});

describe('fingerprintToken', () => {
  it('never stores the token itself', async () => {
    const token = 'a-real-invitation-token';
    await makeInvitation(token);

    const stored = await prisma.memberInvitation.findFirstOrThrow();
    // A database dump must not hand over working invitations.
    expect(stored.tokenHash).not.toBe(token);
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.tokenHash).toMatch(/^[0-9a-f]+$/);
  });

  it('is stable, so the same token always finds its invitation', () => {
    expect(fingerprintToken('abc')).toBe(fingerprintToken('abc'));
    expect(fingerprintToken('abc')).not.toBe(fingerprintToken('abd'));
  });
});

describe('digestsMatch', () => {
  it('accepts identical digests and rejects different ones', () => {
    const a = fingerprintToken('one');
    expect(digestsMatch(a, a)).toBe(true);
    expect(digestsMatch(a, fingerprintToken('two'))).toBe(false);
  });

  it('rejects rather than throwing on a length mismatch', () => {
    // timingSafeEqual throws on unequal lengths; a crafted value must not be
    // able to turn a comparison into a 500.
    expect(digestsMatch(fingerprintToken('one'), 'ab')).toBe(false);
  });
});

describe('requireToken', () => {
  it('grants a valid, unexpired, unrevoked invitation', async () => {
    const invitation = await makeInvitation('good-token');

    const result = await requireToken('good-token');

    expect(result.ok).toBe(true);
    expect(result.ok === true && result.invitationId).toBe(invitation.id);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('refuses a %s token as MISSING_TOKEN', async (_label, token) => {
    const result = await requireToken(token);
    expect(result).toMatchObject({ ok: false, reason: 'MISSING_TOKEN' });
  });

  it('refuses a token that matches no invitation', async () => {
    await makeInvitation('good-token');

    const result = await requireToken('forged-token');

    expect(result).toMatchObject({ ok: false, reason: 'INVALID_TOKEN' });
  });

  it('refuses an expired invitation', async () => {
    await makeInvitation('stale', { expiresAt: new Date(Date.now() - HOUR) });

    const result = await requireToken('stale');

    expect(result).toMatchObject({ ok: false, reason: 'EXPIRED_TOKEN' });
  });

  it('refuses an invitation that expired but was never swept to EXPIRED', async () => {
    // Expiry is decided by the clock, not by whether a background job has run.
    await makeInvitation('unswept', {
      expiresAt: new Date(Date.now() - HOUR),
      status: 'ISSUED',
    });

    const result = await requireToken('unswept');

    expect(result).toMatchObject({ ok: false, reason: 'EXPIRED_TOKEN' });
  });

  it('refuses a revoked invitation even while it is still in date', async () => {
    await makeInvitation('pulled', {
      status: 'REVOKED',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + HOUR),
    });

    const result = await requireToken('pulled');

    expect(result).toMatchObject({ ok: false, reason: 'REVOKED_TOKEN' });
  });

  it('refuses a row marked revoked by timestamp alone', async () => {
    await makeInvitation('half-pulled', { status: 'ISSUED', revokedAt: new Date() });

    const result = await requireToken('half-pulled');

    expect(result).toMatchObject({ ok: false, reason: 'REVOKED_TOKEN' });
  });

  it('returns a fingerprint on rejection so the attempt can be logged', async () => {
    const result = await requireToken('forged-token');

    expect(result.ok).toBe(false);
    // The caller records this, never the plaintext token.
    expect(result.ok === false && result.fingerprint).toBe(fingerprintToken('forged-token'));
  });
});

describe('requireRole', () => {
  const collector = { user: { id: 'u1', role: 'COLLECTOR' } };

  it('grants a permitted role', () => {
    expect(requireRole(collector, ['COLLECTOR'])).toMatchObject({ ok: true, userId: 'u1' });
  });

  it('refuses an artist reaching for a collector area', () => {
    const artist = { user: { id: 'u2', role: 'ARTIST' } };
    expect(requireRole(artist, ['COLLECTOR', 'ADMIN', 'ADVISOR'])).toMatchObject({
      ok: false,
      reason: 'FORBIDDEN',
    });
  });

  it.each([
    ['no session', null],
    ['no user', {}],
    ['an unknown role', { user: { id: 'u3', role: 'SUPERUSER' } }],
    ['a session with no id', { user: { role: 'COLLECTOR' } }],
  ])('refuses %s as unauthenticated', (_label, session) => {
    expect(requireRole(session as never, ['COLLECTOR'])).toMatchObject({
      ok: false,
      reason: 'UNAUTHENTICATED',
    });
  });
});
