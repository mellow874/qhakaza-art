import { auth } from '@qhakaza/shared-auth/server';
import { prisma, withActor } from '@qhakaza/shared-db';

/**
 * The artist's own record, as they may see it.
 *
 * READ AS THE ARTIST, always. Every query here goes through `withActor` with
 * the artist's own id, so row-level security narrows the result to their rows
 * rather than this code being trusted to add the right `where`. If a filter
 * were forgotten the policy would return nothing, which is the failure
 * direction to prefer.
 *
 * NOTHING ABOUT READINESS IS FETCHED HERE, and there is no grant that would
 * let it be: `ReadinessAssessment`, `ReadinessRating` and `ReadinessCriterion`
 * have no `artist` policy at all. Qhakaza confirmed readiness is never visible
 * to the artist, and the absence is enforced rather than remembered.
 */

/** Withdrawn rows are excluded everywhere an artist reads their own record. */
const live = { removedAt: null };

export async function getMyRecord() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const actor = { role: 'artist', userId } as const;

  return withActor(actor, async (tx) => {
    const artist = await tx.artist.findUnique({
      where: { userId },
      select: {
        id: true,
        displayName: true,
        slug: true,
        statement: true,
        biographyPublic: true,
        biographyInternal: true,
        practice: true,
        basedIn: true,
        nationality: true,
        birthYear: true,
        approved: true,
      },
    });

    if (!artist) return null;

    const [mediums, exhibitions, representations, cvEntries, signals, links, documents] =
      await Promise.all([
        tx.artistMedium.findMany({
          where: { artistId: artist.id, ...live },
          select: {
            id: true,
            primary: true,
            medium: { select: { id: true, label: true, family: true } },
          },
          orderBy: [{ primary: 'desc' }, { createdAt: 'asc' }],
        }),
        tx.artistExhibition.findMany({
          where: { artistId: artist.id, ...live },
          select: {
            id: true,
            role: true,
            curator: true,
            reference: true,
            verification: true,
            type: { select: { id: true, label: true } },
            exhibition: {
              select: { id: true, title: true, venue: true, startDate: true, endDate: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        tx.artistRepresentation.findMany({
          where: { artistId: artist.id, ...live },
          select: {
            id: true,
            territory: true,
            startDate: true,
            endDate: true,
            current: true,
            exclusive: true,
            note: true,
            verification: true,
            party: { select: { id: true, name: true } },
            type: { select: { id: true, label: true } },
          },
          orderBy: [{ current: 'desc' }, { createdAt: 'desc' }],
        }),
        tx.cvEntry.findMany({
          where: { artistId: artist.id, ...live },
          select: {
            id: true,
            title: true,
            organisation: true,
            location: true,
            startYear: true,
            endYear: true,
            detail: true,
            verification: true,
            type: { select: { id: true, label: true, ordering: true } },
          },
          orderBy: [{ ordering: 'asc' }, { startYear: 'desc' }],
        }),
        tx.institutionalSignal.findMany({
          where: { artistId: artist.id, ...live },
          select: {
            id: true,
            description: true,
            institution: true,
            year: true,
            verification: true,
            signalType: { select: { id: true, label: true } },
          },
          orderBy: { year: 'desc' },
        }),
        tx.artistLink.findMany({
          where: { artistId: artist.id, ...live },
          select: { id: true, kind: true, label: true, url: true, verification: true },
          orderBy: { createdAt: 'asc' },
        }),
        tx.mediaAsset.findMany({
          where: {
            status: { not: 'DELETED' },
            links: { some: { subjectType: 'Artist', subjectId: artist.id } },
          },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            sizeBytes: true,
            uploadedAt: true,
            documentType: { select: { id: true, label: true } },
          },
          orderBy: { createdAt: 'desc' },
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
      documents,
    };
  });
}

export type ArtistRecord = NonNullable<Awaited<ReturnType<typeof getMyRecord>>>;

/**
 * The configurable lists the forms are built from.
 *
 * Read without an actor: these are reference data with a `public` read in the
 * matrix for every role that has to choose from them, and they are the same
 * for everyone. Inactive terms are excluded so a retired medium stops being
 * offered without disturbing the rows that already use it.
 */
export async function getVocabularies() {
  const [mediums, exhibitionTypes, cvEntryTypes, signalTypes, representationTypes, documentTypes] =
    await Promise.all([
      prisma.medium.findMany({
        where: { active: true },
        select: { id: true, label: true, family: true },
        orderBy: { ordering: 'asc' },
      }),
      prisma.exhibitionType.findMany({
        where: { active: true },
        select: { id: true, label: true, guidance: true },
        orderBy: { ordering: 'asc' },
      }),
      prisma.cvEntryType.findMany({
        where: { active: true },
        select: { id: true, label: true },
        orderBy: { ordering: 'asc' },
      }),
      prisma.signalType.findMany({
        where: { active: true },
        select: { id: true, label: true, guidance: true },
        orderBy: { ordering: 'asc' },
      }),
      prisma.representationType.findMany({
        where: { active: true },
        select: { id: true, label: true },
        orderBy: { ordering: 'asc' },
      }),
      prisma.documentType.findMany({
        where: { active: true },
        select: { id: true, label: true, guidance: true },
        orderBy: { ordering: 'asc' },
      }),
    ]);

  return {
    mediums,
    exhibitionTypes,
    cvEntryTypes,
    signalTypes,
    representationTypes,
    documentTypes,
  };
}

export type Vocabularies = Awaited<ReturnType<typeof getVocabularies>>;
