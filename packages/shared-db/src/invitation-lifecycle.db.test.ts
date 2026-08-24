import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './client';
import {
  acceptInvitation,
  completeInvitation,
  expireOverdueInvitations,
  findInvitationByToken,
  markInvitationOpened,
} from './invitation-lifecycle';
import { fingerprintToken } from './token';

/**
 * The invitation lifecycle.
 *
 * The brief's hard requirement is that one invitation can never create two user
 * records. Most of these tests exist to attack that from a different angle:
 * twice in a row, concurrently, by a second account, after cancellation, after
 * expiry. A single-use guarantee that only holds when nobody tries is not one.
 */

const DAY = 24 * 60 * 60 * 1000;

let collectorTypeId: string;

async function makeUser(email = `u-${Math.random()}@test.local`) {
  return prisma.user.create({ data: { email, role: 'COLLECTOR' } });
}

async function makeInvitation(
  token: string,
  overrides: { status?: string; expiresAt?: Date; acceptedByUserId?: string } = {},
) {
  return prisma.memberInvitation.create({
    data: {
      email: `invite-${Math.random()}@test.local`,
      tokenHash: fingerprintToken(token),
      recipientTypeId: collectorTypeId,
      status: (overrides.status ?? 'SENT') as 'SENT',
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 14 * DAY),
      acceptedByUserId: overrides.acceptedByUserId ?? null,
    },
  });
}

beforeEach(async () => {
  await prisma.activationAttempt.deleteMany();
  await prisma.memberInvitation.deleteMany();
  await prisma.user.deleteMany();

  const type = await prisma.invitationRecipientType.upsert({
    where: { slug: 'COLLECTOR' },
    update: {},
    create: { slug: 'COLLECTOR', label: 'Collector', grantsRole: 'COLLECTOR', ordering: 20 },
  });
  collectorTypeId = type.id;
});

describe('findInvitationByToken', () => {
  it('finds an invitation by its token, never storing the token itself', async () => {
    const created = await makeInvitation('a-real-token');

    const found = await findInvitationByToken('a-real-token');

    expect(found?.id).toBe(created.id);
    // The row holds a digest, not the token.
    expect(created.tokenHash).not.toBe('a-real-token');
    expect(found?.recipientTypeSlug).toBe('COLLECTOR');
    expect(found?.grantsRole).toBe('COLLECTOR');
  });

  it('returns nothing for a token that was never issued', async () => {
    await makeInvitation('the-real-one');
    expect(await findInvitationByToken('a-guess')).toBeNull();
  });
});

describe('markInvitationOpened', () => {
  it('moves SENT to OPENED and stamps the time', async () => {
    const invitation = await makeInvitation('t1', { status: 'SENT' });

    await markInvitationOpened(invitation.id);

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('OPENED');
    expect(after.openedAt).not.toBeNull();
  });

  it('records the FIRST open, not the most recent visit', async () => {
    const invitation = await makeInvitation('t2', { status: 'SENT' });

    await markInvitationOpened(invitation.id);
    const first = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });

    await markInvitationOpened(invitation.id);
    const second = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });

    expect(second.openedAt).toEqual(first.openedAt);
  });

  it('never drags an accepted invitation backwards', async () => {
    // Opening the link again after signing in must not undo acceptance.
    const user = await makeUser();
    const invitation = await makeInvitation('t3', { status: 'SENT' });
    await acceptInvitation(invitation.id, user.id);

    await markInvitationOpened(invitation.id);

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('ACCEPTED');
  });
});

