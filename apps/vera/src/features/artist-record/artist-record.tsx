'use client';

import { useState } from 'react';

import { Button, Field } from '@qhakaza/shared-ui';

import { describeProgress, summariseRecord } from './progress';
import type { ArtistRecord, Vocabularies } from './queries';
import { RecordSections } from './record-section';

/**
 * The artist's record.
 *
 * WHAT AN ARTIST IS TOLD ABOUT THEIR OWN RECORD, and what they are not.
 *
 * They see everything they have written, including which entries Qhakaza has
 * since confirmed. They do NOT see any assessment: no readiness, no criteria,
 * no reviewer's view. That is not a UI decision that could be undone by a
 * careless query - `ReadinessAssessment`, `ReadinessRating` and
 * `ReadinessCriterion` have no `artist` policy at all, so an artist session
 * cannot read those tables however it asks.
 *
 * VERIFICATION IS SHOWN, because it is the artist's own claim being described
 * and hiding it would be strange. "Confirmed by Qhakaza" against an entry is a
 * fact about the entry. It is not a score.
 */

type SaveFn = (input: unknown) => Promise<{
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}>;

type Props = {
  record: ArtistRecord;
  vocabularies: Vocabularies;
  onSaveAbout: SaveFn;
  onSaveMediums: SaveFn;
  onSaveExhibition: SaveFn;
  onSaveRepresentation: SaveFn;
  onSaveCvEntry: SaveFn;
  onSaveSignal: SaveFn;
  onSaveLink: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
};

const VERIFICATION_LABEL: Record<string, string> = {
  UNVERIFIED: 'Not yet checked',
  ARTIST_DECLARED: 'Your entry',
  DOCUMENT_ON_FILE: 'Document on file',
  INDEPENDENTLY_VERIFIED: 'Confirmed by Qhakaza',
  UNABLE_TO_VERIFY: 'Could not be confirmed',
  DISPUTED: 'Queried by Qhakaza',
};

function VerificationChip({ state }: { state: string }) {
  const strong = state === 'INDEPENDENTLY_VERIFIED' || state === 'DOCUMENT_ON_FILE';
  const queried = state === 'DISPUTED' || state === 'UNABLE_TO_VERIFY';

  return (
    <span
      className={
        strong
          ? 'caps text-accent text-xs'
          : queried
            ? 'caps text-danger text-xs'
            : 'caps text-muted text-xs'
      }
    >
      {VERIFICATION_LABEL[state] ?? state}
    </span>
  );
}

