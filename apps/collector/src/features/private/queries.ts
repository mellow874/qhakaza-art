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
/**
 * What THIS collector may see.
 *
 * This constant used to read `{ status: 'PUBLISHED', artist: { approved } }` -
 * byte-identical to the public site's condition. Every member therefore saw
 * the same pool, and that pool was the public catalogue. The premise of the
 * business is that neither of those things is true.
 *
 * A work now reaches a collector only when all of this holds:
 *
 *   an un-revoked release exists at the PRIVATE_COLLECTOR_PROJECTION tier
 *   to an audience the collector belongs to, via an ACTIVE membership
 *   and the artist granted SHARE_PRIVATELY_WITH_COLLECTORS
 *
 * It takes the user id because there is no such thing as "what collectors can
 * see" any more - only what a named collector can see. RLS enforces the same
 * conditions independently, so a caller who forgot to scope would get nothing
 * rather than everything.
 */
export function releasedToCollector(userId: string) {
  return {
    releases: {
      some: {
        tier: 'PRIVATE_COLLECTOR_PROJECTION',
        revokedAt: null,
        audience: {
          members: {
            some: {
              removedAt: null,
              membership: { userId, status: 'ACTIVE' },
            },
          },
        },
      },
    },
    // Work-specific or artist-wide, as above.
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
  } as const;
}

export async function getReleasedArtworks({
  userId,
  limit = 24,
}: {
  userId: string;
  limit?: number;
}) {
  return withActor({ role: 'collector', userId }, (tx) =>
    tx.artwork.findMany({
      where: releasedToCollector(userId),
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
export async function getReleasedArtists({
  userId,
  limit = 12,
}: {
  userId: string;
  limit?: number;
}) {
  const artists = await withActor({ role: 'collector', userId }, (tx) =>
    tx.artist.findMany({
      where: {
        approved: true,
        // An artist appears because work of theirs was placed with THIS
        // collector - not because they have published work somewhere.
        artworks: { some: releasedToCollector(userId) },
      },
      select: {
        id: true,
        displayName: true,
        slug: true,
        statement: true,
        _count: { select: { artworks: { where: releasedToCollector(userId) } } },
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
