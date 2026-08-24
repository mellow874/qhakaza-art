'use client';

import { useState } from 'react';

/**
 * Placing work with collectors.
 *
 * THE SCREEN NEVER RELEASES ANYTHING ON ITS OWN. Suggestions are shown with
 * their reasons and a button; the admin presses it or does not. There is no
 * "release to all suggested", deliberately - a bulk action here would be the
 * shortest path back to every collector seeing the same pool.
 *
 * Scores are shown as an order, never a percentage. The number is a ranking
 * device and would be a false precision if presented as a measurement.
 */

type Suggestion = {
  score: number;
  rationale: string;
  collector: { membershipId: string; name: string | null };
};

type Audience = { id: string; name: string; memberCount: number };

type Work = {
  id: string;
  title: string;
  artist: string;
  status: string;
  medium: string | null;
  releases: { id: string; audienceName: string; tier: string }[];
  artistPermits: boolean;
};

export function PlacementPanel({
  works,
  audiences,
  suggestionsFor,
  onRelease,
  onRevoke,
  onCreateAudience,
}: {
  works: Work[];
  audiences: Audience[];
  suggestionsFor: (artworkId: string) => Promise<Suggestion[]>;
  onRelease: (input: {
    artworkId: string;
    audienceId: string;
    reason?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRevoke: (input: { releaseId: string }) => Promise<{ ok: boolean; error?: string }>;
  onCreateAudience: (input: { name: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [openWork, setOpenWork] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [audienceId, setAudienceId] = useState(audiences[0]?.id ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newAudience, setNewAudience] = useState('');

  async function open(artworkId: string) {
    setError(null);
    setOpenWork(openWork === artworkId ? null : artworkId);

    if (!suggestions[artworkId]) {
      const found = await suggestionsFor(artworkId);
      setSuggestions((current) => ({ ...current, [artworkId]: found }));
    }
  }

  async function place(artworkId: string) {
    if (!audienceId) {
      setError('Choose an audience first.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await onRelease({ artworkId, audienceId, reason: reason.trim() || undefined });
      if (!result.ok) setError(result.error ?? 'The work could not be placed.');
      else setReason('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-muted max-w-2xl text-sm leading-relaxed">
        Nothing here is visible to anyone until it is placed with an audience. Suggestions are
        ranked by what a collector has told us they collect &mdash; they are a shortlist to read,
        not an instruction.
      </p>

      {/* Audiences are cheap to make and are the unit of placement. */}
      <div className="border-line/70 flex flex-wrap items-end gap-3 border p-4">
        <label className="flex flex-1 flex-col gap-1">
          <span className="caps text-muted">New audience</span>
          <input
            type="text"
            value={newAudience}
            onChange={(event) => setNewAudience(event.target.value)}
            placeholder="One collector, a segment, a private brief"
            className="border-line bg-canvas border px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy || !newAudience.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onCreateAudience({ name: newAudience.trim() });
              setNewAudience('');
            } finally {
              setBusy(false);
            }
          }}
          className="border-accent text-accent caps hover:bg-accent/10 border px-4 py-2 text-xs"
        >
          Create
        </button>
      </div>

      {error && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-3 text-sm">
          {error}
        </p>
      )}

      {works.length === 0 ? (
        <p className="text-muted border-line border border-dashed p-8 text-sm">
          No work is ready to place. Work becomes placeable once it has been approved and prepared.
        </p>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {works.map((work) => (
            <li key={work.id} className="border-line/70 flex flex-col gap-3 border-b py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <span className="flex flex-col gap-1">
                  <span className="text-heading">{work.title}</span>
                  <span className="text-muted text-xs">
                    {work.artist} &middot; {work.medium ?? 'medium not stated'} &middot;{' '}
                    {work.status}
                  </span>

                  {/* Where it currently is, in plain terms. */}
                  {work.releases.length > 0 ? (
                    <span className="text-accent text-xs">
                      Placed with {work.releases.map((r) => r.audienceName).join(', ')}
                    </span>
                  ) : (
                    <span className="text-muted text-xs italic">Visible to nobody</span>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => open(work.id)}
                  className="border-line-strong text-heading caps hover:border-accent hover:text-accent border px-3 py-1 text-xs"
                >
                  {openWork === work.id ? 'Close' : 'Place'}
                </button>
              </div>

              {openWork === work.id && (
                <div className="border-line/70 bg-surface/40 flex flex-col gap-4 border p-4">
                  {/*
                    Said before an admin tries and is refused. The artist's
                    permission is not something staff can grant.
                  */}
                  {!work.artistPermits && (
                    <p className="text-danger text-sm leading-relaxed">
                      This artist has not permitted private sharing of their work. It cannot be
                      placed with anyone until they do.
                    </p>
                  )}

                  <div>
                    <h4 className="caps text-muted mb-2">Suggested collectors</h4>
                    {suggestions[work.id]?.length ? (
                      <ul className="flex flex-col gap-2">
                        {suggestions[work.id].map((suggestion) => (
                          <li
                            key={suggestion.collector.membershipId}
                            className="border-line/70 flex flex-wrap items-baseline justify-between gap-2 border-b py-2 text-sm"
                          >
                            <span className="text-heading">
                              {suggestion.collector.name ?? 'Unnamed collector'}
                            </span>
                            <span className="text-muted text-xs">{suggestion.rationale}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-sm">
                        No collector has stated a preference that overlaps this work. That is not a
                        reason not to place it &mdash; only that the system has nothing to add.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="caps text-muted">Audience</span>
                      <select
                        value={audienceId}
                        onChange={(event) => setAudienceId(event.target.value)}
                        className="border-line bg-canvas border px-3 py-2"
                      >
                        {audiences.map((audience) => (
                          <option key={audience.id} value={audience.id}>
                            {audience.name} ({audience.memberCount})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-1 flex-col gap-1">
                      <span className="caps text-muted">Why (kept internal)</span>
                      <input
                        type="text"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="What makes this the right pairing"
                        className="border-line bg-canvas border px-3 py-2"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={busy || !work.artistPermits}
                      onClick={() => place(work.id)}
                      className="border-accent text-accent caps hover:bg-accent/10 border px-4 py-2 text-xs disabled:opacity-40"
                    >
                      Place with this audience
                    </button>
                  </div>

                  {work.releases.length > 0 && (
                    <div>
                      <h4 className="caps text-muted mb-2">Currently placed</h4>
                      <ul className="flex flex-col gap-2">
                        {work.releases.map((release) => (
                          <li
                            key={release.id}
                            className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                          >
                            <span className="text-body">{release.audienceName}</span>
                            <button
                              type="button"
                              onClick={() => onRevoke({ releaseId: release.id })}
                              className="text-muted hover:text-danger caps text-xs"
                            >
                              Take back
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
