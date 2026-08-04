import Link from 'next/link';

import { EditorialImage } from '@/components/editorial-image';
import { SectionHeading } from '@/components/section-heading';
import { buttonStyles } from '@/components/ui/button';
import { briefings as briefingItems, homeStrip } from '@/content/briefings';
import { artistNeeds, begin, framework, hero, platformPreview } from '@/content/home';
import { BriefingCard } from '@/features/briefings/briefing-card';

export function Hero() {
  return (
    <section className="border-line/60 grid border-b lg:grid-cols-2">
      <div className="flex flex-col justify-center gap-8 px-6 py-24 sm:px-12 lg:py-32 xl:px-20">
        <p className="eyebrow">{hero.eyebrow}</p>
        <span className="rule" aria-hidden="true" />

        <h1 className="text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
          {hero.title}
          <br />
          <em>{hero.titleEmphasis}</em>
        </h1>

        <p className="text-body max-w-md leading-relaxed">{hero.subtitle}</p>

        <span className="rule mt-4" aria-hidden="true" />

        <div className="flex flex-col gap-2">
          <p className="eyebrow">{hero.footEyebrow}</p>
          <p className="text-heading text-lg">{hero.footLine}</p>
        </div>
      </div>

      <div className="relative min-h-[24rem] lg:min-h-[42rem]">
        <EditorialImage
          name="hero"
          alt={hero.imageAlt}
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  );
}

export function ArtistNeeds() {
  return (
    <section aria-labelledby="artist-needs" className="mx-auto w-full max-w-7xl px-6">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <SectionHeading
          eyebrow={artistNeeds.eyebrow}
          title={artistNeeds.title}
          subtitle={artistNeeds.subtitle}
          id="artist-needs"
          className="lg:sticky lg:top-32 lg:self-start"
        />

        <ol className="border-line/50 flex flex-col border-t">
          {artistNeeds.items.map((item) => (
            <li
              key={item.number}
              className="border-line/50 flex gap-8 border-b py-10 sm:gap-12 sm:py-12"
            >
              <span className="text-accent/60 pt-1.5 text-xs tabular-nums">{item.number}</span>
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl">{item.question}</h3>
                <p className="text-body leading-relaxed">{item.answer}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FrameworkQuote() {
  return (
    <section aria-labelledby="framework-quote" className="relative isolate overflow-hidden">
      <EditorialImage
        name="framework"
        alt={framework.imageAlt}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      {/* Darkened so the quote keeps its contrast over a busy painting. */}
      <div className="bg-canvas/80 absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-32 lg:py-40">
        <p className="eyebrow">{framework.eyebrow}</p>
        <span className="rule" aria-hidden="true" />

        <blockquote id="framework-quote" className="max-w-3xl">
          <p className="font-display text-heading text-4xl leading-[1.2] sm:text-5xl lg:text-6xl">
            &ldquo;{framework.quote}
            <br />
            <em className="text-accent">{framework.quoteEmphasis}</em>&rdquo;
          </p>
        </blockquote>

        <span className="rule" aria-hidden="true" />
      </div>
    </section>
  );
}

export function EvidenceFramework({ panel }: { panel: React.ReactNode }) {
  return (
    <section aria-labelledby="sx-score" className="mx-auto w-full max-w-7xl px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Evidence framework"
            title="The Sx Score"
            subtitle="The Sx Score measures how valuation-ready an artwork is based on documentation strength, market evidence, liquidity signals, narrative validation, and compliance structure"
            id="sx-score"
          />
          <span className="bg-line/60 h-px w-full max-w-lg" aria-hidden="true" />
          <p className="eyebrow">Qhakaza Art Collective · Internal evidence framework</p>
        </div>

        {panel}
      </div>
    </section>
  );
}

export function PlatformPreview({ panel }: { panel: React.ReactNode }) {
  return (
    <section aria-labelledby="platform-preview" className="mx-auto w-full max-w-7xl px-6">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div className="flex flex-col gap-10">
          <SectionHeading
            eyebrow={platformPreview.eyebrow}
            title={platformPreview.title}
            id="platform-preview"
          />
          <p className="text-body max-w-xl leading-relaxed">{platformPreview.description}</p>

          <ul className="flex flex-col gap-4">
            {platformPreview.checklist.map((item) => (
              <li key={item} className="border-accent/70 text-body border-l-2 pl-5 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {panel}
      </div>
    </section>
  );
}

export function Briefings() {
  return (
    <section aria-labelledby="briefings" className="mx-auto w-full max-w-7xl px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow={homeStrip.eyebrow} title={homeStrip.title} id="briefings" />
        <Link
          href="/briefings"
          className="text-accent hover:text-accent-hover caps transition-colors"
        >
          {homeStrip.allLabel} <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Same card as the /briefings index, so the two can never drift. */}
      <div className="mt-14 grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:max-w-4xl">
        {briefingItems.map((briefing) => (
          <BriefingCard key={briefing.slug} briefing={briefing} />
        ))}
      </div>
    </section>
  );
}

export function Begin() {
  return (
    <section aria-labelledby="begin" className="relative isolate overflow-hidden">
      <EditorialImage
        name="begin"
        alt={begin.imageAlt}
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div className="bg-canvas/85 absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-32 lg:py-40">
        <p className="eyebrow">{begin.eyebrow}</p>
        <span className="rule" aria-hidden="true" />

        <h2 id="begin" className="max-w-2xl text-4xl leading-[1.15] sm:text-5xl">
          {begin.title}
        </h2>

        <p className="text-body max-w-xl leading-relaxed">{begin.description}</p>

        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href={begin.primaryCta.href}
            className={buttonStyles({ size: 'lg', className: 'caps' })}
          >
            {begin.primaryCta.label} <span aria-hidden="true">→</span>
          </Link>
          <Link
            href={begin.secondaryCta.href}
            className={buttonStyles({ variant: 'secondary', size: 'lg', className: 'caps' })}
          >
            {begin.secondaryCta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
