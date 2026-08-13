import {
  decideCollectorIntake,
  inviteCollector,
  revokeInvitation,
  setArtistApproval,
  setArtworkRelease,
  setNoteStatus,
  setUserRole,
} from '@/features/command-center/actions';
import { cn } from '@qhakaza/shared-ui';

import { ActionButton } from '@/features/command-center/action-button';
import type { CommandCentreData } from '@/features/command-center/queries';

/**
 * AdminCommandCenter — the admin hub.
 *
 * Named for the component the brief specifies. It is `.tsx` rather than `.jsx`
 * because this codebase is TypeScript throughout; the name is the brief's, the
 * extension is the stack's.
 *
 * A server component: it renders data it is handed and delegates every mutation
 * to a bound server action, each of which re-authorises and writes an AuditLog
 * row in the same transaction as the change.
 *
 * No design was supplied for this screen. It uses the established tokens and is
 * organised by task rather than styled to a comp — built to be replaced when a
 * design arrives.
 */

/**
 * Everything the console renders, plus who is looking at it.
 *
 * The data half is `CommandCentreData`, so this list cannot drift from what the
 * single page query actually returns.
 */
type Props = CommandCentreData & {
  actorRole: 'ADMIN' | 'ADVISOR';
  actorId: string;
};

function Panel({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-line/70 bg-surface border p-8">
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      {note && <p className="text-muted mt-2 text-sm">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** The three collector journeys, in the words the site uses for them. */
const INTAKE_KIND_LABEL: Record<string, string> = {
  INTAKE: 'Intake',
  ACCESS_REQUEST: 'Access request',
  MEMBERSHIP_CONSIDERATION: 'Consideration',
};

function Empty({ children }: { children: string }) {
  return <p className="text-muted text-sm">{children}</p>;
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <li className="border-line/70 flex flex-wrap items-center justify-between gap-4 border-b py-4 last:border-b-0">
      {children}
    </li>
  );
}

export function AdminCommandCenter({
  actorRole,
  actorId,
  vetting,
  intakes,
  comms,
  privateNotes,
  analytics,
  people,
  audit,
}: Props) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="eyebrow">Command Center</p>
        <h1 className="text-4xl sm:text-5xl">Qhakaza operations</h1>
        <p className="text-body max-w-2xl leading-relaxed">
          The only bridge between the artist site and the collector platform. Every action here is
          recorded in the audit trail.
        </p>
        <p className="text-muted caps mt-2">Signed in as {actorRole}</p>
      </header>

      <Panel
        id="vetting"
        title="Verification &amp; vetting"
        note="Artists become visible once approved. Work reaches members once released."
      >
        <h3 className="caps text-muted">Artists awaiting approval</h3>
        {vetting.pendingArtists.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col">
            {vetting.pendingArtists.map((artist) => (
              <Row key={artist.id}>
                <span className="flex flex-col">
                  <span className="text-heading">{artist.displayName}</span>
                  <span className="text-muted text-xs">
                    {artist._count.artworks} submitted{' '}
                    {artist._count.artworks === 1 ? 'work' : 'works'}
                  </span>
                </span>
                <ActionButton
                  variant="primary"
                  label="Approve"
                  action={setArtistApproval.bind(null, { artistId: artist.id, approved: true })}
                />
              </Row>
            ))}
          </ul>
        )}

        <h3 className="caps text-muted mt-10">Work not yet released</h3>
        {vetting.unreleasedArtworks.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col">
            {vetting.unreleasedArtworks.map((artwork) => (
              <Row key={artwork.id}>
                <span className="flex flex-col">
                  <span className="text-heading">{artwork.title}</span>
                  <span className="text-muted text-xs">
                    {artwork.artist.displayName} · {artwork.status}
                    {!artwork.artist.approved && ' · artist not yet approved'}
                  </span>
                </span>
                <ActionButton
                  variant="primary"
                  label="Release to members"
                  action={setArtworkRelease.bind(null, { artworkId: artwork.id, release: true })}
                />
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        id="intakes"
        title="Collector intake"
        note="All three collector journeys arrive here, labelled by which one produced them. Verify an applicant, then issue the invitation that unlocks their private area."
      >
        {intakes.length === 0 ? (
          <Empty>No applications yet.</Empty>
        ) : (
          <ul className="flex flex-col">
            {intakes.map((intake) => {
              const verified = intake.verification?.outcome === 'VERIFIED';
              const invitation = intake.membership?.invitations[0];

              return (
                <Row key={intake.id}>
                  <span className="flex max-w-xl flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-3">
                      {/* Which of the three journeys produced this row. Without
                          it all three look identical in the queue. */}
                      <span className="border-line-strong text-muted caps border px-2 py-1">
                        {INTAKE_KIND_LABEL[intake.kind]}
                      </span>
                      <span className="text-heading">{intake.fullName}</span>
                    </span>
                    <span className="text-muted text-xs">
                      {[intake.city, intake.country].filter(Boolean).join(', ') ||
                        'Location not given'}
                      {' · '}
                      {intake.verification?.outcome ?? 'not yet vetted'}
                      {invitation && ` · invitation ${invitation.status.toLowerCase()}`}
                    </span>
                    {intake.accessInterest && (
                      <span className="text-body text-sm">{intake.accessInterest}</span>
                    )}
                    {intake.considerationNote && (
                      <span className="text-body text-sm">{intake.considerationNote}</span>
                    )}
                  </span>

                  <span className="flex flex-wrap items-start gap-3">
                    {!verified && (
                      <>
                        <ActionButton
                          label="Verify"
                          variant="primary"
                          action={decideCollectorIntake.bind(null, {
                            intakeId: intake.id,
                            outcome: 'VERIFIED',
                          })}
                        />
                        <ActionButton
                          label="Decline"
                          action={decideCollectorIntake.bind(null, {
                            intakeId: intake.id,
                            outcome: 'REJECTED',
                          })}
                        />
                      </>
                    )}

                    {verified && !invitation && (
                      <ActionButton
                        label="Issue invitation"
                        variant="primary"
                        revealsSecret
                        action={inviteCollector.bind(null, { intakeId: intake.id })}
                      />
                    )}

                    {invitation && invitation.status === 'ISSUED' && (
                      <ActionButton
                        label="Revoke"
                        confirm="Revoke this invitation? The member loses access immediately."
                        action={revokeInvitation.bind(null, { invitationId: invitation.id })}
                      />
                    )}
                  </span>
                </Row>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel
        id="comms"
        title="Communications"
        note="Member enquiries come in here and are routed back to the artist behind the work."
      >
        <h3 className="caps text-muted">Private enquiries</h3>
        {comms.notes.length === 0 ? (
          <Empty>No enquiries yet.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col">
            {comms.notes.map((note) => (
              <Row key={note.id}>
                <span className="flex max-w-xl flex-col gap-1">
                  <span className="text-heading">{note.subject}</span>
                  <span className="text-body text-sm">{note.body}</span>
                  <span className="text-muted text-xs">
                    {note.artwork
                      ? `About “${note.artwork.title}” by ${note.artwork.artist.displayName}`
                      : 'General enquiry'}
                    {' · '}
                    {note.status}
                  </span>
                </span>
                {note.status === 'SUBMITTED' && (
                  <ActionButton
                    label="Pick up"
                    action={setNoteStatus.bind(null, { noteId: note.id, status: 'IN_REVIEW' })}
                  />
                )}
              </Row>
            ))}
          </ul>
        )}

        <h3 className="caps text-muted mt-10">Unhandled contact messages</h3>
        {comms.messages.length === 0 ? (
          <Empty>Nothing unhandled.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col">
            {comms.messages.map((message) => (
              <Row key={message.id}>
                <span className="flex flex-col">
                  <span className="text-heading">{message.subject}</span>
                  <span className="text-muted text-xs">
                    {message.name} · {message.email}
                  </span>
                </span>
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        id="private-notes"
        title="Private Notes"
        note="What prospective collectors told us they are drawn to. Read these before preparing anything for them — that is what they are for."
      >
        {privateNotes.length === 0 ? (
          <Empty>No notes yet.</Empty>
        ) : (
          <ul className="flex flex-col">
            {privateNotes.map((note) => (
              <Row key={note.id}>
                <span className="flex max-w-2xl flex-col gap-2">
                  <span className="flex flex-wrap items-center gap-3">
                    <span className="text-heading">{note.fullName}</span>
                    <span className="text-muted text-xs">{note.email}</span>
                    {/* Whether we may write back is the first thing an advisor
                        needs to know, so it is not buried in the detail. */}
                    <span
                      className={cn(
                        'caps border px-2 py-1',
                        note.mayContact
                          ? 'border-accent text-accent-ink'
                          : 'border-line-strong text-muted',
                      )}
                    >
                      {note.mayContact ? 'May contact' : 'No contact consent'}
                    </span>
                  </span>

                  {(note.mediums.length > 0 || note.regions.length > 0) && (
                    <span className="text-muted text-xs">
                      {[...note.mediums, ...note.regions].join(' · ')}
                    </span>
                  )}

                  <span className="text-muted text-xs">
                    {[
                      note.acquisitionPace && `pace: ${note.acquisitionPace}`,
                      note.budgetBand && `range: ${note.budgetBand}`,
                      note.advisoryStyle && `guidance: ${note.advisoryStyle}`,
                      note.contactStyle && `contact: ${note.contactStyle}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'No preferences given'}
                  </span>

                  {[note.subjects, note.building, note.frustrations, note.goodOutcome]
                    .filter(Boolean)
                    .map((text) => (
                      <span key={text} className="text-body text-sm leading-relaxed">
                        {text}
                      </span>
                    ))}
                </span>
              </Row>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        id="analytics"
        title="Analytics &amp; reporting"
        note="Counts are live. Event and metric feeds are empty until something writes them."
      >
        <dl className="grid gap-px sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Artists', analytics.totals.artists],
            ['Approved', analytics.totals.approvedArtists],
            ['Released works', analytics.totals.releasedArtworks],
            ['Intakes', analytics.totals.intakes],
            ['Active members', analytics.totals.activeMemberships],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-raised flex flex-col gap-1 p-5">
              <dt className="text-muted caps">{label}</dt>
              <dd className="font-display text-heading text-3xl">{value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="caps text-muted mt-8">Failed activation attempts</h3>
        {analytics.attempts.length === 0 ? (
          <Empty>None recorded.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col">
            {analytics.attempts.map((attempt) => (
              <Row key={attempt.id}>
                <span className="text-body text-sm">{attempt.outcome}</span>
                <span className="text-muted text-xs">{attempt.ipAddress ?? 'no address'}</span>
              </Row>
            ))}
          </ul>
        )}

        {analytics.events.length === 0 && analytics.metrics.length === 0 && (
          <p className="text-muted mt-8 text-sm">
            No AnalyticsEvent or DailyMetric rows exist. Nothing writes them yet, so these panels
            are empty rather than showing figures that were never measured.
          </p>
        )}
      </Panel>

      <Panel
        id="people"
        title="Access &amp; permissions"
        note={
          actorRole === 'ADMIN'
            ? 'Role changes take effect on the account holder’s next request.'
            : 'Advisors can see roles but not change them.'
        }
      >
        <ul className="flex flex-col">
          {people.map((person) => (
            <Row key={person.id}>
              <span className="flex flex-col">
                <span className="text-heading">{person.name ?? person.email}</span>
                <span className="text-muted text-xs">
                  {person.email} · {person.role}
                </span>
              </span>

              {actorRole === 'ADMIN' && person.id !== actorId && (
                <span className="flex flex-wrap gap-2">
                  {(['ARTIST', 'COLLECTOR', 'ADVISOR', 'ADMIN'] as const)
                    .filter((role) => role !== person.role)
                    .map((role) => (
                      <ActionButton
                        key={role}
                        label={role}
                        confirm={`Change ${person.email} to ${role}?`}
                        action={setUserRole.bind(null, { userId: person.id, role })}
                      />
                    ))}
                </span>
              )}
            </Row>
          ))}
        </ul>
      </Panel>

      <Panel
        id="audit"
        title="Audit trail"
        note="Append-only. Every action above writes here in the same transaction, so an action that could not be recorded did not happen."
      >
        {audit.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ul className="flex flex-col">
            {audit.map((entry) => (
              <Row key={entry.id}>
                <span className="flex flex-col">
                  <span className="text-heading text-sm">{entry.summary ?? entry.action}</span>
                  <span className="text-muted text-xs">
                    {entry.action} · {entry.entityType} · {entry.actorRole}
                  </span>
                </span>
                <time dateTime={entry.createdAt.toISOString()} className="text-muted text-xs">
                  {entry.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </time>
              </Row>
            ))}
          </ul>
        )}
      </Panel>
    </main>
  );
}
