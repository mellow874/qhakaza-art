import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getMyStudio } from '@/features/artwork/actions';
import { Studio } from '@/features/artwork/studio';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The artist's dashboard.
 *
 * Replaces a Phase 0 placeholder that rendered a title and nothing else — an
 * artist could sign in, complete a profile, and land on a blank page.
 */
export default async function ArtistDashboardPage() {
  const studio = await getMyStudio();

  // The proxy fences /artist to the ARTIST role, but a server component must
  // not rely on that alone: middleware does not run for every path to this code.
  if (!studio) redirect('/login?callbackUrl=%2Fartist%2Fdashboard');

  return <Studio artist={studio.artist} artworks={studio.artworks} />;
}
