'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@qhakaza/shared-auth/server';
import { prisma, withActor } from '@qhakaza/shared-db';

import {
  aboutSchema,
  cvEntrySchema,
  exhibitionSchema,
  linkSchema,
  mediumsSchema,
  representationSchema,
  signalSchema,
  withdrawSchema,
} from './schema';

/**
 * The artist writing their own record.
 *
 * THREE RULES HOLD ACROSS EVERY ACTION HERE.
 *
 *  1. The artist's claims are recorded as ARTIST_DECLARED and nothing more.
 *     None of these actions accepts a verification state, and parsing against
 *     the schemas strips one if it is sent. An artist saying a thing is what
 *     "declared" means; confirming it is Qhakaza's job and happens elsewhere.
 *
 *  2. Withdrawing is an UPDATE, never a DELETE. A claim that was made and
 *     later retracted is part of the record - if it could vanish, an
 *     assessment that relied on it could not be reconciled afterwards. The RLS
 *     matrix grants the artist no DELETE on any of these tables, so this is
 *     enforced rather than merely intended.
 *
 *  3. Every change is written to `RecordChange` in the same transaction as the
 *     change itself. A history written afterwards is a history that is missing
 *     whatever failed in between.
 */

export type RecordResult =
  | { ok: true }
  | {
      ok: false;
      error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NO_PROFILE' | 'INVALID' | 'UNKNOWN';
      fieldErrors?: Record<string, string>;
    };

type Actor = { role: 'artist'; userId: string };

type Access =
  | { ok: true; actor: Actor; artistId: string }
  | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NO_PROFILE' };

async function requireArtistProfile(): Promise<Access> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'UNAUTHENTICATED' };

  // The role is re-read rather than trusted from the token: one issued before
  // a role change would otherwise keep its old privileges until it expired.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (user.role !== 'ARTIST') return { ok: false, error: 'FORBIDDEN' };

  const actor = { role: 'artist', userId } as const;
  const artist = await withActor(actor, (tx) =>
    tx.artist.findUnique({ where: { userId }, select: { id: true } }),
  );
  if (!artist) return { ok: false, error: 'NO_PROFILE' };

  return { ok: true, actor, artistId: artist.id };
}

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
  return fieldErrors;
}

/** A year as the timestamp the schema stores. Null stays null. */
const yearToDate = (year?: number) => (year ? new Date(Date.UTC(year, 0, 1)) : null);

type Tx = Parameters<Parameters<typeof withActor>[1]>[0];

/** Append to the record's own history, inside the caller's transaction. */
async function note(
  tx: Tx,
  subjectId: string,
  field: string,
  previousValue: string | null,
  newValue: string | null,
  userId: string,
) {
  await tx.recordChange.create({
    data: {
      subjectType: 'Artist',
      subjectId,
      field,
      previousValue,
      newValue,
      changedById: userId,
      changedRole: 'ARTIST',
    },
  });
}

// ---------------------------------------------------------------------------

