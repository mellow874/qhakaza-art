import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './client';
import { artworkPermissionGranted, decidePermission, type PermissionRow } from './permission';

/**
 * The permission conflict rule: MORE RESTRICTIVE WINS.
 *
 * WHY THIS FILE IS ADVERSARIAL RATHER THAN ILLUSTRATIVE.
 *
 * The rule was written out by hand in four places and all four had the same
 * bug: they tested `EXISTS(granted = true)` and never consulted denials, so an
 * artist-wide grant answered for a work-specific refusal and the work was shown
 * anyway. Every existing test passed throughout, because every existing test
 * asked "does a permitted work appear" and none asked "does a REFUSED one stay
 * hidden when something else was permitted".
 *
 * So the cases below are built the other way round: each sets up a permission
 * state that SHOULD hide the work and proves it is hidden.
 *
 * There are now three statements of the rule - `decidePermission`,
 * `artworkPermissionGranted` and the SQL `qhakaza_permission_granted()` - and
 * the last block here asserts all three agree on every combination, so they
 * cannot drift apart the way the four hand-written copies did.
 */

const OWNER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';

const app = new PrismaClient({
  datasourceUrl: OWNER_URL.replace('qhakaza:qhakaza@', 'qhakaza_app:qhakaza_app@'),
});

afterAll(() => app.$disconnect());

const rand = () => Math.random().toString(36).slice(2, 10);

async function makeArtist() {
  const user = await prisma.user.create({
    data: { email: `a-${rand()}@test.local`, role: 'ARTIST' },
  });
  return prisma.artist.create({
    data: { userId: user.id, displayName: 'Artist', slug: `s-${rand()}`, approved: true },
  });
}

