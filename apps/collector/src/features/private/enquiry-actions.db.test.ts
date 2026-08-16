import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fingerprintToken } from '@qhakaza/shared-auth/guards';
import { prisma } from '@qhakaza/shared-db';

// The action reads the session; each test decides who is asking.
const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));

const { submitEnquiry } = await import('./enquiry-actions');

const HOUR = 60 * 60 * 1000;
const VALID_TOKEN = 'valid-invitation-token';

function signedInAs(role: string | null) {
  auth.mockResolvedValue(role ? { user: { id: 'user-1', role } } : null);
}

async function seed({ artworkStatus = 'PUBLISHED', artistApproved = true } = {}) {
  await prisma.memberInvitation.create({
    data: {
      email: 'member@test.local',
      tokenHash: fingerprintToken(VALID_TOKEN),
      expiresAt: new Date(Date.now() + HOUR),
    },
  });

  const user = await prisma.user.create({
    data: { email: `artist-${Date.now()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: {
      userId: user.id,
      displayName: 'Naledi Mokoena',
      slug: `naledi-${Date.now()}`,
      approved: artistApproved,
    },
  });
  const artwork = await prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: 'Quiet Inheritance',
      description: 'Mixed media',
      images: [],
      medium: 'Mixed media',
      dimensions: '80 x 60 cm',
      price: '2600',
      status: artworkStatus as 'PUBLISHED' | 'DRAFT',
    },
  });

  return { artwork };
}

const VALID = {
  token: VALID_TOKEN,
  subject: 'Viewing request',
  body: 'I would like to see this work in person.',
};

beforeEach(async () => {
  await prisma.privateNoteSubmission.deleteMany();
  await prisma.activationAttempt.deleteMany();
  await prisma.memberInvitation.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();
  signedInAs('COLLECTOR');
});

describe('submitEnquiry', () => {
  it('records an enquiry from an invited collector', async () => {
    await seed();

    const result = await submitEnquiry(VALID);

    expect(result.ok).toBe(true);
    const note = await prisma.privateNoteSubmission.findFirstOrThrow();
    expect(note.subject).toBe(VALID.subject);
    expect(note.createdById).toBe('user-1');
  });

  it('attaches an enquiry to a released work', async () => {
    const { artwork } = await seed();

    await submitEnquiry({ ...VALID, artworkId: artwork.id });

    const note = await prisma.privateNoteSubmission.findFirstOrThrow();
    expect(note.artworkId).toBe(artwork.id);
  });

  it('refuses a forged token and writes nothing', async () => {
    await seed();

    const result = await submitEnquiry({ ...VALID, token: 'forged' });

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it('refuses an expired token even from a signed-in collector', async () => {
    await prisma.memberInvitation.create({
      data: {
        email: 'stale@test.local',
        tokenHash: fingerprintToken('stale'),
        expiresAt: new Date(Date.now() - HOUR),
      },
    });

    const result = await submitEnquiry({ ...VALID, token: 'stale' });

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it('refuses an artist holding a genuine token', async () => {
    // The action is a public endpoint. A valid token is not a role.
    await seed();
    signedInAs('ARTIST');

    const result = await submitEnquiry(VALID);

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it('refuses an anonymous caller holding a genuine token', async () => {
    await seed();
    signedInAs(null);

    const result = await submitEnquiry(VALID);

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it('refuses to attach an enquiry to an unreleased work', async () => {
    // Otherwise a crafted request could have a draft's title read back from the
    // advisor's screen — a read of raw submissions by another route.
    const { artwork } = await seed({ artworkStatus: 'DRAFT' });

    const result = await submitEnquiry({ ...VALID, artworkId: artwork.id });

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it('refuses to attach an enquiry to work by an unapproved artist', async () => {
    const { artwork } = await seed({ artistApproved: false });

    const result = await submitEnquiry({ ...VALID, artworkId: artwork.id });

    expect(result).toMatchObject({ ok: false, error: 'DENIED' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });

  it.each([
    ['an empty subject', { subject: '' }],
    ['a body that says nothing', { body: 'hi' }],
  ])('rejects %s without writing', async (_label, override) => {
    await seed();

    const result = await submitEnquiry({ ...VALID, ...override });

    expect(result).toMatchObject({ ok: false, error: 'INVALID' });
    expect(await prisma.privateNoteSubmission.count()).toBe(0);
  });
});
