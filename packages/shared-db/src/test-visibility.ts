import { prisma } from './client';

/**
 * Helpers for putting a work where a test needs it to be visible.
 *
 * Making a work visible is no longer a status change - it needs a release to
 * an audience and the artist's permission. Every test that wants a visible
 * work needs all three, so they live here rather than being rebuilt (and
 * quietly diverging) in four test files.
 *
 * Test-only, but shipped in src because the app test suites import it across
 * package boundaries.
 */

/** Make a work publicly visible: editorial release plus public permission. */
export async function releasePublicly(artworkId: string, artistId: string) {
  const audience = await prisma.audience.create({
    data: { name: `Editorial ${Math.random().toString(36).slice(2, 8)}` },
  });

  /*
   * findFirst then create, not upsert.
   *
   * The unique key is (artistId, artworkId, kind) and this is an artist-wide
   * grant, so artworkId is null - which a compound-unique upsert cannot match,
   * because null is not equal to null in SQL.
   */
  const existing = await prisma.artistPermission.findFirst({
    where: { artistId, artworkId: null, kind: 'PUBLISH_PUBLICLY' },
  });

  if (existing) {
    await prisma.artistPermission.update({ where: { id: existing.id }, data: { granted: true } });
  } else {
    await prisma.artistPermission.create({
      data: { artistId, kind: 'PUBLISH_PUBLICLY', granted: true },
    });
  }

  await prisma.artwork.update({ where: { id: artworkId }, data: { status: 'PUBLIC_EDITORIAL' } });

  return prisma.artworkRelease.create({
    data: { artworkId, audienceId: audience.id, tier: 'PUBLIC_EDITORIAL' },
  });
}

/** Place a work with specific collectors, by membership id. */
export async function releaseToCollectors(
  artworkId: string,
  artistId: string,
  membershipIds: string[],
) {
  const audience = await prisma.audience.create({
    data: { name: `Placement ${Math.random().toString(36).slice(2, 8)}` },
  });

  for (const membershipId of membershipIds) {
    await prisma.audienceMember.create({ data: { audienceId: audience.id, membershipId } });
  }

  const shared = await prisma.artistPermission.findFirst({
    where: { artistId, artworkId: null, kind: 'SHARE_PRIVATELY_WITH_COLLECTORS' },
  });

  if (!shared) {
    await prisma.artistPermission.create({
      data: { artistId, kind: 'SHARE_PRIVATELY_WITH_COLLECTORS', granted: true },
    });
  }

  await prisma.artwork.update({
    where: { id: artworkId },
    data: { status: 'RELEASED_TO_AUDIENCE' },
  });

  return prisma.artworkRelease.create({
    data: { artworkId, audienceId: audience.id, tier: 'PRIVATE_COLLECTOR_PROJECTION' },
  });
}

/** Remove every release and permission, for a clean slate between tests. */
export async function clearVisibility() {
  await prisma.artworkRelease.deleteMany();
  await prisma.audienceMember.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.artistPermission.deleteMany();
}