/** A saved-state line that says what happened, rather than flashing a tick. */
function SaveState({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  if (state === 'saving') return <span className="text-muted text-xs">Saving…</span>;
  if (state === 'saved') return <span className="text-accent text-xs">Saved</span>;
  return (
    <span role="alert" className="text-danger text-xs">
      That did not save. Nothing was lost — try again.
    </span>
  );
}

export function ArtistRecordEditor({
  record,
  vocabularies,
  onSaveAbout,
  onSaveMediums,
  onSaveExhibition,
  onSaveRepresentation,
  onSaveCvEntry,
  onSaveSignal,
  onSaveLink,
  onWithdraw,
}: Props) {
  const summaries = summariseRecord({
    ...record.artist,
    mediums: record.mediums,
    exhibitions: record.exhibitions,
    representations: record.representations,
    cvEntries: record.cvEntries,
    signals: record.signals,
    links: record.links,
    documents: record.documents,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-heading font-serif text-3xl">Your record</h1>
        <p className="text-muted max-w-prose text-sm leading-relaxed">
          This is what Qhakaza holds about you and your practice. It is private. Fill in what you
          have — every section saves on its own, so you can stop and come back.
        </p>
        <p className="text-accent text-sm">{describeProgress(summaries)}</p>
      </header>

      <RecordSections
        summaries={summaries}
        render={(key) => {
          switch (key) {
            case 'about':
              return <AboutForm record={record} onSave={onSaveAbout} />;
            case 'mediums':
              return (
                <MediumsForm
                  record={record}
                  mediums={vocabularies.mediums}
                  onSave={onSaveMediums}
                />
              );
            case 'exhibitions':
              return (
                <ExhibitionsSection
                  record={record}
                  types={vocabularies.exhibitionTypes}
                  onSave={onSaveExhibition}
                  onWithdraw={onWithdraw}
                />
              );
            case 'representation':
              return (
                <RepresentationSection
                  record={record}
                  types={vocabularies.representationTypes}
                  onSave={onSaveRepresentation}
                  onWithdraw={onWithdraw}
                />
              );
            case 'cv':
              return (
                <CvSection
                  record={record}
                  types={vocabularies.cvEntryTypes}
                  onSave={onSaveCvEntry}
                  onWithdraw={onWithdraw}
                />
              );
            case 'signals':
              return (
                <SignalsSection
                  record={record}
                  types={vocabularies.signalTypes}
                  onSave={onSaveSignal}
                  onWithdraw={onWithdraw}
                />
              );
            case 'links':
              return <LinksSection record={record} onSave={onSaveLink} onWithdraw={onWithdraw} />;
            case 'documents':
              return <DocumentsSection record={record} />;
            default:
              return null;
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function AboutForm({ record, onSave }: { record: ArtistRecord; onSave: SaveFn }) {
  const artist = record.artist;
  const [values, setValues] = useState({
    biographyPublic: artist.biographyPublic ?? '',
    biographyInternal: artist.biographyInternal ?? '',
    practice: artist.practice ?? '',
    statement: artist.statement ?? '',
    basedIn: artist.basedIn ?? '',
    nationality: artist.nationality ?? '',
    birthYear: artist.birthYear ? String(artist.birthYear) : '',
  });
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('saving');
    setErrors({});

    const result = await onSave({
      ...values,
      birthYear: values.birthYear ? Number(values.birthYear) : undefined,
    });

    if (result.ok) setState('saved');
    else {
      setState('error');
      setErrors(result.fieldErrors ?? {});
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Field
        label="Biography for your public page"
        hint="This appears on your page on the Qhakaza site, but only once you have agreed to your story being published."
        error={errors.biographyPublic}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            value={values.biographyPublic}
            onChange={(event) => set('biographyPublic')(event.target.value)}
          />
        )}
      </Field>

      <Field
        label="Fuller biography, for Qhakaza only"
        hint="Never published. This is the version for the people assessing your work — say more than you would in public."
        error={errors.biographyInternal}
      >
        {(props) => (
          <textarea
            {...props}
            rows={7}
            value={values.biographyInternal}
            onChange={(event) => set('biographyInternal')(event.target.value)}
          />
        )}
      </Field>

      <Field
        label="Your practice"
        hint="Materials, process, and what you are working through."
        error={errors.practice}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            value={values.practice}
            onChange={(event) => set('practice')(event.target.value)}
          />
        )}
      </Field>

      <Field
        label="Artist statement"
        hint="Kept in your own words, exactly as you write it."
        error={errors.statement}
      >
        {(props) => (
          <textarea
            {...props}
            rows={4}
            value={values.statement}
            onChange={(event) => set('statement')(event.target.value)}
          />
        )}
      </Field>

      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Based in" error={errors.basedIn}>
          {(props) => (
            <input
              {...props}
              type="text"
              value={values.basedIn}
              onChange={(event) => set('basedIn')(event.target.value)}
            />
          )}
        </Field>
        <Field label="Nationality" error={errors.nationality}>
          {(props) => (
            <input
              {...props}
              type="text"
              value={values.nationality}
              onChange={(event) => set('nationality')(event.target.value)}
            />
          )}
        </Field>
        <Field label="Year of birth" error={errors.birthYear}>
          {(props) => (
            <input
              {...props}
              type="number"
              value={values.birthYear}
              onChange={(event) => set('birthYear')(event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={state === 'saving'}>
          Save this section
        </Button>
        <SaveState state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function MediumsForm({
  record,
  mediums,
  onSave,
}: {
  record: ArtistRecord;
  mediums: Vocabularies['mediums'];
  onSave: SaveFn;
}) {
  const [selected, setSelected] = useState<string[]>(record.mediums.map((row) => row.medium.id));
  const [primary, setPrimary] = useState<string[]>(
    record.mediums.filter((row) => row.primary).map((row) => row.medium.id),
  );
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('saving');
    const result = await onSave({
      mediumIds: selected,
      primaryMediumIds: primary.filter((id) => selected.includes(id)),
    });
    setState(result.ok ? 'saved' : 'error');
  }

  // Grouped by family so a long list reads as a few short ones.
  const families = [...new Set(mediums.map((medium) => medium.family ?? 'Other'))];

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <p className="text-muted text-sm">
        Choose everything you work in, then mark the one or two you are best known for.
      </p>

      <div className="flex flex-col gap-5">
        {families.map((family) => (
          <fieldset key={family} className="flex flex-col gap-2">
            <legend className="caps text-muted mb-1">{family}</legend>
            <div className="flex flex-wrap gap-2">
              {mediums
                .filter((medium) => (medium.family ?? 'Other') === family)
                .map((medium) => {
                  const chosen = selected.includes(medium.id);
                  const isPrimary = primary.includes(medium.id);
                  return (
                    <span key={medium.id} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => toggle(medium.id)}
                        aria-pressed={chosen}
                        className={
                          chosen
                            ? 'border-accent text-accent border px-3 py-1 text-sm'
                            : 'border-line text-muted hover:border-line-strong border px-3 py-1 text-sm'
                        }
                      >
                        {medium.label}
                      </button>
                      {chosen && (
                        <button
                          type="button"
                          onClick={() =>
                            setPrimary((current) =>
                              current.includes(medium.id)
                                ? current.filter((value) => value !== medium.id)
                                : [...current, medium.id],
                            )
                          }
                          aria-pressed={isPrimary}
                          title="Mark as a primary medium"
                          className={
                            isPrimary
                              ? 'text-accent ml-1 px-2 text-sm'
                              : 'text-muted/50 hover:text-muted ml-1 px-2 text-sm'
                          }
                        >
                          ★
                        </button>
                      )}
                    </span>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={state === 'saving'}>
          Save this section
        </Button>
        <SaveState state={state} />
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/**
 * The list sections share a shape: existing entries, each withdrawable, and one
 * form to add another. The forms differ enough in their fields that a single
 * generic component would be more configuration than code, so they are written
 * out - but the wrapper and the withdraw behaviour are shared.
 */
function EntryList({
  entries,
  kind,
  onWithdraw,
  children,
}: {
  entries: { id: string; primary: string; secondary?: string | null; verification?: string }[];
  kind: string;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {entries.length > 0 && (
        <ul className="border-line/70 flex flex-col border-t">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
            >
              <span className="flex flex-col gap-1">
                <span className="text-body text-sm">{entry.primary}</span>
                {entry.secondary && <span className="text-muted text-xs">{entry.secondary}</span>}
              </span>
              <span className="flex items-center gap-4">
                {entry.verification && <VerificationChip state={entry.verification} />}
                <button
                  type="button"
                  disabled={busy === entry.id}
                  onClick={async () => {
                    setBusy(entry.id);
                    try {
                      await onWithdraw(kind, { id: entry.id });
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="text-muted hover:text-danger caps text-xs"
                >
                  Withdraw
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Withdrawal is not deletion, and saying so once here is honest. */}
      <p className="text-muted text-xs">
        Withdrawing removes an entry from your record. Qhakaza keeps a note that it was there, so
        anything already assessed can still be traced.
      </p>

      {children}
    </div>
  );
}

/** A small form that clears itself on a successful save. */
function useEntryForm<T extends Record<string, string>>(initial: T, onSave: SaveFn) {
  const [values, setValues] = useState<T>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof T) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent, build: (values: T) => unknown) {
    event.preventDefault();
    setState('saving');
    setErrors({});

    const result = await onSave(build(values));

    if (result.ok) {
      setState('saved');
      setValues(initial);
    } else {
      setState('error');
      setErrors(result.fieldErrors ?? {});
    }
  }

  return { values, set, state, errors, submit };
}

function ExhibitionsSection({
  record,
  types,
  onSave,
  onWithdraw,
}: {
  record: ArtistRecord;
  types: Vocabularies['exhibitionTypes'];
  onSave: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useEntryForm(
    { title: '', venue: '', typeId: '', startYear: '', role: '', curator: '' },
    onSave,
  );

  const entries = record.exhibitions.map((row) => ({
    id: row.id,
    primary: row.exhibition.title,
    secondary: [
      row.exhibition.venue,
      row.exhibition.startDate ? String(row.exhibition.startDate.getUTCFullYear()) : null,
      row.type?.label,
    ]
      .filter(Boolean)
      .join(' · '),
    verification: row.verification,
  }));

  return (
    <EntryList entries={entries} kind="exhibition" onWithdraw={onWithdraw}>
      <form
        onSubmit={(event) =>
          form.submit(event, (values) => ({
            title: values.title,
            venue: values.venue || undefined,
            typeId: values.typeId || undefined,
            startYear: values.startYear ? Number(values.startYear) : undefined,
            role: values.role || undefined,
            curator: values.curator || undefined,
          }))
        }
        className="flex flex-col gap-5"
      >
        <h4 className="caps text-muted">Add an exhibition</h4>

        <Field label="Title" required error={form.errors.title}>
          {(props) => (
            <input
              {...props}
              type="text"
              value={form.values.title}
              onChange={(event) => form.set('title')(event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Venue" error={form.errors.venue}>
            {(props) => (
              <input
                {...props}
                type="text"
                value={form.values.venue}
                onChange={(event) => form.set('venue')(event.target.value)}
              />
            )}
          </Field>
          <Field label="Year" error={form.errors.startYear}>
            {(props) => (
              <input
                {...props}
                type="number"
                value={form.values.startYear}
                onChange={(event) => form.set('startYear')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kind of exhibition" error={form.errors.typeId}>
            {(props) => (
              <select
                {...props}
                value={form.values.typeId}
                onChange={(event) => form.set('typeId')(event.target.value)}
              >
                <option value="">Not stated</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Curator" error={form.errors.curator}>
            {(props) => (
              <input
                {...props}
                type="text"
                value={form.values.curator}
                onChange={(event) => form.set('curator')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" disabled={form.state === 'saving'}>
            Add exhibition
          </Button>
          <SaveState state={form.state} />
        </div>
      </form>
    </EntryList>
  );
}

function RepresentationSection({
  record,
  types,
  onSave,
  onWithdraw,
}: {
  record: ArtistRecord;
  types: Vocabularies['representationTypes'];
  onSave: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useEntryForm({ partyName: '', typeId: '', territory: '', startYear: '' }, onSave);

  const entries = record.representations.map((row) => ({
    id: row.id,
    primary: row.party.name,
    secondary: [row.type?.label, row.territory, row.current ? 'Current' : 'Past']
      .filter(Boolean)
      .join(' · '),
    verification: row.verification,
  }));

  return (
    <EntryList entries={entries} kind="representation" onWithdraw={onWithdraw}>
      <form
        onSubmit={(event) =>
          form.submit(event, (values) => ({
            partyName: values.partyName,
            typeId: values.typeId || undefined,
            territory: values.territory || undefined,
            startYear: values.startYear ? Number(values.startYear) : undefined,
            current: true,
          }))
        }
        className="flex flex-col gap-5"
      >
        <h4 className="caps text-muted">Add representation</h4>

        <Field label="Gallery or agent" required error={form.errors.partyName}>
          {(props) => (
            <input
              {...props}
              type="text"
              value={form.values.partyName}
              onChange={(event) => form.set('partyName')(event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Kind" error={form.errors.typeId}>
            {(props) => (
              <select
                {...props}
                value={form.values.typeId}
                onChange={(event) => form.set('typeId')(event.target.value)}
              >
                <option value="">Not stated</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Where it applies" error={form.errors.territory}>
            {(props) => (
              <input
                {...props}
                type="text"
                placeholder="South Africa"
                value={form.values.territory}
                onChange={(event) => form.set('territory')(event.target.value)}
              />
            )}
          </Field>
          <Field label="Since" error={form.errors.startYear}>
            {(props) => (
              <input
                {...props}
                type="number"
                value={form.values.startYear}
                onChange={(event) => form.set('startYear')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" disabled={form.state === 'saving'}>
            Add representation
          </Button>
          <SaveState state={form.state} />
        </div>
      </form>
    </EntryList>
  );
}

function CvSection({
  record,
  types,
  onSave,
  onWithdraw,
}: {
  record: ArtistRecord;
  types: Vocabularies['cvEntryTypes'];
  onSave: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useEntryForm(
    { typeId: '', title: '', organisation: '', location: '', startYear: '' },
    onSave,
  );

  const entries = record.cvEntries.map((row) => ({
    id: row.id,
    primary: row.title,
    secondary: [row.type?.label, row.organisation, row.startYear ? String(row.startYear) : null]
      .filter(Boolean)
      .join(' · '),
    verification: row.verification,
  }));

  return (
    <EntryList entries={entries} kind="cvEntry" onWithdraw={onWithdraw}>
      <form
        onSubmit={(event) =>
          form.submit(event, (values) => ({
            typeId: values.typeId || undefined,
            title: values.title,
            organisation: values.organisation || undefined,
            location: values.location || undefined,
            startYear: values.startYear ? Number(values.startYear) : undefined,
          }))
        }
        className="flex flex-col gap-5"
      >
        <h4 className="caps text-muted">Add a line</h4>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Section" error={form.errors.typeId}>
            {(props) => (
              <select
                {...props}
                value={form.values.typeId}
                onChange={(event) => form.set('typeId')(event.target.value)}
              >
                <option value="">Not stated</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Year" error={form.errors.startYear}>
            {(props) => (
              <input
                {...props}
                type="number"
                value={form.values.startYear}
                onChange={(event) => form.set('startYear')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Title" required error={form.errors.title}>
          {(props) => (
            <input
              {...props}
              type="text"
              placeholder="MFA, Fine Art"
              value={form.values.title}
              onChange={(event) => form.set('title')(event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organisation" error={form.errors.organisation}>
            {(props) => (
              <input
                {...props}
                type="text"
                value={form.values.organisation}
                onChange={(event) => form.set('organisation')(event.target.value)}
              />
            )}
          </Field>
          <Field label="Location" error={form.errors.location}>
            {(props) => (
              <input
                {...props}
                type="text"
                value={form.values.location}
                onChange={(event) => form.set('location')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" disabled={form.state === 'saving'}>
            Add to CV
          </Button>
          <SaveState state={form.state} />
        </div>
      </form>
    </EntryList>
  );
}

function SignalsSection({
  record,
  types,
  onSave,
  onWithdraw,
}: {
  record: ArtistRecord;
  types: Vocabularies['signalTypes'];
  onSave: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useEntryForm(
    { signalTypeId: '', institution: '', description: '', year: '' },
    onSave,
  );

  const entries = record.signals.map((row) => ({
    id: row.id,
    primary: row.description,
    secondary: [row.signalType?.label, row.institution, row.year ? String(row.year) : null]
      .filter(Boolean)
      .join(' · '),
    verification: row.verification,
  }));

  return (
    <EntryList entries={entries} kind="signal" onWithdraw={onWithdraw}>
      <form
        onSubmit={(event) =>
          form.submit(event, (values) => ({
            signalTypeId: values.signalTypeId || undefined,
            institution: values.institution || undefined,
            description: values.description,
            year: values.year ? Number(values.year) : undefined,
          }))
        }
        className="flex flex-col gap-5"
      >
        <h4 className="caps text-muted">Add recognition</h4>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Kind" error={form.errors.signalTypeId}>
            {(props) => (
              <select
                {...props}
                value={form.values.signalTypeId}
                onChange={(event) => form.set('signalTypeId')(event.target.value)}
              >
                <option value="">Not stated</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Year" error={form.errors.year}>
            {(props) => (
              <input
                {...props}
                type="number"
                value={form.values.year}
                onChange={(event) => form.set('year')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Institution" error={form.errors.institution}>
          {(props) => (
            <input
              {...props}
              type="text"
              value={form.values.institution}
              onChange={(event) => form.set('institution')(event.target.value)}
            />
          )}
        </Field>

        <Field label="What happened" required error={form.errors.description}>
          {(props) => (
            <textarea
              {...props}
              rows={3}
              placeholder="Work acquired for the permanent collection"
              value={form.values.description}
              onChange={(event) => form.set('description')(event.target.value)}
            />
          )}
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" disabled={form.state === 'saving'}>
            Add recognition
          </Button>
          <SaveState state={form.state} />
        </div>
      </form>
    </EntryList>
  );
}

function LinksSection({
  record,
  onSave,
  onWithdraw,
}: {
  record: ArtistRecord;
  onSave: SaveFn;
  onWithdraw: (kind: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const form = useEntryForm({ kind: 'Website', label: '', url: '' }, onSave);

  const entries = record.links.map((row) => ({
    id: row.id,
    primary: row.label || row.kind,
    secondary: row.url,
    verification: row.verification,
  }));

  return (
    <EntryList entries={entries} kind="link" onWithdraw={onWithdraw}>
      <form
        onSubmit={(event) =>
          form.submit(event, (values) => ({
            kind: values.kind,
            label: values.label || undefined,
            url: values.url,
          }))
        }
        className="flex flex-col gap-5"
      >
        <h4 className="caps text-muted">Add a link</h4>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="What it is" required error={form.errors.kind}>
            {(props) => (
              <input
                {...props}
                type="text"
                placeholder="Website, Instagram, Gallery page"
                value={form.values.kind}
                onChange={(event) => form.set('kind')(event.target.value)}
              />
            )}
          </Field>
          <Field label="Label" error={form.errors.label}>
            {(props) => (
              <input
                {...props}
                type="text"
                value={form.values.label}
                onChange={(event) => form.set('label')(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label="Address" required error={form.errors.url}>
          {(props) => (
            <input
              {...props}
              type="url"
              placeholder="https://"
              value={form.values.url}
              onChange={(event) => form.set('url')(event.target.value)}
            />
          )}
        </Field>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="secondary" disabled={form.state === 'saving'}>
            Add link
          </Button>
          <SaveState state={form.state} />
        </div>
      </form>
    </EntryList>
  );
}

/**
 * Documents attached to the artist record.
 *
 * READ-ONLY HERE, deliberately. Uploading is done from the work it belongs to,
 * where the artist can say what the document IS - and an untyped pile of files
 * is exactly what the document taxonomy exists to prevent.
 */
function DocumentsSection({ record }: { record: ArtistRecord }) {
  if (record.documents.length === 0) {
    return (
      <p className="text-muted border-line border border-dashed p-6 text-sm">
        No documents yet. Certificates, catalogues and press are added from the work they relate to,
        and anything that supports your CV or exhibition history can be sent to Qhakaza directly.
      </p>
    );
  }

  return (
    <ul className="border-line/70 flex flex-col border-t">
      {record.documents.map((document) => (
        <li
          key={document.id}
          className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
        >
          <span className="text-body text-sm">{document.originalFilename}</span>
          <span className="text-muted caps text-xs">
            {document.documentType?.label ?? 'Type not recorded'}
          </span>
        </li>
      ))}
    </ul>
  );
}
