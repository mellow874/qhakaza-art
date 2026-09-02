import { actorContext, type AuditActor } from '@/lib/audit';
import { withActor } from '@qhakaza/shared-db';

/**
 * One artwork, as Qhakaza sees it.
 *
 * The companion to `getArtistDossier`. Everything here is read in a single
 * transaction with the actor declared, for the same two reasons: RLS needs the
 * actor set, and nine separate round trips to Frankfurt exhausted Prisma's
 * transaction timeout the last time this pattern was ignored.
 */
export async function getArtworkDossier(actor: AuditActor, artworkId: string) {
  return withActor(actorContext(actor), async (tx) => {
    const artwork = await tx.artwork.findUnique({
      where: { id: artworkId },
      select: {
        id: true,
        title: true,
        description: true,
        medium: true,
        dimensions: true,
        price: true,
        currency: true,
        status: true,
        themes: true,
        images: true,
        createdAt: true,
        artist: { select: { id: true, displayName: true, approved: true } },
      },
    });

    if (!artwork) return null;

    const [provenance, documents, sources, prices, releases, permissions] = await Promise.all([
      tx.provenanceTransaction.findMany({
        where: { artworkId },
        select: {
          id: true,
          kind: true,
          sequence: true,
          occurredOn: true,
          periodStart: true,
          periodEnd: true,
          amount: true,
          currency: true,
          notes: true,
          verification: true,
          verificationNote: true,
          fromParty: { select: { id: true, name: true } },
          toParty: { select: { id: true, name: true } },
        },
        orderBy: { sequence: 'asc' },
      }),
      tx.mediaAsset.findMany({
        where: {
          status: { not: 'DELETED' },
          links: { some: { subjectType: 'Artwork', subjectId: artworkId } },
        },
        select: {
          id: true,
          originalFilename: true,
          contentType: true,
          sizeBytes: true,
          confidentiality: true,
          documentType: { select: { id: true, label: true } },
          links: {
            select: { id: true, subjectType: true, subjectId: true, role: true, primaryLink: true },
          },
        },
      }),
      tx.sourceReference.findMany({
        where: { subjectType: 'Artwork', subjectId: artworkId },
        select: {
          id: true,
          field: true,
          locator: true,
          extract: true,
          source: { select: { name: true, kind: true } },
        },
      }),
      // The pricing history behind the current figure.
      tx.declaredPrice.findMany({
        where: { artworkId },
        select: {
          id: true,
          amount: true,
          currency: true,
          basis: true,
          declaredOn: true,
          current: true,
        },
        orderBy: { declaredOn: 'desc' },
      }),
      tx.artworkRelease.findMany({
        where: { artworkId },
        select: {
          id: true,
          tier: true,
          reason: true,
          releasedAt: true,
          revokedAt: true,
          audience: { select: { name: true } },
        },
        orderBy: { releasedAt: 'desc' },
      }),
      tx.artistPermission.findMany({
        where: { artistId: artwork.artist.id },
        select: { id: true, kind: true, granted: true, artworkId: true, scopeNote: true },
      }),
    ]);

    /*
     * The chain's own account of itself. Descriptive, never a score - see
     * getProvenanceChain for why a confidence percentage is refused.
     */
    const gaps = provenance.filter((link) => link.kind === 'UNKNOWN_INTERVAL').length;
    const disputed = provenance.filter(
      (link) => link.kind === 'DISPUTED_TRANSFER' || link.verification === 'DISPUTED',
    ).length;

    return {
      artwork: { ...artwork, price: artwork.price.toString() },
      provenance: provenance.map((link) => ({ ...link, amount: link.amount?.toString() ?? null })),
      provenanceSummary: {
        total: provenance.length,
        gaps,
        disputed,
        statement:
          provenance.length === 0
            ? 'No provenance recorded.'
            : gaps > 0
              ? `${provenance.length} links, ${gaps} period${gaps === 1 ? '' : 's'} where custody is not established.`
              : `${provenance.length} links, no gaps declared. Nothing recorded contradicts the chain.`,
      },
      documents,
      sources,
      prices: prices.map((price) => ({ ...price, amount: price.amount.toString() })),
      releases,
      permissions,
    };
  });
}

export type ArtworkDossier = NonNullable<Awaited<ReturnType<typeof getArtworkDossier>>>;

/** The works belonging to one artist, for navigating between them. */
export async function getArtworkIndex(actor: AuditActor) {
  return withActor(actorContext(actor), (tx) =>
    tx.artwork.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        medium: true,
        artist: { select: { id: true, displayName: true } },
        _count: { select: { transactions: true, releases: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

/** Document types, for the picker on the documents panel. */
export async function getDocumentTypes(actor: AuditActor) {
  return withActor(actorContext(actor), (tx) =>
    tx.documentType.findMany({
      where: { active: true },
      select: { id: true, label: true, guidance: true },
      orderBy: { ordering: 'asc' },
    }),
  );
}
