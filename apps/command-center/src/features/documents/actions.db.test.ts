import { prisma } from '@qhakaza/shared-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { getDocumentLinks, linkDocument, setDocumentType, unlinkDocument } =
  await import('./actions');

/**
 * One document, several records.
 *
 * The case that matters is the brief's own: a catalogue that evidences BOTH an
 * artist's exhibition history and a work's provenance. Under the old
 * single-subject shape that was two uploads of the same file.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

let artistId = '';
let artworkId = '';
let exhibitionLinkId = '';
let assetId = '';

async function asRole(role: 'ADMIN' | 'ADVISOR') {
  const user = await prisma.user.create({
    data: { email: `${role.toLowerCase()}-${rand()}@test.local`, role },
  });
  auth.mockResolvedValue({ user: { id: user.id, role } });
  return user.id;
}

beforeEach(async () => {
  await prisma.documentLink.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.artistExhibition.deleteMany();
  await prisma.exhibition.deleteMany();
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

  const artwork = await prisma.artwork.create({
    data: {
      artistId,
      title: 'A Work',
      description: '',
      images: [],
      medium: 'Oil',
      dimensions: '1x1',
      price: 1000,
    },
  });
  artworkId = artwork.id;

  const exhibition = await prisma.exhibition.create({ data: { title: 'A Show' } });
  const link = await prisma.artistExhibition.create({
    data: { artistId, exhibitionId: exhibition.id },
  });
  exhibitionLinkId = link.id;

  const asset = await prisma.mediaAsset.create({
    data: {
      subjectType: 'ArtistExhibition',
      subjectId: exhibitionLinkId,
      bucket: 'documents',
      storagePath: `documents/${rand()}.pdf`,
      originalFilename: 'catalogue.pdf',
      contentType: 'application/pdf',
      sizeBytes: 4096,
      status: 'STORED',
    },
  });
  assetId = asset.id;
  await prisma.documentLink.create({
    data: {
      mediaAssetId: assetId,
      subjectType: 'ArtistExhibition',
      subjectId: exhibitionLinkId,
      primaryLink: true,
    },
  });

  await asRole('ADMIN');
});

describe('one document, several records', () => {
  it('attaches a catalogue to a work as well as an exhibition', async () => {
    const result = await linkDocument({
      mediaAssetId: assetId,
      subjectType: 'Artwork',
      subjectId: artworkId,
      role: 'Provenance support',
    });

    expect(result.ok).toBe(true);

    const links = await getDocumentLinks(assetId);
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.subjectType).sort()).toEqual(['ArtistExhibition', 'Artwork']);
  });

  it('lets the same document mean different things in different places', async () => {
    // The whole reason `role` is on the link and not on the file.
    await linkDocument({
      mediaAssetId: assetId,
      subjectType: 'Artwork',
      subjectId: artworkId,
      role: 'Provenance support',
    });

    const links = await getDocumentLinks(assetId);
    const artworkLink = links.find((link) => link.subjectType === 'Artwork');
    expect(artworkLink?.role).toBe('Provenance support');
    expect(artworkLink?.primaryLink).toBe(false);
  });

  it('does not create a second row when attached twice', async () => {
    const input = { mediaAssetId: assetId, subjectType: 'Artwork', subjectId: artworkId };

    await linkDocument({ ...input, role: 'First attempt' });
    await linkDocument({ ...input, role: 'Corrected' });

    const links = await getDocumentLinks(assetId);
    expect(links).toHaveLength(2);
    expect(links.find((link) => link.subjectType === 'Artwork')?.role).toBe('Corrected');
  });

  it('refuses a subject type that is not a real record', async () => {
    // `subjectType` is a free string in the database. A typo here would create
    // an attachment nothing could ever find again.
    const result = await linkDocument({
      mediaAssetId: assetId,
      subjectType: 'Artworks',
      subjectId: artworkId,
    });

    expect(result.ok).toBe(false);
  });

  it('refuses to attach an upload that never arrived', async () => {
    const pending = await prisma.mediaAsset.create({
      data: {
        subjectType: 'Artwork',
        subjectId: artworkId,
        bucket: 'documents',
        storagePath: `documents/${rand()}.pdf`,
        originalFilename: 'half.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1,
        status: 'PENDING',
      },
    });

    const result = await linkDocument({
      mediaAssetId: pending.id,
      subjectType: 'Artwork',
      subjectId: artworkId,
    });

    expect(result.ok).toBe(false);
    expect(await prisma.documentLink.count({ where: { mediaAssetId: pending.id } })).toBe(0);
  });
});

describe('detaching', () => {
  it('removes an added attachment and leaves the file alone', async () => {
    await linkDocument({ mediaAssetId: assetId, subjectType: 'Artwork', subjectId: artworkId });
    const links = await getDocumentLinks(assetId);
    const added = links.find((link) => !link.primaryLink)!;

    const result = await unlinkDocument({ linkId: added.id });

    expect(result.ok).toBe(true);
    expect(await getDocumentLinks(assetId)).toHaveLength(1);
    // The document itself is untouched.
    expect(await prisma.mediaAsset.count({ where: { id: assetId } })).toBe(1);
  });

  it('refuses to detach the record the document was uploaded against', async () => {
    // That link is where the document came from, which is provenance.
    const links = await getDocumentLinks(assetId);
    const primary = links.find((link) => link.primaryLink)!;

    const result = await unlinkDocument({ linkId: primary.id });

    expect(result.ok).toBe(false);
    expect(await getDocumentLinks(assetId)).toHaveLength(1);
  });

  it('refuses an advisor', async () => {
    await linkDocument({ mediaAssetId: assetId, subjectType: 'Artwork', subjectId: artworkId });
    const added = (await getDocumentLinks(assetId)).find((link) => !link.primaryLink)!;

    await asRole('ADVISOR');
    const result = await unlinkDocument({ linkId: added.id });

    expect(result.ok).toBe(false);
  });
});

describe('what a document is', () => {
  it('records the type', async () => {
    const type = await prisma.documentType.findFirstOrThrow({
      where: { slug: 'exhibition-catalogue' },
    });

    const result = await setDocumentType({ mediaAssetId: assetId, documentTypeId: type.id });

    expect(result.ok).toBe(true);
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(asset.documentTypeId).toBe(type.id);
  });

  it('leaves confidentiality alone unless asked', async () => {
    /*
     * Retyping a file someone deliberately marked CONFIDENTIAL must not
     * quietly widen it because the new type's default is INTERNAL.
     */
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { confidentiality: 'CONFIDENTIAL' },
    });

    const type = await prisma.documentType.findFirstOrThrow({
      where: { slug: 'exhibition-catalogue' },
    });
    await setDocumentType({ mediaAssetId: assetId, documentTypeId: type.id });

    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(asset.confidentiality).toBe('CONFIDENTIAL');
  });

  it('applies the default when explicitly asked', async () => {
    const type = await prisma.documentType.findFirstOrThrow({ where: { slug: 'invoice' } });

    await setDocumentType({
      mediaAssetId: assetId,
      documentTypeId: type.id,
      applyDefaultConfidentiality: true,
    });

    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
    expect(asset.confidentiality).toBe('CONFIDENTIAL');
  });

  it('refuses a retired type', async () => {
    const type = await prisma.documentType.findFirstOrThrow({ where: { slug: 'press-article' } });
    await prisma.documentType.update({ where: { id: type.id }, data: { active: false } });

    const result = await setDocumentType({ mediaAssetId: assetId, documentTypeId: type.id });

    expect(result.ok).toBe(false);

    // Put it back, so the seeded vocabulary is as the next test expects.
    await prisma.documentType.update({ where: { id: type.id }, data: { active: true } });
  });
});
