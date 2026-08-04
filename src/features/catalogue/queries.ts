import { prisma } from '@qhakaza/shared-db';

const DEFAULT_WORK_LIMIT = 8;
const DEFAULT_ARTIST_LIMIT = 3;

/**
 * What the public is allowed to see.
 *
 * Two conditions, both required: the piece is LISTED (not a draft, not sold,
 * not hidden by an admin) *and* its artist has been approved. Approval is a
 * real gate, so an unapproved storefront is invisible until an admin acts.
 *
 * Every public query must reuse this rather than rewriting the conditions.
 */
export const PUBLICLY_VISIBLE_WORK = {
  status: 'LISTED',
  artist: { approved: true },
} as const;

export async function getFeaturedWorks({ limit = DEFAULT_WORK_LIMIT }: { limit?: number } = {}) {
  return prisma.artwork.findMany({
    where: PUBLICLY_VISIBLE_WORK,
    include: {
      artist: { select: { displayName: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export type FeaturedWork = Awaited<ReturnType<typeof getFeaturedWorks>>[number];

/**
 * Approved artists who actually have something to buy. Featuring an empty
 * storefront sends a collector to a dead end.
 */
export async function getFeaturedArtists({
  limit = DEFAULT_ARTIST_LIMIT,
}: { limit?: number } = {}) {
  const artists = await prisma.artist.findMany({
    where: {
      approved: true,
      artworks: { some: { status: 'LISTED' } },
    },
    select: {
      id: true,
      displayName: true,
      slug: true,
      statement: true,
      _count: { select: { artworks: { where: { status: 'LISTED' } } } },
      artworks: {
        where: { status: 'LISTED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { images: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return artists.map(({ _count, artworks, ...artist }) => ({
    ...artist,
    availableCount: _count.artworks,
    coverImage: artworks[0]?.images[0] ?? null,
  }));
}

export type FeaturedArtist = Awaited<ReturnType<typeof getFeaturedArtists>>[number];