async function makeWork(artistId: string, status = 'COLLECTOR_READY') {
  return prisma.artwork.create({
    data: {
      artistId,
      title: `Work ${rand()}`,
      description: '',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1000,
      status: status as 'COLLECTOR_READY',
    },
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

/** Place a work with a collector, bypassing the permission check entirely. */
async function place(artworkId: string, membershipId: string) {
  const audience = await prisma.audience.create({ data: { name: `Aud ${rand()}` } });
  await prisma.audienceMember.create({ data: { audienceId: audience.id, membershipId } });
  await prisma.artwork.update({
    where: { id: artworkId },
    data: { status: 'RELEASED_TO_AUDIENCE' },
  });
  return prisma.artworkRelease.create({
    data: { artworkId, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
  });
}

function permit(
  artistId: string,
  kind: string,
  granted: boolean,
  artworkId: string | null = null,
  expiresAt: Date | null = null,
) {
  return prisma.artistPermission.create({
    data: { artistId, artworkId, kind: kind as 'PUBLISH_PUBLICLY', granted, expiresAt },
  });
}

/** Ask the database function directly. */
async function sqlSaysGranted(artistId: string, artworkId: string | null, kind: string) {
  const rows = await prisma.$queryRawUnsafe<{ granted: boolean }[]>(
    `SELECT qhakaza_permission_granted($1, $2, $3::"PermissionKind") AS granted`,
    artistId,
    artworkId,
    kind,
  );
  return rows[0].granted;
}

async function collectorSees(userId: string) {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('qhakaza.role', 'collector', true), set_config('qhakaza.user_id', ${userId}, true)`;
    return tx.artwork.findMany({ select: { id: true } });
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

// ---------------------------------------------------------------------------

describe('the defect: a specific refusal against a general grant', () => {
  it('HIDES a work the artist denied, despite an artist-wide grant', async () => {
    /*
     * THE EXACT CASE THAT WAS BROKEN.
     *
     * The artist permits private sharing of their work in general, then asks
     * for one particular piece to be held back. Before the fix the general
     * grant satisfied the EXISTS on its own, the specific denial was never
     * read, and the collector was shown the work anyway.
     */
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', true); // artist-wide grant
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', false, work.id); // this one, no

    expect(await collectorSees(collector.userId)).toEqual([]);
  });

  it('still shows OTHER works by the same artist', async () => {
    // The denial is about one work. It must not become a blanket withdrawal,
    // or the fix would be as wrong as the defect in the other direction.
    const artist = await makeArtist();
    const refused = await makeWork(artist.id);
    const allowed = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(refused.id, collector.membershipId);
    await place(allowed.id, collector.membershipId);

    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', true);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', false, refused.id);

    expect(await collectorSees(collector.userId)).toEqual([{ id: allowed.id }]);
  });

  it('hides a work under an artist-wide denial even with a work-specific grant', async () => {
    /*
     * The other direction, and the reason "more restrictive wins" was chosen
     * over "the more specific row wins". Specificity-wins would let a narrow
     * grant override a blanket refusal, which is the case where being wrong
     * costs the most.
     */
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', false);
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', true, work.id);

    expect(await collectorSees(collector.userId)).toEqual([]);
  });

  it('shows a work permitted specifically when nothing denies it', async () => {
    // The happy path still works. Worth asserting: a "fix" that hid
    // everything would pass every test above.
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', true, work.id);

    expect(await collectorSees(collector.userId)).toEqual([{ id: work.id }]);
  });

  it('hides a work with no permission at all', async () => {
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    expect(await collectorSees(collector.userId)).toEqual([]);
  });
});

describe('expiry', () => {
  it('hides a work once the grant has lapsed', async () => {
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(
      artist.id,
      'SHARE_PRIVATELY_WITH_COLLECTORS',
      true,
      null,
      new Date(Date.now() - 60_000),
    );

    expect(await collectorSees(collector.userId)).toEqual([]);
  });

  it('shows a work while the grant is still live', async () => {
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(
      artist.id,
      'SHARE_PRIVATELY_WITH_COLLECTORS',
      true,
      null,
      new Date(Date.now() + 3_600_000),
    );

    expect(await collectorSees(collector.userId)).toEqual([{ id: work.id }]);
  });

  it('treats a lapsed grant as absent rather than as a refusal', async () => {
    /*
     * The distinction matters for what staff are told. An expired permission
     * means "ask again"; a denial means "they said no". A second, live grant
     * therefore still carries the work.
     */
    const artist = await makeArtist();
    const work = await makeWork(artist.id);
    const collector = await makeCollector();
    await place(work.id, collector.membershipId);

    await permit(
      artist.id,
      'SHARE_PRIVATELY_WITH_COLLECTORS',
      true,
      null,
      new Date(Date.now() - 60_000),
    );
    await permit(artist.id, 'SHARE_PRIVATELY_WITH_COLLECTORS', true, work.id);

    expect(await collectorSees(collector.userId)).toEqual([{ id: work.id }]);
  });
});

describe('publication obeys the same rule', () => {
  it('keeps a specifically-refused work off the public site', async () => {
    const artist = await makeArtist();
    const work = await makeWork(artist.id, 'PUBLIC_EDITORIAL');
    const audience = await prisma.audience.create({ data: { name: `Ed ${rand()}` } });
    await prisma.artworkRelease.create({
      data: { artworkId: work.id, audienceId: audience.id, tier: 'PUBLIC_EDITORIAL' },
    });

    await permit(artist.id, 'PUBLISH_PUBLICLY', true);
    await permit(artist.id, 'PUBLISH_PUBLICLY', false, work.id);

    // Anonymous: no actor declared at all, which is what the public site is.
    expect(await app.artwork.findMany()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe('the three statements of the rule agree', () => {
  /*
   * Every combination of (artist-wide row, work-specific row), each of which
   * may be absent, granting or denying: nine cases. Checked against all three
   * implementations.
   *
   * This is the test that makes the duplication safe. Without it there is
   * nothing stopping the SQL and the TypeScript drifting, which is precisely
   * how the original four copies came to disagree with the intent.
   */
  type Setting = 'absent' | 'grant' | 'deny';
  const settings: Setting[] = ['absent', 'grant', 'deny'];

  const expected: Record<string, boolean> = {
    'absent/absent': false,
    'absent/grant': true,
    'absent/deny': false,
    'grant/absent': true,
    'grant/grant': true,
    'grant/deny': false, // the defect
    'deny/absent': false,
    'deny/grant': false, // restrictive wins
    'deny/deny': false,
  };

  for (const wide of settings) {
    for (const specific of settings) {
      const key = `${wide}/${specific}`;

      it(`artist-wide ${wide}, work-specific ${specific} -> ${expected[key]}`, async () => {
        const artist = await makeArtist();
        const work = await makeWork(artist.id);
        const kind = 'SHARE_PRIVATELY_WITH_COLLECTORS';

        const rows: PermissionRow[] = [];
        if (wide !== 'absent') {
          await permit(artist.id, kind, wide === 'grant');
          rows.push({ artworkId: null, granted: wide === 'grant', expiresAt: null });
        }
        if (specific !== 'absent') {
          await permit(artist.id, kind, specific === 'grant', work.id);
          rows.push({ artworkId: work.id, granted: specific === 'grant', expiresAt: null });
        }

        const want = expected[key];

        // 1. The pure function, used by the release action.
        expect(decidePermission(rows, work.id)).toBe(want);

        // 2. The SQL function, used by every RLS policy.
        expect(await sqlSaysGranted(artist.id, work.id, kind)).toBe(want);

        // 3. The Prisma predicate, used by the app queries.
        const found = await prisma.artwork.findMany({
          where: { id: work.id, ...artworkPermissionGranted(kind) },
          select: { id: true },
        });
        expect(found.length === 1).toBe(want);
      });
    }
  }
});
