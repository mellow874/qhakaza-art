import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { membership } from '@/content/collectors';

/** `/collectors/membership` — the Founding Circle offer and its annual rhythm. */

function MembershipOffer() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <p className="eyebrow">{membership.eyebrow}</p>
      <span className="rule mt-6" aria-hidden="true" />

      <h1 className="mt-10 text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">
        {membership.titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="text-body mt-8 max-w-2xl leading-relaxed">{membership.lede}</p>

      <hr className="border-line/70 mt-14" />

      <div className="mt-14 flex flex-col gap-4">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="font-display text-heading text-5xl sm:text-6xl">
            {membership.price.amount}
          </span>
          <span className="text-accent-ink text-lg">{membership.price.period}</span>
          <span className="text-body caps">{membership.price.label}</span>
        </p>
        <p className="text-body max-w-xl">{membership.price.note}</p>
      </div>

      <hr className="border-line/70 mt-14" />

      <Link
        href={membership.cta.href}
        className={buttonStyles({ size: 'lg', className: 'caps mt-14' })}
      >
        {membership.cta.label}
      </Link>
    </section>
  );
}

function RhythmNote() {
  return (
    <section aria-labelledby="rhythm-note" className="theme-dark bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
        <h2 id="rhythm-note" className="eyebrow">
          {membership.rhythmNote.title}
        </h2>
        <span className="rule mt-6" aria-hidden="true" />
        <p className="text-body mt-10 max-w-4xl text-lg leading-relaxed">
          {membership.rhythmNote.body}
        </p>
      </div>
    </section>
  );
}

function Includes() {
  return (
    <section className="bg-surface">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
        <span className="rule" aria-hidden="true" />

        {/* No heading: the design gives this list only a rule, and a heading
            invented here would be copy the client never wrote. */}
        <ul className="mt-16 flex flex-col">
          {membership.includes.map((item) => (
            <li key={item} className="border-line/70 border-b py-8 last:border-b-0">
              <span className="border-line-strong text-body border-l pl-8">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AnnualRhythm() {
  return (
    <section aria-labelledby="annual-rhythm" className="mx-auto w-full max-w-6xl px-6 py-24">
      <h2 id="annual-rhythm" className="eyebrow">
        {membership.rhythm.title}
      </h2>
      <span className="rule mt-6" aria-hidden="true" />

      <ul className="bg-line/70 mt-14 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
        {membership.rhythm.items.map((item) => (
          <li key={item} className="bg-canvas flex flex-col gap-6 p-10">
            <span className="rule" aria-hidden="true" />
            <p className="text-body leading-relaxed">{item}</p>
          </li>
        ))}

        {/* Five items in a six-cell grid; the design closes the row with a
            solid block rather than leaving it empty. Decorative. */}
        <li className="bg-line-strong/50 hidden lg:block" aria-hidden="true" />
      </ul>
    </section>
  );
}

function HowAccessIsConsidered() {
  return (
    <section aria-labelledby="how-access" className="theme-dark bg-canvas">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-24 lg:grid-cols-2">
        <div>
          <h2 id="how-access" className="eyebrow">
            {membership.access.title}
          </h2>
          <span className="rule mt-6" aria-hidden="true" />
        </div>
        <p className="text-body max-w-xl leading-relaxed">{membership.access.body}</p>
      </div>
    </section>
  );
}

function MembershipClosing() {
  return (
    <section aria-labelledby="membership-closing" className="mx-auto w-full max-w-3xl px-6 py-28">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="eyebrow">{membership.closing.eyebrow}</p>
        <span className="rule" aria-hidden="true" />
        <h2 id="membership-closing" className="mt-4 text-3xl sm:text-4xl">
          {membership.closing.title}
        </h2>
        <p className="text-body leading-relaxed">{membership.closing.body}</p>
        <Link
          href={membership.closing.cta.href}
          className={buttonStyles({ size: 'lg', className: 'caps mt-6' })}
        >
          {membership.closing.cta.label}
        </Link>
      </div>
    </section>
  );
}

export function CollectorMembership() {
  return (
    <>
      <MembershipOffer />
      <RhythmNote />
      <Includes />
      <AnnualRhythm />
      <HowAccessIsConsidered />
      <MembershipClosing />
    </>
  );
}
