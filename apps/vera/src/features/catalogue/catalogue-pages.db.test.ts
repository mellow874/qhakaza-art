import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';
import { makeArtistWithProfile, resetDb } from '@tests/helpers/db';

const { getArtistBySlug, getBrowseWorks, getWorkById } = await import('./queries');

/**
 * The catalogue pages.
 *
 * Every one of these asserts the same thing from a different angle: nothing
 * reaches the public that is not LISTED work by an approved artist. The pages
 * themselves hold no conditions, so if these hold, the pages are safe.
 */

async function makePiece(
  artistId: string,
  overrides: { title?: string; status?: 'DRAFT' | 'LISTED' | 'SOLD' | 'HIDDEN' } = {},
) {
  return prisma.artwork.create({
    data: {
      artistId,
      title: overrides.title ?? 'A piece',
      description: 'Description',
      images: ['https://cdn.example.com/1.jpg'],
      medium: 'Oil on canvas',
      dimensions: '600 x 900 mm',
      price: 5000,
      currency: 'ZAR',
      status: overrides.status ?? 'LISTED',
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('getBrowseWorks', () => {
  it('returns every listed work, not just the featured few', async () => {
    // The featured row caps at 8. Browse is the whole catalogue, so a tenth
    // piece must not fall off it.
    const { profile } = await makeArtistWithProfile({ approved: true });
    for (let i = 0; i < 10; i++) await makePiece(profile.id, { title: `Piece ${i}` });

    expect(await getBrowseWorks()).toHaveLength(10);
  });

  it.each(['DRAFT', 'SOLD', 'HIDDEN'] as const)('never surfaces a %s piece', async (status) => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    await makePiece(profile.id, { status });

    expect(await getBrowseWorks()).toHaveLength(0);
  });

  it('hides work by an unapproved artist', async () => {
    const { profile } = await makeArtistWithProfile({ approved: false });
    await makePiece(profile.id);

    expect(await getBrowseWorks()).toHaveLength(0);
  });
});

describe('getArtistBySlug', () => {
  it('returns an approved artist and their listed work', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true, slug: 'thandi-mokoena' });
    await makePiece(profile.id, { title: 'Highveld Storm' });

    const artist = await getArtistBySlug('thandi-mokoena');

    expect(artist?.displayName).toBe(profile.displayName);
    expect(artist?.artworks.map((work) => work.title)).toEqual(['Highveld Storm']);
  });

  it('returns nothing for an artist who has not been approved', async () => {
    // Otherwise an unapproved profile is reachable by guessing its slug, and
    // approval stops being a gate.
    await makeArtistWithProfile({ approved: false, slug: 'not-approved' });

    expect(await getArtistBySlug('not-approved')).toBeNull();
  });

  it('returns nothing for a slug that does not exist', async () => {
    expect(await getArtistBySlug('no-such-artist')).toBeNull();
  });

  it('omits the artist’s unreleased work from their own page', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true, slug: 'mixed' });
    await makePiece(profile.id, { title: 'Released' });
    await makePiece(profile.id, { title: 'Still a draft', status: 'DRAFT' });

    const artist = await getArtistBySlug('mixed');

    expect(artist?.artworks.map((work) => work.title)).toEqual(['Released']);
  });

  it('carries the artist onto each work, for the card', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true, slug: 'carried' });
    await makePiece(profile.id);

    const artist = await getArtistBySlug('carried');

    expect(artist?.artworks[0].artist).toEqual({
      displayName: profile.displayName,
      slug: 'carried',
    });
  });
});

describe('getWorkById', () => {
  it('returns a listed work with its artist', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    const piece = await makePiece(profile.id, { title: 'Quiet Inheritance' });

    const found = await getWorkById(piece.id);

    expect(found?.work.title).toBe('Quiet Inheritance');
    expect(found?.work.artist.displayName).toBe(profile.displayName);
  });

  it.each(['DRAFT', 'SOLD', 'HIDDEN'] as const)('404s on a %s piece', async (status) => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    const piece = await makePiece(profile.id, { status });

    expect(await getWorkById(piece.id)).toBeNull();
  });

  it('404s on work by an unapproved artist, even with the exact id', async () => {
    const { profile } = await makeArtistWithProfile({ approved: false });
    const piece = await makePiece(profile.id);

    expect(await getWorkById(piece.id)).toBeNull();
  });

  it('returns nothing for an id that does not exist', async () => {
    expect(await getWorkById('cmnotarealidatall000000')).toBeNull();
  });

  it('suggests other work by the same artist, never the piece being viewed', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    const piece = await makePiece(profile.id, { title: 'This one' });
    await makePiece(profile.id, { title: 'Another' });

    const found = await getWorkById(piece.id);

    expect(found?.alsoBy.map((work) => work.title)).toEqual(['Another']);
  });

  it('never suggests another artist’s work', async () => {
    const mine = await makeArtistWithProfile({ approved: true });
    const other = await makeArtistWithProfile({ approved: true });
    const piece = await makePiece(mine.profile.id);
    await makePiece(other.profile.id, { title: 'Not theirs to show' });

    expect((await getWorkById(piece.id))?.alsoBy).toEqual([]);
  });

  it('never suggests an unreleased piece by the same artist', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    const piece = await makePiece(profile.id);
    await makePiece(profile.id, { title: 'Draft', status: 'DRAFT' });

    expect((await getWorkById(piece.id))?.alsoBy).toEqual([]);
  });
});
