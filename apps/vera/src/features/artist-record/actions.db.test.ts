import { prisma } from '@qhakaza/shared-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  saveAbout,
  saveCvEntry,
  saveExhibition,
  saveLink,
  saveMediums,
  saveRepresentation,
  saveSignal,
  withdrawEntry,
} = await import('./actions');

/**
 * The artist writing their own record.
 *
 * The interesting assertions here are about what the platform REFUSES to let
 * an artist do, and about what it keeps when they change their mind. A test
 * that only proved "saving a CV line saves a CV line" would miss both.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

let userId = '';
let artistId = '';

async function signInAsArtist() {
  const user = await prisma.user.create({
    data: { email: `a-${rand()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: { userId: user.id, displayName: 'An Artist', slug: `a-${rand()}` },
  });

  userId = user.id;
  artistId = artist.id;
  auth.mockResolvedValue({ user: { id: user.id, role: 'ARTIST' } });
}

beforeEach(async () => {
  await prisma.recordChange.deleteMany();
  await prisma.artistMedium.deleteMany();
  await prisma.artistExhibition.deleteMany();
  await prisma.artistRepresentation.deleteMany();
  await prisma.cvEntry.deleteMany();
  await prisma.institutionalSignal.deleteMany();
  await prisma.artistLink.deleteMany();
  await prisma.exhibition.deleteMany();
  await prisma.artistPermission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();

  await signInAsArtist();
});

describe('the two biographies', () => {
  it('keeps them apart', async () => {
    const result = await saveAbout({
      biographyPublic: 'Born in Durban.',
      biographyInternal: 'Gallery relationship is informal and unconfirmed.',
      practice: 'Large-format oil.',
      basedIn: 'Johannesburg',
    });

    expect(result.ok).toBe(true);

    const artist = await prisma.artist.findUniqueOrThrow({ where: { id: artistId } });
    expect(artist.biographyPublic).toBe('Born in Durban.');
    expect(artist.biographyInternal).toContain('unconfirmed');
  });

  it('records what changed, field by field', async () => {
    await saveAbout({ biographyPublic: 'First version.' });
    await saveAbout({ biographyPublic: 'Second version.' });

    const changes = await prisma.recordChange.findMany({
      where: { subjectId: artistId, field: 'artist.biographyPublic' },
      orderBy: { changedAt: 'asc' },
    });

    expect(changes).toHaveLength(2);
    expect(changes[1].previousValue).toBe('First version.');
    expect(changes[1].newValue).toBe('Second version.');
  });

  it('refuses a caller who is not an artist', async () => {
    const collector = await prisma.user.create({
      data: { email: `c-${rand()}@test.local`, role: 'COLLECTOR' },
    });
    auth.mockResolvedValue({ user: { id: collector.id, role: 'COLLECTOR' } });

    expect((await saveAbout({ biographyPublic: 'x' })).ok).toBe(false);
  });
});

describe('exhibitions join the existing table', () => {
  it('creates one Exhibition row and links to it', async () => {
    await saveExhibition({ title: 'A Show', venue: 'A Gallery', startYear: 2024 });

    expect(await prisma.exhibition.count()).toBe(1);
    const link = await prisma.artistExhibition.findFirstOrThrow({
      include: { exhibition: true },
    });
    expect(link.exhibition.title).toBe('A Show');
    expect(link.artistId).toBe(artistId);
  });

  it('reuses the existing Exhibition when a second artist was in the same show', async () => {
    /*
     * The whole point of joining rather than copying. Two artists in one show
     * must be two links to ONE exhibition, or VERA sees two shows.
     */
    await saveExhibition({ title: 'A Show', venue: 'A Gallery' });

    await signInAsArtist(); // a different artist
    await saveExhibition({ title: 'a show', venue: 'A GALLERY' });

    expect(await prisma.exhibition.count()).toBe(1);
    expect(await prisma.artistExhibition.count()).toBe(2);
  });

  it('does not merge same-named shows at different venues', async () => {
    // "Summer Exhibition" happens everywhere. Merging on title alone would
    // attach an artist to a show they were never in.
    await saveExhibition({ title: 'Summer Exhibition', venue: 'Gallery A' });
    await saveExhibition({ title: 'Summer Exhibition', venue: 'Gallery B' });

    expect(await prisma.exhibition.count()).toBe(2);
  });

  it("records the claim as the artist's own, never as verified", async () => {
    await saveExhibition({ title: 'A Show' });

    const link = await prisma.artistExhibition.findFirstOrThrow();
    expect(link.verification).toBe('ARTIST_DECLARED');
    expect(link.assertedVia).toBe('ARTIST');
    expect(link.verifiedAt).toBeNull();
  });

  it('refuses an artist who tries to declare their own claim verified', async () => {
    // The schema has no such field, so it is stripped rather than rejected -
    // the assertion is that it does not reach the row.
    await saveExhibition({
      title: 'A Show',
      verification: 'INDEPENDENTLY_VERIFIED',
      verifiedById: userId,
    });

    const link = await prisma.artistExhibition.findFirstOrThrow();
    expect(link.verification).toBe('ARTIST_DECLARED');
    expect(link.verifiedById).toBeNull();
  });

  it('drops verification back to declared when the entry is edited', async () => {
    await saveExhibition({ title: 'A Show', venue: 'A Gallery' });
    const link = await prisma.artistExhibition.findFirstOrThrow();

    // Qhakaza confirms it...
    await prisma.artistExhibition.update({
      where: { id: link.id },
      data: { verification: 'INDEPENDENTLY_VERIFIED', verifiedAt: new Date() },
    });

    // ...and the artist then changes what it says.
    await saveExhibition({ id: link.id, title: 'A Different Show', venue: 'A Gallery' });

    const after = await prisma.artistExhibition.findUniqueOrThrow({ where: { id: link.id } });
    expect(after.verification).toBe('ARTIST_DECLARED');
    expect(after.verifiedAt).toBeNull();
  });
});

