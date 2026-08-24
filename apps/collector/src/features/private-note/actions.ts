'use server';

import { prisma } from '@qhakaza/shared-db';

import { privateNoteSchema } from '@/lib/validation/private-note';

export type PrivateNoteResult =
  { ok: true } | { ok: false; error: 'INVALID' | 'UNKNOWN'; fieldErrors?: Record<string, string> };

/**
 * Records a Private Note.
 *
 * Written to `PrivateNote`, which is a different table from
 * `PrivateNoteSubmission` despite the similar name: that one is a *member*
 * writing to their advisor about a work and requires a Membership, while this
 * is a prospect who has none.
 *
 * `createMany`, not `create`: RLS makes this table write-only for the public,
 * and `create()` issues INSERT ... RETURNING, which needs a SELECT the policy
 * does not grant.
 */
export async function submitPrivateNote(input: unknown): Promise<PrivateNoteResult> {
  const parsed = privateNoteSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  try {
    await prisma.privateNote.createMany({ data: [parsed.data] });
    return { ok: true };
  } catch (error) {
    // The payload is someone describing what they collect and why. Only the
    // error is logged, never the note.
    console.error('submitPrivateNote failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
