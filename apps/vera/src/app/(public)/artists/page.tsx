import type { Metadata } from 'next';

import { ArtistCard } from '@/features/catalogue/artist-card';
import { getAllArtists } from '@/features/catalogue/queries';

export const metadata: Metadata = {
  title: 'Artists',
  description:
    'Artists represented through Qhakaza Art Collective, each with available work and a statement of practice.',
};

export const dynamic = 'force-dynamic';

export default async function ArtistsPage() {
  const artists = await getAllArtists();

  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">The collective</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">Artists</h1>
          <p className="text-body max-w-2xl leading-relaxed">
            Artists whose work is available through the collective. Each profile carries a statement
            of practice and the pieces currently released.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
        {artists.length === 0 ? (
          <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-16 text-center text-sm">
            No artists have released work yet.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
