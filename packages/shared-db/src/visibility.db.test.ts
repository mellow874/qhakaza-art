import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './client';

/**
 * Adversarial visibility tests.
 *
 * Section 2.4 asks for attempts at unauthorised access that assert failure, so
 * these are written from the attacker's side: each sets up a work that SHOULD
 * be invisible and proves the database refuses it, rather than checking that
 * the happy path works.
 *
 * They connect as `qhakaza_app` - the non-owner, NOBYPASSRLS role the
 * applications use. Running them on the owner connection would pass while
 * proving nothing.
 */

const OWNER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';

const app = new PrismaClient({
  datasourceUrl: OWNER_URL.replace('qhakaza:qhakaza@', 'qhakaza_app:qhakaza_app@'),
});

async function as<T>(role: string, userId: string, run: (tx: PrismaClient) => Promise<T>) {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('qhakaza.role', ${role}, true), set_config('qhakaza.user_id', ${userId}, true)`;
    return run(tx as unknown as PrismaClient);
  });
}

/** Anonymous: no actor declared at all, which is what the public site is. */
function anonymously<T>(run: (tx: PrismaClient) => Promise<T>) {
  return run(app);
}

afterAll(() => app.$disconnect());

const rand = () => Math.random().toString(36).slice(2, 10);

async function makeArtist(approved = true) {
  const user = await prisma.user.create({
    data: { email: `a-${rand()}@test.local`, role: 'ARTIST' },
  });
  return prisma.artist.create({
    data: { userId: user.id, displayName: 'Artist', slug: `s-${rand()}`, approved },
  });
}

async function makeCollector() {
  const user = await prisma.user.create({
    data: { email: `c-${rand()}@test.local`, role: 'COLLECTOR' },
  });
  const intake = await prisma.collectorIntake.create({
    data: { fullName: 'A Collector', email: user.email },
  });
  const membership = await prisma.membership.create({
    data: { intakeId: intake.id, userId: user.id, status: 'ACTIVE' },
  });
  return { userId: user.id, membershipId: membership.id };
}

async function makeWork(artistId: string, status: string) {
  return prisma.artwork.create({
    data: {
      artistId,
      title: `Work ${rand()}`,
      description: '',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1000,
      status: status as 'DRAFT',
    },
  });
}

async function makeAudience(membershipIds: string[]) {
  const audience = await prisma.audience.create({ data: { name: `Audience ${rand()}` } });
  for (const membershipId of membershipIds) {
    await prisma.audienceMember.create({ data: { audienceId: audience.id, membershipId } });
  }
  return audience;
}

function permit(artistId: string, kind: string, granted = true) {
  return prisma.artistPermission.create({
    data: { artistId, kind: kind as 'PUBLISH_PUBLICLY', granted },
  });
}

beforeEach(async () => {
  await prisma.artworkRelease.deleteMany();
  await prisma.audienceMember.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.artistPermission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.collectorIntake.deleteMany();
  await prisma.user.deleteMany();
});

describe('approval is not publication', () => {
  it('shows the public NOTHING of an approved work', async () => {
    // The defect this phase exists to remove: approving used to publish.
    const artist = await makeArtist();
    await makeWork(artist.id, 'APPROVED');

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('shows the public nothing of a COLLECTOR_READY work', async () => {
    const artist = await makeArtist();
    await makeWork(artist.id, 'COLLECTOR_READY');

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('shows the public nothing even when a work is released to collectors', async () => {
    // Released to a collector audience is emphatically not released publicly.
    const artist = await makeArtist();
    const collector = await makeCollector();
    const work = await makeWork(artist.id, 'RELEASED_TO_AUDIENCE');
    const audience = await makeAudience([collector.membershipId]);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
    });

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });
});

describe('the public sees a work only with editorial release AND permission', () => {
  async function editorialWork({ permission = true, release = true } = {}) {
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'PUBLIC_EDITORIAL');
    const audience = await makeAudience([]);

    if (permission) await permit(artist.id, 'PUBLISH_PUBLICLY');
    if (release) {
      await prisma.artworkRelease.create({
        data: { artworkId: work.id, audienceId: audience.id, tier: 'PUBLIC_EDITORIAL' },
      });
    }
    return work;
  }

  it('shows it when both hold', async () => {
    const work = await editorialWork();

    const seen = await anonymously((tx) => tx.artwork.findMany());
    expect(seen.map((w) => w.id)).toEqual([work.id]);
  });

  it('hides it without the artist permission, however it is released', async () => {
    // A work whose artist never agreed to public use cannot be published by
    // anyone, at any level of approval.
    await editorialWork({ permission: false });

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('hides it without a release, however permitted', async () => {
    await editorialWork({ release: false });

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('hides it again the moment the release is revoked', async () => {
    const work = await editorialWork();

    await prisma.artworkRelease.updateMany({
      where: { artworkId: work.id },
      data: { revokedAt: new Date() },
    });

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('hides it if the artist is not approved', async () => {
    const artist = await makeArtist(false);
    const work = await makeWork(artist.id, 'PUBLIC_EDITORIAL');
    const audience = await makeAudience([]);
    await permit(artist.id, 'PUBLISH_PUBLICLY');
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PUBLIC_EDITORIAL' },
    });

    expect(await anonymously((tx) => tx.artwork.findMany())).toEqual([]);
  });
});

describe('collectors see only what was released to them', () => {
  async function placedWith(membershipIds: string[]) {
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'RELEASED_TO_AUDIENCE');
    const audience = await makeAudience(membershipIds);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
    });
    return work;
  }

  it('shows a collector the work placed with them', async () => {
    const collector = await makeCollector();
    const work = await placedWith([collector.membershipId]);

    const seen = await as('collector', collector.userId, (tx) => tx.artwork.findMany());
    expect(seen.map((w) => w.id)).toEqual([work.id]);
  });

  it('shows ANOTHER collector nothing of it', async () => {
    // The headline defect: every member used to see the same pool.
    const mine = await makeCollector();
    const theirs = await makeCollector();
    await placedWith([mine.membershipId]);

    expect(await as('collector', theirs.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('stops showing it once the collector leaves the audience', async () => {
    const collector = await makeCollector();
    await placedWith([collector.membershipId]);

    await prisma.audienceMember.updateMany({
      where: { membershipId: collector.membershipId },
      data: { removedAt: new Date() },
    });

    expect(await as('collector', collector.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('stops showing it once the membership is no longer active', async () => {
    const collector = await makeCollector();
    await placedWith([collector.membershipId]);

    await prisma.membership.update({
      where: { id: collector.membershipId },
      data: { status: 'REVOKED' },
    });

    expect(await as('collector', collector.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('stops showing it the moment the release is revoked', async () => {
    const collector = await makeCollector();
    const work = await placedWith([collector.membershipId]);

    await prisma.artworkRelease.updateMany({
      where: { artworkId: work.id },
      data: { revokedAt: new Date() },
    });

    expect(await as('collector', collector.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('refuses without the artist permission to share privately', async () => {
    const collector = await makeCollector();
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'RELEASED_TO_AUDIENCE');
    const audience = await makeAudience([collector.membershipId]);
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
    });

    expect(await as('collector', collector.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });

  it('does not accept a public editorial release as a collector release', async () => {
    // The two tiers are different permissions, not degrees of the same one.
    const collector = await makeCollector();
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'PUBLIC_EDITORIAL');
    const audience = await makeAudience([collector.membershipId]);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PUBLIC_EDITORIAL' },
    });

    expect(await as('collector', collector.userId, (tx) => tx.artwork.findMany())).toEqual([]);
  });
});

describe('the four questions are answerable from rows, not inferred', () => {
  it('says where a work is visible, to whom, why, and which version', async () => {
    const artist = await makeArtist();
    const collector = await makeCollector();
    const work = await makeWork(artist.id, 'RELEASED_TO_AUDIENCE');
    const audience = await makeAudience([collector.membershipId]);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    await prisma.artworkRelease.create({
      data: {
        artworkId: work.id,
        audienceId: audience.id,
        tier: 'PRIVATE_COLLECTOR_PROJECTION',
        reason: 'Matches a stated interest in mixed media',
        versionLabel: 'collector-projection-v1',
      },
    });

    const release = await prisma.artworkRelease.findFirstOrThrow({
      where: { artworkId: work.id },
      include: { audience: { include: { members: true } } },
    });

    expect(release.tier).toBe('PRIVATE_COLLECTOR_PROJECTION'); // where
    expect(release.audience.members).toHaveLength(1); // who
    expect(release.reason).toContain('mixed media'); // why
    expect(release.versionLabel).toBe('collector-projection-v1'); // which version
  });
});

describe('collectors cannot read the distribution itself', () => {
  it('shows a collector no releases, audiences or permissions', async () => {
    const collector = await makeCollector();
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'RELEASED_TO_AUDIENCE');
    const audience = await makeAudience([collector.membershipId]);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS');
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
    });

    // They may see the work. They may not see who else holds it, or why.
    expect(await as('collector', collector.userId, (tx) => tx.artworkRelease.findMany())).toEqual(
      [],
    );
    expect(await as('collector', collector.userId, (tx) => tx.audience.findMany())).toEqual([]);
    expect(await as('collector', collector.userId, (tx) => tx.audienceMember.findMany())).toEqual(
      [],
    );
    expect(await as('collector', collector.userId, (tx) => tx.artistPermission.findMany())).toEqual(
      [],
    );
  });
});
