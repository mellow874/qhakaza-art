import { PrismaClient } from '@prisma/client';
import { prisma } from '@qhakaza/shared-db';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { recordReadinessAssessment, recordVerification, setArtistPermission } =
  await import('./actions');

/**
 * Qhakaza working on an artist's record.
 *
 * The assertions worth having are about the separations this feature exists to
 * keep: declared apart from verified, permission apart from approval, and an
 * assessment that cannot be rewritten after the fact.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

/**
 * A connection as `qhakaza_app` - the non-owner, NOBYPASSRLS role the
 * applications actually use. Built once at module scope: connecting inside a
 * test costs more than the test's own timeout allows.
 */
const OWNER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';

const app = new PrismaClient({
  datasourceUrl: OWNER_URL.replace('qhakaza:qhakaza@', 'qhakaza_app:qhakaza_app@'),
});

afterAll(() => app.$disconnect());

let adminId = '';
let artistId = '';
let exhibitionLinkId = '';

async function asRole(role: 'ADMIN' | 'ADVISOR' | 'ANALYST') {
  const user = await prisma.user.create({
    data: { email: `${role.toLowerCase()}-${rand()}@test.local`, role },
  });
  auth.mockResolvedValue({ user: { id: user.id, role } });
  return user.id;
}

beforeEach(async () => {
  await prisma.readinessRating.deleteMany();
  await prisma.readinessAssessment.deleteMany();
  await prisma.readinessCriterion.deleteMany();
  await prisma.recordChange.deleteMany();
  await prisma.artistExhibition.deleteMany();
  await prisma.exhibition.deleteMany();
  await prisma.artistPermission.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const artistUser = await prisma.user.create({
    data: { email: `artist-${rand()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: { userId: artistUser.id, displayName: 'An Artist', slug: `a-${rand()}` },
  });
  artistId = artist.id;

  const exhibition = await prisma.exhibition.create({
    data: { title: 'A Show', venue: 'A Venue' },
  });
  const link = await prisma.artistExhibition.create({
    data: {
      artistId,
      exhibitionId: exhibition.id,
      verification: 'ARTIST_DECLARED',
      assertedVia: 'ARTIST',
    },
  });
  exhibitionLinkId = link.id;

  adminId = await asRole('ADMIN');
});

describe('verification is separate from assertion', () => {
  it('records who verified without touching who asserted', async () => {
    const result = await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'INDEPENDENTLY_VERIFIED',
      note: 'Confirmed against the catalogue',
    });

    expect(result.ok).toBe(true);

    const link = await prisma.artistExhibition.findUniqueOrThrow({
      where: { id: exhibitionLinkId },
    });
    expect(link.verification).toBe('INDEPENDENTLY_VERIFIED');
    expect(link.verifiedById).toBe(adminId);
    // Still the artist's claim. Verifying it does not make it ours.
    expect(link.assertedVia).toBe('ARTIST');
  });

  it('treats could-not-confirm as a real outcome', async () => {
    const result = await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'UNABLE_TO_VERIFY',
      note: 'The gallery has no record of the show',
    });

    expect(result.ok).toBe(true);
    const link = await prisma.artistExhibition.findUniqueOrThrow({
      where: { id: exhibitionLinkId },
    });
    expect(link.verification).toBe('UNABLE_TO_VERIFY');
    expect(link.verificationNote).toContain('no record');
  });

  it('refuses to record a dispute without saying why', async () => {
    // An unexplained "disputed" is an accusation without a reason.
    const result = await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'DISPUTED',
    });

    expect(result.ok).toBe(false);
    const link = await prisma.artistExhibition.findUniqueOrThrow({
      where: { id: exhibitionLinkId },
    });
    expect(link.verification).toBe('ARTIST_DECLARED');
  });

  it('clears the verifier when a confirmed claim is later queried', async () => {
    await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'INDEPENDENTLY_VERIFIED',
    });

    await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'DISPUTED',
      note: 'A second source contradicts the dates',
    });

    const link = await prisma.artistExhibition.findUniqueOrThrow({
      where: { id: exhibitionLinkId },
    });
    // A stale verifier left on a queried claim would read as an endorsement.
    expect(link.verifiedById).toBeNull();
    expect(link.verifiedAt).toBeNull();
  });

  it('records the act in the audit trail', async () => {
    await recordVerification({
      kind: 'exhibition',
      id: exhibitionLinkId,
      verification: 'DOCUMENT_ON_FILE',
    });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { action: 'artist.verify' } });
    expect(entry.entityId).toBe(exhibitionLinkId);
  });
});

describe('permissions', () => {
  it('requires a record of what the artist actually did', async () => {
    const result = await setArtistPermission({
      artistId,
      kind: 'SHARE_PRIVATELY_WITH_COLLECTORS',
      granted: true,
      confirmingAction: '',
    });

    expect(result.ok).toBe(false);
    expect(await prisma.artistPermission.count()).toBe(0);
  });

  it('records a grant with its provenance', async () => {
    const result = await setArtistPermission({
      artistId,
      kind: 'SHARE_PRIVATELY_WITH_COLLECTORS',
      granted: true,
      confirmingAction: 'Confirmed by email, 12 March',
      scopeNote: 'Not the 2019 series',
    });

    expect(result.ok).toBe(true);
    const permission = await prisma.artistPermission.findFirstOrThrow();
    expect(permission.granted).toBe(true);
    expect(permission.confirmingAction).toContain('12 March');
    expect(permission.scopeNote).toContain('2019');
  });

  it('updates the artist-wide row rather than creating a second one', async () => {
    /*
     * The unique key includes a nullable artworkId, and a compound-unique
     * upsert cannot match null. Two rows for one artist-wide decision would
     * then disagree with each other.
     */
    const input = {
      artistId,
      kind: 'PUBLISH_PUBLICLY' as const,
      confirmingAction: 'Signed the release',
    };

    await setArtistPermission({ ...input, granted: true });
    await setArtistPermission({ ...input, granted: false });

    const rows = await prisma.artistPermission.findMany({ where: { artistId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].granted).toBe(false);
  });

  it('refuses an advisor', async () => {
    await asRole('ADVISOR');

    const result = await setArtistPermission({
      artistId,
      kind: 'PUBLISH_PUBLICLY',
      granted: true,
      confirmingAction: 'Said so',
    });

    expect(result.ok).toBe(false);
    expect(await prisma.artistPermission.count()).toBe(0);
  });
});

describe('readiness', () => {
  it('explains itself rather than failing when no criteria exist', async () => {
    // This is the state every installation starts in, because the framework is
    // Qhakaza's and is deliberately not seeded.
    const result = await recordReadinessAssessment({ artistId, ratings: [] });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Lists');
  });

  it('records an assessment against the criteria that exist', async () => {
    const criterion = await prisma.readinessCriterion.create({
      data: { slug: `c-${rand()}`, label: 'Exhibition history' },
    });

    const result = await recordReadinessAssessment({
      artistId,
      summary: 'Strong regional showing, thin internationally.',
      recommendation: 'Revisit in six months',
      ratings: [{ criterionId: criterion.id, rating: 'Developing', evidence: 'Four group shows' }],
    });

    expect(result.ok).toBe(true);
    const assessment = await prisma.readinessAssessment.findFirstOrThrow({
      include: { ratings: true },
    });
    expect(assessment.recommendation).toBe('Revisit in six months');
    expect(assessment.ratings[0].rating).toBe('Developing');
  });

  it('supersedes rather than overwrites', async () => {
    const criterion = await prisma.readinessCriterion.create({
      data: { slug: `c-${rand()}`, label: 'Exhibition history' },
    });

    await recordReadinessAssessment({
      artistId,
      summary: 'First view.',
      ratings: [{ criterionId: criterion.id, rating: 'Early' }],
    });
    await recordReadinessAssessment({
      artistId,
      summary: 'Second view.',
      ratings: [{ criterionId: criterion.id, rating: 'Developing' }],
    });

    const all = await prisma.readinessAssessment.findMany({ orderBy: { assessedAt: 'asc' } });
    expect(all).toHaveLength(2);
    // The first is untouched and the second knows what it replaced.
    expect(all[0].summary).toBe('First view.');
    expect(all[1].supersedesId).toBe(all[0].id);
  });

  it('skips a criterion that was left blank', async () => {
    // A blank rating recorded as an empty row looks like it was assessed.
    const rated = await prisma.readinessCriterion.create({
      data: { slug: `c-${rand()}`, label: 'Rated' },
    });
    const blank = await prisma.readinessCriterion.create({
      data: { slug: `c-${rand()}`, label: 'Left alone' },
    });

    await recordReadinessAssessment({
      artistId,
      ratings: [{ criterionId: rated.id, rating: 'Developing' }, { criterionId: blank.id }],
    });

    const ratings = await prisma.readinessRating.findMany();
    expect(ratings).toHaveLength(1);
    expect(ratings[0].criterionId).toBe(rated.id);
  });

  it('cannot be edited afterwards', async () => {
    /*
     * The application role has UPDATE revoked on this table, so this is a
     * database guarantee rather than the absence of a code path. Asserted
     * through the app connection, which is the one that is constrained.
     */
    const criterion = await prisma.readinessCriterion.create({
      data: { slug: `c-${rand()}`, label: 'Exhibition history' },
    });
    await recordReadinessAssessment({
      artistId,
      summary: 'A view.',
      ratings: [{ criterionId: criterion.id, rating: 'Early' }],
    });

    const assessment = await prisma.readinessAssessment.findFirstOrThrow();

    await expect(
      app.readinessAssessment.update({
        where: { id: assessment.id },
        data: { summary: 'A revised view.' },
      }),
    ).rejects.toThrow();

    // And the row is exactly as it was.
    const after = await prisma.readinessAssessment.findUniqueOrThrow({
      where: { id: assessment.id },
    });
    expect(after.summary).toBe('A view.');
  });
});
