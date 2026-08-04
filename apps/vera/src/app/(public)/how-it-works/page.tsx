import type { Metadata } from 'next';

import { CtaBand } from '@/components/cta-band';
import { cta, hero, steps } from '@/content/how-it-works';
import { ProcessSteps } from '@/features/how-it-works/process-steps';

export const metadata: Metadata = {
  title: 'How it works',
  description: hero.subtitle,
  openGraph: {
    title: 'How Qhakaza Art Collective works',
    description: hero.subtitle,
    type: 'website',
  },
};

export default function HowItWorksPage() {
  return (
    <main className="flex flex-col">
      {/*
        A single left-aligned column rather than the two-column layouts used
        elsewhere — the process reads top to bottom and nothing should compete
        with it for attention.
      */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-24 pb-16 sm:pt-32">
        <header className="flex flex-col gap-6 pb-20">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{hero.title}</h1>
          <p className="text-body max-w-lg text-lg leading-relaxed">{hero.subtitle}</p>
        </header>

        <ProcessSteps steps={steps} />
      </div>

      <CtaBand title={cta.title} subtitle={cta.subtitle} label={cta.label} href={cta.href} />
    </main>
  );
}
