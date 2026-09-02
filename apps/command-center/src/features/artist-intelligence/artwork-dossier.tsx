'use client';

import { useState } from 'react';

import type { ArtworkDossier } from './artwork-queries';

/**
 * One artwork, as Qhakaza sees it.
 *
 * THE PROVENANCE EDITOR IS THE POINT OF THIS SCREEN. Recording a clean
 * transfer was never the hard part; recording that a period is unaccounted for
 * is, and until there was a screen for it the ability existed only in the
 * database. A chain whose gaps are inexpressible in the UI gets its gaps left
 * out, and a chain with its gaps omitted reads as complete.
 *
 * So "record a gap" is a first-class button here, sitting beside "record a
 * transfer" rather than hidden behind an advanced option.
 */

type Fn = (input: unknown) => Promise<{ ok: boolean; error?: string }>;

const KINDS = [
  { value: 'TRANSFER', label: 'A change of hands' },
  { value: 'UNKNOWN_INTERVAL', label: 'A period where custody is not known' },
  { value: 'DISPUTED_TRANSFER', label: 'A transfer someone disputes' },
  { value: 'RETAINED', label: 'Held by the same party' },
] as const;

const VERIFICATION = [
  { value: 'UNVERIFIED', label: 'Not checked' },
  { value: 'ARTIST_DECLARED', label: "Artist's word" },
  { value: 'DOCUMENT_ON_FILE', label: 'Document on file' },
  { value: 'INDEPENDENTLY_VERIFIED', label: 'Confirmed independently' },
  { value: 'UNABLE_TO_VERIFY', label: 'Could not confirm' },
  { value: 'DISPUTED', label: 'Disputed' },
] as const;

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="caps text-muted">{title}</h2>
      {note && <p className="text-muted max-w-2xl text-xs leading-relaxed">{note}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted border-line border border-dashed p-5 text-sm">{children}</p>;
}

