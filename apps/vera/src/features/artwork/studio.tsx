import Link from 'next/link';

import { buttonStyles, cn } from '@qhakaza/shared-ui';

import { CURRENCIES, type Currency } from '@/lib/validation/art';
import { formatMoney } from '@/lib/format/money';

import type { getMyStudio } from './actions';

/*
 * Spelled out rather than derived. `getMyStudio` returns a union — a profile
 * or none — and collapsing it with NonNullable picks one branch and loses the
 * null, which is exactly the case this component exists to handle.
 */
type StudioData = Awaited<ReturnType<typeof getMyStudio>>;
type Studio = {
  artist: Extract<StudioData, { artist: object }>['artist'] | null;
  artworks: NonNullable<StudioData>['artworks'];
};

/** `currency` is a plain column, so it is checked before it reaches Intl. */
function asCurrency(value: string): Currency {
  return (CURRENCIES as readonly string[]).includes(value) ? (value as Currency) : 'ZAR';
}

/**
 * The artist's dashboard.
 *
 * Its job is to answer three questions without the artist having to ask:
 * where does my profile stand, what has happened to each work, and what should
 * I do next. It replaced a placeholder that rendered a title and nothing else.
 */

/** What each artwork status means to the artist who submitted it. */
const STATUS: Record<string, { label: string; note: string; tone: 'live' | 'waiting' | 'closed' }> =
  {
    DRAFT: {
      label: 'Draft',
      note: 'Yours to edit. Submit it when you are ready for Qhakaza to review it.',
      tone: 'waiting',
    },
    SUBMITTED: {
      label: 'Submitted',
      note: 'With Qhakaza, waiting to be picked up.',
      tone: 'waiting',
    },
    UNDER_REVIEW: { label: 'Under review', note: 'A reviewer is reading it now.', tone: 'waiting' },
    RETURNED_FOR_INFORMATION: {
      label: 'Needs more',
      note: 'Qhakaza has asked for something. See the request below.',
      tone: 'waiting',
    },
    APPROVED: {
      label: 'Approved',
      note: 'Accepted. It will appear once Qhakaza releases it.',
      tone: 'live',
    },
    PUBLISHED: { label: 'Released', note: 'Visible to member collectors.', tone: 'live' },
    REJECTED: { label: 'Not accepted', note: 'Qhakaza has declined this work.', tone: 'closed' },
    SOLD: { label: 'Sold', note: 'No longer available.', tone: 'closed' },
    HIDDEN: { label: 'Withdrawn', note: 'Taken down by Qhakaza.', tone: 'closed' },
  };

function ProfileStanding({ artist }: { artist: Studio['artist'] }) {
  if (!artist) {
    return (
      <div className="border-line/70 bg-surface/40 flex flex-col gap-4 border p-8">
        <h2 className="text-2xl">Start with your profile</h2>
        <p className="text-body max-w-xl leading-relaxed">
          Your profile is the record behind the work. Nothing can be submitted or released until it
          exists.
        </p>
        <Link
          href="/artist/onboarding"
          className={buttonStyles({ size: 'md', className: 'self-start' })}
        >
          Build your profile
        </Link>
      </div>
    );
  }

  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-4 border p-8">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl">{artist.displayName}</h2>
        <span
          className={cn(
            'caps border px-3 py-1',
            artist.approved ? 'border-accent text-accent' : 'border-line-strong text-muted',
          )}
        >
          {artist.approved ? 'Approved' : 'Awaiting approval'}
        </span>
      </div>

      {/* Approval is the gate on everything else, so it is explained rather
          than left as a badge the artist has to interpret. */}
      <p className="text-body max-w-xl leading-relaxed">
        {artist.approved
          ? 'Your profile has been approved. Work you submit can be released to collectors once its record is complete.'
          : 'Qhakaza is reviewing your profile. You can submit work now — it will be held until your profile is approved.'}
      </p>

      <Link
        href="/artist/onboarding"
        className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'self-start' })}
      >
        Edit profile
      </Link>
    </div>
  );
}

export function Studio({ artist, artworks }: Studio) {
  const released = artworks.filter((work) => work.status === 'PUBLISHED').length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-muted text-xs tracking-[0.2em] uppercase">Your studio</p>
        <h1 className="text-4xl sm:text-5xl">Dashboard</h1>
      </header>

      <ProfileStanding artist={artist} />

      <section aria-labelledby="your-work" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 id="your-work" className="text-2xl">
              Your work
            </h2>
            <p className="text-muted text-sm">
              {artworks.length === 0
                ? 'Nothing submitted yet.'
                : `${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}, ${released} released`}
            </p>
          </div>

          {artist && (
            <Link href="/artist/work/new" className={buttonStyles({ size: 'md' })}>
              Add a work
            </Link>
          )}
        </div>

        {artworks.length === 0 ? (
          <p className="border-line/70 text-muted border border-dashed p-8 text-sm">
            {artist
              ? 'Submit your first work and Qhakaza will review it.'
              : 'Build your profile first — work attaches to it.'}
          </p>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {artworks.map((work) => {
              const status = STATUS[work.status] ?? {
                label: work.status,
                note: '',
                tone: 'waiting' as const,
              };

              return (
                <li
                  key={work.id}
                  className="border-line/70 flex flex-wrap items-start justify-between gap-4 border-b py-6"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-heading text-lg">{work.title}</span>
                    <span className="text-muted text-xs">
                      {[work.medium, work.dimensions].filter(Boolean).join(' · ') ||
                        'Details not yet added'}
                    </span>
                    {/* The status line is the feedback loop from the Command
                        Center — the artist should never have to ask. */}
                    <span className="text-body text-sm">{status.note}</span>

                    {/* The actual question, verbatim. A status alone tells an
                        artist that something is wrong but not what. */}
                    {work.reviewRequests?.[0] && (
                      <span className="border-accent bg-accent/5 text-body mt-2 border-l-2 py-2 pl-3 text-sm leading-relaxed">
                        <strong className="text-heading block text-xs tracking-wide uppercase">
                          Qhakaza asked
                        </strong>
                        {work.reviewRequests[0].request}
                      </span>
                    )}

                    {(work.status === 'DRAFT' ||
                      work.status === 'RETURNED_FOR_INFORMATION') && (
                      <Link
                        href={`/artist/work/${work.id}`}
                        className="text-accent caps mt-2 w-fit text-xs hover:underline"
                      >
                        {work.status === 'DRAFT' ? 'Submit for review' : 'Resubmit'}
                      </Link>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Link
                      href={`/artist/work/${work.id}`}
                      className="text-accent caps text-xs hover:underline"
                    >
                      Photographs
                    </Link>
                    <span
                      className={cn(
                        'caps border px-3 py-1',
                        status.tone === 'live' && 'border-accent text-accent',
                        status.tone === 'waiting' && 'border-line-strong text-muted',
                        status.tone === 'closed' && 'border-line text-muted',
                      )}
                    >
                      {status.label}
                    </span>
                    {Number(work.price) > 0 && (
                      <span className="text-muted text-sm">
                        {formatMoney(work.price, asCurrency(work.currency))}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
