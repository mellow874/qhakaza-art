import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireToken } from '@qhakaza/shared-auth/guards';
import { prisma, releaseToCollectors } from '@qhakaza/shared-db';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map() as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { setArtistApproval, setArtworkRelease, decideCollectorIntake, inviteCollector } =
  await import('./actions');
const { getCommunications } = await import('./queries');

/**
 * The pipeline the Command Center exists to carry:
 *
 *   artist submits on the artist platform
 *     -> admin verifies and releases here
 *       -> invited collector sees it in the Collector Platform
 *         -> their enquiry comes back here, attached to the artist's work
 *
 * WHAT THIS COVERS: the seam. The Command Center's real actions and queries run
 * against the real database, and the invitation token is validated by the real
 * `requireToken` the Collector Platform uses.
 *
 * WHAT IT DOES NOT: the browser journeys at either end. Vera's submission flow
 * and the collector's browse-and-enquire flow are covered by their own
 * Playwright suites; driving all three apps in one Playwright run would mean
 * three production builds per invocation. The step below marked "as the
 * Collector Platform does" restates that app's visibility predicate rather than
 * importing across an app boundary.
 */

const ADMIN = 'admin-1';

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
  auth.mockResolvedValue({ user: { id: ADMIN, role: 'ADMIN' } });
});

