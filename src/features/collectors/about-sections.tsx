import Link from 'next/link';

import { buttonStyles } from '@qhakaza/shared-ui';
import { about } from '@/content/collectors';

/**
 * The collector About page. Three grounds alternate down the page — dark hero,
 * canvas mission, lifted story — and the measure changes with them: the mission
 * sits in a narrow column, the story runs wide. That contrast is the design's,
 * not decoration; it marks the shift from statement to narrative.
 */

function AboutHero() {
  return (
    <section className="theme-dark bg-canvas">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-24 sm:py-32">
        <p className="eyebrow">{about.eyebrow}</p>
        <h1 className="text-4xl leading-[1.12] sm:text-5xl lg:text-6xl">{about.title}</h1>
        <p className="text-body max-w-xl leading-relaxed">{about.lede}</p>
      </div>
    </section>
  );
}

function Mission() {
  return (
    <section aria-labelledby="our-mission" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <span className="rule" aria-hidden="true" />
      <h2 id="our-mission" className="mt-8 text-4xl sm:text-5xl">
        {about.mission.title}
      </h2>

      <div className="mt-12 flex max-w-md flex-col gap-8">
        {about.mission.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-body leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

function Story() {
  return (
    <section aria-labelledby="the-story" className="bg-surface">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-32">
        <h2 id="the-story" className="eyebrow">
          {about.story.eyebrow}
        </h2>

        <div className="mt-14 flex flex-col gap-8">
          {about.story.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-body leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Structure() {
  return (
    <section aria-labelledby="how-we-are-organised" className="mx-auto w-full max-w-6xl px-6 py-24">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">{about.structure.eyebrow}</p>
        <h2 id="how-we-are-organised" className="text-4xl sm:text-5xl">
          {about.structure.title}
        </h2>
      </div>

      {/* gap-px over a line-coloured ground: hairlines between the cells, none
          around the outside, as in the design. */}
      <ul className="bg-line/70 mt-14 grid gap-px sm:grid-cols-3">
        {about.structure.teams.map((team) => (
          <li key={team.title} className="bg-surface flex flex-col gap-6 p-10">
            <span className="rule" aria-hidden="true" />
            <h3 className="text-2xl">{team.title}</h3>
            <p className="text-body leading-relaxed">{team.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AboutClosing() {
  return (
    <section aria-labelledby="about-closing" className="theme-dark bg-canvas">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-6 py-28 text-center">
        <h2 id="about-closing" className="text-4xl sm:text-5xl">
          {about.closing.title}
        </h2>
        <Link
          href={about.closing.cta.href}
          className={buttonStyles({ size: 'lg', className: 'caps' })}
        >
          {about.closing.cta.label}
        </Link>
      </div>
    </section>
  );
}

export function CollectorAbout() {
  return (
    <>
      <AboutHero />
      <Mission />
      <Story />
      <Structure />
      <AboutClosing />
    </>
  );
}
