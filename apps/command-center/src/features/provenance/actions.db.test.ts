import { prisma } from '@qhakaza/shared-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { citeSource, getProvenanceChain, getSourceReferences, saveProvenanceLink } =
  await import('./actions');

/**
 * A provenance chain that can admit what it does not know.
 *
 * The assertions worth having are about the incomplete cases. A test suite
 * that only proved clean transfers can be recorded would pass against the old
 * structure, which is exactly the structure this replaced.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

let artworkId = '';

beforeEach(async () => {
  await prisma.sourceReference.deleteMany();
  await prisma.source.deleteMany();
  await prisma.provenanceTransaction.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.party.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const artistUser = await prisma.user.create({
    data: { email: `artist-${rand()}@test.local`, role: 'ARTIST' },
  });
  const artist = await prisma.artist.create({
    data: { userId: artistUser.id, displayName: 'An Artist', slug: `a-${rand()}` },
  });
  const artwork = await prisma.artwork.create({
    data: {
      artistId: artist.id,
      title: 'A Work',
      description: '',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1000,
    },
  });
  artworkId = artwork.id;

  const admin = await prisma.user.create({
    data: { email: `admin-${rand()}@test.local`, role: 'ADMIN' },
  });
  auth.mockResolvedValue({ user: { id: admin.id, role: 'ADMIN' } });
});

describe('a chain can say what is not known', () => {
  it('records a gap as a link in the chain', async () => {
    const result = await saveProvenanceLink({
      artworkId,
      kind: 'UNKNOWN_INTERVAL',
      periodStart: '1992-01-01',
      periodEnd: '2018-01-01',
      notes: 'No record of custody between the estate sale and the current owner.',
    });

    expect(result.ok).toBe(true);

    const chain = await getProvenanceChain(artworkId);
    expect(chain?.links).toHaveLength(1);
    expect(chain?.links[0].kind).toBe('UNKNOWN_INTERVAL');
    expect(chain?.summary.gaps).toBe(1);
  });

  it('keeps the gap in sequence between the links it sits between', async () => {
    // The gap is a row IN the chain. Ordering is the whole reason.
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      fromPartyName: 'The artist',
      toPartyName: 'First owner',
      occurredOn: '1990-05-01',
    });
    await saveProvenanceLink({
      artworkId,
      kind: 'UNKNOWN_INTERVAL',
      periodStart: '1992-01-01',
      periodEnd: '2018-01-01',
      notes: 'Custody not established.',
    });
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      fromPartyName: 'Unknown',
      toPartyName: 'Current owner',
      occurredOn: '2018-06-01',
    });

    const chain = await getProvenanceChain(artworkId);
    expect(chain?.links.map((link) => link.kind)).toEqual([
      'TRANSFER',
      'UNKNOWN_INTERVAL',
      'TRANSFER',
    ]);
  });

  it('refuses an empty gap', async () => {
    // "We know nothing, and cannot say between when" is not a finding; it is
    // noise that makes a chain look worse without telling anyone anything.
    const result = await saveProvenanceLink({ artworkId, kind: 'UNKNOWN_INTERVAL' });

    expect(result.ok).toBe(false);
    expect(await prisma.provenanceTransaction.count()).toBe(0);
  });

  it('will not let a gap carry parties', async () => {
    /*
     * A from/to on an UNKNOWN_INTERVAL would assert custody in the very row
     * that exists to say custody is not established.
     */
    await saveProvenanceLink({
      artworkId,
      kind: 'UNKNOWN_INTERVAL',
      fromPartyName: 'Someone',
      toPartyName: 'Someone else',
      notes: 'Not established.',
    });

    const link = await prisma.provenanceTransaction.findFirstOrThrow();
    expect(link.fromPartyId).toBeNull();
    expect(link.toPartyId).toBeNull();
    expect(link.amount).toBeNull();
  });

  it('records a contested transfer without resolving it', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'DISPUTED_TRANSFER',
      fromPartyName: 'A dealer',
      toPartyName: 'A collector',
      notes: 'The dealer disputes that title passed.',
      verification: 'DISPUTED',
      verificationNote: 'Two accounts of the 2004 sale.',
    });

    const chain = await getProvenanceChain(artworkId);
    expect(chain?.summary.disputed).toBe(1);
    expect(chain?.links[0].verificationNote).toContain('Two accounts');
  });
});

