import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import { getArtistIndex } from '@/features/artist-intelligence/queries';

export const metadata: Metadata = {
  title: 'Artists',
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Every artist, with enough on each to choose one.
 *
 * The counts are of entries that are STANDING - withdrawn claims are not
 * counted, because a reviewer scanning this list wants to know what a record
 * currently says, not how much was ever typed into it.
 */
export default async function ArtistsPage() {
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect('/login?callbackUrl=%2Fartists');
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
  const artists = await getArtistIndex(actor);

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-heading font-serif text-3xl">Artists</h1>
            <p className="text-muted text-sm">
              {artists.length} {artists.length === 1 ? 'artist' : 'artists'} on the platform
            </p>
          </div>
          <Link href="/" className="text-muted hover:text-accent caps text-xs">
            Command Center
          </Link>
        </header>

        {artists.length === 0 ? (
          <p className="text-muted border-line border border-dashed p-8 text-sm">
            No artists yet. They appear here once they have accepted an invitation and built a
            profile.
          </p>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {artists.map((artist) => (
              <li key={artist.id} className="border-line/70 border-b py-4">
                <Link
                  href={`/artists/${artist.id}`}
                  className="hover:text-accent flex flex-wrap items-baseline justify-between gap-3"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-heading">{artist.displayName}</span>
                    <span className="text-muted text-xs">
                      {[
                        artist.basedIn,
                        `${artist._count.artworks} works`,
                        `${artist._count.exhibitions} exhibitions`,
                        `${artist._count.cvEntries} CV lines`,
                        `${artist._count.signals} signals`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>

                  <span className="flex items-center gap-3">
                    {artist._count.assessments === 0 && (
                      <span className="text-muted caps text-xs">Not assessed</span>
                    )}
                    <span
                      className={
                        artist.approved ? 'caps text-accent text-xs' : 'caps text-muted text-xs'
                      }
                    >
                      {artist.approved ? 'Approved' : 'Not approved'}
                    </span>
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
