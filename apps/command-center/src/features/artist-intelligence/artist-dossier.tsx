'use client';

import { useState } from 'react';

import type { ArtistDossier } from './queries';

/**
 * One artist, as Qhakaza sees them.
 *
 * THE SCREEN'S JOB IS TO KEEP TWO THINGS APART: what the artist told us, and
 * what we established. Every claim shows both its verification state and whose
 * account it is, because "the artist says they were in the Biennale" and "we
 * confirmed they were in the Biennale" support very different decisions and
 * look identical once flattened into a list.
 *
 * WITHDRAWN ENTRIES ARE SHOWN, struck through. They are hidden from the
 * artist's own view and kept here on purpose: a claim that was made, relied
 * on, and later retracted is exactly what a reviewer needs to see.
 */

type VerifyFn = (input: unknown) => Promise<{ ok: boolean; error?: string }>;
type PermissionFn = (input: unknown) => Promise<{ ok: boolean; error?: string }>;
type AssessFn = (input: unknown) => Promise<{ ok: boolean; error?: string }>;
/*
 * Typed, unlike its neighbours. Approval is the one action here that is shared
 * with the dashboard rather than defined for this screen, so its signature is
 * fixed elsewhere and matching it is what keeps the two callers honest.
 */
type ApproveFn = (input: {
  artistId: string;
  approved: boolean;
  reason?: string;
}) => Promise<{ ok: boolean; error?: string }>;

const STATES = [
  { value: 'UNVERIFIED', label: 'Not checked' },
  { value: 'ARTIST_DECLARED', label: 'Artist says so' },
  { value: 'DOCUMENT_ON_FILE', label: 'Document on file' },
  { value: 'INDEPENDENTLY_VERIFIED', label: 'Confirmed independently' },
  { value: 'UNABLE_TO_VERIFY', label: 'Could not confirm' },
  { value: 'DISPUTED', label: 'Disputed' },
] as const;

const PERMISSION_KINDS = [
  { value: 'STORE_MATERIAL', label: 'Store their material' },
  { value: 'USE_INTERNALLY', label: 'Use it in internal assessment' },
  { value: 'SHARE_PRIVATELY_WITH_COLLECTORS', label: 'Share privately with collectors' },
  { value: 'USE_IN_PRIVATE_BRIEF', label: 'Use in a private brief' },
  { value: 'PRESENT_TO_PARTNERS', label: 'Present to partners' },
  { value: 'PUBLISH_PUBLICLY', label: 'Publish work publicly' },
  { value: 'PUBLISH_ARTIST_STORY', label: 'Publish their story' },
  { value: 'RETAIN_DOCUMENTATION', label: 'Retain documentation' },
] as const;

function stateTone(state: string) {
  if (state === 'INDEPENDENTLY_VERIFIED' || state === 'DOCUMENT_ON_FILE') return 'text-accent';
  if (state === 'DISPUTED' || state === 'UNABLE_TO_VERIFY') return 'text-danger';
  return 'text-muted';
}