describe('what the chain claims about itself', () => {
  it('never claims to be complete', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      fromPartyName: 'The artist',
      toPartyName: 'A collector',
      occurredOn: '2020-01-01',
      verification: 'INDEPENDENTLY_VERIFIED',
    });

    const chain = await getProvenanceChain(artworkId);

    // The strongest honest statement is that nothing recorded contradicts it.
    expect(chain?.summary.statement).toContain('not the same as the chain being proven');
    expect(chain?.summary.statement).not.toMatch(/\bcomplete\b/i);
  });

  it('says plainly when custody is not established', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'UNKNOWN_INTERVAL',
      periodStart: '1992-01-01',
      notes: 'Nothing found.',
    });

    const chain = await getProvenanceChain(artworkId);
    expect(chain?.summary.statement).toContain('custody is not established');
  });

  it('offers no score or percentage', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      toPartyName: 'A collector',
      occurredOn: '2020-01-01',
    });

    const chain = await getProvenanceChain(artworkId);
    expect(JSON.stringify(chain?.summary)).not.toMatch(/%|confidence|score/i);
  });
});

describe('parties are reused, not duplicated', () => {
  it('uses one Party row for the same gallery across two links', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      toPartyName: 'Goodman Gallery',
      occurredOn: '2019-01-01',
    });
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      fromPartyName: 'goodman gallery',
      toPartyName: 'A collector',
      occurredOn: '2020-01-01',
    });

    expect(
      await prisma.party.count({ where: { name: { mode: 'insensitive', contains: 'goodman' } } }),
    ).toBe(1);
  });
});

describe('citing a source', () => {
  it('attaches a source to a provenance link', async () => {
    await saveProvenanceLink({
      artworkId,
      kind: 'TRANSFER',
      toPartyName: 'A collector',
      occurredOn: '2020-01-01',
    });
    const link = await prisma.provenanceTransaction.findFirstOrThrow();

    const result = await citeSource({
      subjectType: 'ProvenanceTransaction',
      subjectId: link.id,
      field: 'occurredOn',
      sourceName: 'Gallery sales ledger 2020',
      sourceKind: 'Archive',
      locator: 'p. 44',
      extract: 'Sold 14 March 2020 to a private collector.',
    });

    expect(result.ok).toBe(true);

    const references = await getSourceReferences('ProvenanceTransaction', link.id);
    expect(references).toHaveLength(1);
    expect(references[0].source.name).toBe('Gallery sales ledger 2020');
    expect(references[0].extract).toContain('14 March 2020');
  });

  it('reuses one Source across several citations', async () => {
    // One archive is the source of many documents.
    await citeSource({
      subjectType: 'Artwork',
      subjectId: artworkId,
      sourceName: 'Gallery sales ledger 2020',
    });
    await citeSource({
      subjectType: 'Artwork',
      subjectId: artworkId,
      field: 'medium',
      sourceName: 'gallery sales ledger 2020',
    });

    expect(await prisma.source.count()).toBe(1);
    expect(await prisma.sourceReference.count()).toBe(2);
  });

  it('can cite against an artist record, which was previously impossible', async () => {
    // Before this phase only Evidence could reach a Source at all.
    const artist = await prisma.artist.findFirstOrThrow();

    const result = await citeSource({
      subjectType: 'Artist',
      subjectId: artist.id,
      field: 'biographyInternal',
      sourceName: 'Interview, 3 August',
    });

    expect(result.ok).toBe(true);
    expect(await getSourceReferences('Artist', artist.id)).toHaveLength(1);
  });
});