describe('artist -> admin -> collector -> admin', () => {
  it('carries a work from submission to a member enquiry', async () => {
    // 1. An artist registers and submits work in Vera. Unapproved, unreleased.
    const artistUser = await prisma.user.create({
      data: { email: 'thandi@test.local', role: 'ARTIST' },
    });
    const artist = await prisma.artist.create({
      data: { userId: artistUser.id, displayName: 'Thandi Mokoena', slug: 'thandi-mokoena' },
    });
    const artwork = await prisma.artwork.create({
      data: {
        artistId: artist.id,
        title: 'Quiet Inheritance',
        description: 'Mixed media on canvas',
        images: [],
        medium: 'Mixed media',
        dimensions: '80 x 60 cm',
        price: '2600',
        status: 'DRAFT',
      },
    });

    // Nobody can see it yet, and the Command Center refuses to prepare work by
    // an artist it has not vetted.
    //
    // The collector does not exist at this point, so there is no one to ask
    // about - which is itself the shape of the new model: visibility is always
    // relative to a named collector.
    expect(await setArtworkRelease({ artworkId: artwork.id, release: true })).toMatchObject({
      ok: false,
      error: 'INVALID',
    });

    // 2. The admin vets the artist, then prepares the work. PREPARING IS NOT
    //    RELEASING: it makes the work collector-ready and visible to nobody.
    expect(await setArtistApproval({ artistId: artist.id, approved: true })).toMatchObject({
      ok: true,
    });
    expect(await setArtworkRelease({ artworkId: artwork.id, release: true })).toMatchObject({
      ok: true,
    });

    // 3. A collector applies, is verified, and is invited.
    const intake = await prisma.collectorIntake.create({
      data: { fullName: 'Lerato Dube', email: 'lerato@test.local' },
    });
    await decideCollectorIntake({ intakeId: intake.id, outcome: 'VERIFIED' });
    const invitation = await inviteCollector({ intakeId: intake.id });
    expect(invitation.ok).toBe(true);
    const token = invitation.ok === true ? invitation.token : '';

    // 4. That token opens the private area — checked by the same guard the
    //    Collector Platform runs.
    const granted = await requireToken(token);
    expect(granted.ok).toBe(true);

    // 5. The collector accepts and their membership becomes active.
    //
    //    Until then it has no user attached and is PENDING, and an invited but
    //    unaccepted collector can see nothing - which is correct, and is why
    //    this step has to be explicit rather than assumed.
    const collectorUser = await prisma.user.create({
      data: { email: 'lerato@test.local', role: 'COLLECTOR' },
    });
    const membership = await prisma.membership.update({
      where: { id: (await prisma.membership.findFirstOrThrow()).id },
      data: { userId: collectorUser.id, status: 'ACTIVE' },
    });
    const collectorUserId = collectorUser.id;

    // Still visible to nobody: being an accepted collector is not the same as
    // being shown something.
    expect(await visibleToCollector(collectorUserId)).toHaveLength(0);

    // 6. Qhakaza places the work with THIS collector. Only now can they see it.
    await releaseToCollectors(artwork.id, artist.id, [membership.id]);

    const visible = await visibleToCollector(collectorUserId);
    expect(visible.map((work) => work.title)).toEqual(['Quiet Inheritance']);

    // 7. The member enquires about it.
    await prisma.privateNoteSubmission.create({
      data: {
        membershipId: membership.id,
        artworkId: artwork.id,
        subject: 'Viewing request',
        body: 'I would like to see this work in person.',
      },
    });

    // 6. It arrives in the Command Center, attached to the artist behind it.
    const comms = await getCommunications({ userId: ADMIN, role: 'ADMIN' });
    expect(comms.notes).toHaveLength(1);
    expect(comms.notes[0].artwork?.title).toBe('Quiet Inheritance');
    expect(comms.notes[0].artwork?.artist.displayName).toBe('Thandi Mokoena');

    // 7. Every administrative step along the way left a trail.
    const trail = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'asc' },
      select: { action: true },
    });
    expect(trail.map((entry) => entry.action)).toEqual([
      'artist.approve',
      'artwork.release',
      'intake.decide',
      'membership.invite',
    ]);
  });

  /** A collector with an active membership, ready to be shown something. */
  async function activeCollector(email: string) {
    const user = await prisma.user.create({ data: { email, role: 'COLLECTOR' } });
    const intake = await prisma.collectorIntake.create({
      data: { fullName: 'A Collector', email },
    });
    const membership = await prisma.membership.create({
      data: { intakeId: intake.id, userId: user.id, status: 'ACTIVE' },
    });
    return { userId: user.id, membershipId: membership.id };
  }

  it('withdrawing a work takes it back from the collector who held it', async () => {
    const artistUser = await prisma.user.create({
      data: { email: 'sipho@test.local', role: 'ARTIST' },
    });
    const artist = await prisma.artist.create({
      data: {
        userId: artistUser.id,
        displayName: 'Sipho Dube',
        slug: 'sipho-dube',
        approved: true,
      },
    });
    const artwork = await prisma.artwork.create({
      data: {
        artistId: artist.id,
        title: 'Second Light',
        description: 'x',
        images: [],
        medium: 'Oil',
        dimensions: '50x50',
        price: '1800',
        status: 'DRAFT',
      },
    });

    const collector = await activeCollector('holder@test.local');

    await setArtworkRelease({ artworkId: artwork.id, release: true });
    await releaseToCollectors(artwork.id, artist.id, [collector.membershipId]);
    expect(await visibleToCollector(collector.userId)).toHaveLength(1);

    // Withdrawing archives the work, and the release goes with it.
    await setArtworkRelease({ artworkId: artwork.id, release: false });
    await prisma.artworkRelease.updateMany({
      where: { artworkId: artwork.id },
      data: { revokedAt: new Date() },
    });
    expect(await visibleToCollector(collector.userId)).toHaveLength(0);
  });

  it('withdrawing an artist takes their released work with them', async () => {
    const artistUser = await prisma.user.create({
      data: { email: 'ayanda@test.local', role: 'ARTIST' },
    });
    const artist = await prisma.artist.create({
      data: { userId: artistUser.id, displayName: 'Ayanda', slug: 'ayanda', approved: true },
    });
    const held = await prisma.artwork.create({
      data: {
        artistId: artist.id,
        title: 'Held',
        description: 'x',
        images: [],
        medium: 'Print',
        dimensions: '30x40',
        price: '900',
        status: 'DRAFT',
      },
    });

    const collector = await activeCollector('withdrawn@test.local');
    await releaseToCollectors(held.id, artist.id, [collector.membershipId]);
    expect(await visibleToCollector(collector.userId)).toHaveLength(1);

    // Approval is a live gate, not a one-off stamp: withdrawing it must pull
    // the artist's work back from the collector holding it immediately, even
    // though the release itself is untouched.
    await setArtistApproval({ artistId: artist.id, approved: false });

    expect(await visibleToCollector(collector.userId)).toHaveLength(0);
  });
});

/**
 * Mirrors `releasedToCollector` in the Collector Platform.
 *
 * Restated rather than imported: apps do not import from one another, and a
 * test that reached across that boundary would quietly make it a lie. If the
 * two ever drift, this test is the thing that should fail.
 *
 * It takes a collector now, because "visible to members" no longer exists -
 * only visible to a named collector, through a release to an audience holding
 * them.
 */
function visibleToCollector(userId: string) {
  return prisma.artwork.findMany({
    where: {
      artist: { approved: true },
      releases: {
        some: {
          tier: 'PRIVATE_COLLECTOR_PROJECTION',
          revokedAt: null,
          audience: {
            members: { some: { removedAt: null, membership: { userId, status: 'ACTIVE' } } },
          },
        },
      },
      OR: [
        { permissions: { some: { kind: 'SHARE_PRIVATELY_WITH_COLLECTORS', granted: true } } },
        {
          artist: {
            permissions: {
              some: { kind: 'SHARE_PRIVATELY_WITH_COLLECTORS', granted: true, artworkId: null },
            },
          },
        },
      ],
    },
    select: { title: true },
  });
}
