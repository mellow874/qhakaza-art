import { prisma, releasePublicly } from '@qhakaza/shared-db';
import { beforeEach, describe, expect, it } from 'vitest';

import { getArtistBySlug, getBrowseWorks, getFeaturedArtists, getWorkById } from './queries';

/**
 * What the public site is allowed to know.
 *
 * WHY THIS EXISTS AS ITS OWN FILE. Row-level security is exactly that: the
 * policy decides which ROWS an anonymous reader may see, not which COLUMNS.
 * An approved artist's row is readable by the public, and that row now also
 * contains `biographyInternal` - the fuller biography written for assessment.
 * The only thing keeping it off the public site is the explicit `select` in
 * each query.
 *
 * A whitelist enforced by discipline is a whitelist that lasts until someone is
 * in a hurry, so these tests assert on the KEYS of what comes back rather than
 * on particular values. A query that grows a field it should not have fails
 * here even if nobody thinks to update this file.
 */

const FORBIDDEN_ARTIST_FIELDS = ['biographyInternal', 'approved', 'userId', 'socials'];
const FORBIDDEN_WORK_FIELDS = ['price', 'currency', 'status'];

const rand = () => Math.random().toString(36).slice(2, 10);

async function makePublishedArtist() {
  const user = await prisma.user.create({
    data: { email: `a-${rand()}@test.local`, role: 'ARTIST' },
  });

  const artist = await prisma.artist.create({
    data: {
      userId: user.id,
      displayName: 'A Painter',
      slug: `painter-${rand()}`,
      approved: true,
      statement: 'The work is about memory.',
      biographyPublic: 'Born in Durban. Works in Johannesburg.',
      biographyInternal: 'INTERNAL: represented informally, gallery relationship unconfirmed.',
      practice: 'Large-format oil on canvas.',
    },
  });

  const work = await prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: 'A Work',
      description: '',
      images: ['https://example.test/a.jpg'],
      medium: 'Oil',
      dimensions: '100x100',
      price: 45000,
      status: 'DRAFT',
    },
  });

  await releasePublicly(work.id, artist.id);

  return { artist, work };
}

/** Let the artist's story be published, which is a separate permission. */
function permitStory(artistId: string, granted = true) {
  return prisma.artistPermission.create({
    data: { artistId, kind: 'PUBLISH_ARTIST_STORY', granted },
  });
}

beforeEach(async () => {
  await prisma.artworkRelease.deleteMany();
  await prisma.audienceMember.deleteMany();
  await prisma.audience.deleteMany();
  await prisma.artistPermission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();
});

describe('the internal biography never leaves the building', () => {
  it('is absent from the artist page', async () => {
    const { artist } = await makePublishedArtist();
    await permitStory(artist.id);

    const page = await getArtistBySlug(artist.slug);

    expect(page).not.toBeNull();
    for (const field of FORBIDDEN_ARTIST_FIELDS) {
      expect(Object.keys(page!)).not.toContain(field);
    }
  });

  it('is absent from the featured artists row', async () => {
    const { artist } = await makePublishedArtist();
    await permitStory(artist.id);

    const [featured] = await getFeaturedArtists();

    expect(featured).toBeDefined();
    for (const field of FORBIDDEN_ARTIST_FIELDS) {
      expect(Object.keys(featured)).not.toContain(field);
    }
  });

  it('does not appear anywhere in the serialised page', async () => {
    /*
     * The belt-and-braces check. The field could reach the page nested inside
     * a relation rather than at the top level, where a key check would miss
     * it, so this looks for the VALUE anywhere in the output.
     */
    const { artist } = await makePublishedArtist();
    await permitStory(artist.id);

    const page = await getArtistBySlug(artist.slug);

    expect(JSON.stringify(page)).not.toContain('INTERNAL:');
  });
});

describe('the public biography needs the artist to have agreed', () => {
  it('is shown once the artist permits their story to be published', async () => {
    const { artist } = await makePublishedArtist();
    await permitStory(artist.id);

    const page = await getArtistBySlug(artist.slug);

    expect(page?.biographyPublic).toContain('Born in Durban');
    expect(page?.practice).toContain('oil on canvas');
  });

  it('is withheld when the artist has not permitted it', async () => {
    // No permission row at all. The page still exists - it just carries their
    // statement and their work, not their biography.
    const { artist } = await makePublishedArtist();

    const page = await getArtistBySlug(artist.slug);

    expect(page).not.toBeNull();
    expect(page?.biographyPublic).toBeNull();
    expect(page?.practice).toBeNull();
  });

  it('is withheld when the artist refused', async () => {
    const { artist } = await makePublishedArtist();
    await permitStory(artist.id, false);

    const page = await getArtistBySlug(artist.slug);

    expect(page?.biographyPublic).toBeNull();
  });
});

describe('price never reaches the public site', () => {
  it('is absent from browse', async () => {
    await makePublishedArtist();

    const [work] = await getBrowseWorks();

    expect(work).toBeDefined();
    for (const field of FORBIDDEN_WORK_FIELDS) {
      expect(Object.keys(work)).not.toContain(field);
    }
  });

  it('is absent from a single work', async () => {
    const { work } = await makePublishedArtist();

    const found = await getWorkById(work.id);

    expect(found).not.toBeNull();
    expect(JSON.stringify(found)).not.toContain('45000');
  });

  it('is absent from the artist page', async () => {
    const { artist } = await makePublishedArtist();

    const page = await getArtistBySlug(artist.slug);

    expect(JSON.stringify(page)).not.toContain('45000');
  });
});