/** The verification control that sits on every claim. */
function VerifyControl({
  kind,
  id,
  current,
  note,
  onVerify,
}: {
  kind: string;
  id: string;
  current: string;
  note?: string | null;
  onVerify: VerifyFn;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(current);
  const [reason, setReason] = useState(note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A note is required for these two, and saying so before the attempt is
  // kinder than refusing afterwards.
  const needsReason = state === 'DISPUTED' || state === 'UNABLE_TO_VERIFY';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`caps text-xs ${stateTone(current)} hover:underline`}
      >
        {STATES.find((option) => option.value === current)?.label ?? current}
      </button>
    );
  }

  return (
    <div className="border-line/70 bg-surface/40 flex w-full flex-col gap-2 border p-3">
      <select
        value={state}
        onChange={(event) => setState(event.target.value)}
        className="border-line bg-canvas border px-2 py-1 text-sm"
      >
        {STATES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <textarea
        rows={2}
        value={reason}
        placeholder={
          needsReason ? 'Required: what could not be confirmed, or what contradicts it' : 'Note'
        }
        onChange={(event) => setReason(event.target.value)}
        className="border-line bg-canvas border px-2 py-1 text-sm"
      />

      {error && (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || (needsReason && !reason.trim())}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const result = await onVerify({
              kind,
              id,
              verification: state,
              note: reason.trim() || undefined,
            });
            setBusy(false);
            if (result.ok) setOpen(false);
            else setError(result.error ?? 'That did not save.');
          }}
          className="border-accent text-accent caps hover:bg-accent/10 border px-3 py-1 text-xs disabled:opacity-40"
        >
          Record
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted caps text-xs hover:underline"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ClaimRow({
  kind,
  id,
  primary,
  secondary,
  verification,
  assertedVia,
  note,
  removedAt,
  onVerify,
}: {
  kind: string;
  id: string;
  primary: string;
  secondary?: string | null;
  verification: string;
  assertedVia?: string;
  note?: string | null;
  removedAt?: Date | null;
  onVerify: VerifyFn;
}) {
  return (
    <li className="border-line/70 flex flex-col gap-2 border-b py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className={removedAt ? 'text-muted text-sm line-through' : 'text-heading text-sm'}>
            {primary}
          </span>
          {secondary && <span className="text-muted text-xs">{secondary}</span>}

          {/* Whose account it is, kept visibly apart from how verified it is. */}
          {assertedVia && (
            <span className="text-muted/70 text-xs">
              {assertedVia === 'ARTIST' ? 'Stated by the artist' : `Recorded by ${assertedVia}`}
            </span>
          )}

          {removedAt && (
            <span className="text-danger text-xs">
              Withdrawn by the artist on {removedAt.toLocaleDateString('en-ZA')}
            </span>
          )}

          {note && <span className="text-muted text-xs italic">{note}</span>}
        </span>

        <VerifyControl kind={kind} id={id} current={verification} note={note} onVerify={onVerify} />
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="caps text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted border-line border border-dashed p-5 text-sm">{children}</p>;
}

export function ArtistDossierView({
  dossier,
  criteria,
  canApprove,
  canSetPermissions,
  onVerify,
  onSetPermission,
  onAssess,
  onApprove,
}: {
  dossier: ArtistDossier;
  criteria: { id: string; label: string; guidance: string | null }[];
  canApprove: boolean;
  canSetPermissions: boolean;
  onVerify: VerifyFn;
  onSetPermission: PermissionFn;
  onAssess: AssessFn;
  onApprove: ApproveFn;
}) {
  const { artist } = dossier;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-heading font-serif text-3xl">{artist.displayName}</h1>
          <span
            className={
              artist.approved
                ? 'border-accent text-accent caps border px-3 py-1 text-xs'
                : 'border-line-strong text-muted caps border px-3 py-1 text-xs'
            }
          >
            {artist.approved ? 'Approved' : 'Not approved'}
          </span>
        </div>
        <p className="text-muted text-sm">
          {[artist.basedIn, artist.nationality, artist.user.email].filter(Boolean).join(' · ')}
        </p>

        {/* Said once, plainly, because it is the thing most easily assumed. */}
        <p className="text-muted max-w-2xl text-xs leading-relaxed">
          Approving an artist accepts them onto the platform. It does not publish anything and does
          not put work in front of a collector — both of those need a release and the artist&rsquo;s
          permission.
        </p>
      </header>

      {canApprove && <ApprovalControl artist={artist} onApprove={onApprove} />}

      <Section title="Biography, as written for Qhakaza">
        {artist.biographyInternal ? (
          <p className="text-body max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">
            {artist.biographyInternal}
          </p>
        ) : (
          <Empty>The artist has not written an internal biography.</Empty>
        )}
      </Section>

      <Section title="Biography, for their public page">
        {artist.biographyPublic ? (
          <p className="text-body max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">
            {artist.biographyPublic}
          </p>
        ) : (
          <Empty>Nothing written for publication.</Empty>
        )}
      </Section>

      {artist.practice && (
        <Section title="Practice">
          <p className="text-body max-w-2xl text-sm leading-relaxed whitespace-pre-wrap">
            {artist.practice}
          </p>
        </Section>
      )}

      <Section title="Works in">
        {dossier.mediums.length === 0 ? (
          <Empty>No media recorded.</Empty>
        ) : (
          <p className="text-body text-sm">
            {dossier.mediums
              .filter((row) => !row.removedAt)
              .map((row) => `${row.medium.label}${row.primary ? ' (primary)' : ''}`)
              .join(', ')}
          </p>
        )}
      </Section>

      <Section title="Exhibitions">
        {dossier.exhibitions.length === 0 ? (
          <Empty>No exhibitions recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.exhibitions.map((row) => (
              <ClaimRow
                key={row.id}
                kind="exhibition"
                id={row.id}
                primary={row.exhibition.title}
                secondary={[
                  row.exhibition.venue,
                  row.exhibition.startDate?.getUTCFullYear(),
                  row.type?.label,
                  row.curator ? `Curated by ${row.curator}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                verification={row.verification}
                assertedVia={row.assertedVia}
                note={row.verificationNote}
                removedAt={row.removedAt}
                onVerify={onVerify}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Representation">
        {dossier.representations.length === 0 ? (
          <Empty>No representation recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.representations.map((row) => (
              <ClaimRow
                key={row.id}
                kind="representation"
                id={row.id}
                primary={row.party.name}
                secondary={[
                  row.type?.label,
                  row.territory,
                  row.current ? 'Current' : 'Past',
                  row.exclusive ? 'Exclusive' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                verification={row.verification}
                assertedVia={row.assertedVia}
                note={row.verificationNote}
                removedAt={row.removedAt}
                onVerify={onVerify}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Curriculum vitae">
        {dossier.cvEntries.length === 0 ? (
          <Empty>No CV entries recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.cvEntries.map((row) => (
              <ClaimRow
                key={row.id}
                kind="cvEntry"
                id={row.id}
                primary={row.title}
                secondary={[row.type?.label, row.organisation, row.location, row.startYear]
                  .filter(Boolean)
                  .join(' · ')}
                verification={row.verification}
                assertedVia={row.assertedVia}
                note={row.verificationNote}
                removedAt={row.removedAt}
                onVerify={onVerify}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Institutional recognition">
        {dossier.signals.length === 0 ? (
          <Empty>No institutional signals recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.signals.map((row) => (
              <ClaimRow
                key={row.id}
                kind="signal"
                id={row.id}
                primary={row.description}
                secondary={[row.signalType?.label, row.party?.name ?? row.institution, row.year]
                  .filter(Boolean)
                  .join(' · ')}
                verification={row.verification}
                assertedVia={row.assertedVia}
                note={row.verificationNote}
                removedAt={row.removedAt}
                onVerify={onVerify}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Elsewhere">
        {dossier.links.length === 0 ? (
          <Empty>No links recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.links.map((row) => (
              <ClaimRow
                key={row.id}
                kind="link"
                id={row.id}
                primary={row.label || row.kind}
                secondary={row.url}
                verification={row.verification}
                removedAt={row.removedAt}
                onVerify={onVerify}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Documents">
        {dossier.documents.length === 0 ? (
          <Empty>No documents on file.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.documents.map((document) => (
              <li
                key={document.id}
                className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-heading text-sm">{document.originalFilename}</span>
                  <span className="text-muted text-xs">
                    {document.documentType?.label ?? 'Type not recorded'} ·{' '}
                    {document.confidentiality.toLowerCase()}
                  </span>
                  {/* One document may evidence several records. Saying how many
                      is the quickest way to see that it is doing that work. */}
                  {document.links.length > 1 && (
                    <span className="text-accent text-xs">
                      Attached to {document.links.length} records
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Work">
        {dossier.artworks.length === 0 ? (
          <Empty>Nothing submitted yet.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.artworks.map((work) => (
              <li key={work.id} className="border-line/70 border-b py-3">
                {/* Each work has its own record - provenance, documents and
                    sources live there rather than being flattened in here. */}
                <a
                  href={`/artworks/${work.id}`}
                  className="hover:text-accent flex flex-wrap items-baseline justify-between gap-3"
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-heading text-sm">{work.title}</span>
                    <span className="text-muted text-xs">
                      {[work.medium, work.status].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="text-muted text-xs">
                    {work._count.transactions === 0
                      ? 'No provenance'
                      : `${work._count.transactions} provenance links`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <PermissionsPanel
        dossier={dossier}
        canSet={canSetPermissions}
        onSetPermission={onSetPermission}
      />

      <ReadinessPanel dossier={dossier} criteria={criteria} onAssess={onAssess} />

      <Section title="What has changed">
        {dossier.history.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t text-xs">
            {dossier.history.map((entry) => (
              <li key={entry.id} className="border-line/70 flex flex-col gap-1 border-b py-2">
                <span className="text-muted">
                  {entry.changedAt.toLocaleString('en-ZA')} · {entry.changedRole ?? 'system'} ·{' '}
                  {entry.field}
                </span>
                <span className="text-body">
                  {entry.previousValue ? `${entry.previousValue} → ` : ''}
                  {entry.newValue ?? '(removed)'}
                </span>
                {entry.reason && <span className="text-muted italic">{entry.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ApprovalControl({
  artist,
  onApprove,
}: {
  artist: ArtistDossier['artist'];
  onApprove: ApproveFn;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="border-line/70 bg-surface/40 flex flex-wrap items-end gap-3 border p-4">
      <label className="flex flex-1 flex-col gap-1">
        <span className="caps text-muted">Reason</span>
        <input
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            artist.approved ? 'Why approval is being withdrawn' : 'Why they are accepted'
          }
          className="border-line bg-canvas border px-3 py-2"
        />
      </label>

      <button
        type="button"
        disabled={busy || !reason.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await onApprove({
            artistId: artist.id,
            approved: !artist.approved,
            reason: reason.trim(),
          });
          setBusy(false);
          if (result.ok) setReason('');
          else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 border px-4 py-2 text-xs disabled:opacity-40"
      >
        {artist.approved ? 'Withdraw approval' : 'Approve this artist'}
      </button>

      {error && (
        <p role="alert" className="text-danger w-full text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function PermissionsPanel({
  dossier,
  canSet,
  onSetPermission,
}: {
  dossier: ArtistDossier;
  canSet: boolean;
  onSetPermission: PermissionFn;
}) {
  const [kind, setKind] = useState<string>(PERMISSION_KINDS[0].value);
  const [granted, setGranted] = useState(true);
  const [confirmingAction, setConfirmingAction] = useState('');
  const [scopeNote, setScopeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Section title="Permissions">
      <p className="text-muted max-w-2xl text-xs leading-relaxed">
        These are the artist&rsquo;s decisions, recorded by staff. Where a work-specific permission
        and an artist-wide one disagree, <strong>the more restrictive applies</strong> — one refusal
        anywhere is a refusal.
      </p>

      {dossier.permissions.length === 0 ? (
        <Empty>Nothing recorded. Until a permission is recorded, nothing may be shared.</Empty>
      ) : (
        <ul className="border-line/70 flex flex-col border-t">
          {dossier.permissions.map((permission) => (
            <li
              key={permission.id}
              className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
            >
              <span className="flex flex-col gap-1">
                <span className="text-heading text-sm">
                  {PERMISSION_KINDS.find((option) => option.value === permission.kind)?.label ??
                    permission.kind}
                </span>
                <span className="text-muted text-xs">
                  {permission.artworkId ? 'For one work' : 'Across the artist record'}
                  {permission.confirmingAction ? ` · ${permission.confirmingAction}` : ''}
                </span>
                {/* A scope limit is recorded but not machine-enforced, and
                    pretending otherwise would be worse than not having it. */}
                {permission.scopeNote && (
                  <span className="text-muted text-xs italic">
                    Limit noted: {permission.scopeNote} (not enforced automatically)
                  </span>
                )}
                {permission.expiresAt && (
                  <span className="text-muted text-xs">
                    Lapses {permission.expiresAt.toLocaleDateString('en-ZA')}
                  </span>
                )}
              </span>
              <span
                className={
                  permission.granted ? 'caps text-accent text-xs' : 'caps text-danger text-xs'
                }
              >
                {permission.granted ? 'Granted' : 'Refused'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canSet ? (
        <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="border-line bg-canvas border px-3 py-2 text-sm"
            >
              {PERMISSION_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={granted ? 'yes' : 'no'}
              onChange={(event) => setGranted(event.target.value === 'yes')}
              className="border-line bg-canvas border px-3 py-2 text-sm"
            >
              <option value="yes">Granted</option>
              <option value="no">Refused</option>
            </select>
          </div>

          <input
            type="text"
            value={confirmingAction}
            onChange={(event) => setConfirmingAction(event.target.value)}
            placeholder="What the artist did to confirm this — required"
            className="border-line bg-canvas border px-3 py-2 text-sm"
          />

          <input
            type="text"
            value={scopeNote}
            onChange={(event) => setScopeNote(event.target.value)}
            placeholder="Any limit they placed on it, in their words"
            className="border-line bg-canvas border px-3 py-2 text-sm"
          />

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !confirmingAction.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await onSetPermission({
                artistId: dossier.artist.id,
                kind,
                granted,
                confirmingAction: confirmingAction.trim(),
                scopeNote: scopeNote.trim() || undefined,
              });
              setBusy(false);
              if (result.ok) {
                setConfirmingAction('');
                setScopeNote('');
              } else setError(result.error ?? 'That did not save.');
            }}
            className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
          >
            Record this decision
          </button>
        </div>
      ) : (
        <p className="text-muted text-xs">Only an administrator can change a permission.</p>
      )}
    </Section>
  );
}

function ReadinessPanel({
  dossier,
  criteria,
  onAssess,
}: {
  dossier: ArtistDossier;
  criteria: { id: string; label: string; guidance: string | null }[];
  onAssess: AssessFn;
}) {
  const [ratings, setRatings] = useState<Record<string, { rating: string; evidence: string }>>({});
  const [summary, setSummary] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Section title="Readiness">
      <p className="text-muted max-w-2xl text-xs leading-relaxed">
        Never shown to the artist. Assessments are append-only — a revised view is a new assessment
        that supersedes the last one and leaves it standing.
      </p>

      {dossier.assessments.length > 0 && (
        <ul className="border-line/70 flex flex-col border-t">
          {dossier.assessments.map((assessment) => (
            <li key={assessment.id} className="border-line/70 flex flex-col gap-2 border-b py-4">
              <span className="text-muted text-xs">
                {assessment.assessedAt.toLocaleString('en-ZA')}
                {assessment.methodologyVersion
                  ? ` · framework ${assessment.methodologyVersion.versionNumber}`
                  : ''}
              </span>
              {assessment.recommendation && (
                <span className="text-heading text-sm">{assessment.recommendation}</span>
              )}
              {assessment.summary && (
                <span className="text-body text-sm whitespace-pre-wrap">{assessment.summary}</span>
              )}
              <ul className="flex flex-col gap-1">
                {assessment.ratings.map((rating) => (
                  <li key={rating.id} className="text-muted text-xs">
                    <strong className="text-body">{rating.criterion.label}:</strong>{' '}
                    {rating.rating ?? 'not rated'}
                    {rating.evidence ? ` — ${rating.evidence}` : ''}
                    {rating.concern ? ` (concern: ${rating.concern})` : ''}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {criteria.length === 0 ? (
        /*
         * The readiness framework is Qhakaza's own and is deliberately not
         * seeded. This explains the emptiness rather than presenting it as a
         * fault, and says exactly who can fix it.
         */
        <Empty>
          No readiness criteria have been set up. The framework is Qhakaza&rsquo;s own — the
          platform applies it rather than defining it. An administrator can add the criteria under
          Lists, and assessment becomes available as soon as there is one.
        </Empty>
      ) : (
        <div className="border-line/70 bg-surface/40 flex flex-col gap-4 border p-4">
          {criteria.map((criterion) => (
            <div key={criterion.id} className="flex flex-col gap-2">
              <span className="text-heading text-sm">{criterion.label}</span>
              {criterion.guidance && (
                <span className="text-muted text-xs">{criterion.guidance}</span>
              )}
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Rating, in words"
                  value={ratings[criterion.id]?.rating ?? ''}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [criterion.id]: {
                        rating: event.target.value,
                        evidence: current[criterion.id]?.evidence ?? '',
                      },
                    }))
                  }
                  className="border-line bg-canvas border px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="What it rests on"
                  value={ratings[criterion.id]?.evidence ?? ''}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [criterion.id]: {
                        rating: current[criterion.id]?.rating ?? '',
                        evidence: event.target.value,
                      },
                    }))
                  }
                  className="border-line bg-canvas flex-1 border px-3 py-2 text-sm"
                />
              </div>
            </div>
          ))}

          <textarea
            rows={3}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Your overall position, in your own words"
            className="border-line bg-canvas border px-3 py-2 text-sm"
          />

          <input
            type="text"
            value={recommendation}
            onChange={(event) => setRecommendation(event.target.value)}
            placeholder="Recommendation — a view, not a decision"
            className="border-line bg-canvas border px-3 py-2 text-sm"
          />

          {error && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await onAssess({
                artistId: dossier.artist.id,
                summary: summary.trim() || undefined,
                recommendation: recommendation.trim() || undefined,
                ratings: criteria.map((criterion) => ({
                  criterionId: criterion.id,
                  rating: ratings[criterion.id]?.rating?.trim() || undefined,
                  evidence: ratings[criterion.id]?.evidence?.trim() || undefined,
                })),
              });
              setBusy(false);
              if (result.ok) {
                setRatings({});
                setSummary('');
                setRecommendation('');
              } else setError(result.error ?? 'That did not save.');
            }}
            className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
          >
            Record this assessment
          </button>
        </div>
      )}
    </Section>
  );
}
