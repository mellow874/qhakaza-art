'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * The provenance chain.
 *
 * WHAT THIS EXISTS TO MAKE POSSIBLE: recording that the chain is INCOMPLETE.
 *
 * The table could previously only say "A sold to B on a date". A real chain is
 * mostly not that - it has periods where custody is unknown, transfers that
 * are asserted and contested, and links resting on a single unverified source.
 * A structure that can only express clean transfers forces the incomplete
 * parts to be left out, and a chain with its gaps silently omitted READS AS
 * COMPLETE. That is the failure that matters, because a collector relies on it.
 *
 * A gap is a row IN the chain rather than a separate table, so the chain stays
 * one ordered sequence and a gap cannot be lost by a query that forgot to look
 * for it.
 */

export type ProvenanceResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const linkSchema = z
  .object({
    id: z.string().min(1).optional(),
    artworkId: z.string().min(1),
    kind: z.enum(['TRANSFER', 'UNKNOWN_INTERVAL', 'DISPUTED_TRANSFER', 'RETAINED']),
    fromPartyName: z.string().trim().max(300).optional(),
    toPartyName: z.string().trim().max(300).optional(),
    occurredOn: z.string().date().optional(),
    periodStart: z.string().date().optional(),
    periodEnd: z.string().date().optional(),
    amount: z.number().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    notes: z.string().trim().max(2_000).optional(),
    verification: z
      .enum([
        'UNVERIFIED',
        'ARTIST_DECLARED',
        'DOCUMENT_ON_FILE',
        'INDEPENDENTLY_VERIFIED',
        'UNABLE_TO_VERIFY',
        'DISPUTED',
      ])
      .optional(),
    verificationNote: z.string().trim().max(2_000).optional(),
  })
  .refine(
    (value) =>
      value.kind !== 'UNKNOWN_INTERVAL' ||
      Boolean(value.notes) ||
      Boolean(value.periodStart) ||
      Boolean(value.periodEnd),
    {
      /*
       * A gap with no period and no explanation says nothing. Even "we know
       * nothing between these two owners" is a boundary; a completely empty
       * gap row is noise that makes the chain look worse without telling
       * anyone anything.
       */
      message: 'Give the period the gap covers, or say what is not known.',
      path: ['notes'],
    },
  );

/** Resolve a party by name, reusing the existing row where there is one. */
async function partyIdFor(
  tx: Parameters<Parameters<typeof performAudited>[0]['run']>[0],
  name: string | undefined,
  userId: string,
) {
  if (!name) return null;

  const existing = await tx.party.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.party.create({
    data: { name, createdById: userId },
    select: { id: true },
  });
  return created.id;
}

/**
 * Add or amend one link in a chain.
 *
 * `sequence` is assigned rather than taken from the caller. Dates are
 * frequently unknown or approximate - and for a gap, the absence of a date is
 * the point - so ordering by date alone puts undated links somewhere
 * arbitrary. New links go on the end and can be reordered deliberately.
 */
