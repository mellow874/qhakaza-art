import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from './client';

/*
 * The RLS group below connects as `qhakaza_app` -- the non-owner,
 * NOBYPASSRLS role the applications use.
 *
 * `prisma` and `withActor` connect as the OWNER in tests, which bypasses every
 * policy. Asserting separation over that connection would pass while proving
 * nothing. This is the trap the whole RLS phase exists to avoid, and it caught
 * me here: these four tests failed on the owner connection precisely because
 * the policies were not applying.
 */
const OWNER_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://qhakaza:qhakaza@localhost:5433/qhakaza_art_test?schema=public';
const app = new PrismaClient({
  datasourceUrl: OWNER_URL.replace('qhakaza:qhakaza@', 'qhakaza_app:qhakaza_app@'),
});

/** Run as the app role, with the actor declared for the transaction. */
async function as<T>(role: string, userId: string, run: (tx: PrismaClient) => Promise<T>) {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('qhakaza.role', ${role}, true), set_config('qhakaza.user_id', ${userId}, true)`;
    return run(tx as unknown as PrismaClient);
  });
}

afterAll(() => app.$disconnect());

/**
 * The VERA data architecture.
 *
 * These tests are written against the six constraints the brief states as
 * things the schema must NOT be able to express. Each one asserts the shape
 * survives a case that would break a naive one-to-one model, because a schema
 * that merely happens to work today is not the requirement.
 *
 * The last group is the section 22 separation: an analyst may work Cases and
 * must not thereby be able to read a collector's financial profile.
 */

async function makeArtwork(title: string) {
  const user = await prisma.user.create({
    data: { email: `a-${Math.random()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: {
      userId: user.id,
      displayName: 'Artist',
      slug: `s-${Math.random().toString(36).slice(2)}`,
      approved: true,
    },
  });
  return prisma.artwork.create({
    data: {
      artistId: artist.id,
      title,
      description: '',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1,
    },
  });
}

async function makeEvidence(description: string, artworkId?: string) {
  return prisma.evidence.create({ data: { description, artworkId } });
}

async function makeClaim(statement: string, artworkId?: string) {
  return prisma.claim.create({ data: { statement, artworkId } });
}

async function makeCase(reference: string) {
  return prisma.intelligenceCase.create({ data: { reference, title: `Case ${reference}` } });
}

beforeEach(async () => {
  // Children first. Junctions cascade, but being explicit keeps a failure here
  // readable rather than a wall of FK errors.
  await prisma.evidenceClaim.deleteMany();
  await prisma.claimAssessment.deleteMany();
  await prisma.caseEvidence.deleteMany();
  await prisma.caseArtwork.deleteMany();
  await prisma.contradiction.deleteMany();
  await prisma.gap.deleteMany();
  await prisma.specialistEscalation.deleteMany();
  await prisma.caseVersion.deleteMany();
  await prisma.intelligenceCase.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.methodologyVersion.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.collectorIntake.deleteMany();
  await prisma.user.deleteMany();
});

describe('constraint 1: one evidence supports many claims, one claim rests on many', () => {
  it('links a single item of evidence to several claims', async () => {
    const evidence = await makeEvidence('A 1972 gallery invoice');
    const first = await makeClaim('The work was sold in 1972');
    const second = await makeClaim('The gallery handled the artist that year');

    await prisma.evidenceClaim.createMany({
      data: [
        { evidenceId: evidence.id, claimId: first.id },
        { evidenceId: evidence.id, claimId: second.id },
      ],
    });

    const links = await prisma.evidenceClaim.findMany({ where: { evidenceId: evidence.id } });
    expect(links).toHaveLength(2);
  });

  it('links a single claim to several items of evidence', async () => {
    const claim = await makeClaim('The work is by the artist');
    const a = await makeEvidence('Signature analysis');
    const b = await makeEvidence('Studio photograph');

    await prisma.evidenceClaim.createMany({
      data: [
        { evidenceId: a.id, claimId: claim.id },
        { evidenceId: b.id, claimId: claim.id },
      ],
    });

    expect(await prisma.evidenceClaim.count({ where: { claimId: claim.id } })).toBe(2);
  });

  it('records evidence that tells AGAINST a claim, not only for it', async () => {
    // A model that could only express support would quietly lose every
    // inconvenient document.
    const claim = await makeClaim('The work was never restored');
    const against = await makeEvidence('Conservation report showing overpaint');

    await prisma.evidenceClaim.create({
      data: { evidenceId: against.id, claimId: claim.id, supports: false },
    });

    const link = await prisma.evidenceClaim.findFirstOrThrow({ where: { claimId: claim.id } });
    expect(link.supports).toBe(false);
  });
});

