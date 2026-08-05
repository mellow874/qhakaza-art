import Link from 'next/link';

import { buttonStyles } from '@qhakaza/shared-ui';

import { getReleasedArtists } from '@/features/private/queries';

/**
 * The member's overview.
 *
 * No design was supplied for the private area; this is functional, built from
 * the existing tokens, and expected to be replaced when the screens arrive.
 * The layout has already validated the token — nothing here re-checks it,
 * because nothing here renders unless it passed.
 */
export default async function PrivateOverviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const artists = await getReleasedArtists({ limit: 6 });

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <p className="eyebrow">Your suite</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Welcome back</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        Everything here has passed through vetting before reaching you. Artists are approved and
        works released by the Command Center; nothing is shown at submission stage.
      </p>

      <section aria-labelledby="released-artists" className="mt-16">
        <h2 id="released-artists" className="text-2xl">
          Artists released to members
        </h2>

        {artists.length === 0 ? (
          <p className="text-muted mt-6">
            No artists have been released yet. Your advisor will be in touch as the first records
            are prepared.
          </p>
        ) : (
          <ul className="bg-line/70 mt-8 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <li key={artist.id} className="bg-surface flex flex-col gap-4 p-8">
                <h3 className="text-xl">{artist.displayName}</h3>
                {artist.statement && (
                  <p className="text-body line-clamp-3 text-sm leading-relaxed">
                    {artist.statement}
                  </p>
                )}
                <p className="text-muted caps">
                  {artist.releasedCount} {artist.releasedCount === 1 ? 'work' : 'works'} available
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-16 flex flex-wrap gap-4">
        <Link
          href={`/private/${token}/discover`}
          className={buttonStyles({ size: 'lg', className: 'caps' })}
        >
          Discover works
        </Link>
        <Link
          href={`/private/${token}/enquiries`}
          className={buttonStyles({ variant: 'outline', size: 'lg', className: 'caps' })}
        >
          Make an enquiry
        </Link>
      </div>
    </main>
  );
}