/** The biographies, the practice, and where the artist is. */
export async function saveAbout(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = aboutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;

  try {
    await withActor(actor, async (tx) => {
      const before = await tx.artist.findUniqueOrThrow({
        where: { id: artistId },
        select: {
          biographyPublic: true,
          biographyInternal: true,
          practice: true,
          statement: true,
          basedIn: true,
          nationality: true,
          birthYear: true,
        },
      });

      await tx.artist.update({
        where: { id: artistId },
        data: {
          biographyPublic: parsed.data.biographyPublic ?? null,
          biographyInternal: parsed.data.biographyInternal ?? null,
          practice: parsed.data.practice ?? null,
          statement: parsed.data.statement ?? null,
          basedIn: parsed.data.basedIn ?? null,
          nationality: parsed.data.nationality ?? null,
          birthYear: parsed.data.birthYear ?? null,
        },
      });

      // Field by field, so the history says what actually moved rather than
      // "the profile was edited".
      for (const [field, previous] of Object.entries(before)) {
        const next = (parsed.data as Record<string, unknown>)[field] ?? null;
        const previousText = previous === null ? null : String(previous);
        const nextText = next === null || next === undefined ? null : String(next);
        if (previousText !== nextText) {
          await note(tx, artistId, `artist.${field}`, previousText, nextText, actor.userId);
        }
      }
    });
  } catch (error) {
    console.error('saveAbout failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/** What the artist works in, chosen from the configurable list. */
export async function saveMediums(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = mediumsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const { mediumIds, primaryMediumIds } = parsed.data;

  try {
    await withActor(actor, async (tx) => {
      const existing = await tx.artistMedium.findMany({
        where: { artistId },
        select: { id: true, mediumId: true, primary: true, removedAt: true },
      });

      const wanted = new Set(mediumIds);

      for (const row of existing) {
        const shouldExist = wanted.has(row.mediumId);
        const shouldBePrimary = primaryMediumIds.includes(row.mediumId);

        if (!shouldExist && row.removedAt === null) {
          // Withdrawn, not deleted.
          await tx.artistMedium.update({ where: { id: row.id }, data: { removedAt: new Date() } });
          await note(tx, artistId, 'medium', row.mediumId, null, actor.userId);
        } else if (shouldExist && (row.removedAt !== null || row.primary !== shouldBePrimary)) {
          await tx.artistMedium.update({
            where: { id: row.id },
            data: { removedAt: null, primary: shouldBePrimary },
          });
        }
      }

      const known = new Set(existing.map((row) => row.mediumId));
      for (const mediumId of mediumIds) {
        if (known.has(mediumId)) continue;
        await tx.artistMedium.create({
          data: {
            artistId,
            mediumId,
            primary: primaryMediumIds.includes(mediumId),
            createdById: actor.userId,
          },
        });
        await note(tx, artistId, 'medium', null, mediumId, actor.userId);
      }
    });
  } catch (error) {
    console.error('saveMediums failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/**
 * An exhibition the artist has been in.
 *
 * JOINS THE EXISTING `Exhibition` TABLE rather than storing the venue on the
 * artist's row. The same exhibition may already be recorded against an
 * artwork, and one exhibition should be one row - see VERA_READINESS.md.
 *
 * Matching is on title and venue together and is deliberately conservative:
 * where no confident match exists a new Exhibition is created. Two rows for one
 * show can be merged by staff later; two artists silently attached to what
 * turned out to be different shows of the same name cannot be pulled apart.
 */
export async function saveExhibition(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = exhibitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const data = parsed.data;

  try {
    await withActor(actor, async (tx) => {
      if (data.id) {
        const row = await tx.artistExhibition.findFirst({
          where: { id: data.id, artistId },
          select: { id: true, exhibitionId: true },
        });
        if (!row) return;

        await tx.exhibition.update({
          where: { id: row.exhibitionId },
          data: {
            title: data.title,
            venue: data.venue ?? null,
            startDate: yearToDate(data.startYear),
            endDate: yearToDate(data.endYear),
          },
        });

        await tx.artistExhibition.update({
          where: { id: row.id },
          data: {
            typeId: data.typeId ?? null,
            role: data.role ?? null,
            curator: data.curator ?? null,
            reference: data.reference ?? null,
            /*
             * EDITING RESETS VERIFICATION.
             *
             * A row that was confirmed and has since been changed is no longer
             * the row that was confirmed. Leaving the old state on it would
             * carry an assurance across to a fact nobody checked.
             */
            verification: 'ARTIST_DECLARED',
            verifiedById: null,
            verifiedAt: null,
          },
        });

        await note(tx, artistId, 'exhibition', row.id, data.title, actor.userId);
        return;
      }

      const match = await tx.exhibition.findFirst({
        where: {
          title: { equals: data.title, mode: 'insensitive' },
          venue: data.venue ? { equals: data.venue, mode: 'insensitive' } : null,
        },
        select: { id: true },
      });

      const exhibition =
        match ??
        (await tx.exhibition.create({
          data: {
            title: data.title,
            venue: data.venue ?? null,
            startDate: yearToDate(data.startYear),
            endDate: yearToDate(data.endYear),
            createdById: actor.userId,
          },
          select: { id: true },
        }));

      const created = await tx.artistExhibition.create({
        data: {
          artistId,
          exhibitionId: exhibition.id,
          typeId: data.typeId ?? null,
          role: data.role ?? null,
          curator: data.curator ?? null,
          reference: data.reference ?? null,
          verification: 'ARTIST_DECLARED',
          assertedVia: 'ARTIST',
          assertedById: actor.userId,
          createdById: actor.userId,
        },
        select: { id: true },
      });

      await note(tx, artistId, 'exhibition', null, data.title, actor.userId);
      return created;
    });
  } catch (error) {
    console.error('saveExhibition failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/**
 * Who represents the artist.
 *
 * The gallery is a `Party` - the same row that may appear as a seller in a
 * provenance chain. Matched by name, created when there is no match.
 */
export async function saveRepresentation(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = representationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const data = parsed.data;

  try {
    await withActor(actor, async (tx) => {
      const match = await tx.party.findFirst({
        where: { name: { equals: data.partyName, mode: 'insensitive' } },
        select: { id: true },
      });

      const party =
        match ??
        (await tx.party.create({
          data: { name: data.partyName, kind: 'Gallery', createdById: actor.userId },
          select: { id: true },
        }));

      const common = {
        typeId: data.typeId ?? null,
        territory: data.territory ?? null,
        startDate: yearToDate(data.startYear),
        endDate: yearToDate(data.endYear),
        current: data.current,
        exclusive: data.exclusive ?? null,
        note: data.note ?? null,
      };

      if (data.id) {
        const row = await tx.artistRepresentation.findFirst({
          where: { id: data.id, artistId },
          select: { id: true },
        });
        if (!row) return;

        await tx.artistRepresentation.update({
          where: { id: row.id },
          data: {
            ...common,
            partyId: party.id,
            verification: 'ARTIST_DECLARED',
            verifiedById: null,
            verifiedAt: null,
          },
        });
        await note(tx, artistId, 'representation', row.id, data.partyName, actor.userId);
        return;
      }

      await tx.artistRepresentation.create({
        data: {
          ...common,
          artistId,
          partyId: party.id,
          verification: 'ARTIST_DECLARED',
          assertedVia: 'ARTIST',
          assertedById: actor.userId,
          createdById: actor.userId,
        },
      });
      await note(tx, artistId, 'representation', null, data.partyName, actor.userId);
    });
  } catch (error) {
    console.error('saveRepresentation failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/** One line of the artist's CV. */
export async function saveCvEntry(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = cvEntrySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const data = parsed.data;

  const common = {
    typeId: data.typeId ?? null,
    title: data.title,
    organisation: data.organisation ?? null,
    location: data.location ?? null,
    startYear: data.startYear ?? null,
    endYear: data.endYear ?? null,
    detail: data.detail ?? null,
  };

  try {
    await withActor(actor, async (tx) => {
      if (data.id) {
        const row = await tx.cvEntry.findFirst({
          where: { id: data.id, artistId },
          select: { id: true, title: true },
        });
        if (!row) return;

        await tx.cvEntry.update({
          where: { id: row.id },
          data: {
            ...common,
            verification: 'ARTIST_DECLARED',
            verifiedById: null,
            verifiedAt: null,
          },
        });
        await note(tx, artistId, 'cvEntry.title', row.title, data.title, actor.userId);
        return;
      }

      await tx.cvEntry.create({
        data: {
          ...common,
          artistId,
          verification: 'ARTIST_DECLARED',
          assertedVia: 'ARTIST',
          assertedById: actor.userId,
          createdById: actor.userId,
        },
      });
      await note(tx, artistId, 'cvEntry.title', null, data.title, actor.userId);
    });
  } catch (error) {
    console.error('saveCvEntry failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/** An acquisition, prize, residency or commission. */
export async function saveSignal(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = signalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const data = parsed.data;

  const common = {
    signalTypeId: data.signalTypeId ?? null,
    institution: data.institution ?? null,
    description: data.description,
    year: data.year ?? null,
  };

  try {
    await withActor(actor, async (tx) => {
      if (data.id) {
        const row = await tx.institutionalSignal.findFirst({
          where: { id: data.id, artistId },
          select: { id: true },
        });
        if (!row) return;

        await tx.institutionalSignal.update({
          where: { id: row.id },
          data: {
            ...common,
            verification: 'ARTIST_DECLARED',
            verifiedById: null,
            verifiedAt: null,
          },
        });
        await note(tx, artistId, 'signal', row.id, data.description, actor.userId);
        return;
      }

      await tx.institutionalSignal.create({
        data: {
          ...common,
          artistId,
          verification: 'ARTIST_DECLARED',
          assertedVia: 'ARTIST',
          assertedById: actor.userId,
          createdById: actor.userId,
        },
      });
      await note(tx, artistId, 'signal', null, data.description, actor.userId);
    });
  } catch (error) {
    console.error('saveSignal failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

/** A website, portfolio or press link. */
export async function saveLink(input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const data = parsed.data;

  try {
    await withActor(actor, async (tx) => {
      if (data.id) {
        const row = await tx.artistLink.findFirst({
          where: { id: data.id, artistId },
          select: { id: true, url: true },
        });
        if (!row) return;

        await tx.artistLink.update({
          where: { id: row.id },
          data: {
            kind: data.kind,
            label: data.label ?? null,
            url: data.url,
            verification: 'ARTIST_DECLARED',
            checkedAt: null,
          },
        });
        await note(tx, artistId, 'link', row.url, data.url, actor.userId);
        return;
      }

      await tx.artistLink.create({
        data: {
          artistId,
          kind: data.kind,
          label: data.label ?? null,
          url: data.url,
          verification: 'ARTIST_DECLARED',
          createdById: actor.userId,
        },
      });
      await note(tx, artistId, 'link', null, data.url, actor.userId);
    });
  } catch (error) {
    console.error('saveLink failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}

// ---------------------------------------------------------------------------

type Withdrawable = 'exhibition' | 'representation' | 'cvEntry' | 'signal' | 'link' | 'medium';

/**
 * Withdraw a claim.
 *
 * MARKS, NEVER DELETES. The RLS matrix grants the artist no DELETE on any of
 * these tables, so an attempt to delete would be refused by the database
 * regardless of what this code did. The reason is recorded because "why was
 * this taken down" is the question asked afterwards.
 */
export async function withdrawEntry(kind: Withdrawable, input: unknown): Promise<RecordResult> {
  const access = await requireArtistProfile();
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = withdrawSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { actor, artistId } = access;
  const { id, reason } = parsed.data;

  try {
    await withActor(actor, async (tx) => {
      const now = new Date();
      const where = { id, artistId } as const;
      const data = { removedAt: now } as const;

      switch (kind) {
        case 'exhibition':
          await tx.artistExhibition.updateMany({ where, data });
          break;
        case 'representation':
          await tx.artistRepresentation.updateMany({ where, data });
          break;
        case 'cvEntry':
          await tx.cvEntry.updateMany({ where, data });
          break;
        case 'signal':
          await tx.institutionalSignal.updateMany({ where, data });
          break;
        case 'link':
          await tx.artistLink.updateMany({ where, data });
          break;
        case 'medium':
          await tx.artistMedium.updateMany({ where, data });
          break;
      }

      await tx.recordChange.create({
        data: {
          subjectType: 'Artist',
          subjectId: artistId,
          field: `${kind}.withdrawn`,
          previousValue: id,
          newValue: null,
          reason: reason ?? null,
          changedById: actor.userId,
          changedRole: 'ARTIST',
        },
      });
    });
  } catch (error) {
    console.error('withdrawEntry failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artist/record');
  return { ok: true };
}
