'use client';

import { useState } from 'react';

import type { ListName } from './actions';

/**
 * Managing the configurable lists.
 *
 * NOTHING IS DELETED HERE, and the screen says so. A term that has been used
 * is part of the rows that used it: retiring takes it out of the pickers and
 * leaves every record that already refers to it intact and legible.
 */

type Term = {
  id: string;
  slug: string;
  label: string;
  active: boolean;
  guidance?: string | null;
  family?: string | null;
};

type Lists = Record<ListName, Term[]>;

const LIST_META: { key: ListName; label: string; description: string }[] = [
  {
    key: 'medium',
    label: 'Media',
    description: 'What artists work in. Used on artist records and for matching.',
  },
  {
    key: 'exhibitionType',
    label: 'Exhibition types',
    description: 'Solo, group, biennale. The distinction carries weight in an assessment.',
  },
  {
    key: 'signalType',
    label: 'Recognition types',
    description: 'Acquisitions, prizes, residencies, commissions.',
  },
  { key: 'cvEntryType', label: 'CV sections', description: 'How a CV is broken up.' },
  {
    key: 'representationType',
    label: 'Representation types',
    description: 'Primary gallery, agent, estate.',
  },
  {
    key: 'documentType',
    label: 'Document types',
    description: 'What a stored file is. Drives its default confidentiality.',
  },
  {
    key: 'readinessCriterion',
    label: 'Readiness criteria',
    description:
      'The dimensions an artist is assessed on. Qhakaza’s own framework — nothing is supplied here by default.',
  },
];

export function ListManager({
  lists,
  canEdit,
  onAdd,
  onSetActive,
}: {
  lists: Lists;
  canEdit: boolean;
  onAdd: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
  onSetActive: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [openList, setOpenList] = useState<ListName>('medium');

  const meta = LIST_META.find((entry) => entry.key === openList)!;
  const terms = lists[openList] ?? [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-heading font-serif text-3xl">Lists</h1>
        <p className="text-muted max-w-2xl text-sm leading-relaxed">
          The vocabulary the platform uses. These are yours to extend — adding a term here changes
          what artists can choose and what future assessments compare against.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {LIST_META.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setOpenList(entry.key)}
            className={
              openList === entry.key
                ? 'border-accent text-accent caps border px-3 py-1 text-xs'
                : 'border-line text-muted hover:border-line-strong caps border px-3 py-1 text-xs'
            }
          >
            {entry.label}
          </button>
        ))}
      </nav>

      <section className="flex flex-col gap-4">
        <p className="text-muted text-sm">{meta.description}</p>

        {terms.length === 0 ? (
          <p className="text-muted border-line border border-dashed p-6 text-sm">
            {openList === 'readinessCriterion'
              ? 'Nothing here yet, and deliberately so. The readiness framework is Qhakaza’s intellectual property — the platform applies it rather than defining it, so no criteria were invented for you. Add yours below and assessment becomes available immediately.'
              : 'Nothing in this list yet.'}
          </p>
        ) : (
          <ul className="border-line/70 flex flex-col border-t">
            {terms.map((term) => (
              <li
                key={term.id}
                className="border-line/70 flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <span className="flex flex-col gap-1">
                  <span className={term.active ? 'text-heading text-sm' : 'text-muted text-sm'}>
                    {term.label}
                    {!term.active && ' (retired)'}
                  </span>
                  <span className="text-muted text-xs">
                    {[term.slug, term.family, term.guidance].filter(Boolean).join(' · ')}
                  </span>
                </span>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      onSetActive({ list: openList, id: term.id, active: !term.active })
                    }
                    className="text-muted hover:text-accent caps text-xs"
                  >
                    {term.active ? 'Retire' : 'Restore'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-muted text-xs">
          Retiring a term removes it from the lists artists and staff choose from. Records that
          already use it keep it, so nothing written in the past changes meaning.
        </p>

        {canEdit ? (
          <AddTerm list={openList} onAdd={onAdd} />
        ) : (
          <p className="text-muted text-xs">Only an administrator can change these lists.</p>
        )}
      </section>
    </div>
  );
}

function AddTerm({
  list,
  onAdd,
}: {
  list: ListName;
  onAdd: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [label, setLabel] = useState('');
  const [guidance, setGuidance] = useState('');
  const [family, setFamily] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wantsFamily = list === 'medium';
  const wantsGuidance = list !== 'cvEntryType' && list !== 'representationType' && !wantsFamily;

  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-4">
      <h3 className="caps text-muted">Add a term</h3>

      <input
        type="text"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Label"
        className="border-line bg-canvas border px-3 py-2 text-sm"
      />

      {wantsFamily && (
        <input
          type="text"
          value={family}
          onChange={(event) => setFamily(event.target.value)}
          placeholder="Family, for grouping — Painting, Sculpture"
          className="border-line bg-canvas border px-3 py-2 text-sm"
        />
      )}

      {wantsGuidance && (
        <textarea
          rows={2}
          value={guidance}
          onChange={(event) => setGuidance(event.target.value)}
          placeholder={
            list === 'readinessCriterion'
              ? 'What a reviewer should be looking for'
              : 'Guidance, so the right one gets picked'
          }
          className="border-line bg-canvas border px-3 py-2 text-sm"
        />
      )}

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !label.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await onAdd({
            list,
            label: label.trim(),
            guidance: guidance.trim() || undefined,
            family: family.trim() || undefined,
          });
          setBusy(false);
          if (result.ok) {
            setLabel('');
            setGuidance('');
            setFamily('');
          } else setError(result.error ?? 'That did not save.');
        }}
        className="border-accent text-accent caps hover:bg-accent/10 self-start border px-4 py-2 text-xs disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}
