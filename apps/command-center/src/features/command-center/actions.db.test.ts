import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));

// Server-only Next APIs the actions touch, stubbed to what they return in a request.
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  decideCollectorIntake,
  inviteCollector,
  revokeInvitation,
  setArtistApproval,
  setArtworkRelease,
  setUserRole,
} = await import('./actions');

function signedInAs(role: string | null, id = 'admin-1') {
  auth.mockResolvedValue(role ? { user: { id, role } } : null);
}

async function makeArtistWithWork({ approved = false } = {}) {
  const user = await prisma.user.create({
    data: { email: `artist-${Math.random()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: { userId: user.id, displayName: 'Naledi', slug: `naledi-${Math.random()}`, approved },
  });
  const artwork = await prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: 'Quiet Inheritance',
      description: 'x',
      images: [],
      medium: 'Mixed media',
      dimensions: '80x60',
      price: '2600',
      status: 'DRAFT',
    },
  });
  return { artist, artwork };
}

async function makeIntake() {
  return prisma.collectorIntake.create({
    data: { fullName: 'Thandi Mokoena', email: `t-${Math.random()}@test.local` },
  });
}

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.activationAttempt.deleteMany();
  await prisma.memberInvitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.collectorVerification.deleteMany();
  await prisma.collectorIntake.deleteMany();
  await prisma.privateNoteSubmission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();
  signedInAs('ADMIN');
});

describe('authorisation', () => {
  it.each([
    ['an artist', 'ARTIST'],
    ['a collector', 'COLLECTOR'],
  ])('refuses %s and changes nothing', async (_label, role) => {
    const { artist } = await makeArtistWithWork();
    signedInAs(role);

    const result = await setArtistApproval({ artistId: artist.id, approved: true });

    expect(result).toMatchObject({ ok: false, error: 'FORBIDDEN' });
    const after = await prisma.artist.findUniqueOrThrow({ where: { id: artist.id } });
    expect(after.approved).toBe(false);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('refuses an anonymous caller', async () => {
    const { artist } = await makeArtistWithWork();
    signedInAs(null);

    expect(await setArtistApproval({ artistId: artist.id, approved: true })).toMatchObject({
      ok: false,
      error: 'FORBIDDEN',
    });
  });

  it('lets an advisor vet, but not change roles', async () => {
    const { artist } = await makeArtistWithWork();
    const person = await prisma.user.create({
      data: { email: `p-${Math.random()}@test.local`, role: 'COLLECTOR' },
    });
    signedInAs('ADVISOR', 'advisor-1');

    expect(await setArtistApproval({ artistId: artist.id, approved: true })).toMatchObject({
      ok: true,
    });
    // Permissions are an ADMIN concern: an advisor must not be able to promote
    // themselves or anyone else.
    expect(await setUserRole({ userId: person.id, role: 'ADMIN' })).toMatchObject({
      ok: false,
      error: 'FORBIDDEN',
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: person.id } })).role).toBe(
      'COLLECTOR',
    );
  });
});

describe('every action is audited', () => {
  it('records an artist approval', async () => {
    const { artist } = await makeArtistWithWork();

    await setArtistApproval({ artistId: artist.id, approved: true });

    const entry = await prisma.auditLog.findFirstOrThrow();
    expect(entry.action).toBe('artist.approve');
    expect(entry.entityType).toBe('Artist');
    expect(entry.entityId).toBe(artist.id);
    expect(entry.actorId).toBe('admin-1');
    expect(entry.actorRole).toBe('ADMIN');
    expect(entry.before).toEqual({ approved: false });
    expect(entry.after).toEqual({ approved: true });
    expect(entry.ipAddress).toBe('203.0.113.5');
  });

  it('records a release, a verification, an invitation and a role change', async () => {
    const { artist, artwork } = await makeArtistWithWork({ approved: true });
    const intake = await makeIntake();
    const person = await prisma.user.create({
      data: { email: `p-${Math.random()}@test.local`, role: 'COLLECTOR' },
    });

    await setArtworkRelease({ artworkId: artwork.id, release: true });
    await decideCollectorIntake({ intakeId: intake.id, outcome: 'VERIFIED' });
    await inviteCollector({ intakeId: intake.id });
    await setUserRole({ userId: person.id, role: 'ADVISOR' });
    await setArtistApproval({ artistId: artist.id, approved: false });

    const actions = (
      await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' }, select: { action: true } })
    ).map((entry) => entry.action);

    expect(actions).toEqual([
      'artwork.release',
      'intake.decide',
      'membership.invite',
      'user.role',
      'artist.unapprove',
    ]);
  });

  it('does not copy an applicant’s financial answers into the audit trail', async () => {
    const intake = await prisma.collectorIntake.create({
      data: {
        fullName: 'Thandi Mokoena',
        email: `t-${Math.random()}@test.local`,
        annualIncomeBand: 'OVER_5M',
        liquidAssetsBand: 'OVER_25M',
      },
    });

    await decideCollectorIntake({ intakeId: intake.id, outcome: 'VERIFIED' });

    const entry = await prisma.auditLog.findFirstOrThrow();
    const serialised = JSON.stringify(entry);
    expect(serialised).not.toContain('OVER_5M');
    expect(serialised).not.toContain('OVER_25M');
  });
});

describe('vetting rules', () => {
  it('refuses to release work by an unapproved artist', async () => {
    // Otherwise a raw submission reaches members through the back door.
    const { artwork } = await makeArtistWithWork({ approved: false });

    const result = await setArtworkRelease({ artworkId: artwork.id, release: true });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } })).status).toBe(
      'DRAFT',
    );
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('refuses to invite an applicant who has not been verified', async () => {
    const intake = await makeIntake();

    const result = await inviteCollector({ intakeId: intake.id });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.memberInvitation.count()).toBe(0);
  });

  it('issues an invitation whose token is stored only as a hash', async () => {
    const intake = await makeIntake();
    await decideCollectorIntake({ intakeId: intake.id, outcome: 'VERIFIED' });

    const result = await inviteCollector({ intakeId: intake.id });

    expect(result.ok).toBe(true);
    const token = result.ok === true ? result.token : '';
    expect(token.length).toBeGreaterThan(20);

    const invitation = await prisma.memberInvitation.findFirstOrThrow();
    // The plaintext is returned once, to the operator, and never persisted.
    expect(invitation.tokenHash).not.toBe(token);
    expect(invitation.tokenHash).toHaveLength(64);
  });

  it('revokes an invitation', async () => {
    const intake = await makeIntake();
    await decideCollectorIntake({ intakeId: intake.id, outcome: 'VERIFIED' });
    await inviteCollector({ intakeId: intake.id });
    const invitation = await prisma.memberInvitation.findFirstOrThrow();

    await revokeInvitation({ invitationId: invitation.id });

    const after = await prisma.memberInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(after.status).toBe('REVOKED');
    expect(after.revokedAt).not.toBeNull();
  });

  it('refuses to let the last admin demote themselves', async () => {
    // Nothing in this console could put the rights back.
    const me = await prisma.user.create({
      data: { id: 'admin-1', email: `me-${Math.random()}@test.local`, role: 'ADMIN' },
    });

    const result = await setUserRole({ userId: me.id, role: 'COLLECTOR' });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).role).toBe('ADMIN');
  });

  it('reports a missing target rather than writing an audit row', async () => {
    const result = await setArtistApproval({ artistId: 'does-not-exist', approved: true });

    expect(result).toMatchObject({ ok: false, error: 'NOT_FOUND' });
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