describe('representation reuses Party', () => {
  it('creates one Party and reuses it for a second artist', async () => {
    await saveRepresentation({ partyName: 'Goodman Gallery', current: true });

    await signInAsArtist();
    await saveRepresentation({ partyName: 'goodman gallery', current: true });

    expect(await prisma.party.count()).toBe(1);
    expect(await prisma.artistRepresentation.count()).toBe(2);
  });
});

describe('withdrawing is not deleting', () => {
  it('marks a CV line withdrawn and keeps the row', async () => {
    await saveCvEntry({ title: 'MFA, Fine Art', organisation: 'A University' });
    const entry = await prisma.cvEntry.findFirstOrThrow();

    const result = await withdrawEntry('cvEntry', { id: entry.id, reason: 'Added by mistake' });

    expect(result.ok).toBe(true);
    const after = await prisma.cvEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(after.removedAt).not.toBeNull();
    expect(await prisma.cvEntry.count()).toBe(1);
  });

  it('records why', async () => {
    await saveSignal({ description: 'Acquired by a museum' });
    const signal = await prisma.institutionalSignal.findFirstOrThrow();

    await withdrawEntry('signal', { id: signal.id, reason: 'It was a loan, not an acquisition' });

    const change = await prisma.recordChange.findFirstOrThrow({
      where: { field: 'signal.withdrawn' },
    });
    expect(change.reason).toContain('loan');
  });

  it("will not withdraw another artist's entry", async () => {
    await saveCvEntry({ title: 'Mine' });
    const mine = await prisma.cvEntry.findFirstOrThrow();

    await signInAsArtist(); // someone else
    await withdrawEntry('cvEntry', { id: mine.id });

    const after = await prisma.cvEntry.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.removedAt).toBeNull();
  });
});

describe('mediums come from the configurable list', () => {
  it('records the chosen mediums and which are primary', async () => {
    const oil = await prisma.medium.findFirstOrThrow({ where: { slug: 'oil-on-canvas' } });
    const photo = await prisma.medium.findFirstOrThrow({ where: { slug: 'photography' } });

    await saveMediums({ mediumIds: [oil.id, photo.id], primaryMediumIds: [oil.id] });

    const rows = await prisma.artistMedium.findMany({ where: { artistId } });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.mediumId === oil.id)?.primary).toBe(true);
    expect(rows.find((row) => row.mediumId === photo.id)?.primary).toBe(false);
  });

  it('withdraws a medium rather than deleting the row', async () => {
    const oil = await prisma.medium.findFirstOrThrow({ where: { slug: 'oil-on-canvas' } });
    await saveMediums({ mediumIds: [oil.id], primaryMediumIds: [] });
    await saveMediums({ mediumIds: [], primaryMediumIds: [] });

    const row = await prisma.artistMedium.findFirstOrThrow({ where: { artistId } });
    expect(row.removedAt).not.toBeNull();
  });

  it('brings a medium back without creating a second row', async () => {
    const oil = await prisma.medium.findFirstOrThrow({ where: { slug: 'oil-on-canvas' } });
    await saveMediums({ mediumIds: [oil.id], primaryMediumIds: [] });
    await saveMediums({ mediumIds: [], primaryMediumIds: [] });
    await saveMediums({ mediumIds: [oil.id], primaryMediumIds: [oil.id] });

    const rows = await prisma.artistMedium.findMany({ where: { artistId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].removedAt).toBeNull();
    expect(rows[0].primary).toBe(true);
  });
});

describe('links', () => {
  it('refuses something that is not a web address', async () => {
    const result = await saveLink({ kind: 'Website', url: 'instagram.com/someone' });

    expect(result.ok).toBe(false);
    expect(await prisma.artistLink.count()).toBe(0);
  });

  it('accepts a full address', async () => {
    expect((await saveLink({ kind: 'Website', url: 'https://example.test' })).ok).toBe(true);
  });
});

describe('readiness is out of reach', () => {
  it('is not fetched by anything the artist can call', async () => {
    /*
     * Qhakaza confirmed readiness is never visible to the artist. This asserts
     * the actions module offers no way to reach it - the RLS matrix has no
     * artist grant on any of the three readiness tables, so a query would
     * return nothing anyway, but an action that TRIED would be a signal that
     * someone expected it to work.
     */
    const actions = await import('./actions');

    expect(Object.keys(actions).join(' ')).not.toMatch(/readiness|assessment|criterion/i);
  });
});
