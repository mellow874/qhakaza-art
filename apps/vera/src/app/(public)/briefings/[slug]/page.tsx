import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EditorialImage, buttonStyles } from '@qhakaza/shared-ui';

import { IMAGES } from '@/content/images';
import { DemoNotice } from '@/features/content/demo-notice';
import { getBriefingBySlug } from '@/features/content/queries';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const briefing = await getBriefingBySlug(slug);

  if (!briefing) return { title: 'Briefing not found' };

  return {
    title: briefing.title,
    description: briefing.excerpt,
    openGraph: { title: briefing.title, description: briefing.excerpt, type: 'article' },
  };
}

/**
 * One Briefing, read from the database.
 *
 * Was a page that rendered an excerpt from a TypeScript file and said the full
 * text was coming. Staff can now write the body from the Command Center, and
 * the page shows whatever is there.
 *
 * Where a Briefing has no body yet, the excerpt still stands on its own rather
 * than the page pretending to be an article - which is what it did before, and
 * is still the right behaviour for an unfinished piece.
 */
export default async function BriefingPage({ params }: Props) {
  const { slug } = await params;
  const briefing = await getBriefingBySlug(slug);

  if (!briefing) notFound();

  const paragraphs = (briefing.body ?? '').split(/\n{2,}/).filter((p) => p.trim());

  return (
    <main className="flex flex-col">
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-24 sm:py-28">
        <div className="flex flex-col gap-4">
          {briefing.category && <p className="eyebrow">{briefing.category}</p>}
          <h1 className="text-4xl leading-[1.15] sm:text-5xl">{briefing.title}</h1>
          {briefing.subtitle && (
            <p className="text-body text-lg leading-relaxed">{briefing.subtitle}</p>
          )}
          <p className="text-muted text-sm">
            {briefing.author && <span>{briefing.author}</span>}
            {briefing.author && briefing.publishedAt && <span> &middot; </span>}
            {briefing.publishedAt && (
              <time dateTime={briefing.publishedAt.toISOString()}>
                {briefing.publishedAt.toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            )}
          </p>
        </div>

        {briefing.isDemo && <DemoNotice what="The article text" />}

        <div className="bg-surface relative aspect-16/9 overflow-hidden">
          <EditorialImage
            src={briefing.coverImageUrl ?? IMAGES[`briefing-${briefing.slug}`]}
            alt=""
            sizes="(max-width: 768px) 100vw, 768px"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {paragraphs.length > 0 ? (
          <div className="flex flex-col gap-5">
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="text-body leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        ) : (
          <>
            <p className="text-body text-lg leading-relaxed">{briefing.excerpt}</p>
            <p className="border-line/70 text-muted border-l-2 py-2 pl-6 text-sm leading-relaxed">
              The full briefing is being prepared. If you would like it when it is published, get
              in touch and we will send it to you.
            </p>
          </>
        )}

        {briefing.sources && (
          <section className="border-line/70 flex flex-col gap-3 border-t pt-6">
            <h2 className="caps text-muted">Sources</h2>
            <p className="text-muted text-sm leading-relaxed whitespace-pre-line">
              {briefing.sources}
            </p>
          </section>
        )}

        {briefing.related.length > 0 && (
          <section className="border-line/70 flex flex-col gap-4 border-t pt-6">
            <h2 className="caps text-muted">Related</h2>
            <ul className="flex flex-col gap-3">
              {briefing.related.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={`/briefings/${related.slug}`}
                    className="text-heading hover:text-accent text-lg transition-colors"
                  >
                    {related.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/contact" className={buttonStyles({ size: 'md' })}>
            Get in touch
          </Link>
          <Link href="/briefings" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            All briefings
          </Link>
        </div>
      </article>
    </main>
  );
}
