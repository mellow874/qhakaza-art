import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prisma } from '@qhakaza/shared-db';
import { makeArtistWithProfile, makeUser, resetDb } from '@tests/helpers/db';

// The action reads the session through `auth()`; each test decides who is asking.
const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));

// Revalidation is a Next.js runtime concern, irrelevant to what we assert here.
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { saveArtistProfile } = await import('./actions');
type SaveResult = Awaited<ReturnType<typeof saveArtistProfile>>;

function signedInAs(user: { id: string; role: string } | null) {
  auth.mockResolvedValue(user ? { user: { id: user.id, role: user.role } } : null);
}

/** Narrows a result to the failure branch, failing the test if it succeeded. */
function asFailure(result: SaveResult) {
  if (result.ok) throw new Error('Expected the action to fail, but it succeeded');
  return result;
}

const validInput = {
  displayName: 'Thandi Mokoena',
  statement: 'I paint the light of the highveld.',
  socials: { instagram: 'https://instagram.com/thandi' },
};

beforeEach(async () => {
  await resetDb();
  auth.mockReset();
});

describe('saveArtistProfile — authorisation', () => {
  it('rejects an anonymous caller', async () => {
    signedInAs(null);

    const result = await saveArtistProfile(validInput);

    expect(result.ok).toBe(false);
    expect(asFailure(result).error).toBe('UNAUTHENTICATED');
    expect(await prisma.artist.count()).toBe(0);
  });

  it('rejects a COLLECTOR', async () => {
    const collector = await makeUser('COLLECTOR');
    signedInAs(collector);

    const result = await saveArtistProfile(validInput);

    expect(result.ok).toBe(false);
    expect(asFailure(result).error).toBe('FORBIDDEN');
    expect(await prisma.artist.count()).toBe(0);
  });

  it('rejects an ADMIN', async () => {
    const admin = await makeUser('ADMIN');
    signedInAs(admin);

    const result = await saveArtistProfile(validInput);

    expect(result.ok).toBe(false);
    expect(asFailure(result).error).toBe('FORBIDDEN');
    expect(await prisma.artist.count()).toBe(0);
  });

  it('rejects a session whose user no longer exists', async () => {
    signedInAs({ id: 'deleted-user-id', role: 'ARTIST' });

    const result = await saveArtistProfile(validInput);

    expect(result.ok).toBe(false);
    expect(await prisma.artist.count()).toBe(0);
  });
});

describe('saveArtistProfile — creating', () => {
  it('creates the profile for the signed-in artist', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    const result = await saveArtistProfile(validInput);

    expect(result.ok).toBe(true);

    const profile = await prisma.artist.findUniqueOrThrow({
      where: { userId: artist.id },
    });
    expect(profile.displayName).toBe('Thandi Mokoena');
    expect(profile.statement).toBe('I paint the light of the highveld.');
    expect(profile.socials).toEqual({ instagram: 'https://instagram.com/thandi' });
  });

  it('derives a slug from the display name', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    await saveArtistProfile(validInput);

    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.slug).toBe('thandi-mokoena');
  });

  it('makes the slug unique when another artist already took it', async () => {
    await makeArtistWithProfile({ slug: 'thandi-mokoena' });
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    await saveArtistProfile(validInput);

    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.slug).toBe('thandi-mokoena-2');
  });

  it('creates the profile unapproved — approval is the admin’s call', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    await saveArtistProfile(validInput);

    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.approved).toBe(false);
  });

  it('ignores an `approved` flag smuggled into the payload', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    await saveArtistProfile({ ...validInput, approved: true } as never);

    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.approved).toBe(false);
  });

  it('accepts a profile with no statement or socials', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    const result = await saveArtistProfile({ displayName: 'Minimal Studio' });

    expect(result.ok).toBe(true);
  });
});

describe('saveArtistProfile — updating', () => {
  it('updates the existing profile instead of creating a second one', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);
    await saveArtistProfile(validInput);

    await saveArtistProfile({ ...validInput, displayName: 'Thandi M' });

    expect(await prisma.artist.count()).toBe(1);
    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.displayName).toBe('Thandi M');
  });

  it('keeps the original slug when the display name changes', async () => {
    // The slug is a public URL — silently changing it would break inbound links.
    const artist = await makeUser('ARTIST');
    signedInAs(artist);
    await saveArtistProfile(validInput);

    await saveArtistProfile({ ...validInput, displayName: 'Something Entirely Different' });

    const profile = await prisma.artist.findUniqueOrThrow({ where: { userId: artist.id } });
    expect(profile.slug).toBe('thandi-mokoena');
  });

  it('does not reset approval when an approved artist edits their profile', async () => {
    const { user, profile } = await makeArtistWithProfile({ approved: true });
    signedInAs(user);

    await saveArtistProfile({ displayName: 'Renamed Studio' });

    const updated = await prisma.artist.findUniqueOrThrow({ where: { id: profile.id } });
    expect(updated.approved).toBe(true);
  });

  it('cannot touch another artist’s profile', async () => {
    const other = await makeArtistWithProfile({ displayName: 'Untouched Studio' });
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    await saveArtistProfile({ displayName: 'My Studio' });

    const untouched = await prisma.artist.findUniqueOrThrow({
      where: { id: other.profile.id },
    });
    expect(untouched.displayName).toBe('Untouched Studio');
    expect(await prisma.artist.count()).toBe(2);
  });
});

describe('saveArtistProfile — validation', () => {
  it('rejects an empty display name and writes nothing', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    const result = await saveArtistProfile({ displayName: '   ' });

    expect(result.ok).toBe(false);
    expect(asFailure(result).error).toBe('INVALID');
    expect(asFailure(result).fieldErrors?.displayName).toBeTruthy();
    expect(await prisma.artist.count()).toBe(0);
  });

  it('rejects a social link that is not a URL', async () => {
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    const result = await saveArtistProfile({
      displayName: 'Thandi Mokoena',
      socials: { instagram: 'not-a-url' },
    });

    expect(result.ok).toBe(false);
    expect(asFailure(result).error).toBe('INVALID');
    expect(await prisma.artist.count()).toBe(0);
  });
});

describe('getMyArtistProfile', () => {
  it('returns null when the artist has not onboarded yet', async () => {
    const { getMyArtistProfile } = await import('./actions');
    const artist = await makeUser('ARTIST');
    signedInAs(artist);

    expect(await getMyArtistProfile()).toBeNull();
  });

  it('returns only the signed-in artist’s own profile', async () => {
    const { getMyArtistProfile } = await import('./actions');
    await makeArtistWithProfile({ displayName: 'Someone Else' });
    const { user } = await makeArtistWithProfile({ displayName: 'Mine' });
    signedInAs(user);

    const profile = await getMyArtistProfile();

    expect(profile?.displayName).toBe('Mine');
  });
});
