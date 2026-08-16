import { withActor } from '@qhakaza/shared-db';

/**
 * What a member is allowed to see.
 *
 * Two conditions, both required: the artist has been **approved** by the
 * Command Center, and the work has been **released** to PUBLISHED. A DRAFT or
 * HIDDEN piece, or anything by an unvetted artist, is a raw submission and must
 * never reach a collector.
 *
 * Since Phase 5 this is enforced twice: the `collector` RLS policy narrows
 * these tables to released rows in the database, and the predicate below says
 * the same thing in the query. The database is the one that cannot be
 * forgotten; the WHERE clause is what makes the intent readable here.
 *
 * ⚠ THIS IS NOT PER-COLLECTOR CURATION. The brief calls for content *released
 * to them* — curated routes chosen member by member. No entity for that exists
 * among the 13, and per your decision members currently share one pool. The
 * vetting gate is real; the personalisation is absent, not faked.
 */
export const RELEASED_TO_MEMBERS = {
  status: 'PUBLISHED',
  artist: { approved: true },
} as const;

export async function getReleasedArtworks({ limit = 24 }: { limit?: number } = {}) {
  return withActor({ role: 'collector' }, (tx) =>
    tx.artwork.findMany({
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
    }),
  );
}

export type ReleasedArtwork = Awaited<ReturnType<typeof getReleasedArtworks>>[number];

/** Approved artists who actually have released work — never an empty room. */
export async function getReleasedArtists({ limit = 12 }: { limit?: number } = {}) {
  const artists = await withActor({ role: 'collector' }, (tx) =>
    tx.artist.findMany({
      where: { approved: true, artworks: { some: { status: 'PUBLISHED' } } },
      select: {
        id: true,
        displayName: true,
        slug: true,
        statement: true,
        _count: { select: { artworks: { where: { status: 'PUBLISHED' } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
  );

  return artists.map(({ _count, ...artist }) => ({
    ...artist,
    releasedCount: _count.artworks,
  }));
}

export type ReleasedArtist = Awaited<ReturnType<typeof getReleasedArtists>>[number];
