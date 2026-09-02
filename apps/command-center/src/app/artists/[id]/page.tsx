import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import {
  recordReadinessAssessment,
  recordVerification,
  setArtistPermission,
} from '@/features/artist-intelligence/actions';
// Approval already lives with the other Command Center decisions. One
// function, so the audit trail and the analyst rule cannot drift apart.
import { setArtistApproval } from '@/features/command-center/actions';
import { ArtistDossierView } from '@/features/artist-intelligence/artist-dossier';
import { getArtistDossier, getReadinessCriteria } from '@/features/artist-intelligence/queries';

export const metadata: Metadata = {
  title: 'Artist record',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ArtistDossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect(`/login?callbackUrl=%2Fartists%2F${id}`);
  }

  // An artist or collector who reaches this URL gets nothing, not a shell.
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

  const [dossier, criteria] = await Promise.all([
    getArtistDossier(actor, id),
    getReadinessCriteria(actor),
  ]);

  if (!dossier) notFound();

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <nav className="border-line/70 border-b px-6 py-4">
        <Link href="/artists" className="text-muted hover:text-accent caps text-xs">
          ← All artists
        </Link>
      </nav>

      <ArtistDossierView
        dossier={dossier}
        criteria={criteria}
        // Analysts research the record; approval is not theirs to give, and
        // only admins change what anyone is allowed to do.
        canApprove={actor.role !== 'ANALYST'}
        canSetPermissions={actor.role === 'ADMIN'}
        onVerify={recordVerification}
        onSetPermission={setArtistPermission}
        onAssess={recordReadinessAssessment}
        onApprove={setArtistApproval}
      />
    </div>
  );
}
