import type { Metadata } from 'next';

import { CtaBand } from '@/components/cta-band';
import { cta, features, hero } from '@/content/features';
import { FeatureGrid } from '@/features/platform-features/feature-grid';

export const metadata: Metadata = {
  title: 'Features',
  description: hero.subtitle,
  openGraph: {
    title: 'What you get with Qhakaza Art Collective',
    description: hero.subtitle,
    type: 'website',
  },
};

export default function FeaturesPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="max-w-3xl text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">
            {hero.title}
          </h1>
          <p className="text-body max-w-md text-lg leading-relaxed">{hero.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32">
        <FeatureGrid features={features} />
      </div>

      <CtaBand title={cta.title} label={cta.label} href={cta.href} layout="split" />
    </main>
  );
}
