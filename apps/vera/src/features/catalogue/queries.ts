import { prisma } from '@qhakaza/shared-db';

const DEFAULT_WORK_LIMIT = 8;
const DEFAULT_ARTIST_LIMIT = 3;

/**
 * What the public is allowed to see.
 *
 * Two conditions, both required: the piece is PUBLISHED (not a draft, not sold,
 * not hidden by an admin) *and* its artist has been approved. Approval is a
 * real gate, so an unapproved storefront is invisible until an admin acts.
 *
 * Every public query must reuse this rather than rewriting the conditions.
 */
export const PUBLICLY_VISIBLE_WORK = {
  status: 'PUBLISHED',
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
      artworks: { some: { status: 'PUBLISHED' } },
    },
    select: {
      id: true,
      displayName: true,
      slug: true,
      statement: true,
      _count: { select: { artworks: { where: { status: 'PUBLISHED' } } } },
      artworks: {
        where: { status: 'PUBLISHED' },
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

/*
 * The catalogue pages.
 *
 * All four reuse PUBLICLY_VISIBLE_WORK rather than restating "listed, by an
 * approved artist". A page that rewrote those conditions could drift from it
 * and quietly publish a draft.
 */

/** Every publicly visible work, newest first. */
export async function getBrowseWorks({ limit = 60 }: { limit?: number } = {}) {
  return prisma.artwork.findMany({
    where: PUBLICLY_VISIBLE_WORK,
    include: { artist: { select: { displayName: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/** Every approved artist with something listed. Same shape as the featured row. */
export async function getAllArtists({ limit = 60 }: { limit?: number } = {}) {
  return getFeaturedArtists({ limit });
}

/**
 * One artist and their available work.
 *
 * The artist must be approved — an unapproved profile 404s rather than being
 * reachable by guessing its slug.
 */
export async function getArtistBySlug(slug: string) {
  const artist = await prisma.artist.findFirst({
    where: { slug, approved: true },
    select: {
      id: true,
      displayName: true,
      slug: true,
      statement: true,
      artworks: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          images: true,
          medium: true,
          price: true,
          currency: true,
        },
      },
    },
  });

  if (!artist) return null;

  // ArtCard wants the artist on each work; it is the same artist throughout.
  const { artworks, ...rest } = artist;
  return {
    ...rest,
    artworks: artworks.map((work) => ({
      ...work,
      artist: { displayName: artist.displayName, slug: artist.slug },
    })),
  };
}

/** One work, with its artist and a few others by the same hand. */
export async function getWorkById(id: string) {
  const work = await prisma.artwork.findFirst({
    where: { id, ...PUBLICLY_VISIBLE_WORK },
    include: {
      artist: { select: { id: true, displayName: true, slug: true, statement: true } },
    },
  });

  if (!work) return null;

  const alsoBy = await prisma.artwork.findMany({
    where: { ...PUBLICLY_VISIBLE_WORK, artistId: work.artistId, id: { not: work.id } },
    include: { artist: { select: { displayName: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  return { work, alsoBy };
}
