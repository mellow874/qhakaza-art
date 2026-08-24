import Image from 'next/image';
import Link from 'next/link';

import { formatMoney, type MoneyInput } from '@/lib/format/money';
import type { Currency } from '@/lib/validation/art';

/**
 * PRICE IS OPTIONAL, AND THE PUBLIC SITE NEVER PASSES IT.
 *
 * The same card serves the public editorial pages and, later, collector
 * surfaces. Public queries do not select price at all - not "select it and
 * hide it", which is one careless render away from a leak - so the card simply
 * shows nothing where there is nothing.
 */
export type ArtCardWork = {
  id: string;
  title: string;
  images: string[];
  medium: string;
  price?: MoneyInput | null;
  currency?: string | null;
  artist: { displayName: string; slug: string };
};

export function ArtCard({ work }: { work: ArtCardWork }) {
  const cover = work.images[0];

  return (
    <article className="group flex flex-col gap-4">
      {/*
        The title below is the accessible link to this piece. This image link
        exists for the mouse only — hidden from assistive tech and skipped by
        the keyboard, so the card is announced once, not twice.
      */}
      <Link
        href={`/art/${work.id}`}
        aria-hidden="true"
        tabIndex={-1}
        className="bg-surface block overflow-hidden rounded-(--radius-soft)"
      >
        <div className="relative aspect-4/5">
          {cover ? (
            <Image
              src={cover}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            // No image yet: keep the tile's shape so the grid does not jump.
            <div className="text-muted flex h-full items-center justify-center text-xs">
              Image coming soon
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg leading-snug">
          <Link href={`/art/${work.id}`} className="hover:text-accent transition-colors">
            {work.title}
          </Link>
        </h3>
        <Link
          href={`/artists/${work.artist.slug}`}
          className="text-muted hover:text-accent w-fit text-sm transition-colors"
        >
          {work.artist.displayName}
        </Link>
        <p className="text-muted text-xs">{work.medium}</p>
        {work.price != null && work.currency && (
          <p className="text-accent mt-2 text-sm">
            {formatMoney(work.price, work.currency as Currency)}
          </p>
        )}
      </div>
    </article>
  );
}
