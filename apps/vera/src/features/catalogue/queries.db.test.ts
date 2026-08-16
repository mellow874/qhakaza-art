import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@qhakaza/shared-db';
import { makeArtistWithProfile, resetDb } from '@tests/helpers/db';

const { getFeaturedArtists, getFeaturedWorks } = await import('./queries');

type PieceOverrides = {
  title?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'SOLD' | 'HIDDEN';
  createdAt?: Date;
};

async function makePiece(artistId: string, overrides: PieceOverrides = {}) {
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
      status: overrides.status ?? 'PUBLISHED',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('getFeaturedWorks', () => {
  it('returns listed work by an approved artist', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    await makePiece(profile.id, { title: 'Ubuntu in Ochre' });

    const works = await getFeaturedWorks();

    expect(works).toHaveLength(1);
    expect(works[0].title).toBe('Ubuntu in Ochre');
  });

  it.each(['DRAFT', 'SOLD', 'HIDDEN'] as const)('never surfaces a %s piece', async (status) => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    await makePiece(profile.id, { status });

    expect(await getFeaturedWorks()).toHaveLength(0);
  });

  it('hides work by an artist an admin has not approved yet', async () => {
    const { profile } = await makeArtistWithProfile({ approved: false });
    await makePiece(profile.id, { title: 'Not yet approved' });

    expect(await getFeaturedWorks()).toHaveLength(0);
  });

  it('shows only the approved artist’s work when both kinds exist', async () => {
    const approved = await makeArtistWithProfile({ approved: true });
    const pending = await makeArtistWithProfile({ approved: false });
    await makePiece(approved.profile.id, { title: 'Visible' });
    await makePiece(pending.profile.id, { title: 'Hidden' });

    const works = await getFeaturedWorks();

    expect(works.map((work) => work.title)).toEqual(['Visible']);
  });

  it('returns the newest work first', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    await makePiece(profile.id, { title: 'Older', createdAt: new Date('2026-01-01') });
    await makePiece(profile.id, { title: 'Newer', createdAt: new Date('2026-06-01') });

    const works = await getFeaturedWorks();

    expect(works.map((work) => work.title)).toEqual(['Newer', 'Older']);
  });

  it('caps how many pieces the home page asks for', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    for (let index = 0; index < 12; index += 1) {
      await makePiece(profile.id, { title: `Piece ${index}` });
    }

    expect((await getFeaturedWorks()).length).toBeLessThanOrEqual(8);
  });

  it('honours an explicit limit', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    for (let index = 0; index < 5; index += 1) {
      await makePiece(profile.id, { title: `Piece ${index}` });
    }

    expect(await getFeaturedWorks({ limit: 3 })).toHaveLength(3);
  });

  it('includes the artist so a card can credit the work', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true, displayName: 'Thandi M' });
    await makePiece(profile.id);

    const [work] = await getFeaturedWorks();

    expect(work.artist.displayName).toBe('Thandi M');
    expect(work.artist.slug).toBe(profile.slug);
  });

  it('returns an empty array rather than throwing when there is nothing to show', async () => {
    expect(await getFeaturedWorks()).toEqual([]);
  });
});

describe('getFeaturedArtists', () => {
  it('returns an approved artist who has work available', async () => {
    const { profile } = await makeArtistWithProfile({
      approved: true,
      displayName: 'Approved Studio',
    });
    await makePiece(profile.id);

    const artists = await getFeaturedArtists();

    expect(artists).toHaveLength(1);
    expect(artists[0].displayName).toBe('Approved Studio');
  });

  it('excludes an artist awaiting approval even when they have work listed', async () => {
    const { profile } = await makeArtistWithProfile({ approved: false });
    await makePiece(profile.id);

    expect(await getFeaturedArtists()).toHaveLength(0);
  });

  it('excludes approved artists with nothing available to buy', async () => {
    // An empty storefront is a dead end for a collector — do not feature it.
    await makeArtistWithProfile({ approved: true });

    expect(await getFeaturedArtists()).toHaveLength(0);
  });

  it('counts only the available work on each storefront', async () => {
    const { profile } = await makeArtistWithProfile({ approved: true });
    await makePiece(profile.id, { status: 'PUBLISHED' });
    await makePiece(profile.id, { status: 'PUBLISHED' });
    await makePiece(profile.id, { status: 'SOLD' });
    await makePiece(profile.id, { status: 'DRAFT' });

    const [artist] = await getFeaturedArtists();

    expect(artist.availableCount).toBe(2);
  });
});
