import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));

// Server-only Next APIs the audit wrapper touches, stubbed to what they return
// inside a real request. Without this every audited action throws.
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { addInternalNote, editInternalNote, listInternalNotes, returnForInformation, setArtworkStatus } =
  await import('./actions');

/**
 * The artwork review workflow and internal notes.
 *
 * The state machine is the point: a transition that should be impossible must
 * fail rather than quietly succeed, because the alternative is unvetted work
 * appearing in public.
 */

let adminId: string;
let artistId: string;

async function signInAsAdmin() {
  auth.mockResolvedValue({ user: { id: adminId, role: 'ADMIN' } });
}

async function makeArtwork(status: string, approved = true) {
  const artist = await prisma.artist.findFirstOrThrow();
  if (artist.approved !== approved) {
    await prisma.artist.update({ where: { id: artist.id }, data: { approved } });
  }

  return prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: `Work ${Math.random().toString(36).slice(2, 8)}`,
      description: 'A description',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1000,
      status: status as 'DRAFT',
    },
  });
}

beforeEach(async () => {
  await prisma.internalNoteRevision.deleteMany();
  await prisma.internalNote.deleteMany();
  await prisma.artworkReviewRequest.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: `admin-${Math.random()}@test.local`, role: 'ADMIN' },
  });
  adminId = admin.id;

  const artistUser = await prisma.user.create({
    data: { email: `artist-${Math.random()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: {
      userId: artistUser.id,
      displayName: 'Test Artist',
      slug: `a-${Math.random().toString(36).slice(2)}`,
      approved: true,
    },
  });
  artistId = artist.id;

  await signInAsAdmin();
});

describe('setArtworkStatus', () => {
  it.each([
    ['SUBMITTED', 'UNDER_REVIEW'],
    ['UNDER_REVIEW', 'APPROVED'],
    ['APPROVED', 'PUBLISHED'],
    ['SUBMITTED', 'REJECTED'],
    ['PUBLISHED', 'HIDDEN'],
  ])('allows %s to %s', async (from, to) => {
    const work = await makeArtwork(from);

    const result = await setArtworkStatus({ artworkId: work.id, status: to as 'APPROVED' });

    expect(result.ok).toBe(true);
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe(to);
  });

  it('refuses to publish straight from DRAFT', async () => {
    // The whole point of the workflow. If this passes, vetting is decorative.
    const work = await makeArtwork('DRAFT');

    const result = await setArtworkStatus({ artworkId: work.id, status: 'PUBLISHED' });

    expect(result.ok).toBe(false);
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe('DRAFT');
  });

  it.each(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REJECTED'])(
    'refuses to publish from %s',
    async (from) => {
      const work = await makeArtwork(from);

      expect((await setArtworkStatus({ artworkId: work.id, status: 'PUBLISHED' })).ok).toBe(false);
    },
  );

  it('refuses to publish work by an unapproved artist', async () => {
    // Approved work by an unapproved artist would make artist vetting
    // decorative. The public query hides it either way; the status must not lie.
    const work = await makeArtwork('APPROVED', false);

    const result = await setArtworkStatus({ artworkId: work.id, status: 'PUBLISHED' });

    expect(result).toMatchObject({ ok: false });
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe('APPROVED');
  });

  it('records the transition in the audit trail', async () => {
    const work = await makeArtwork('SUBMITTED');

    await setArtworkStatus({ artworkId: work.id, status: 'UNDER_REVIEW' });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { entityType: 'Artwork', entityId: work.id },
    });
    expect(entry.before).toMatchObject({ status: 'SUBMITTED' });
    expect(entry.after).toMatchObject({ status: 'UNDER_REVIEW' });
  });

  it('stores a reviewer note as an internal note, not on the artwork', async () => {
    const work = await makeArtwork('SUBMITTED');

    await setArtworkStatus({
      artworkId: work.id,
      status: 'APPROVED',
      note: 'Provenance checks out.',
    });

    const notes = await prisma.internalNote.findMany({ where: { subjectId: work.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe('Provenance checks out.');
  });

  it('closes an open question when the work moves on', async () => {
    const work = await makeArtwork('SUBMITTED');
    await returnForInformation({ artworkId: work.id, request: 'Please add dimensions.' });
    await setArtworkStatus({ artworkId: work.id, status: 'UNDER_REVIEW' });

    const open = await prisma.artworkReviewRequest.findMany({
      where: { artworkId: work.id, resolvedAt: null },
    });
    expect(open).toHaveLength(0);
  });

  it('refuses an unknown artwork', async () => {
    expect(await setArtworkStatus({ artworkId: 'nope', status: 'APPROVED' })).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('refuses a caller who is not staff', async () => {
    const work = await makeArtwork('SUBMITTED');
    auth.mockResolvedValue({ user: { id: artistId, role: 'ARTIST' } });

    expect((await setArtworkStatus({ artworkId: work.id, status: 'APPROVED' })).ok).toBe(false);
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe('SUBMITTED');
  });
});

describe('returnForInformation', () => {
  it('sends the work back with a question the artist can read', async () => {
    const work = await makeArtwork('UNDER_REVIEW');

    const result = await returnForInformation({
      artworkId: work.id,
      request: 'Please supply the certificate of authenticity.',
    });

    expect(result.ok).toBe(true);
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: work.id } })).status).toBe(
      'RETURNED_FOR_INFORMATION',
    );

    const request = await prisma.artworkReviewRequest.findFirstOrThrow({
      where: { artworkId: work.id },
    });
    expect(request.request).toContain('certificate');
    expect(request.resolvedAt).toBeNull();
  });

  it('insists on an actual question', async () => {
    // "Returned for information" with no information requested is useless.
    const work = await makeArtwork('SUBMITTED');

    expect((await returnForInformation({ artworkId: work.id, request: '  ' })).ok).toBe(false);
  });

  it('will not return a work that is already published', async () => {
    const work = await makeArtwork('PUBLISHED');

    expect((await returnForInformation({ artworkId: work.id, request: 'Something' })).ok).toBe(false);
  });
});

describe('internal notes', () => {
  it('records the author and the subject', async () => {
    const result = await addInternalNote({
      subjectType: 'Artist',
      subjectId: artistId,
      body: 'Spoke to the gallery; they confirm representation.',
    });

    expect(result.ok).toBe(true);
    const note = await prisma.internalNote.findFirstOrThrow();
    expect(note.authorId).toBe(adminId);
    expect(note.subjectType).toBe('Artist');
  });

  it('refuses an empty note', async () => {
    expect((await addInternalNote({ subjectType: 'Artist', subjectId: artistId, body: '   ' })).ok).toBe(
      false,
    );
  });

  it('keeps the previous text when a note is edited', async () => {
    // A note that can be quietly rewritten is not a record of anything.
    const created = await addInternalNote({
      subjectType: 'Artist',
      subjectId: artistId,
      body: 'First understanding.',
    });
    if (!created.ok) throw new Error('setup failed');

    await editInternalNote({ noteId: created.noteId, body: 'Corrected understanding.' });

    const note = await prisma.internalNote.findUniqueOrThrow({
      where: { id: created.noteId },
      include: { revisions: true },
    });
    expect(note.body).toBe('Corrected understanding.');
    expect(note.revisions).toHaveLength(1);
    expect(note.revisions[0].previousBody).toBe('First understanding.');
  });

  it('keeps every previous version, not just the last', async () => {
    const created = await addInternalNote({
      subjectType: 'Artist',
      subjectId: artistId,
      body: 'One',
    });
    if (!created.ok) throw new Error('setup failed');

    await editInternalNote({ noteId: created.noteId, body: 'Two' });
    await editInternalNote({ noteId: created.noteId, body: 'Three' });

    const revisions = await prisma.internalNoteRevision.findMany({
      where: { noteId: created.noteId },
      orderBy: { createdAt: 'asc' },
    });
    expect(revisions.map((r) => r.previousBody)).toEqual(['One', 'Two']);
  });

  it('does not record a revision for a change that changes nothing', async () => {
    const created = await addInternalNote({
      subjectType: 'Artist',
      subjectId: artistId,
      body: 'Unchanged',
    });
    if (!created.ok) throw new Error('setup failed');

    await editInternalNote({ noteId: created.noteId, body: '  Unchanged  ' });

    expect(await prisma.internalNoteRevision.count()).toBe(0);
  });

  it('never marks a note as evidence on its own', async () => {
    // The brief is explicit: a private comment must not surface in a Case
    // merely because it was attached to the same subject.
    await addInternalNote({ subjectType: 'Artwork', subjectId: 'x', body: 'A thought.' });

    const note = await prisma.internalNote.findFirstOrThrow();
    expect(note.convertedToEvidenceId).toBeNull();
    expect(note.convertedAt).toBeNull();
  });

  it('keeps the note body out of the audit trail', async () => {
    // Copying internal text into a second table widens who can read it.
    await addInternalNote({
      subjectType: 'Artist',
      subjectId: artistId,
      body: 'Something sensitive about a person.',
    });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityType: 'InternalNote' } });
    expect(JSON.stringify(entry)).not.toContain('sensitive');
  });

  it('lists notes for a subject with their edit count', async () => {
    const created = await addInternalNote({
      subjectType: 'Artwork',
      subjectId: 'work-1',
      body: 'Initial',
    });
    if (!created.ok) throw new Error('setup failed');
    await editInternalNote({ noteId: created.noteId, body: 'Revised' });

    const notes = await listInternalNotes('Artwork', 'work-1');

    expect(notes).toHaveLength(1);
    expect(notes[0]._count.revisions).toBe(1);
  });
});
