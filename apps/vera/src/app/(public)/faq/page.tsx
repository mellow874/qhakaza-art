import type { Metadata } from 'next';

import { CtaBand } from '@/components/cta-band';
import { cta, emptyState, faqs, hero } from '@/content/faq';
import { FaqAccordion } from '@/features/faq/faq-accordion';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about the Qhakaza Art Collective platform.',
  openGraph: {
    title: 'Frequently Asked Questions — Qhakaza Art Collective',
    type: 'website',
  },
};

export default function FaqPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-32">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{hero.title}</h1>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl px-6 py-20 sm:py-24">
        {faqs.length === 0 ? (
          <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-16 text-center text-sm">
            {emptyState}
          </p>
        ) : (
          <FaqAccordion items={faqs} />
        )}
      </div>

      <CtaBand
        title={cta.title}
        label={cta.primary.label}
        href={cta.primary.href}
        secondary={cta.secondary}
        layout="split"
      />
    </main>
  );
}