describe('constraint 2: one artwork may appear in several Cases', () => {
  it('puts the same work in two Cases, and several works in one Case', async () => {
    const work = await makeArtwork('Shared work');
    const other = await makeArtwork('Second work');
    const first = await makeCase('QAC-2026-001');
    const second = await makeCase('QAC-2026-002');

    await prisma.caseArtwork.createMany({
      data: [
        { caseId: first.id, artworkId: work.id },
        { caseId: second.id, artworkId: work.id },
        { caseId: first.id, artworkId: other.id },
      ],
    });

    expect(await prisma.caseArtwork.count({ where: { artworkId: work.id } })).toBe(2);
    expect(await prisma.caseArtwork.count({ where: { caseId: first.id } })).toBe(2);
  });
});

describe('constraint 3: one Case may raise several specialist escalations', () => {
  it('records escalations to different specialist categories on one Case', async () => {
    const openCase = await makeCase('QAC-2026-003');
    const provenance = await prisma.specialistCategory.findFirstOrThrow({
      where: { slug: 'PROVENANCE' },
    });
    const legal = await prisma.specialistCategory.findFirstOrThrow({ where: { slug: 'LEGAL' } });

    await prisma.specialistEscalation.createMany({
      data: [
        { caseId: openCase.id, categoryId: provenance.id, issue: 'Gap in the 1980s' },
        { caseId: openCase.id, categoryId: legal.id, issue: 'Export licence unclear' },
      ],
    });

    expect(await prisma.specialistEscalation.count({ where: { caseId: openCase.id } })).toBe(2);
  });
});

describe('constraint 4: taxonomy is data, not a redeployment', () => {
  it('ships the gap types the brief names', async () => {
    const slugs = (await prisma.gapType.findMany()).map((t) => t.slug);

    expect(slugs).toEqual(
      expect.arrayContaining([
        'MISSING_EVIDENCE',
        'EVIDENCE_REQUESTED',
        'EVIDENCE_RECEIVED',
        'WEAK_EVIDENCE',
        'CONTRADICTORY_EVIDENCE',
        'UNVERIFIED_CLAIM',
        'SPECIALIST_REVIEW_REQUIRED',
        'RESOLVED',
      ]),
    );
  });

  it('ships the ten specialist categories the brief names', async () => {
    const slugs = (await prisma.specialistCategory.findMany()).map((c) => c.slug);

    expect(slugs).toEqual(
      expect.arrayContaining([
        'PROVENANCE',
        'AUTHENTICATION',
        'VALUATION',
        'LEGAL',
        'CONDITION',
        'CONSERVATION',
        'TAX',
        'CULTURAL_PROPERTY',
        'ARTIST_SCHOLARSHIP',
        'INSURANCE',
      ]),
    );
  });

  it('accepts a new evidence category as a row', async () => {
    // The whole reason these are tables. If this needed a migration, the
    // requirement would not be met.
    const created = await prisma.evidenceType.create({
      data: { slug: `CUSTOM_${Math.random().toString(36).slice(2, 7)}`, label: 'Something new' },
    });

    expect(created.id).toBeTruthy();
    await prisma.evidenceType.delete({ where: { id: created.id } });
  });
});

