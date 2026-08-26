import { actorContext, type AuditActor } from '@/lib/audit';
import { withActor } from '@qhakaza/shared-db';

/**
 * The artist record, as Qhakaza sees it.
 *
 * EVERYTHING THE ARTIST WROTE, PLUS EVERYTHING QHAKAZA KNOWS. The artist's
 * view and this one read the same rows; this one additionally carries the
 * internal biography, the readiness assessments, the record's change history
 * and the withdrawn entries.
 *
 * WITHDRAWN ENTRIES ARE INCLUDED HERE and excluded from the artist's own view.
 * That is the point of withdrawal being a timestamp rather than a delete: a
 * claim that was made, relied upon, and later retracted is exactly the thing a
 * reviewer needs to be able to see.
 *
 * ONE TRANSACTION, ONE DECLARED ACTOR. The dashboard learned this the hard
 * way - nine separate reads against Supabase from South Africa took long
 * enough to exhaust Prisma's transaction timeout. These run inside a single
 * `withActor` for correctness first (RLS needs the actor set) and latency
 * second.
 */

export async function getArtistDossier(actor: AuditActor, artistId: string) {
  return withActor(actorContext(actor), async (tx) => {
    const artist = await tx.artist.findUnique({
      where: { id: artistId },
      select: {
        id: true,
        displayName: true,
        slug: true,
        approved: true,
        statement: true,
        biographyPublic: true,
        biographyInternal: true,
        practice: true,
        basedIn: true,
        nationality: true,
        birthYear: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    });

    if (!artist) return null;

    const [
      mediums,
      exhibitions,
      representations,
      cvEntries,
      signals,
      links,
      artworks,
      permissions,
      assessments,
      history,
      documents,
    ] = await Promise.all([
      tx.artistMedium.findMany({
        where: { artistId },
        select: {
          id: true,
          primary: true,
          removedAt: true,
          medium: { select: { label: true, family: true } },
        },
        orderBy: [{ primary: 'desc' }],
      }),
      tx.artistExhibition.findMany({
        where: { artistId },
        select: {
          id: true,
          role: true,
          curator: true,
          reference: true,
          verification: true,
          assertedVia: true,
          verifiedAt: true,
          verificationNote: true,
          removedAt: true,
          type: { select: { label: true } },
          exhibition: { select: { title: true, venue: true, startDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      tx.artistRepresentation.findMany({
        where: { artistId },
        select: {
          id: true,
          territory: true,
          current: true,
          exclusive: true,
          note: true,
          startDate: true,
          endDate: true,
          verification: true,
          assertedVia: true,
          verifiedAt: true,
          verificationNote: true,
          removedAt: true,
          party: { select: { id: true, name: true } },
          type: { select: { label: true } },
        },
        orderBy: [{ current: 'desc' }],
      }),
      tx.cvEntry.findMany({
        where: { artistId },
        select: {
          id: true,
          title: true,
          organisation: true,
          location: true,
          startYear: true,
          endYear: true,
          detail: true,
          verification: true,
          assertedVia: true,
          verifiedAt: true,
          verificationNote: true,
          removedAt: true,
          type: { select: { label: true, ordering: true } },
        },
        orderBy: [{ startYear: 'desc' }],
      }),
      tx.institutionalSignal.findMany({
        where: { artistId },
        select: {
          id: true,
          description: true,
          institution: true,
          year: true,
          verification: true,
          assertedVia: true,
          verifiedAt: true,
          verificationNote: true,
          removedAt: true,
          signalType: { select: { label: true } },
          party: { select: { name: true } },
        },
        orderBy: { year: 'desc' },
      }),
      tx.artistLink.findMany({
        where: { artistId },
        select: {
          id: true,
          kind: true,
          label: true,
          url: true,
          verification: true,
          checkedAt: true,
          removedAt: true,
        },
      }),
      tx.artwork.findMany({
        where: { artistId },
        select: {
          id: true,
          title: true,
          status: true,
          medium: true,
          price: true,
          currency: true,
          _count: { select: { transactions: true, releases: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      tx.artistPermission.findMany({
        where: { artistId },
        select: {
          id: true,
          kind: true,
          granted: true,
          artworkId: true,
          scopeNote: true,
          expiresAt: true,
          decidedAt: true,
          confirmingAction: true,
        },
        orderBy: { decidedAt: 'desc' },
      }),
      tx.readinessAssessment.findMany({
        where: { artistId },
        select: {
          id: true,
          summary: true,
          recommendation: true,
          assessedAt: true,
          assessedById: true,
          methodologyVersion: { select: { versionNumber: true } },
          ratings: {
            select: {
              id: true,
              rating: true,
              evidence: true,
              concern: true,
              criterion: { select: { label: true, guidance: true, ordering: true } },
            },
          },
        },
        orderBy: { assessedAt: 'desc' },
      }),
      tx.recordChange.findMany({
        where: { subjectType: 'Artist', subjectId: artistId },
        select: {
          id: true,
          field: true,
          previousValue: true,
          newValue: true,
          reason: true,
          changedAt: true,
          changedRole: true,
        },
        orderBy: { changedAt: 'desc' },
        take: 100,
      }),
      tx.mediaAsset.findMany({
        where: {
          status: { not: 'DELETED' },
          links: { some: { subjectType: 'Artist', subjectId: artistId } },
        },
        select: {
          id: true,
          originalFilename: true,
          contentType: true,
          sizeBytes: true,
          confidentiality: true,
          uploadedAt: true,
          documentType: { select: { label: true } },
          links: { select: { subjectType: true, subjectId: true, role: true } },
        },
      }),
    ]);

    return {
      artist,
      mediums,
      exhibitions,
      representations,
      cvEntries,
      signals,
      links,
      artworks: artworks.map((work) => ({ ...work, price: work.price.toString() })),
      permissions,
      assessments,
      history,
      documents,
    };
  });
}

export type ArtistDossier = NonNullable<Awaited<ReturnType<typeof getArtistDossier>>>;

/**
 * The list of artists, with enough to choose one from.
 *
 * The counts are of UNWITHDRAWN entries only: a reviewer scanning the list
 * wants to know what is standing, not what was ever typed.
 */
export async function getArtistIndex(actor: AuditActor) {
  return withActor(actorContext(actor), async (tx) => {
    const artists = await tx.artist.findMany({
      select: {
        id: true,
        displayName: true,
        slug: true,
        approved: true,
        basedIn: true,
        createdAt: true,
        _count: {
          select: {
            artworks: true,
            exhibitions: { where: { removedAt: null } },
            cvEntries: { where: { removedAt: null } },
            signals: { where: { removedAt: null } },
            assessments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return artists;
  });
}

/** The criteria a readiness assessment is made against. Staff only. */
export async function getReadinessCriteria(actor: AuditActor) {
  return withActor(actorContext(actor), (tx) =>
    tx.readinessCriterion.findMany({
      where: { active: true },
      select: { id: true, label: true, guidance: true },
      orderBy: { ordering: 'asc' },
    }),
  );
}
