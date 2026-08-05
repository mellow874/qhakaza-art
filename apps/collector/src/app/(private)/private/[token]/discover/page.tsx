import Link from 'next/link';

import { getReleasedArtworks } from '@/features/private/queries';

/** Formats a Prisma Decimal without ever interpolating the raw object. */
function money(amount: { toString(): string }, currency: string) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount.toString()));
}

export default async function DiscoverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const artworks = await getReleasedArtworks();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <p className="eyebrow">Discovery</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Works released to members</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        Each work below is by an approved artist and has been released for member viewing.
      </p>

      {artworks.length === 0 ? (
        <p className="text-muted mt-12">
          Nothing has been released yet. This page fills as the Command Center prepares records.
        </p>
      ) : (
        <ul className="bg-line/70 mt-12 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {artworks.map((artwork) => (
            <li key={artwork.id} className="bg-surface flex flex-col gap-4 p-8">
              <h2 className="text-xl">{artwork.title}</h2>
              <p className="text-muted caps">{artwork.artist.displayName}</p>

              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Medium</dt>
                  <dd className="text-body text-right">{artwork.medium}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Dimensions</dt>
                  <dd className="text-body text-right">{artwork.dimensions}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Price</dt>
                  <dd className="text-body text-right">{money(artwork.price, artwork.currency)}</dd>
                </div>
              </dl>

              <Link
                href={`/private/${token}/enquiries?artwork=${artwork.id}`}
                className="text-accent-ink hover:text-accent-hover mt-2 text-sm underline underline-offset-4"
              >
                Request private viewing
                <span className="sr-only"> of {artwork.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