describe('constraint 5: conclusions never overwrite earlier ones', () => {
  it('keeps every issued Case version', async () => {
    const method = await prisma.methodologyVersion.create({
      data: { versionNumber: `v${Math.random()}`, effectiveFrom: new Date(), status: 'ACTIVE' },
    });
    const subject = await makeCase('QAC-2026-004');

    await prisma.caseVersion.create({
      data: {
        caseId: subject.id,
        versionNumber: 1,
        decisionAssessment: 'Proceed with caution.',
        methodologyVersionId: method.id,
        issuedAt: new Date(),
      },
    });

    // A revision INSERTS. Nothing updates version 1.
    await prisma.caseVersion.create({
      data: {
        caseId: subject.id,
        versionNumber: 2,
        decisionAssessment: 'New evidence changes the picture.',
        methodologyVersionId: method.id,
        issuedAt: new Date(),
      },
    });

    const versions = await prisma.caseVersion.findMany({
      where: { caseId: subject.id },
      orderBy: { versionNumber: 'asc' },
    });

    expect(versions).toHaveLength(2);
    expect(versions[0].decisionAssessment).toBe('Proceed with caution.');
  });

  it('refuses two versions with the same number on one Case', async () => {
    const subject = await makeCase('QAC-2026-005');
    await prisma.caseVersion.create({ data: { caseId: subject.id, versionNumber: 1 } });

    await expect(
      prisma.caseVersion.create({ data: { caseId: subject.id, versionNumber: 1 } }),
    ).rejects.toThrow();
  });

  it('preserves both sides of a contradiction when it is resolved', async () => {
    // The brief is explicit: contradictions are preserved, never overwritten by
    // later evidence. Resolving records HOW, and leaves both standing.
    const work = await makeArtwork('Contested');
    const a = await makeEvidence('Catalogue says 1971', work.id);
    const b = await makeEvidence('Invoice says 1973', work.id);

    const contradiction = await prisma.contradiction.create({
      data: {
        firstEvidenceId: a.id,
        secondEvidenceId: b.id,
        description: 'Two dates for the same sale',
      },
    });

    await prisma.contradiction.update({
      where: { id: contradiction.id },
      data: { resolution: 'The invoice is primary; the catalogue was reprinted.', resolvedAt: new Date() },
    });

    const after = await prisma.contradiction.findUniqueOrThrow({
      where: { id: contradiction.id },
      include: { firstEvidence: true, secondEvidence: true },
    });

    expect(after.firstEvidence.description).toContain('1971');
    expect(after.secondEvidence.description).toContain('1973');
    expect(after.resolution).toContain('primary');
  });

  it('keeps a historical Case on the methodology it was prepared under', async () => {
    const original = await prisma.methodologyVersion.create({
      data: { versionNumber: `old-${Math.random()}`, effectiveFrom: new Date(), status: 'ACTIVE' },
    });
    const subject = await makeCase('QAC-2026-006');
    await prisma.caseVersion.create({
      data: { caseId: subject.id, versionNumber: 1, methodologyVersionId: original.id, issuedAt: new Date() },
    });

    // The method moves on.
    await prisma.methodologyVersion.update({
      where: { id: original.id },
      data: { status: 'SUPERSEDED' },
    });

    const version = await prisma.caseVersion.findFirstOrThrow({
      where: { caseId: subject.id },
      include: { methodologyVersion: true },
    });
    expect(version.methodologyVersion?.id).toBe(original.id);
  });
});

