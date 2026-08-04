import type { Metadata } from 'next';

import { hero, intro } from '@/content/contact';
import { ContactPanel } from '@/features/contact/contact-panel';

export const metadata: Metadata = {
  title: 'Contact',
  description: intro.body,
  openGraph: {
    title: 'Get in Touch — Qhakaza Art Collective',
    description: intro.body,
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">{hero.eyebrow}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{hero.title}</h1>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:gap-24 lg:py-28">
        <div className="flex flex-col gap-10">
          <p className="text-body max-w-md leading-relaxed">{intro.body}</p>

          <div className="flex flex-col gap-2">
            <p className="eyebrow">{intro.enquiriesLabel}</p>
            <a
              href={`mailto:${intro.email}`}
              className="text-heading hover:text-accent w-fit transition-colors"
            >
              {intro.email}
            </a>
          </div>
        </div>

        <ContactPanel />
      </div>
    </main>
  );
}
