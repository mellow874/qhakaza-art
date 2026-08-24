import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  createAudience,
  releaseArtwork,
  revokeRelease,
  setAudienceMembership,
  suggestCollectorsFor,
  syncCollectorProfile,
} = await import('./actions');

/**
 * Placing work with collectors.
 *
 * The release action is the only thing in the platform that changes who can
 * see something, so most of these are about what it REFUSES.
 */

let adminId = '';
const rand = () => Math.random().toString(36).slice(2, 8);

async function makeArtwork(status = 'COLLECTOR_READY') {
  const user = await prisma.user.create({
    data: { email: `artist-${rand()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: { userId: user.id, displayName: 'Artist', slug: `a-${rand()}`, approved: true },
  });
  const artwork = await prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: 'A work',
      description: '',
      images: [],
      medium: 'Photography',
      dimensions: '1x1',
      price: 1000,
      themes: ['memory'],
      status: status as 'COLLECTOR_READY',
    },
  });
  return { artist, artwork };
}

async function makeCollector(mediums: string[] = ['Photography']) {
  const user = await prisma.user.create({
    data: { email: `c-${rand()}@test.local`, role: 'COLLECTOR' },
  });
  const intake = await prisma.collectorIntake.create({
    data: { fullName: 'A Collector', email: user.email, preferredMediums: mediums },
  });
  const membership = await prisma.membership.create({
    data: { intakeId: intake.id, userId: user.id, status: 'ACTIVE' },
  });
  return { userId: user.id, membershipId: membership.id, email: user.email };
}

function permit(artistId: string, kind: string) {
  return prisma.artistPermission.create({
    data: { artistId, kind: kind as 'PUBLISH_PUBLICLY', granted: true },
  });
}

beforeEach(async () => {
  await prisma.matchSuggestion.deleteMany();
  await prisma.collectorProfile.deleteMany();
  await prisma.artworkRelease.deleteMany();
  await prisma.audienceMember.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.artistPermission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.privateNote.deleteMany();
  await prisma.collectorIntake.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: `admin-${rand()}@test.local`, role: 'ADMIN' },
  });
  adminId = admin.id;
  auth.mockResolvedValue({ user: { id: adminId, role: 'ADMIN' } });
});

describe('releaseArtwork', () => {
  it('refuses without the artist permission, however approved the work', async () => {
    // The permission is the artist's. No amount of internal approval
    // substitutes for it.
    const { artwork } = await makeArtwork();
    const created = await createAudience({ name: 'One collector' });
    if (!created.ok) throw new Error('setup failed');

    const result = await releaseArtwork({ artworkId: artwork.id, audienceId: created.audienceId });

    expect(result.ok).toBe(false);
    expect(await prisma.artworkRelease.count()).toBe(0);
  });

  it('places the work once the artist has permitted private sharing', async () => {
    const { artist, artwork } = await makeArtwork();
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    const created = await createAudience({ name: 'One collector' });
    if (!created.ok) throw new Error('setup failed');

    const result = await releaseArtwork({
      artworkId: artwork.id,
      audienceId: created.audienceId,
      reason: 'Matches a stated interest',
    });

    expect(result.ok).toBe(true);
    const release = await prisma.artworkRelease.findFirstOrThrow();
    expect(release.tier).toBe('PRIVATE_COLLECTOR_PROJECTION');
    expect(release.reason).toBe('Matches a stated interest');
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } })).status).toBe(
      'RELEASED_TO_AUDIENCE',
    );
  });

  it('refuses a public release when only private sharing was permitted', async () => {
    // Permitting a private showing is not permitting publication.
    const { artist, artwork } = await makeArtwork();
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    const created = await createAudience({ name: 'Editorial' });
    if (!created.ok) throw new Error('setup failed');

    const result = await releaseArtwork({
      artworkId: artwork.id,
      audienceId: created.audienceId,
      tier: 'PUBLIC_EDITORIAL',
    });

    expect(result.ok).toBe(false);
    expect(await prisma.artworkRelease.count()).toBe(0);
  });

  it.each(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED', 'ARCHIVED'])(
    'refuses to place a work that is %s',
    async (status) => {
      const { artist, artwork } = await makeArtwork(status);
      await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
      const created = await createAudience({ name: 'Anyone' });
      if (!created.ok) throw new Error('setup failed');

      expect(
        (await releaseArtwork({ artworkId: artwork.id, audienceId: created.audienceId })).ok,
      ).toBe(false);
    },
  );

  it('records the release in the audit trail', async () => {
    const { artist, artwork } = await makeArtwork();
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    const created = await createAudience({ name: 'One collector' });
    if (!created.ok) throw new Error('setup failed');

    await releaseArtwork({ artworkId: artwork.id, audienceId: created.audienceId });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: 'artwork.release' } });
    expect(entry.entityId).toBe(artwork.id);
  });

  it('refuses a caller who is not staff', async () => {
    const { artist, artwork } = await makeArtwork();
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    const created = await createAudience({ name: 'One collector' });
    if (!created.ok) throw new Error('setup failed');

    auth.mockResolvedValue({ user: { id: 'someone', role: 'COLLECTOR' } });

    expect((await releaseArtwork({ artworkId: artwork.id, audienceId: created.audienceId })).ok).toBe(
      false,
    );
  });
});

describe('revokeRelease', () => {
  it('marks the release revoked rather than deleting it', async () => {
    // Who could see what, and when, is provenance.
    const { artist, artwork } = await makeArtwork();
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    const created = await createAudience({ name: 'One collector' });
    if (!created.ok) throw new Error('setup failed');
    await releaseArtwork({ artworkId: artwork.id, audienceId: created.audienceId });

    const release = await prisma.artworkRelease.findFirstOrThrow();
    await revokeRelease({ releaseId: release.id });

    const after = await prisma.artworkRelease.findUniqueOrThrow({ where: { id: release.id } });
    expect(after.revokedAt).not.toBeNull();
    expect(await prisma.artworkRelease.count()).toBe(1);
  });
});

describe('setAudienceMembership', () => {
  it('adds and removes without ever holding two rows for one person', async () => {
    const collector = await makeCollector();
    const created = await createAudience({ name: 'Segment' });
    if (!created.ok) throw new Error('setup failed');

    const args = { audienceId: created.audienceId, membershipId: collector.membershipId };
    await setAudienceMembership({ ...args, member: true });
    await setAudienceMembership({ ...args, member: false });
    await setAudienceMembership({ ...args, member: true });

    const rows = await prisma.audienceMember.findMany({ where: args });
    expect(rows).toHaveLength(1);
    expect(rows[0].removedAt).toBeNull();
  });

  it('records a removal rather than deleting the row', async () => {
    const collector = await makeCollector();
    const created = await createAudience({ name: 'Segment' });
    if (!created.ok) throw new Error('setup failed');

    const args = { audienceId: created.audienceId, membershipId: collector.membershipId };
    await setAudienceMembership({ ...args, member: true });
    await setAudienceMembership({ ...args, member: false });

    const row = await prisma.audienceMember.findFirstOrThrow({ where: args });
    expect(row.removedAt).not.toBeNull();
  });
});

describe('syncCollectorProfile', () => {
  it('builds a profile from the intake without inventing anything', async () => {
    const collector = await makeCollector(['Photography', 'Print']);

    expect((await syncCollectorProfile({ membershipId: collector.membershipId })).ok).toBe(true);

    const profile = await prisma.collectorProfile.findUniqueOrThrow({
      where: { membershipId: collector.membershipId },
    });
    expect(profile.mediums).toEqual(expect.arrayContaining(['Photography', 'Print']));
    expect(profile.themes).toEqual([]); // nothing said, nothing recorded
    expect(profile.sourcedFrom).toContain('intake');
  });

  it('folds in the Private Note when one exists', async () => {
    const collector = await makeCollector(['Painting']);
    await prisma.privateNote.create({
      data: {
        fullName: 'A Collector',
        email: collector.email,
        mediums: ['Photography'],
        regions: ['West Africa'],
        subjects: 'memory, migration',
      },
    });

    await syncCollectorProfile({ membershipId: collector.membershipId });

    const profile = await prisma.collectorProfile.findUniqueOrThrow({
      where: { membershipId: collector.membershipId },
    });
    expect(profile.themes).toEqual(['memory', 'migration']);
    expect(profile.sourcedFrom).toContain('private-note');
  });

  it('refreshes rather than duplicating when run again', async () => {
    const collector = await makeCollector();

    await syncCollectorProfile({ membershipId: collector.membershipId });
    await syncCollectorProfile({ membershipId: collector.membershipId });

    expect(await prisma.collectorProfile.count()).toBe(1);
  });
});

describe('suggestCollectorsFor', () => {
  it('suggests a collector whose stated preferences overlap', async () => {
    const { artwork } = await makeArtwork();
    const collector = await makeCollector(['Photography']);
    await syncCollectorProfile({ membershipId: collector.membershipId });

    const suggestions = await suggestCollectorsFor(artwork.id);

    expect(suggestions.map((s) => s.collector.membershipId)).toEqual([collector.membershipId]);
    expect(suggestions[0].rationale).toContain('Photography');
  });

  it('suggests nobody when nothing overlaps', async () => {
    const { artwork } = await makeArtwork();
    const collector = await makeCollector(['Sculpture']);
    await syncCollectorProfile({ membershipId: collector.membershipId });

    expect(await suggestCollectorsFor(artwork.id)).toEqual([]);
  });

  it('NEVER releases anything', async () => {
    // The system suggests; the admin decides. If this ever fails, the platform
    // has started placing work with people on its own.
    const { artwork } = await makeArtwork();
    const collector = await makeCollector(['Photography']);
    await syncCollectorProfile({ membershipId: collector.membershipId });

    await suggestCollectorsFor(artwork.id);

    expect(await prisma.artworkRelease.count()).toBe(0);
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } })).status).toBe(
      'COLLECTOR_READY',
    );
  });
});
