import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@qhakaza/shared-auth/server';

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

  /*
   * Scoped to THIS collector, not to "members".
   *
   * There is no longer a query for what collectors in general can see - only
   * what a named one can. The layout has already established the session; this
   * refuses rather than guessing if it somehow has not.
   */
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  const artworks = await getReleasedArtworks({ userId });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <p className="eyebrow">Discovery</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Selected for you</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        Work Qhakaza has chosen to place in front of you. This is not a catalogue, and it is not
        what every member sees.
      </p>

      {artworks.length === 0 ? (
        <p className="text-muted mt-12">
          Nothing has been placed with you yet. Qhakaza selects work for each collector
          individually, so this fills as your advisor prepares it.
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
