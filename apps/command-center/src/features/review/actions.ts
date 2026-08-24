'use server';

import { revalidatePath } from 'next/cache';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * The artwork review workflow and internal notes.
 *
 *   DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> PUBLISHED
 *   plus RETURNED_FOR_INFORMATION and REJECTED
 *
 * APPROVED AND PUBLISHED ARE NOT THE SAME THING. Approval is the vetting
 * decision; publication is the release. Keeping them apart lets a reviewer
 * clear a batch and a curator choose the moment work appears. The hard rule in
 * the brief -- nothing public before approval -- is enforced by PUBLISHED being
 * the only status the public RLS policy and `PUBLICLY_VISIBLE_WORK` accept, not
 * by these functions being careful.
 */

export type ReviewResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : T))
  | { ok: false; error: string };

/** Which statuses each transition may be applied from. */
const ALLOWED_FROM = {
  UNDER_REVIEW: ['SUBMITTED', 'RETURNED_FOR_INFORMATION'],
  RETURNED_FOR_INFORMATION: ['SUBMITTED', 'UNDER_REVIEW'],
  APPROVED: ['SUBMITTED', 'UNDER_REVIEW'],
  REJECTED: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'],
  PUBLISHED: ['APPROVED'],
  HIDDEN: ['PUBLISHED'],
} as const;

type Target = keyof typeof ALLOWED_FROM;

/**
 * Move a work to a new status.
 *
 * The transition is guarded in the `where` clause, not by reading first and
 * writing after: two reviewers acting at once must not both succeed, and the
 * second should find nothing to change rather than overwrite the first.
 *
 * PUBLISHED additionally requires the artist to be approved. An approved work
 * by an unapproved artist going live would make artist vetting decorative --
 * the public query would hide it anyway, but the status would be a lie.
 */
