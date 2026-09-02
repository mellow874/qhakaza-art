import { Prisma, artworkPermissionGranted, decidePermission, prisma } from '@qhakaza/shared-db';

const DEFAULT_WORK_LIMIT = 8;
const DEFAULT_ARTIST_LIMIT = 3;

/**
 * What the public is allowed to see.
 *
 * THE PUBLIC SITE IS NOT A CATALOGUE. It introduces Qhakaza's artist
 * programme, its methodology and selected artists. Availability, pricing and
 * collector-specific intelligence are governed and live elsewhere.
 *
 * This condition used to read `{ status: 'PUBLISHED', artist: { approved } }`
 * - which was byte-identical to the collector platform's condition, so
 * approving a work put it on the open web with its price AND in every
 * collector's private area at the same moment. That is the defect this phase
 * exists to remove.
 *
 * Four conditions now, all required:
 *
 *   the artist is approved
 *   the work is in PUBLIC_EDITORIAL
 *   an un-revoked release exists at the PUBLIC_EDITORIAL tier
 *   the artist granted PUBLISH_PUBLICLY
 *
 * RLS enforces the same thing independently, so a query that forgot this would
 * still return nothing. This exists so the intent is readable, not because the
 * database trusts it.
 */
export const PUBLICLY_VISIBLE_WORK: Prisma.ArtworkWhereInput = {
  status: 'PUBLIC_EDITORIAL',
  artist: { approved: true },
  releases: {
    some: { tier: 'PUBLIC_EDITORIAL', revokedAt: null },
  },
  /*
   * The artist's permission to publish, under the conflict rule: granted by
   * something that applies here, and denied by nothing that applies here.
   *
   * This was spelled out inline and was wrong - it tested only for a granting
   * row, so an artist-wide grant published a work the artist had specifically
   * asked be held back. The rule now lives in one place; see
   * `artworkPermissionGranted`.
   */
  ...artworkPermissionGranted('PUBLISH_PUBLICLY'),
};

/*
 * WHAT A PUBLIC VISITOR MAY SEE OF A WORK: id, title, images, medium,
 * dimensions, createdAt and the artist's name. NO PRICE, NO AVAILABILITY.
 *
 * Written out at each call site rather than shared as a constant. Prisma infers
 * the return type from a literal `select`, and a shared object - whether
 * `as const` or `satisfies` - widens it enough that Next's build-time type
 * check fails while `tsc --noEmit` passes. Repetition beats a build that only
 * breaks on deploy.
 *
 * If price ever appears in one of these, it is a leak, not a feature.
 */

export async function getFeaturedWorks({ limit = DEFAULT_WORK_LIMIT }: { limit?: number } = {}) {
  return prisma.artwork.findMany({
    where: PUBLICLY_VISIBLE_WORK,
    select: {
      id: true,
      title: true,
      images: true,
      medium: true,
      dimensions: true,
      createdAt: true,
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
      // An artist is featured when they have work Qhakaza has chosen to show
      // publicly - not merely when they have work.
      artworks: { some: PUBLICLY_VISIBLE_WORK },
    },
    select: {
      id: true,
      displayName: true,
      slug: true,
      statement: true,
      _count: { select: { artworks: { where: PUBLICLY_VISIBLE_WORK } } },
      artworks: {
        where: PUBLICLY_VISIBLE_WORK,
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
    select: {
      id: true,
      title: true,
      images: true,
      medium: true,
      dimensions: true,
      createdAt: true,
      artist: { select: { displayName: true, slug: true } },
    },
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

      /*
       * THE PUBLIC BIOGRAPHY ONLY.
       *
       * `biographyInternal` is in this same row and must never be selected
       * here. RLS is row-level, not column-level: the policy lets an anonymous
       * reader see the row of an approved artist, and this whitelist is the
       * only thing keeping the internal half of the record off the public
       * site. `public-projection.db.test.ts` asserts it.
       */
      biographyPublic: true,
      practice: true,

      /*
       * Whether the artist has agreed to their story being published, which is
       * a separate permission from publishing their work. Fetched rather than
       * filtered on, because an artist who has not granted it still has a
       * public page - it just carries their statement and their work, not
       * their biography.
       */
      permissions: {
        where: { kind: 'PUBLISH_ARTIST_STORY' },
        select: { artworkId: true, granted: true, expiresAt: true },
      },

      artworks: {
        where: PUBLICLY_VISIBLE_WORK,
        orderBy: { createdAt: 'desc' },
        // No price. An artist page introduces a practice; it does not offer
        // anything for sale.
        select: { id: true, title: true, images: true, medium: true },
      },
    },
  });

  if (!artist) return null;

  // ArtCard wants the artist on each work; it is the same artist throughout.
  const { artworks, permissions, biographyPublic, practice, ...rest } = artist;

  // The story is published only if the artist said it could be. Withheld
  // rather than half-shown: a biography is theirs, not Qhakaza's.
  const storyPermitted = decidePermission(permissions, null);

  return {
    ...rest,
    biographyPublic: storyPermitted ? biographyPublic : null,
    practice: storyPermitted ? practice : null,
    artworks: artworks.map((work) => ({
      ...work,
      artist: { displayName: artist.displayName, slug: artist.slug },
    })),
  };
}

/** One work, with its artist and a few others by the same hand. */
export async function getWorkById(id: string) {
  /*
   * Spelled out rather than spread from PUBLIC_WORK_FIELDS.
   *
   * Spreading an `as const` object into a Prisma `select` loses the narrowing
   * under Next's build-time type check - it compiled under `tsc --noEmit` and
   * failed the build, which is a difference worth not relying on. Still no
   * price and no availability.
   */
  const work = await prisma.artwork.findFirst({
    where: { id, ...PUBLICLY_VISIBLE_WORK },
    select: {
      id: true,
      title: true,
      images: true,
      medium: true,
      dimensions: true,
      createdAt: true,
      description: true,
      artist: { select: { id: true, displayName: true, slug: true, statement: true } },
    },
  });

  if (!work) return null;

  const alsoBy = await prisma.artwork.findMany({
    where: {
      ...PUBLICLY_VISIBLE_WORK,
      // By id, not by spreading the shared `artist` filter: that property is a
      // union in Prisma's input types, and spreading it widens the whole query
      // enough that the select stops narrowing the result.
      artistId: work.artist.id,
      id: { not: work.id },
    },
    select: {
      id: true,
      title: true,
      images: true,
      medium: true,
      dimensions: true,
      createdAt: true,
      artist: { select: { displayName: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  return { work, alsoBy };
}