describe('acceptInvitation — the single-use guarantee', () => {
  it('accepts once and records which account it produced', async () => {
    const user = await makeUser();
    const invitation = await makeInvitation('t4');

    const result = await acceptInvitation(invitation.id, user.id);

    expect(result).toEqual({ ok: true, alreadyAccepted: false });
    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('ACCEPTED');
    expect(after.acceptedByUserId).toBe(user.id);
    expect(after.acceptedAt).not.toBeNull();
  });

  it('is idempotent for the same account', async () => {
    // A refreshed page or a retried request must be harmless.
    const user = await makeUser();
    const invitation = await makeInvitation('t5');

    await acceptInvitation(invitation.id, user.id);
    const second = await acceptInvitation(invitation.id, user.id);

    expect(second).toEqual({ ok: true, alreadyAccepted: true });
  });

  it('refuses a second, different account', async () => {
    // The whole point: one invitation, one user record.
    const first = await makeUser('first@test.local');
    const second = await makeUser('second@test.local');
    const invitation = await makeInvitation('t6');

    await acceptInvitation(invitation.id, first.id);
    const result = await acceptInvitation(invitation.id, second.id);

    expect(result).toEqual({ ok: false, reason: 'TAKEN_BY_ANOTHER_ACCOUNT' });
    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.acceptedByUserId).toBe(first.id);
  });

  it('survives two accounts racing for the same invitation', async () => {
    // The guard is a conditional UPDATE, so the database serialises these and
    // exactly one can win. A read-then-write would let both through.
    const a = await makeUser('race-a@test.local');
    const b = await makeUser('race-b@test.local');
    const invitation = await makeInvitation('t7');

    const [first, second] = await Promise.all([
      acceptInvitation(invitation.id, a.id),
      acceptInvitation(invitation.id, b.id),
    ]);

    const succeeded = [first, second].filter((r) => r.ok);
    expect(succeeded).toHaveLength(1);

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect([a.id, b.id]).toContain(after.acceptedByUserId);
  });

  it('refuses a cancelled invitation', async () => {
    const user = await makeUser();
    const invitation = await makeInvitation('t8', { status: 'CANCELLED' });

    expect(await acceptInvitation(invitation.id, user.id)).toEqual({
      ok: false,
      reason: 'CANCELLED',
    });
  });

  it('refuses an expired invitation and records that it expired', async () => {
    const user = await makeUser();
    const invitation = await makeInvitation('t9', { expiresAt: new Date(Date.now() - DAY) });

    expect(await acceptInvitation(invitation.id, user.id)).toEqual({
      ok: false,
      reason: 'EXPIRED',
    });

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('EXPIRED');
    expect(after.acceptedByUserId).toBeNull();
  });

  it('returns NOT_FOUND for an invitation that does not exist', async () => {
    const user = await makeUser();
    expect(await acceptInvitation('cmnotarealid0000000000', user.id)).toEqual({
      ok: false,
      reason: 'NOT_FOUND',
    });
  });

  it('still honours a legacy REVOKED row', async () => {
    // REVOKED is the original spelling of CANCELLED and survives in old data.
    const user = await makeUser();
    const invitation = await makeInvitation('t10', { status: 'REVOKED' });

    expect(await acceptInvitation(invitation.id, user.id)).toEqual({
      ok: false,
      reason: 'CANCELLED',
    });
  });
});

describe('completeInvitation', () => {
  it('moves ACCEPTED to COMPLETED', async () => {
    const user = await makeUser();
    const invitation = await makeInvitation('t11');
    await acceptInvitation(invitation.id, user.id);

    await completeInvitation(invitation.id);

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('COMPLETED');
    expect(after.completedAt).not.toBeNull();
  });

  it('is idempotent — completion may be observed more than once', async () => {
    const user = await makeUser();
    const invitation = await makeInvitation('t12');
    await acceptInvitation(invitation.id, user.id);

    await completeInvitation(invitation.id);
    const first = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    await completeInvitation(invitation.id);
    const second = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });

    expect(second.completedAt).toEqual(first.completedAt);
  });

  it('will not complete an invitation nobody accepted', async () => {
    const invitation = await makeInvitation('t13', { status: 'SENT' });

    await completeInvitation(invitation.id);

    const after = await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(after.status).toBe('SENT');
  });
});

describe('expireOverdueInvitations', () => {
  it('expires only the overdue, live ones', async () => {
    const overdue = await makeInvitation('t14', { expiresAt: new Date(Date.now() - DAY) });
    const current = await makeInvitation('t15', { expiresAt: new Date(Date.now() + DAY) });

    const count = await expireOverdueInvitations();

    expect(count).toBe(1);
    expect(
      (await prisma.memberInvitation.findUniqueOrThrow({ where: { id: overdue.id } })).status,
    ).toBe('EXPIRED');
    expect(
      (await prisma.memberInvitation.findUniqueOrThrow({ where: { id: current.id } })).status,
    ).toBe('SENT');
  });

  it('leaves an accepted invitation alone even when past its date', async () => {
    // It was used in time. Expiring it afterwards would rewrite what happened.
    const user = await makeUser();
    const invitation = await makeInvitation('t16');
    await acceptInvitation(invitation.id, user.id);
    await prisma.memberInvitation.update({
      where: { id: invitation.id },
      data: { expiresAt: new Date(Date.now() - DAY) },
    });

    await expireOverdueInvitations();

    expect(
      (await prisma.memberInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
    ).toBe('ACCEPTED');
  });
});