export async function setArtworkStatus(input: {
  artworkId: string;
  status: Target;
  note?: string;
}): Promise<ReviewResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const artwork = await readAs(actor, (tx) =>
    tx.artwork.findUnique({
      where: { id: input.artworkId },
      select: { id: true, title: true, status: true, artist: { select: { approved: true } } },
    }),
  );

  if (!artwork) return { ok: false, error: 'NOT_FOUND' };

  const allowed = ALLOWED_FROM[input.status] as readonly string[];
  if (!allowed.includes(artwork.status)) {
    return { ok: false, error: `Cannot move from ${artwork.status} to ${input.status}.` };
  }

  if (input.status === 'PUBLISHED' && !artwork.artist.approved) {
    return { ok: false, error: 'The artist has not been approved yet.' };
  }

  try {
    await performAudited({
      actor,
      action: `artwork.${input.status.toLowerCase()}`,
      entityType: 'Artwork',
      entityId: artwork.id,
      summary: `${artwork.title}: ${artwork.status} to ${input.status}`,
      before: { status: artwork.status },
      after: { status: input.status },
      run: async (tx) => {
        await tx.artwork.updateMany({
          where: { id: artwork.id, status: artwork.status },
          data: { status: input.status },
        });

        // A reviewer's reasoning is an internal note, never evidence and never
        // shown to the artist. What the artist sees is a review request.
        if (input.note?.trim()) {
          await tx.internalNote.create({
            data: {
              subjectType: 'Artwork',
              subjectId: artwork.id,
              body: input.note.trim(),
              authorId: actor.userId,
              createdById: actor.userId,
            },
          });
        }

        // Moving on from a question closes it.
        if (input.status !== 'RETURNED_FOR_INFORMATION') {
          await tx.artworkReviewRequest.updateMany({
            where: { artworkId: artwork.id, resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
        }
      },
    });
  } catch (error) {
    console.error('setArtworkStatus failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

/**
 * Send a submission back with a question.
 *
 * The question is a record the artist can read, not a status alone. Being told
 * "returned for information" without being told what is wanted is being told
 * nothing.
 */
export async function returnForInformation(input: {
  artworkId: string;
  request: string;
}): Promise<ReviewResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const request = input.request.trim();
  if (request.length < 5) return { ok: false, error: 'Say what is needed.' };

  const artwork = await readAs(actor, (tx) =>
    tx.artwork.findUnique({
      where: { id: input.artworkId },
      select: { id: true, title: true, status: true },
    }),
  );

  if (!artwork) return { ok: false, error: 'NOT_FOUND' };

  const allowed = ALLOWED_FROM.RETURNED_FOR_INFORMATION as readonly string[];
  if (!allowed.includes(artwork.status)) {
    return { ok: false, error: `Cannot return a work that is ${artwork.status}.` };
  }

  try {
    await performAudited({
      actor,
      action: 'artwork.returned_for_information',
      entityType: 'Artwork',
      entityId: artwork.id,
      summary: `${artwork.title} returned to the artist with a question`,
      before: { status: artwork.status },
      after: { status: 'RETURNED_FOR_INFORMATION' },
      run: async (tx) => {
        await tx.artwork.updateMany({
          where: { id: artwork.id, status: artwork.status },
          data: { status: 'RETURNED_FOR_INFORMATION' },
        });

        await tx.artworkReviewRequest.create({
          data: { artworkId: artwork.id, request, requestedById: actor.userId, createdById: actor.userId },
        });
      },
    });
  } catch (error) {
    console.error('returnForInformation failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal notes
// ---------------------------------------------------------------------------

/**
 * Write a note about anything.
 *
 * Never evidence. A note enters a Collector Intelligence Case only through a
 * deliberate conversion, which is a separate action added with VERA -- not
 * because it happened to be attached to the same artwork.
 */
export async function addInternalNote(input: {
  subjectType: string;
  subjectId: string;
  body: string;
}): Promise<ReviewResult<{ noteId: string }>> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'A note needs something in it.' };

  let noteId = '';

  try {
    await performAudited({
      actor,
      action: 'note.create',
      entityType: 'InternalNote',
      summary: `Note added on ${input.subjectType}`,
      // The body is deliberately absent from the audit row: notes are internal,
      // and copying their text into a second table widens who can read it.
      after: { subjectType: input.subjectType, subjectId: input.subjectId },
      run: async (tx) => {
        const note = await tx.internalNote.create({
          data: {
            subjectType: input.subjectType,
            subjectId: input.subjectId,
            body,
            authorId: actor.userId,
            createdById: actor.userId,
          },
          select: { id: true },
        });
        noteId = note.id;
      },
    });
  } catch (error) {
    console.error('addInternalNote failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true, noteId };
}

/**
 * Edit a note, keeping what it said before.
 *
 * The previous body is written to the revision table in the same transaction.
 * A note that can be quietly rewritten is not a record of anything, and the
 * brief requires the history to survive a material change.
 */
export async function editInternalNote(input: {
  noteId: string;
  body: string;
}): Promise<ReviewResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const body = input.body.trim();
  if (!body) return { ok: false, error: 'A note needs something in it.' };

  const note = await readAs(actor, (tx) =>
    tx.internalNote.findUnique({ where: { id: input.noteId }, select: { id: true, body: true } }),
  );

  if (!note) return { ok: false, error: 'NOT_FOUND' };

  // Whitespace-only changes are not material and would clutter the history.
  if (note.body.trim() === body) return { ok: true };

  try {
    await performAudited({
      actor,
      action: 'note.edit',
      entityType: 'InternalNote',
      entityId: note.id,
      summary: 'Note edited',
      run: async (tx) => {
        await tx.internalNoteRevision.create({
          data: { noteId: note.id, previousBody: note.body, editedById: actor.userId, createdById: actor.userId },
        });
        await tx.internalNote.update({ where: { id: note.id }, data: { body } });
      },
    });
  } catch (error) {
    console.error('editInternalNote failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/');
  return { ok: true };
}

/** Notes on one subject, newest first, with how many times each was edited. */
export async function listInternalNotes(subjectType: string, subjectId: string) {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return [];

  return readAs(actor, (tx) =>
    tx.internalNote.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        body: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        convertedToEvidenceId: true,
        _count: { select: { revisions: true } },
      },
    }),
  );
}
