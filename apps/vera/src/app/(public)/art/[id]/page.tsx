import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buttonStyles } from '@qhakaza/shared-ui';

import { ArtCard } from '@/features/catalogue/art-card';
import { getWorkById } from '@/features/catalogue/queries';
import { formatMoney } from '@/lib/format/money';
import type { Currency } from '@/lib/validation/art';
import { CURRENCIES } from '@/lib/validation/art';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

/** `currency` is a plain column, so it is checked before it reaches Intl. */
function asCurrency(value: string): Currency {
  return (CURRENCIES as readonly string[]).includes(value) ? (value as Currency) : 'ZAR';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getWorkById(id);

  if (!found) return { title: 'Work not found' };

  return {
    title: `${found.work.title} — ${found.work.artist.displayName}`,
    description: found.work.description?.slice(0, 200) || undefined,
  };
}

export default async function ArtworkPage({ params }: Props) {
  const { id } = await params;
  const found = await getWorkById(id);

  // A draft, a sold piece or work by an unapproved artist is a 404 here. The
  // query decides that; this page never sees anything it should not show.
  if (!found) notFound();

  const { work, alsoBy } = found;
  const details = [
    ['Medium', work.medium],
    ['Dimensions', work.dimensions],
  ].filter(([, value]) => Boolean(value));

  return (
    <main className="flex flex-col">
      <div className="mx-auto grid w-full max-w-7xl gap-16 px-6 py-24 sm:py-28 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {work.images.length === 0 ? (
            <div className="bg-surface text-muted flex aspect-4/5 items-center justify-center rounded-(--radius-soft) text-xs">
              Image coming soon
            </div>
          ) : (
            work.images.map((src, index) => (
              <div
                key={src}
                className="bg-surface relative aspect-4/5 overflow-hidden rounded-(--radius-soft)"
              >
                <Image
                  src={src}
                  // The first image carries the work's identity; the rest are
                  // further views of the same piece and are described as such.
                  alt={index === 0 ? work.title : `${work.title}, further view`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Available</p>
            <h1 className="text-4xl leading-[1.15] sm:text-5xl">{work.title}</h1>
            <Link
              href={`/artists/${work.artist.slug}`}
              className="text-muted hover:text-accent w-fit transition-colors"
            >
              {work.artist.displayName}
            </Link>
          </div>

          <p className="text-accent text-2xl">
            {formatMoney(work.price, asCurrency(work.currency))}
          </p>

          {work.description && (
            <p className="text-body leading-relaxed whitespace-pre-line">{work.description}</p>
          )}

          {details.length > 0 && (
            <dl className="border-line/70 flex flex-col border-t">
              {details.map(([label, value]) => (
                <div key={label} className="border-line/70 flex justify-between gap-6 border-b py-4">
                  <dt className="text-muted text-sm">{label}</dt>
                  <dd className="text-body text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/*
            No cart, no checkout — none is configured. An enquiry is the honest
            next step, and it is what the collective does anyway.
          */}
          <Link href="/contact" className={buttonStyles({ size: 'lg', className: 'self-start' })}>
            Enquire about this work
          </Link>
        </div>
      </div>

      {alsoBy.length > 0 && (
        <section className="border-line/60 border-t">
          <div className="mx-auto w-full max-w-7xl px-6 py-24 sm:py-28">
            <h2 className="mb-12 text-2xl">Also by {work.artist.displayName}</h2>
            <div className="grid gap-x-8 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
              {alsoBy.map((other) => (
                <ArtCard key={other.id} work={other} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
