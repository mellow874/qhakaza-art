import type { Metadata } from 'next';

import { briefings, hero } from '@/content/briefings';
import { BriefingCard } from '@/features/briefings/briefing-card';

export const metadata: Metadata = {
  title: 'Briefings',
  description:
    'Market intelligence, editorial commentary, regulatory updates and artist spotlights from Qhakaza Art Collective.',
  openGraph: {
    title: 'News & Insights — Qhakaza Art Collective',
    description: 'Research and commentary for artists structuring their practice.',
    type: 'website',
  },
};

export default function BriefingsPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{hero.title}</h1>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
        {briefings.length === 0 ? (
          <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-16 text-center text-sm">
            No briefings have been published yet.
          </p>
        ) : (
          <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:max-w-4xl">
            {briefings.map((briefing) => (
              <BriefingCard key={briefing.slug} briefing={briefing} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
