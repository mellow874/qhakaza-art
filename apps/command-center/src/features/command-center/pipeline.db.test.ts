import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireToken } from '@qhakaza/shared-auth/guards';
import { prisma } from '@qhakaza/shared-db';

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
 *   artist submits in Vera
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

    // A member could not see it yet, and the Command Center refuses to release
    // work by an artist it has not vetted.
    expect(await visibleToMembers()).toHaveLength(0);
    expect(await setArtworkRelease({ artworkId: artwork.id, release: true })).toMatchObject({
      ok: false,
      error: 'INVALID',
    });

    // 2. The admin vets the artist, then releases the work.
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

    // ...and the released work is now what a member sees.
    const visible = await visibleToMembers();
    expect(visible.map((work) => work.title)).toEqual(['Quiet Inheritance']);

    // 5. The member enquires about it.
    const membership = await prisma.membership.findFirstOrThrow();
    await prisma.privateNoteSubmission.create({
      data: {
        membershipId: membership.id,
        artworkId: artwork.id,
        subject: 'Viewing request',
        body: 'I would like to see this work in person.',
      },
    });

    // 6. It arrives in the Command Center, attached to the artist behind it.
    const comms = await getCommunications();
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

  it('withdrawing a work removes it from the member pool', async () => {
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

    await setArtworkRelease({ artworkId: artwork.id, release: true });
    expect(await visibleToMembers()).toHaveLength(1);

    await setArtworkRelease({ artworkId: artwork.id, release: false });
    expect(await visibleToMembers()).toHaveLength(0);
  });

  it('withdrawing an artist takes their released work with them', async () => {
    const artistUser = await prisma.user.create({
      data: { email: 'ayanda@test.local', role: 'ARTIST' },
    });
    const artist = await prisma.artist.create({
      data: { userId: artistUser.id, displayName: 'Ayanda', slug: 'ayanda', approved: true },
    });
    await prisma.artwork.create({
      data: {
        artistId: artist.id,
        title: 'Held',
        description: 'x',
        images: [],
        medium: 'Print',
        dimensions: '30x40',
        price: '900',
        status: 'LISTED',
      },
    });

    expect(await visibleToMembers()).toHaveLength(1);

    // Approval is a live gate, not a one-off stamp: withdrawing it must pull
    // the artist's work from members immediately.
    await setArtistApproval({ artistId: artist.id, approved: false });

    expect(await visibleToMembers()).toHaveLength(0);
  });
});

/**
 * Mirrors `RELEASED_TO_MEMBERS` in the Collector Platform.
 *
 * Restated rather than imported: apps do not import from one another, and a
 * test that reached across that boundary would quietly make it a lie. If the
 * two ever drift, this test is the thing that should fail.
 */
function visibleToMembers() {
  return prisma.artwork.findMany({
    where: { status: 'LISTED', artist: { approved: true } },
    select: { title: true },
  });
}
