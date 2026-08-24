import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArtCard } from '@/features/catalogue/art-card';
import { getArtistBySlug } from '@/features/catalogue/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) return { title: 'Artist not found' };

  return {
    title: artist.displayName,
    // The statement is the artist's own words; truncated, never rewritten.
    description: artist.statement?.slice(0, 200) ?? `Work by ${artist.displayName}.`,
  };
}

export default async function ArtistPage({ params }: Props) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  // An unapproved or unknown artist is a 404, not an empty profile — a profile
  // that exists but has not been approved should not be reachable by guessing.
  if (!artist) notFound();

  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">Artist</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{artist.displayName}</h1>
          {artist.statement && (
            <p className="text-body max-w-2xl leading-relaxed whitespace-pre-line">
              {artist.statement}
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
        <h2 className="mb-12 text-2xl">Available work</h2>

        {artist.artworks.length === 0 ? (
          <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-16 text-center text-sm">
            Nothing is available from this artist at the moment.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {artist.artworks.map((work) => (
              <ArtCard key={work.id} work={work} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