export async function saveProvenanceLink(input: unknown): Promise<ProvenanceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'INVALID', fieldErrors };
  }

  const data = parsed.data;

  try {
    await performAudited({
      actor,
      action: data.id ? 'provenance.amend' : 'provenance.add',
      entityType: 'ProvenanceTransaction',
      entityId: data.artworkId,
      summary:
        data.kind === 'UNKNOWN_INTERVAL'
          ? 'A gap in the chain was recorded'
          : `Provenance link recorded (${data.kind})`,
      after: { kind: data.kind, notes: data.notes ?? null },
      run: async (tx) => {
        /*
         * A gap has no parties, whatever was typed. Carrying a from/to across
         * onto an UNKNOWN_INTERVAL would assert custody in the very row that
         * exists to say custody is not established.
         */
        const isGap = data.kind === 'UNKNOWN_INTERVAL';

        const fromPartyId = isGap ? null : await partyIdFor(tx, data.fromPartyName, actor.userId);
        const toPartyId = isGap ? null : await partyIdFor(tx, data.toPartyName, actor.userId);

        const common = {
          kind: data.kind,
          fromPartyId,
          toPartyId,
          occurredOn: isGap || !data.occurredOn ? null : new Date(data.occurredOn),
          periodStart: data.periodStart ? new Date(data.periodStart) : null,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
          amount: isGap ? null : (data.amount ?? null),
          currency: isGap ? null : (data.currency ?? null),
          notes: data.notes ?? null,
          verification: data.verification ?? 'UNVERIFIED',
          verificationNote: data.verificationNote ?? null,
        };

        if (data.id) {
          await tx.provenanceTransaction.update({ where: { id: data.id }, data: common });
          return;
        }

        const last = await tx.provenanceTransaction.findFirst({
          where: { artworkId: data.artworkId },
          orderBy: { sequence: 'desc' },
          select: { sequence: true },
        });

        await tx.provenanceTransaction.create({
          data: {
            ...common,
            artworkId: data.artworkId,
            sequence: (last?.sequence ?? 0) + 1,
            assertedVia: 'QHAKAZA_STAFF',
            assertedById: actor.userId,
            createdById: actor.userId,
          },
        });
      },
    });
  } catch (error) {
    console.error('saveProvenanceLink failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

/**
 * The chain for one work, in order, with its gaps in place.
 *
 * Returns a plain summary alongside the links. The summary is descriptive, not
 * a score: it says how many links are unverified and whether the chain has
 * declared gaps, and it deliberately does not turn that into a confidence
 * percentage. A number would get quoted.
 */
export async function getProvenanceChain(artworkId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return null;

  return readAs(actor, async (tx) => {
    const links = await tx.provenanceTransaction.findMany({
      where: { artworkId },
      select: {
        id: true,
        kind: true,
        sequence: true,
        occurredOn: true,
        periodStart: true,
        periodEnd: true,
        amount: true,
        currency: true,
        notes: true,
        verification: true,
        verificationNote: true,
        fromParty: { select: { id: true, name: true } },
        toParty: { select: { id: true, name: true } },
      },
      orderBy: { sequence: 'asc' },
    });

    const gaps = links.filter((link) => link.kind === 'UNKNOWN_INTERVAL').length;
    const disputed = links.filter(
      (link) => link.kind === 'DISPUTED_TRANSFER' || link.verification === 'DISPUTED',
    ).length;
    const unverified = links.filter(
      (link) => link.verification === 'UNVERIFIED' || link.verification === 'ARTIST_DECLARED',
    ).length;

    return {
      links: links.map((link) => ({ ...link, amount: link.amount?.toString() ?? null })),
      summary: {
        total: links.length,
        gaps,
        disputed,
        unverified,
        /*
         * The one sentence a reviewer needs. "Complete" is never claimed - the
         * most that can be said is that nothing recorded says otherwise, which
         * is a different statement and the honest one.
         */
        statement:
          links.length === 0
            ? 'No provenance has been recorded for this work.'
            : gaps > 0
              ? `${links.length} links recorded, with ${gaps} period${gaps === 1 ? '' : 's'} where custody is not established.`
              : `${links.length} links recorded and no gaps declared. Nothing recorded contradicts the chain; that is not the same as the chain being proven.`,
      },
    };
  });
}

// ---------------------------------------------------------------------------

const sourceSchema = z.object({
  subjectType: z.enum([
    'Artist',
    'Artwork',
    'ArtistExhibition',
    'ArtistRepresentation',
    'CvEntry',
    'InstitutionalSignal',
    'ProvenanceTransaction',
  ]),
  subjectId: z.string().min(1),
  /** Which assertion the source supports. Null means the record as a whole. */
  field: z.string().trim().max(120).optional(),
  sourceName: z.string().trim().min(1, 'Name the source').max(300),
  sourceKind: z.string().trim().max(120).optional(),
  locator: z.string().trim().max(500).optional(),
  extract: z.string().trim().max(4_000).optional(),
});

/**
 * Cite the source behind an assertion.
 *
 * THE VERA HOOK. `Source` existed before this phase but only `Evidence` could
 * reach it, so nothing on an artist or an artwork could say where it came
 * from. Anything in the platform can now point at what stands behind it.
 *
 * `extract` is quoted rather than summarised on purpose: a source that has
 * since moved or gone offline still has to be answerable for, and a paraphrase
 * written by whoever was reading it that day is not the same evidence.
 */
export async function citeSource(input: unknown): Promise<ProvenanceResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'INVALID' };
  }

  const { subjectType, subjectId, field, sourceName, sourceKind, locator, extract } = parsed.data;

  try {
    await performAudited({
      actor,
      action: 'source.cite',
      entityType: subjectType,
      entityId: subjectId,
      summary: `${sourceName} cited`,
      after: { sourceName, field: field ?? null },
      run: async (tx) => {
        // One archive is the source of many documents, so an existing Source
        // is reused rather than duplicated per citation.
        const existing = await tx.source.findFirst({
          where: { name: { equals: sourceName, mode: 'insensitive' } },
          select: { id: true },
        });

        const source =
          existing ??
          (await tx.source.create({
            data: { name: sourceName, kind: sourceKind ?? null, createdById: actor.userId },
            select: { id: true },
          }));

        await tx.sourceReference.create({
          data: {
            sourceId: source.id,
            subjectType,
            subjectId,
            field: field ?? null,
            locator: locator ?? null,
            extract: extract ?? null,
            assertedVia: 'QHAKAZA_STAFF',
            assertedById: actor.userId,
            createdById: actor.userId,
          },
        });
      },
    });
  } catch (error) {
    console.error('citeSource failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

/** Everything cited against one record. */
export async function getSourceReferences(subjectType: string, subjectId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, (tx) =>
    tx.sourceReference.findMany({
      where: { subjectType, subjectId },
      select: {
        id: true,
        field: true,
        locator: true,
        extract: true,
        source: { select: { id: true, name: true, kind: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  );
}
