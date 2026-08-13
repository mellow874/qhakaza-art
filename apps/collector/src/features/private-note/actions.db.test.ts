import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

const { submitPrivateNote } = await import('./actions');

/** Only these two are required — the rest is a note, not an application. */
const MINIMAL = { fullName: 'Thandi Mokoena', email: 'thandi@test.local' };

const FULL = {
  ...MINIMAL,
  mediums: ['Painting', 'Textile'],
  regions: ['Southern Africa'],
  subjects: 'Land, memory, and the domestic interior.',
  acquisitionPace: 'STEADY',
  budgetBand: '2K_10K',
  advisoryStyle: 'BALANCED',
  contactStyle: 'MONTHLY',
  building: 'A room that holds work I can live with for decades.',
  frustrations: 'Being sold to before being understood.',
  goodOutcome: 'Two works I am certain about, and a clearer eye.',
  mayContact: true,
};

beforeEach(async () => {
  await prisma.privateNote.deleteMany();
});

describe('submitPrivateNote', () => {
  it('records a complete note', async () => {
    const result = await submitPrivateNote(FULL);

    expect(result.ok).toBe(true);
    const note = await prisma.privateNote.findFirstOrThrow();
    expect(note.mediums).toEqual(['Painting', 'Textile']);
    expect(note.regions).toEqual(['Southern Africa']);
    expect(note.budgetBand).toBe('2K_10K');
    expect(note.goodOutcome).toContain('clearer eye');
    expect(note.mayContact).toBe(true);
  });

  it('accepts a note with nothing but a name and an email', async () => {
    // It is a note. Someone who answers two questions has still told us
    // something worth having, and demanding more would defeat the point.
    const result = await submitPrivateNote(MINIMAL);

    expect(result.ok).toBe(true);
    const note = await prisma.privateNote.findFirstOrThrow();
    expect(note.mediums).toEqual([]);
    expect(note.acquisitionPace).toBeNull();
    expect(note.building).toBeNull();
  });

  it('defaults contact consent to false when it is not given', async () => {
    // Consent is opt-in. Absent must never mean yes.
    await submitPrivateNote(MINIMAL);

    expect((await prisma.privateNote.findFirstOrThrow()).mayContact).toBe(false);
  });

  it('normalises the email so one person is one note-writer', async () => {
    await submitPrivateNote({ ...MINIMAL, email: '  Thandi@Test.LOCAL ' });

    expect((await prisma.privateNote.findFirstOrThrow()).email).toBe('thandi@test.local');
  });

  it('rests at SUBMITTED, waiting for someone to read it', async () => {
    await submitPrivateNote(MINIMAL);

    expect((await prisma.privateNote.findFirstOrThrow()).status).toBe('SUBMITTED');
  });

  it.each([
    ['a medium', { mediums: ['Painting', 'Fine Wine'] }],
    ['a region', { regions: ['Atlantis'] }],
    ['an acquisition pace', { acquisitionPace: 'IMMEDIATELY' }],
    ['a budget band', { budgetBand: 'OVER_9000' }],
    ['an advisory style', { advisoryStyle: 'TELEPATHY' }],
  ])('refuses %s that is not on the published list, and writes nothing', async (_l, override) => {
    // The chips and selects are client state; a crafted request can send
    // anything at all.
    const result = await submitPrivateNote({ ...FULL, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.privateNote.count()).toBe(0);
  });

  it('stores a repeated choice once', async () => {
    await submitPrivateNote({ ...MINIMAL, mediums: ['Painting', 'Painting', 'Print'] });

    expect((await prisma.privateNote.findFirstOrThrow()).mediums).toEqual(['Painting', 'Print']);
  });

  it.each([
    ['no name', { fullName: '   ' }],
    ['a malformed email', { email: 'thandi@' }],
  ])('rejects a note with %s and writes nothing', async (_label, override) => {
    const result = await submitPrivateNote({ ...MINIMAL, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.privateNote.count()).toBe(0);
  });

  it('does not touch PrivateNoteSubmission, which is a different thing', async () => {
    // That table is a *member* writing to their advisor about a work. Writing
    // there instead would put a prospect's survey into the enquiry queue.
    const before = await prisma.privateNoteSubmission.count();

    await submitPrivateNote(FULL);

    expect(await prisma.privateNoteSubmission.count()).toBe(before);
    expect(await prisma.privateNote.count()).toBe(1);
  });
});
