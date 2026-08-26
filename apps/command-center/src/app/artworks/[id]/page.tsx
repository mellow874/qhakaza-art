import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import {
  getArtworkDossier,
  getDocumentTypes,
} from '@/features/artist-intelligence/artwork-queries';
import { ArtworkDossierView } from '@/features/artist-intelligence/artwork-dossier';
import { linkDocument, setDocumentType } from '@/features/documents/actions';
import { citeSource, saveProvenanceLink } from '@/features/provenance/actions';

export const metadata: Metadata = {
  title: 'Artwork record',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ArtworkDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect(`/login?callbackUrl=%2Fartworks%2F${id}`);
  }

  if (!grant.ok) {
    return (
      <main className="theme-light bg-canvas text-body flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-heading text-3xl">Not available</h1>
        <p className="text-body mt-4 max-w-md leading-relaxed">
          This area is limited to Qhakaza staff.
        </p>
      </main>
    );
  }

  const actor = { userId: grant.userId, role: grant.role as 'ADMIN' | 'ADVISOR' | 'ANALYST' };

  const [dossier, documentTypes] = await Promise.all([
    getArtworkDossier(actor, id),
    getDocumentTypes(actor),
  ]);

  if (!dossier) notFound();

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <nav className="border-line/70 flex gap-4 border-b px-6 py-4">
        <Link
          href={`/artists/${dossier.artwork.artist.id}`}
          className="text-muted hover:text-accent caps text-xs"
        >
          ← {dossier.artwork.artist.displayName}
        </Link>
        <Link href="/artworks" className="text-muted hover:text-accent caps text-xs">
          All works
        </Link>
      </nav>

      <ArtworkDossierView
        dossier={dossier}
        documentTypes={documentTypes}
        // Analysts research the record and record what they find; the
        // provenance chain and its citations are exactly that work.
        canEdit={true}
        onSaveProvenance={saveProvenanceLink}
        onCiteSource={citeSource}
        onLinkDocument={linkDocument}
        onSetDocumentType={setDocumentType}
      />
    </div>
  );
}
