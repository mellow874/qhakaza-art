import type { Metadata } from 'next';

import { CtaBand } from '@/components/cta-band';
import { EditorialImage } from '@qhakaza/shared-ui';
import { cta, documents, hero, position } from '@/content/about';

export const metadata: Metadata = {
  title: 'About',
  description: hero.intro,
  openGraph: {
    title: 'About Qhakaza Art Collective',
    description: hero.intro,
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-28 lg:grid-cols-2 lg:gap-20 lg:py-36">
          <div className="flex flex-col gap-8">
            <p className="eyebrow">{hero.eyebrow}</p>
            <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{hero.title}</h1>
          </div>

          <p className="text-body self-center text-lg leading-relaxed">{hero.intro}</p>
        </div>
      </section>

      <section aria-labelledby="our-position" className="mx-auto w-full max-w-7xl px-6 py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-20">
          <h2 id="our-position" className="eyebrow lg:sticky lg:top-32 lg:self-start">
            {position.eyebrow}
          </h2>

          {/* max-w keeps the measure near 70 characters for long-form reading. */}
          <div className="flex max-w-[68ch] flex-col gap-8">
            {position.opening.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-body leading-relaxed">
                {paragraph}
              </p>
            ))}

            <blockquote className="border-accent/70 border-l-2 py-2 pl-6">
              <p className="font-display text-heading text-2xl leading-snug sm:text-3xl">
                {position.pullQuote}
              </p>
            </blockquote>

            {position.body.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-body leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Full-bleed band. The documents carry meaning, so the alt text is descriptive. */}
      <div className="relative h-[22rem] w-full sm:h-[30rem]">
        <EditorialImage
          name="aboutDocuments"
          alt={documents.imageAlt}
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <CtaBand title={cta.title} label={cta.label} href={cta.href} layout="split" />
    </main>
  );
}
