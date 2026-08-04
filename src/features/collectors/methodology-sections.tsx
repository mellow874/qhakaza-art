import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { methodology } from '@/content/collectors';

/**
 * The methodology page: a numbered sequence rather than a grid. Everything
 * shares one left edge — the eyebrow, the step numbers, the dark essence band
 * and the closing action all align at the same column, which is what gives the
 * page its ledger-like calm in the design.
 */

function MethodologyIntro() {
  return (
    <header className="flex flex-col gap-6">
      <p className="eyebrow">{methodology.eyebrow}</p>
      <h1 className="text-5xl sm:text-6xl">{methodology.title}</h1>
      <p className="text-body max-w-2xl text-lg leading-relaxed">{methodology.lede}</p>
    </header>
  );
}

function MethodologySteps() {
  return (
    <ol className="mt-24 flex flex-col gap-20">
      {methodology.steps.map((step, index) => (
        <li key={step.title} className="grid gap-x-10 gap-y-4 sm:grid-cols-[3rem_1fr]">
          {/* The ordinal is decorative: the list already conveys order to
              assistive tech, and reading "zero one" before each heading is
              noise. */}
          <span className="text-muted caps pt-1" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>

          <div className="flex flex-col gap-5">
            <span className="rule" aria-hidden="true" />
            <h2 className="text-3xl">{step.title}</h2>
            <p className="text-body max-w-3xl leading-relaxed">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Essence() {
  return (
    <section
      aria-labelledby="in-essence"
      className="theme-dark bg-canvas mt-28 px-8 py-14 sm:px-14"
    >
      <p id="in-essence" className="eyebrow">
        {methodology.essence.eyebrow}
      </p>
      <p className="font-display text-heading mt-8 text-xl leading-relaxed italic sm:text-2xl">
        {methodology.essence.body}
      </p>
    </section>
  );
}

export function Methodology() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-28">
      <MethodologyIntro />
      <MethodologySteps />
      <Essence />

      <hr className="border-line/70 mt-28" />

      <Link
        href={methodology.cta.href}
        className={buttonStyles({ size: 'lg', className: 'caps mt-16' })}
      >
        {methodology.cta.label}
      </Link>
    </div>
  );
}
