import Link from 'next/link';

import { EditorialImage, buttonStyles } from '@qhakaza/shared-ui';
import { belief, benefits, closing, experience, hero, news, preview } from '@/content/collectors';

import { IntelligenceCard } from './intelligence-card';

export function CollectorHero() {
  return (
    <section className="theme-dark bg-canvas grid lg:grid-cols-2">
      <div className="flex flex-col justify-center gap-6 px-6 py-20 sm:px-12 lg:py-28 xl:px-20">
        <p className="eyebrow">{hero.eyebrow}</p>
        <p className="font-display text-heading text-2xl italic">{hero.kicker}</p>

        <h1 className="text-4xl leading-[1.12] sm:text-5xl lg:text-6xl">{hero.title}</h1>

        <p className="text-body max-w-xl leading-relaxed">{hero.body}</p>
        <p className="text-muted max-w-xl text-sm italic">{hero.note}</p>

        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href={hero.primaryCta.href}
            className={buttonStyles({ size: 'lg', className: 'caps' })}
          >
            {hero.primaryCta.label}
          </Link>
          <Link
            href={hero.secondaryCta.href}
            className={buttonStyles({ variant: 'outline', size: 'lg', className: 'caps' })}
          >
            {hero.secondaryCta.label}
          </Link>
        </div>

        <p className="text-muted mt-4 max-w-xl text-sm italic">{hero.membershipNote}</p>
      </div>

      <div className="relative min-h-[22rem] lg:min-h-[40rem]">
        <EditorialImage
          name="collector-hero"
          alt={hero.imageAlt}
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section
      aria-labelledby="what-you-receive"
      className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32"
    >
      <div className="flex flex-col gap-4">
        <p className="eyebrow">{benefits.eyebrow}</p>
        <h2 id="what-you-receive" className="text-4xl sm:text-5xl">
          {benefits.title}
        </h2>
      </div>

      {/* Hairline grid, as in the design: dividers between cells, none outside. */}
      <ul className="mt-20 grid gap-x-14 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
        {benefits.items.map((item) => (
          <li key={item.title} className="flex flex-col gap-5">
            <span className="rule" aria-hidden="true" />
            <h3 className="text-2xl">{item.title}</h3>
            <p className="text-body leading-relaxed">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Belief() {
  return (
    <section aria-labelledby="our-belief" className="theme-dark bg-canvas">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2 lg:py-28">
        <div className="flex flex-col gap-6">
          <p className="eyebrow">{belief.eyebrow}</p>
          <h2 id="our-belief" className="text-4xl leading-[1.15] sm:text-5xl">
            {belief.titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="text-body max-w-lg leading-relaxed">{belief.body}</p>
          <Link
            href={belief.cta.href}
            className={buttonStyles({ size: 'lg', className: 'caps mt-4 self-start' })}
          >
            {belief.cta.label}
          </Link>
        </div>

        <div className="relative aspect-4/3 w-full">
          <EditorialImage
            name="collector-belief"
            alt={belief.imageAlt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

export function IntelligencePreview() {
  return (
    <section aria-labelledby="intelligence-preview" className="bg-raised">
      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-32">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{preview.eyebrow}</p>
          <h2 id="intelligence-preview" className="text-4xl sm:text-5xl">
            {preview.title}
          </h2>
        </div>

        <div className="mt-16 grid gap-px lg:grid-cols-2">
          <IntelligenceCard record={preview.artistRecord} />
          <IntelligenceCard record={preview.artworkRecord} />
        </div>
      </div>
    </section>
  );
}

export function FeaturedExperience() {
  return (
    <section aria-labelledby="featured-experience" className="mx-auto w-full max-w-7xl px-6 py-24">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">{experience.eyebrow}</p>
        <span className="rule" aria-hidden="true" />
      </div>

      <div className="border-line/70 mt-14 grid border lg:grid-cols-2">
        <div className="relative min-h-[20rem] lg:min-h-[30rem]">
          <EditorialImage
            name="collector-experience"
            alt={experience.imageAlt}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="flex flex-col justify-center gap-8 p-10 sm:p-14">
          <h2 id="featured-experience" className="text-3xl leading-snug sm:text-4xl">
            {experience.title}
          </h2>

          <ul className="flex flex-col">
            {experience.highlights.map((highlight) => (
              <li key={highlight} className="border-line/70 border-b py-5 last:border-b-0">
                <span className="border-accent text-body border-l-2 pl-4">{highlight}</span>
              </li>
            ))}
          </ul>

          <Link
            href={experience.cta.href}
            className={buttonStyles({ size: 'lg', className: 'caps self-start' })}
          >
            {experience.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CollectorNews() {
  return (
    <section aria-labelledby="from-the-suite" className="bg-raised">
      <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{news.eyebrow}</p>
          <h2 id="from-the-suite" className="text-4xl sm:text-5xl">
            {news.title}
          </h2>
        </div>

        <ul className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {news.items.map((item) => (
            <li key={item.title} className="border-line/70 flex flex-col gap-5 sm:border-l sm:pl-8">
              <p className="eyebrow">{item.category}</p>
              <span className="rule" aria-hidden="true" />
              <h3 className="text-xl leading-snug">{item.title}</h3>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function CollectorClosing() {
  return (
    <section aria-labelledby="collector-closing" className="theme-dark bg-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-28 text-center">
        <h2 id="collector-closing" className="text-4xl sm:text-5xl">
          {closing.title}
        </h2>
        <p className="text-body leading-relaxed">{closing.body}</p>
        <Link
          href={closing.cta.href}
          className={buttonStyles({ size: 'lg', className: 'caps mt-4' })}
        >
          {closing.cta.label}
        </Link>
      </div>
    </section>
  );
}
