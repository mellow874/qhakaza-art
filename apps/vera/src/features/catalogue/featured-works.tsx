import Link from 'next/link';

import { ArtCard, type ArtCardWork } from './art-card';

export function FeaturedWorks({ works }: { works: ArtCardWork[] }) {
  return (
    <section aria-labelledby="available-now" className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">The collection</p>
          <h2 id="available-now" className="text-3xl sm:text-4xl">
            Available now
          </h2>
        </div>

        {works.length > 0 && (
          <Link
            href="/browse"
            className="text-accent hover:text-accent-hover text-sm underline underline-offset-4 transition-colors"
          >
            View all work
          </Link>
        )}
      </div>

      {works.length === 0 ? (
        <p className="text-muted border-line rounded-(--radius-soft) border border-dashed p-12 text-center text-sm">
          No work available just yet. New pieces are added as artists are approved.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {works.map((work) => (
            <ArtCard key={work.id} work={work} />
          ))}
        </div>
      )}
    </section>
  );
}
