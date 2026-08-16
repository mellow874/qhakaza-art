import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@qhakaza/shared-db';

// The action reads the session; each test decides who is asking.
const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { submitArtwork, getMyStudio } = await import('./actions');

const VALID = {
  title: 'Highveld Storm III',
  description: 'Oil on canvas, painted over one summer.',
  medium: 'Oil on canvas',
  dimensions: '600 x 900 mm',
  price: '12500',
  images: ['https://example.com/storm.jpg'],
};

function signedInAs(user: { id: string; role: string } | null) {
  auth.mockResolvedValue(user ? { user } : null);
}

async function makeArtist({ approved = false } = {}) {
  const user = await prisma.user.create({
    data: { email: `artist-${Math.random()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: {
      userId: user.id,
      displayName: 'Thandi Mokoena',
      slug: `thandi-${Math.random().toString(36).slice(2)}`,
      approved,
    },
  });
  signedInAs({ id: user.id, role: 'ARTIST' });
  return { user, artist };
}

beforeEach(async () => {
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();
});

describe('submitArtwork', () => {
  it('saves a work against the signed-in artist', async () => {
    const { artist } = await makeArtist();

    const result = await submitArtwork(VALID);

    expect(result.ok).toBe(true);
    const work = await prisma.artwork.findFirstOrThrow();
    expect(work.artistId).toBe(artist.id);
    expect(work.title).toBe(VALID.title);
    expect(work.images).toEqual(VALID.images);
  });

  it('always saves as DRAFT, even for an approved artist', async () => {
    // Releasing is the Command Center's decision. If an artist could publish
    // their own work, vetting would be decorative.
    await makeArtist({ approved: true });

    await submitArtwork(VALID);

    expect((await prisma.artwork.findFirstOrThrow()).status).toBe('DRAFT');
  });

  it('ignores a status in the payload', async () => {
    await makeArtist({ approved: true });

    await submitArtwork({ ...VALID, status: 'PUBLISHED' });

    expect((await prisma.artwork.findFirstOrThrow()).status).toBe('DRAFT');
  });

  it('accepts a work with nothing but a title', async () => {
    // A work in progress should be savable; the fuller record is what release
    // requires, not what saving requires.
    await makeArtist();

    const result = await submitArtwork({ title: 'Untitled study' });

    expect(result.ok).toBe(true);
    const work = await prisma.artwork.findFirstOrThrow();
    expect(work.title).toBe('Untitled study');
    expect(work.images).toEqual([]);
    expect(Number(work.price)).toBe(0);
  });

  it('records who submitted it', async () => {
    const { user } = await makeArtist();

    await submitArtwork(VALID);

    expect((await prisma.artwork.findFirstOrThrow()).createdById).toBe(user.id);
  });

  it('refuses an artist who has no profile yet', async () => {
    const user = await prisma.user.create({
      data: { email: `no-profile-${Math.random()}@test.local`, role: 'ARTIST' },
    });
    signedInAs({ id: user.id, role: 'ARTIST' });

    const result = await submitArtwork(VALID);

    expect(result).toMatchObject({ ok: false, error: 'NO_PROFILE' });
    expect(await prisma.artwork.count()).toBe(0);
  });

  it('refuses a collector, even one with a crafted request', async () => {
    const { artist } = await makeArtist();
    const collector = await prisma.user.create({
      data: { email: `c-${Math.random()}@test.local`, role: 'COLLECTOR' },
    });
    signedInAs({ id: collector.id, role: 'COLLECTOR' });

    const result = await submitArtwork({ ...VALID, artistId: artist.id });

    expect(result).toMatchObject({ ok: false, error: 'FORBIDDEN' });
    expect(await prisma.artwork.count()).toBe(0);
  });

  it('refuses an anonymous caller', async () => {
    await makeArtist();
    signedInAs(null);

    expect(await submitArtwork(VALID)).toMatchObject({ ok: false, error: 'UNAUTHENTICATED' });
    expect(await prisma.artwork.count()).toBe(0);
  });

  it('trusts the session over the payload for whose work it is', async () => {
    // Two artists. The one signed in must own the result, whatever the request
    // claims.
    const other = await makeArtist();
    const mine = await makeArtist();

    await submitArtwork({ ...VALID, artistId: other.artist.id });

    expect((await prisma.artwork.findFirstOrThrow()).artistId).toBe(mine.artist.id);
  });

  it.each([
    ['no title', { title: '   ' }],
    ['a negative price', { price: '-5' }],
    ['a non-URL image', { images: ['not-a-url'] }],
  ])('rejects %s and writes nothing', async (_label, override) => {
    await makeArtist();

    const result = await submitArtwork({ ...VALID, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.artwork.count()).toBe(0);
  });
});

describe('getMyStudio', () => {
  it('returns the profile and its work', async () => {
    await makeArtist({ approved: true });
    await submitArtwork(VALID);

    const studio = await getMyStudio();

    expect(studio?.artist?.approved).toBe(true);
    expect(studio?.artworks).toHaveLength(1);
    expect(studio?.artworks[0].title).toBe(VALID.title);
  });

  it('returns no profile for an artist who has not onboarded', async () => {
    const user = await prisma.user.create({
      data: { email: `n-${Math.random()}@test.local`, role: 'ARTIST' },
    });
    signedInAs({ id: user.id, role: 'ARTIST' });

    const studio = await getMyStudio();

    expect(studio?.artist).toBeNull();
    expect(studio?.artworks).toEqual([]);
  });

  it('never shows another artist’s work', async () => {
    const other = await makeArtist();
    await prisma.artwork.create({
      data: {
        artistId: other.artist.id,
        title: 'Not Mine',
        description: 'x',
        images: [],
        medium: 'Oil',
        dimensions: '1x1',
        price: '1',
      },
    });

    await makeArtist();
    await submitArtwork({ title: 'Mine' });

    const studio = await getMyStudio();

    expect(studio?.artworks.map((work) => work.title)).toEqual(['Mine']);
  });

  it('returns nothing at all for an anonymous visitor', async () => {
    signedInAs(null);
    expect(await getMyStudio()).toBeNull();
  });
});
