'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * Documents, and what they evidence.
 *
 * THE POINT OF THIS FILE. A document belongs to as many records as it actually
 * supports. The brief's own example is an exhibition catalogue that evidences
 * both an artist's exhibition history and a work's provenance - under the old
 * single-subject shape that meant the same PDF uploaded twice, and two copies
 * that drift the moment either is corrected.
 *
 * A LINK IS NOT A CLAIM. Attaching a catalogue to a provenance transaction
 * says "this document is relevant here", not "this document proves it". What
 * it establishes is recorded as the record's own `verification`, and what it
 * says is recorded as a `SourceReference`. Keeping those apart is why
 * attaching is cheap and verifying is not.
 */

export type DocumentResult = { ok: true } | { ok: false; error: string };

/**
 * The records a document may be attached to.
 *
 * A closed list, because `subjectType` is a free string in the database and an
 * unchecked one would let a typo create an attachment nothing can ever find
 * again.
 */
const SUBJECTS = [
  'Artist',
  'Artwork',
  'ArtistExhibition',
  'ArtistRepresentation',
  'CvEntry',
  'InstitutionalSignal',
  'ProvenanceTransaction',
] as const;

const linkSchema = z.object({
  mediaAssetId: z.string().min(1),
  subjectType: z.enum(SUBJECTS),
  subjectId: z.string().min(1),
  /** Why it is attached HERE, which may differ from why it is attached elsewhere. */
  role: z.string().trim().max(200).optional(),
});

/** Attach a stored document to another record. */
export async function linkDocument(input: unknown): Promise<DocumentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { mediaAssetId, subjectType, subjectId, role } = parsed.data;

  // A link to a file that has not arrived would look like evidence on file.
  const asset = await readAs(actor, (tx) =>
    tx.mediaAsset.findUnique({
      where: { id: mediaAssetId },
      select: { id: true, status: true, originalFilename: true },
    }),
  );

  if (!asset) return { ok: false, error: 'That document could not be found.' };
  if (asset.status !== 'STORED') {
    return { ok: false, error: 'That upload has not finished, so it cannot be attached yet.' };
  }

  try {
    await performAudited({
      actor,
      action: 'document.link',
      entityType: 'DocumentLink',
      entityId: mediaAssetId,
      summary: `${asset.originalFilename} attached to ${subjectType}`,
      after: { subjectType, subjectId, role: role ?? null },
      run: async (tx) => {
        // Attaching twice is a slip, not an error worth refusing over.
        const existing = await tx.documentLink.findFirst({
          where: { mediaAssetId, subjectType, subjectId },
          select: { id: true },
        });

        if (existing) {
          await tx.documentLink.update({
            where: { id: existing.id },
            data: { role: role ?? null },
          });
          return;
        }

        await tx.documentLink.create({
          data: {
            mediaAssetId,
            subjectType,
            subjectId,
            role: role ?? null,
            createdById: actor.userId,
          },
        });
      },
    });
  } catch (error) {
    console.error('linkDocument failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

const unlinkSchema = z.object({ linkId: z.string().min(1) });

/**
 * Detach a document from one record.
 *
 * A REAL DELETE, and the only one in this area. A document attached to the
 * wrong work should come off it, and leaving a withdrawn-attachment tombstone
 * would clutter every record with corrections rather than facts.
 *
 * THE FILE ITSELF IS NEVER DELETED, and the primary link cannot be removed -
 * that one records where the document came from, which is provenance.
 */
export async function unlinkDocument(input: unknown): Promise<DocumentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can detach a document.' };
  }

  const parsed = unlinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const link = await readAs(actor, (tx) =>
    tx.documentLink.findUnique({
      where: { id: parsed.data.linkId },
      select: { id: true, primaryLink: true, subjectType: true, mediaAssetId: true },
    }),
  );

  if (!link) return { ok: false, error: 'That attachment could not be found.' };

  if (link.primaryLink) {
    return {
      ok: false,
      error:
        'This is the record the document was uploaded against, so it cannot be detached. Withdraw the document instead.',
    };
  }

  try {
    await performAudited({
      actor,
      action: 'document.unlink',
      entityType: 'DocumentLink',
      entityId: link.mediaAssetId,
      summary: `Document detached from ${link.subjectType}`,
      run: (tx) => tx.documentLink.delete({ where: { id: link.id } }),
    });
  } catch (error) {
    console.error('unlinkDocument failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

const typeSchema = z.object({
  mediaAssetId: z.string().min(1),
  documentTypeId: z.string().min(1),
  /** Left alone unless given: a type's default should not silently reclassify a file. */
  applyDefaultConfidentiality: z.boolean().optional(),
});

/**
 * Say what a document is.
 *
 * The type carries a default confidentiality - a certificate and an identity
 * document are not the same exposure - but applying it is opt-in. Retyping a
 * file that someone deliberately marked CONFIDENTIAL should not quietly widen
 * it because the type's default happens to be INTERNAL.
 */
export async function setDocumentType(input: unknown): Promise<DocumentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { mediaAssetId, documentTypeId, applyDefaultConfidentiality } = parsed.data;

  const type = await readAs(actor, (tx) =>
    tx.documentType.findUnique({
      where: { id: documentTypeId },
      select: { id: true, label: true, defaultConfidentiality: true, active: true },
    }),
  );

  if (!type) return { ok: false, error: 'That document type could not be found.' };
  if (!type.active) {
    return { ok: false, error: 'That document type has been retired and cannot be applied.' };
  }

  try {
    await performAudited({
      actor,
      action: 'document.type',
      entityType: 'MediaAsset',
      entityId: mediaAssetId,
      summary: `Document recorded as ${type.label}`,
      after: { documentTypeId, label: type.label },
      run: (tx) =>
        tx.mediaAsset.update({
          where: { id: mediaAssetId },
          data: {
            documentTypeId,
            ...(applyDefaultConfidentiality
              ? { confidentiality: type.defaultConfidentiality }
              : {}),
          },
        }),
    });
  } catch (error) {
    console.error('setDocumentType failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/artists');
  return { ok: true };
}

/** Everything a document is attached to, so a reviewer can see its reach. */
export async function getDocumentLinks(mediaAssetId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, (tx) =>
    tx.documentLink.findMany({
      where: { mediaAssetId },
      select: { id: true, subjectType: true, subjectId: true, role: true, primaryLink: true },
      orderBy: [{ primaryLink: 'desc' }, { createdAt: 'asc' }],
    }),
  );
}
