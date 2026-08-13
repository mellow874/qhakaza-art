import type { Metadata } from 'next';

import { ArtCard } from '@/features/catalogue/art-card';
import { getBrowseWorks } from '@/features/catalogue/queries';

export const metadata: Metadata = {
  title: 'Browse',
  description:
    'Available works by artists represented through Qhakaza Art Collective, with medium, dimensions and price.',
};

// Availability changes when an admin releases or withdraws a work, so this is
// read fresh rather than baked in at build time.
export const dynamic = 'force-dynamic';

export default async function BrowsePage() {
  const works = await getBrowseWorks();

  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">The catalogue</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">Browse</h1>
          <p className="text-body max-w-2xl leading-relaxed">
            Work currently available through the collective. Each piece carries its medium,
            dimensions and price.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
        {works.length === 0 ? (
          // Said plainly. An empty catalogue is a real state — a release has to
          // happen before anything appears here.
          <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-16 text-center text-sm">
            No work has been released yet.
          </p>
        ) : (
          <>
            <p className="text-muted mb-12 text-sm">
              {works.length} {works.length === 1 ? 'work' : 'works'} available
            </p>
            <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {works.map((work) => (
                <ArtCard key={work.id} work={work} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
