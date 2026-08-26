import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import { getArtworkIndex } from '@/features/artist-intelligence/artwork-queries';

export const metadata: Metadata = {
  title: 'Works',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ArtworksPage() {
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect('/login?callbackUrl=%2Fartworks');
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
  const artworks = await getArtworkIndex(actor);

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-heading font-serif text-3xl">Works</h1>
            <p className="text-muted text-sm">
              {artworks.length} {artworks.length === 1 ? 'work' : 'works'}
            </p>
          </div>
          <Link href="/" className="text-muted hover:text-accent caps text-xs">
            Command Center
          </Link>
        </header>

        {artworks.length === 0 ? (
          <p className="text-muted border-line border border-dashed p-8 text-sm">
            No work has been submitted yet.
          </p>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {artworks.map((artwork) => (
              <li key={artwork.id} className="border-line/70 border-b py-4">
                <Link
                  href={`/artworks/${artwork.id}`}
                  className="hover:text-accent flex flex-wrap items-baseline justify-between gap-3"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-heading">{artwork.title}</span>
                    <span className="text-muted text-xs">
                      {[artwork.artist.displayName, artwork.medium, artwork.status]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>

                  <span className="text-muted text-xs">
                    {/* The two counts a reviewer scans for: is there a chain,
                        and has it gone anywhere. */}
                    {artwork._count.transactions === 0
                      ? 'No provenance'
                      : `${artwork._count.transactions} provenance links`}
                    {artwork._count.releases > 0 && ' · placed'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