describe('the reasoning path is reconstructible', () => {
  it('walks Source to Evidence to Claim to Assessment to Gap', async () => {
    const work = await makeArtwork('Traceable');
    const source = await prisma.source.create({ data: { name: 'Gallery archive' } });
    const evidence = await makeEvidence('Consignment ledger entry', work.id);
    const claim = await makeClaim('Consigned in 1984', work.id);
    const assessment = await prisma.assessment.create({
      data: {
        conclusion: 'Consignment is established.',
        inference: 'The ledger is contemporaneous and internally consistent.',
        uncertainty: 'The consignee is named only by initials.',
      },
    });

    await prisma.evidenceSource.create({ data: { evidenceId: evidence.id, sourceId: source.id } });
    await prisma.evidenceClaim.create({ data: { evidenceId: evidence.id, claimId: claim.id } });
    await prisma.claimAssessment.create({ data: { claimId: claim.id, assessmentId: assessment.id } });

    const gapType = await prisma.gapType.findFirstOrThrow({ where: { slug: 'WEAK_EVIDENCE' } });
    await prisma.gap.create({
      data: {
        claimId: claim.id,
        assessmentId: assessment.id,
        gapTypeId: gapType.id,
        description: 'Consignee identified only by initials',
      },
    });

    // Walk it forwards from the source.
    const walked = await prisma.source.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        evidenceLinks: {
          include: {
            evidence: {
              include: { claimLinks: { include: { claim: { include: { gaps: true } } } } },
            },
          },
        },
      },
    });

    const reached = walked.evidenceLinks[0].evidence.claimLinks[0].claim;
    expect(reached.statement).toBe('Consigned in 1984');
    expect(reached.gaps).toHaveLength(1);
  });

  it('keeps inference and uncertainty as separate fields, not one paragraph', async () => {
    // The brief requires evidence, inference and uncertainty to be distinct
    // data concepts rather than three things said in one block of prose.
    const assessment = await prisma.assessment.create({
      data: { conclusion: 'C', inference: 'I', uncertainty: 'U' },
    });

    expect(assessment.inference).toBe('I');
    expect(assessment.uncertainty).toBe('U');
  });
});

describe('section 22: an analyst works Cases and cannot read collector data', () => {
  it('lets an analyst read the evidence graph', async () => {
    await makeEvidence('Something an analyst should see');

    const seen = await as('analyst', 'analyst-1', (tx) => tx.evidence.findMany());

    expect(seen.length).toBeGreaterThan(0);
  });

  it('shows an analyst NO collector applications', async () => {
    // The separation section 22 names. An analyst reading a Case must not
    // thereby be able to read someone's income and liquid-asset bands.
    await prisma.collectorIntake.create({
      data: { fullName: 'A Collector', email: `c-${Math.random()}@test.local` },
    });

    const seen = await as('analyst', 'analyst-1', (tx) => tx.collectorIntake.findMany());

    expect(seen).toEqual([]);
  });

  it('shows an artist nothing of the evidence graph', async () => {
    await makeEvidence('Internal only');

    const seen = await as('artist', 'artist-1', (tx) => tx.evidence.findMany());

    expect(seen).toEqual([]);
  });

  it('shows a collector nothing of the evidence graph', async () => {
    await makeEvidence('Internal only');
    await makeCase('QAC-2026-007');

    const evidence = await as('collector', 'collector-1', (tx) => tx.evidence.findMany());
    const cases = await as('collector', 'collector-1', (tx) => tx.intelligenceCase.findMany());

    expect(evidence).toEqual([]);
    expect(cases).toEqual([]);
  });

  it('lets nobody update an issued Case version, not even an admin', async () => {
    // The storage-level guarantee behind "a revision never destroys a
    // previously issued version".
    const subject = await makeCase('QAC-2026-008');
    const version = await prisma.caseVersion.create({
      data: { caseId: subject.id, versionNumber: 1, decisionAssessment: 'As issued.', issuedAt: new Date() },
    });

    const { count } = await as('admin', 'admin-1', (tx) =>
      tx.caseVersion.updateMany({
        where: { id: version.id },
        data: { decisionAssessment: 'Rewritten after the fact.' },
      }),
    );

    expect(count).toBe(0);
    expect(
      (await prisma.caseVersion.findUniqueOrThrow({ where: { id: version.id } })).decisionAssessment,
    ).toBe('As issued.');
  });
});