export function ArtworkDossierView({
  dossier,
  documentTypes,
  canEdit,
  onSaveProvenance,
  onCiteSource,
  onLinkDocument,
  onSetDocumentType,
}: {
  dossier: ArtworkDossier;
  documentTypes: { id: string; label: string; guidance: string | null }[];
  canEdit: boolean;
  onSaveProvenance: Fn;
  onCiteSource: Fn;
  onLinkDocument: Fn;
  onSetDocumentType: Fn;
}) {
  const { artwork } = dossier;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-heading font-serif text-3xl">{artwork.title}</h1>
        <p className="text-muted text-sm">
          {[artwork.artist.displayName, artwork.medium, artwork.dimensions, artwork.status]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <Section
        title="Provenance"
        note="A chain is only as honest as its gaps. Record what is not known as readily as what is."
      >
        <p className="text-body text-sm">{dossier.provenanceSummary.statement}</p>

        {dossier.provenance.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <ol className="border-line/70 flex flex-col border-t">
            {dossier.provenance.map((link) => {
              const isGap = link.kind === 'UNKNOWN_INTERVAL';
              const contested =
                link.kind === 'DISPUTED_TRANSFER' || link.verification === 'DISPUTED';

              return (
                <li
                  key={link.id}
                  className={
                    isGap
                      ? 'border-line/70 bg-wait-soft/30 flex flex-col gap-1 border-b border-l-2 border-l-amber-700 py-3 pl-3'
                      : 'border-line/70 flex flex-col gap-1 border-b py-3'
                  }
                >
                  <span className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className={isGap ? 'text-danger text-sm' : 'text-heading text-sm'}>
                      {isGap
                        ? 'Custody not established'
                        : `${link.fromParty?.name ?? 'Unknown'} → ${link.toParty?.name ?? 'Unknown'}`}
                    </span>
                    <span
                      className={contested ? 'caps text-danger text-xs' : 'caps text-muted text-xs'}
                    >
                      {VERIFICATION.find((v) => v.value === link.verification)?.label ??
                        link.verification}
                    </span>
                  </span>

                  <span className="text-muted text-xs">
                    {[
                      link.occurredOn?.toLocaleDateString('en-ZA'),
                      link.periodStart || link.periodEnd
                        ? `${link.periodStart?.getUTCFullYear() ?? '?'} – ${link.periodEnd?.getUTCFullYear() ?? '?'}`
                        : null,
                      link.amount ? `${link.currency ?? ''} ${link.amount}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>

                  {link.notes && <span className="text-body text-xs">{link.notes}</span>}
                  {link.verificationNote && (
                    <span className="text-muted text-xs italic">{link.verificationNote}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {canEdit && <ProvenanceForm artworkId={artwork.id} onSave={onSaveProvenance} />}
      </Section>

      <Section
        title="Documents"
        note="A document may be attached to more than one record. The same catalogue can be an exhibition record on one and provenance support on another."
      >
        {dossier.documents.length === 0 ? (
          <Empty>No documents attached to this work.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.documents.map((document) => (
              <li key={document.id} className="border-line/70 flex flex-col gap-2 border-b py-3">
                <span className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-heading text-sm">{document.originalFilename}</span>
                  <span className="text-muted caps text-xs">
                    {document.confidentiality.toLowerCase()}
                  </span>
                </span>

                <span className="text-muted text-xs">
                  {document.documentType?.label ?? 'Type not recorded'}
                  {document.links.length > 1 && ` · attached to ${document.links.length} records`}
                </span>

                {canEdit && (
                  <DocumentTypePicker
                    assetId={document.id}
                    current={document.documentType?.id ?? ''}
                    types={documentTypes}
                    onSet={onSetDocumentType}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && <AttachDocument artworkId={artwork.id} onLink={onLinkDocument} />}
      </Section>

      <Section
        title="Sources"
        note="What stands behind the record. A source is quoted rather than summarised — one that has since moved still has to be answerable for."
      >
        {dossier.sources.length === 0 ? (
          <Empty>Nothing cited against this work.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.sources.map((reference) => (
              <li key={reference.id} className="border-line/70 flex flex-col gap-1 border-b py-3">
                <span className="text-heading text-sm">{reference.source.name}</span>
                <span className="text-muted text-xs">
                  {[reference.source.kind, reference.field, reference.locator]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {reference.extract && (
                  <span className="text-body text-xs italic">
                    &ldquo;{reference.extract}&rdquo;
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && <CiteSourceForm artworkId={artwork.id} onCite={onCiteSource} />}
      </Section>

      <Section
        title="Declared value"
        note="What was asked or stated, and by whom. Not a valuation, and nothing in the platform presents it as one."
      >
        {dossier.prices.length === 0 ? (
          <Empty>No figure recorded.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.prices.map((price) => (
              <li
                key={price.id}
                className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-2 text-sm"
              >
                <span className={price.current ? 'text-heading' : 'text-muted'}>
                  {price.currency} {price.amount}
                  {price.current && ' · current'}
                </span>
                <span className="text-muted text-xs">
                  {price.declaredOn.toLocaleDateString('en-ZA')}
                  {price.basis ? ` · ${price.basis}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Where this work has been placed">
        {dossier.releases.length === 0 ? (
          <Empty>Visible to nobody.</Empty>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {dossier.releases.map((release) => (
              <li
                key={release.id}
                className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-2 text-sm"
              >
                <span className={release.revokedAt ? 'text-muted line-through' : 'text-body'}>
                  {release.audience.name} · {release.tier.replaceAll('_', ' ').toLowerCase()}
                </span>
                <span className="text-muted text-xs">
                  {release.revokedAt
                    ? 'Taken back'
                    : release.releasedAt.toLocaleDateString('en-ZA')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProvenanceForm({ artworkId, onSave }: { artworkId: string; onSave: Fn }) {
  const [kind, setKind] = useState<string>('TRANSFER');
  const [values, setValues] = useState({
    fromPartyName: '',
    toPartyName: '',
    occurredOn: '',
    periodStart: '',
    periodEnd: '',
    amount: '',
    notes: '',
    verification: 'UNVERIFIED',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGap = kind === 'UNKNOWN_INTERVAL';
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
      <h3 className="caps text-muted">Add to the chain</h3>

      <select
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        className="border-line bg-canvas border px-3 py-2 text-sm"
      >
        {KINDS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {isGap ? (
        /*
         * A gap takes no parties and no amount. The fields are not merely
         * ignored on the server - they are absent here, so nobody types an
         * owner into the row that exists to say the owner is unknown.
         */
        <>
          <p className="text-muted text-xs">
            Give the period this covers, or say what is not known. Both is better.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="caps text-muted">From</span>
              <input
                type="date"
                value={values.periodStart}
                onChange={(event) => set('periodStart')(event.target.value)}
                className="border-line bg-canvas border px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="caps text-muted">Until</span>
              <input
                type="date"
                value={values.periodEnd}
                onChange={(event) => set('periodEnd')(event.target.value)}
                className="border-line bg-canvas border px-3 py-2 text-sm"
              />
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={values.fromPartyName}
              onChange={(event) => set('fromPartyName')(event.target.value)}
              placeholder="From"
              className="border-line bg-canvas flex-1 border px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={values.toPartyName}
              onChange={(event) => set('toPartyName')(event.target.value)}
              placeholder="To"
              className="border-line bg-canvas flex-1 border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={values.occurredOn}
              onChange={(event) => set('occurredOn')(event.target.value)}
              className="border-line bg-canvas border px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={values.amount}
              onChange={(event) => set('amount')(event.target.value)}
              placeholder="Amount, if known"
              className="border-line bg-canvas border px-3 py-2 text-sm"
            />
          </div>
        </>
      )}

      <textarea
        rows={2}
        value={values.notes}
        onChange={(event) => set('notes')(event.target.value)}
        placeholder={isGap ? 'What is not known, and what was looked at' : 'Notes'}
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      <select
        value={values.verification}
        onChange={(event) => set('verification')(event.target.value)}
        className="border-line bg-canvas border px-3 py-2 text-sm"
      >
        {VERIFICATION.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
          const result = await onSave({
            artworkId,
            kind,
            ...(isGap
              ? {
                  periodStart: values.periodStart || undefined,
                  periodEnd: values.periodEnd || undefined,
                }
              : {
                  fromPartyName: values.fromPartyName || undefined,
                  toPartyName: values.toPartyName || undefined,
                  occurredOn: values.occurredOn || undefined,
                  amount: values.amount ? Number(values.amount) : undefined,
                  currency: values.amount ? 'ZAR' : undefined,
                }),
            notes: values.notes || undefined,
            verification: values.verification,
          });
          setBusy(false);
          if (result.ok) {
            setValues({
              fromPartyName: '',
              toPartyName: '',
              occurredOn: '',
              periodStart: '',
              periodEnd: '',
              amount: '',
              notes: '',
              verification: 'UNVERIFIED',
            });
          } else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        {isGap ? 'Record this gap' : 'Add this link'}
      </button>
    </div>
  );
}

function DocumentTypePicker({
  assetId,
  current,
  types,
  onSet,
}: {
  assetId: string;
  current: string;
  types: { id: string; label: string }[];
  onSet: Fn;
}) {
  const [applyDefault, setApplyDefault] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        defaultValue={current}
        disabled={busy}
        onChange={async (event) => {
          if (!event.target.value) return;
          setBusy(true);
          await onSet({
            mediaAssetId: assetId,
            documentTypeId: event.target.value,
            applyDefaultConfidentiality: applyDefault,
          });
          setBusy(false);
        }}
        className="border-line bg-canvas border px-2 py-1 text-xs"
      >
        <option value="">Say what this is…</option>
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.label}
          </option>
        ))}
      </select>

      {/* Opt-in, because retyping a file must not quietly widen who can see it. */}
      <label className="text-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={applyDefault}
          onChange={(event) => setApplyDefault(event.target.checked)}
        />
        Also apply this type&rsquo;s usual confidentiality
      </label>
    </div>
  );
}

function AttachDocument({ artworkId, onLink }: { artworkId: string; onLink: Fn }) {
  const [assetId, setAssetId] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
      <h3 className="caps text-muted">Attach an existing document</h3>
      <p className="text-muted text-xs">
        For a document already on file elsewhere &mdash; a catalogue held against an exhibition,
        say. It stays one file; this records that it also evidences this work.
      </p>

      <input
        type="text"
        value={assetId}
        onChange={(event) => setAssetId(event.target.value)}
        placeholder="Document reference"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="Why it is attached here — e.g. provenance support"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      {done && <p className="text-accent text-sm">Attached.</p>}

      <button
        type="button"
        disabled={busy || !assetId.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setDone(false);
          const result = await onLink({
            mediaAssetId: assetId.trim(),
            subjectType: 'Artwork',
            subjectId: artworkId,
            role: role.trim() || undefined,
          });
          setBusy(false);
          if (result.ok) {
            setAssetId('');
            setRole('');
            setDone(true);
          } else setError(result.error ?? 'That did not attach.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        Attach
      </button>
    </div>
  );
}

function CiteSourceForm({ artworkId, onCite }: { artworkId: string; onCite: Fn }) {
  const [values, setValues] = useState({
    sourceName: '',
    sourceKind: '',
    field: '',
    locator: '',
    extract: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
      <h3 className="caps text-muted">Cite a source</h3>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={values.sourceName}
          onChange={(event) => set('sourceName')(event.target.value)}
          placeholder="Source"
          className="border-line bg-canvas flex-1 border px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={values.sourceKind}
          onChange={(event) => set('sourceKind')(event.target.value)}
          placeholder="Archive, catalogue, interview"
          className="border-line bg-canvas border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={values.field}
          onChange={(event) => set('field')(event.target.value)}
          placeholder="What it supports — leave blank for the work as a whole"
          className="border-line bg-canvas flex-1 border px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={values.locator}
          onChange={(event) => set('locator')(event.target.value)}
          placeholder="Page, reference"
          className="border-line bg-canvas border px-3 py-2 text-sm"
        />
      </div>

      <textarea
        rows={2}
        value={values.extract}
        onChange={(event) => set('extract')(event.target.value)}
        placeholder="What the source actually says, quoted"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !values.sourceName.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await onCite({
            subjectType: 'Artwork',
            subjectId: artworkId,
            sourceName: values.sourceName.trim(),
            sourceKind: values.sourceKind.trim() || undefined,
            field: values.field.trim() || undefined,
            locator: values.locator.trim() || undefined,
            extract: values.extract.trim() || undefined,
          });
          setBusy(false);
          if (result.ok) {
            setValues({ sourceName: '', sourceKind: '', field: '', locator: '', extract: '' });
          } else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        Record this citation
      </button>
    </div>
  );
}
