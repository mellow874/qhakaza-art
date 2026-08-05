import { prisma } from '@qhakaza/shared-db';

/**
 * What a member is allowed to see.
 *
 * Two conditions, both required: the artist has been **approved** by the
 * Command Center, and the work has been **released** to LISTED. A DRAFT or
 * HIDDEN piece, or anything by an unvetted artist, is a raw submission and must
 * never reach a collector.
 *
 * Every query in the private area reuses this. Rewriting the conditions per
 * call site is how one of them eventually ends up missing a clause.
 *
 * ⚠ THIS IS NOT PER-COLLECTOR CURATION. The brief calls for content *released
 * to them* by the Command Center — curated routes and matches, chosen member by
 * member. No entity for that exists: the 13 core entities contain no Match or
 * CuratedRoute, and inventing a fourteenth was not mine to do. Until that is
 * resolved, every member sees the same verified pool. The vetting gate below is
 * real and enforced; the personalisation is absent, not faked.
 */
export const RELEASED_TO_MEMBERS = {
  status: 'LISTED',
  artist: { approved: true },
} as const;

export async function getReleasedArtworks({ limit = 24 }: { limit?: number } = {}) {
  return prisma.artwork.findMany({
    where: RELEASED_TO_MEMBERS,
    select: {
      id: true,
      title: true,
      medium: true,
      dimensions: true,
      price: true,
      currency: true,
      images: true,
      artist: { select: { displayName: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export type ReleasedArtwork = Awaited<ReturnType<typeof getReleasedArtworks>>[number];

/** Approved artists who actually have released work — never an empty room. */
export async function getReleasedArtists({ limit = 12 }: { limit?: number } = {}) {
  const artists = await prisma.artist.findMany({
    where: { approved: true, artworks: { some: { status: 'LISTED' } } },
    select: {
      id: true,
      displayName: true,
      slug: true,
      statement: true,
      _count: { select: { artworks: { where: { status: 'LISTED' } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return artists.map(({ _count, ...artist }) => ({
    ...artist,
    releasedCount: _count.artworks,
  }));
}

export type ReleasedArtist = Awaited<ReturnType<typeof getReleasedArtists>>[number];
