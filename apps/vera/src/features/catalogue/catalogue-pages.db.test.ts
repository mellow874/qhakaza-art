import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';
import { releasePublicly } from '@qhakaza/shared-db';
import { makeArtistWithProfile, resetDb } from '@tests/helpers/db';

const { getArtistBySlug, getBrowseWorks, getWorkById } = await import('./queries');

/**
 * The catalogue pages.
 *
 * Every one asserts the same thing from a different angle: nothing reaches the
 * public that Qhakaza has not deliberately released for editorial use, with the
 * artist's permission. The pages hold no conditions of their own, so if these
 * hold, the pages are safe.
 *
 * `status: 'PUBLISHED'` used to be the whole test. It is now three facts, and
 * `releasePublicly` supplies all three.
 */

async function makePiece(
  artistId: string,
  overrides: { title?: string; status?: 'DRAFT' | 'PUBLISHED' | 'SOLD' | 'HIDDEN' } = {},
) {
  const piece = await prisma.artwork.create({
    data: {
      artistId,
      title: overrides.title ?? 'A piece',
      description: 'Description',
      images: ['https://cdn.example.com/1.jpg'],
      medium: 'Oil on canvas',
      dimensions: '600 x 900 mm',
      price: 5000,
      currency: 'ZAR',
      status: 'DRAFT',
    },
  });

  // Anything the old tests called PUBLISHED means "the public should see it",
  // which now requires an editorial release and the artist's permission.
  if ((overrides.status ?? 'PUBLISHED') === 'PUBLISHED') {
    await releasePublicly(piece.id, artistId);
  } else if (overrides.status !== 'DRAFT') {
    await prisma.artwork.update({ where: { id: piece.id }, data: { status: 'ARCHIVED' } });
  }

  return piece;
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
