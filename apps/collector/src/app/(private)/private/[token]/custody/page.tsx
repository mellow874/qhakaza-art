import { notFound } from 'next/navigation';

import { auth } from '@qhakaza/shared-auth/server';
import { getCollectorCustodyPeriods, calculateTimeRemaining } from '@qhakaza/shared-db';

import { collector as copy } from '@/content/custody';

/**
 * The collector's Appreciation Periods page.
 *
 * Shows the collector which works are currently placed with them, with the
 * time remaining presented calmly — as an appreciation period rather than
 * a deadline.
 *
 * Language: "appreciation period" — not loan, rental, or return.
 * Pending Qhakaza confirmation.
 */

function money(amount: { toString(): string }, currency: string) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount.toString()));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function CustodyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) notFound();

  // Get the active custody periods for this collector
  // We need to resolve the membershipId from the token's membership
  const { withActor } = await import('@qhakaza/shared-db');
  const membership = await withActor({ role: 'collector', userId }, async (tx) => {
    return tx.membership.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true },
    });
  });

  if (!membership) notFound();

  const periods = await getCollectorCustodyPeriods(membership.id);
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <p className="eyebrow">Appreciation</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">{copy.heading}</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">{copy.intro}</p>

      {periods.length === 0 ? (
        <div className="border-line/70 bg-surface mt-14 flex flex-col gap-4 border p-12">
          <h2 className="text-heading text-xl">{copy.emptyState.title}</h2>
          <p className="text-muted leading-relaxed">{copy.emptyState.body}</p>
        </div>
      ) : (
        <section aria-labelledby="active-periods" className="mt-14">
          <h2 id="active-periods" className="text-2xl">
            {copy.activePeriodsTitle}
          </h2>

          <ul className="bg-line/70 mt-8 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {periods.map((period) => {
              const remaining = calculateTimeRemaining(period.startedAt, period.endsAt, now);
              const artwork = period.artwork;

              return (
                <li key={period.id} className="bg-surface flex flex-col gap-4 p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl">{artwork.title}</h3>
                      <p className="text-muted caps mt-1">
                        {copy.workBy(artwork.artist.displayName)}
                      </p>
                    </div>
                  </div>

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
                      <dd className="text-body text-right">
                        {money(artwork.price, artwork.currency)}
                      </dd>
                    </div>
                  </dl>

                  {/* Time remaining — presented calmly */}
                  <div className="border-line/70 mt-2 border-t pt-4">
                    <p className="text-heading text-sm font-medium">
                      {copy.timeRemaining(remaining.daysRemaining)}
                    </p>
                    <p className="text-muted mt-1 text-xs italic">
                      {copy.progressNote(remaining.percentageElapsed)}
                    </p>

                    {/* Progress bar — gentle, not urgent */}
                    <div className="bg-line/70 mt-3 h-1.5 w-full rounded-full overflow-hidden">
                      <div
                        className="bg-accent/60 h-full rounded-full transition-all duration-500"
                        style={{ width: `${remaining.percentageElapsed}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
