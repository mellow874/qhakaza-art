import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EditorialImage, buttonStyles } from '@qhakaza/shared-ui';

import { briefings } from '@/content/briefings';
import { IMAGES } from '@/content/images';

type Props = { params: Promise<{ slug: string }> };

/** The briefings are a fixed list in content, so every one can be prerendered. */
export function generateStaticParams() {
  return briefings.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const briefing = briefings.find((item) => item.slug === slug);

  if (!briefing) return { title: 'Briefing not found' };

  return {
    title: briefing.title,
    description: briefing.excerpt,
    openGraph: { title: briefing.title, description: briefing.excerpt, type: 'article' },
  };
}

/**
 * One briefing.
 *
 * The index linked here from the start, and the route did not exist — every
 * card on /briefings and the home strip led to a 404.
 *
 * ONLY THE EXCERPTS WERE SUPPLIED. The full article bodies do not exist
 * anywhere, and a briefing is a factual claim about the market, so nothing here
 * is written to fill the space. The page shows what we have and says plainly
 * that the rest is coming. When the bodies arrive, add a `body` to each entry
 * in `content/briefings.ts` and render it in place of the notice.
 */
export default async function BriefingPage({ params }: Props) {
  const { slug } = await params;
  const briefing = briefings.find((item) => item.slug === slug);

  if (!briefing) notFound();

  return (
    <main className="flex flex-col">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-24 sm:py-28">
        <div className="flex flex-col gap-4">
          <p className="eyebrow">{briefing.category}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl">{briefing.title}</h1>
          <time dateTime={briefing.date} className="text-muted text-sm">
            {briefing.dateLabel}
          </time>
        </div>

        <div className="bg-surface relative aspect-16/9 overflow-hidden">
          <EditorialImage
            src={IMAGES[`briefing-${briefing.slug}`]}
            alt={briefing.imageAlt}
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <p className="text-body text-lg leading-relaxed">{briefing.excerpt}</p>

        <p className="border-line/70 text-muted border-l-2 py-2 pl-6 text-sm leading-relaxed">
          The full briefing is being prepared. If you would like it when it is published, get in
          touch and we will send it to you.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/contact" className={buttonStyles({ size: 'md' })}>
            Request the full briefing
          </Link>
          <Link
            href="/briefings"
            className={buttonStyles({ variant: 'secondary', size: 'md' })}
          >
            All briefings
          </Link>
        </div>
      </article>
    </main>
  );
}
