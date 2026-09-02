'use client';

import { useState, type ReactNode } from 'react';

import type { SectionSummary } from './progress';

/**
 * One collapsible section of the artist's record.
 *
 * SECTIONS OPEN ONE AT A TIME AND SAVE ON THEIR OWN. The record is long, and a
 * single form holding all of it would mean an artist with fifteen minutes and
 * one exhibition to add either saved everything or nothing. Each section is its
 * own form and its own server action, so progress is never lost to an
 * unrelated validation error three sections away.
 *
 * The state chip says what is in the section, never how good it is. Nothing an
 * artist sees about their own record is an assessment of it.
 */
export function RecordSection({
  summary,
  open,
  onToggle,
  children,
}: {
  summary: SectionSummary;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const stateLabel =
    summary.state === 'complete'
      ? summary.count !== undefined
        ? `${summary.count} recorded`
        : 'Filled in'
      : summary.state === 'started'
        ? 'Partly filled in'
        : 'Nothing yet';

  return (
    <section className="border-line/70 border-b">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="hover:text-accent flex w-full items-center justify-between gap-4 py-5 text-left"
        >
          <span className="flex flex-col gap-1">
            <span className="text-heading text-lg">{summary.label}</span>
            {!open && summary.outstanding.length > 0 && (
              <span className="text-muted text-xs">{summary.outstanding[0]}</span>
            )}
          </span>

          <span className="flex items-center gap-3">
            <span
              className={
                summary.state === 'complete'
                  ? 'caps text-accent text-xs'
                  : 'caps text-muted text-xs'
              }
            >
              {stateLabel}
            </span>
            <span aria-hidden className="text-muted">
              {open ? '−' : '+'}
            </span>
          </span>
        </button>
      </h3>

      {open && <div className="pb-8">{children}</div>}
    </section>
  );
}

/**
 * The shell: the whole record, one section open at a time.
 *
 * Which section is open is deliberately NOT persisted. It is a scroll
 * position, not a preference, and restoring it on a later visit would land the
 * artist somewhere they did not ask to be.
 */
export function RecordSections({
  summaries,
  render,
}: {
  summaries: SectionSummary[];
  render: (key: string) => ReactNode;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="border-line/70 flex flex-col border-t">
      {summaries.map((summary) => (
        <RecordSection
          key={summary.key}
          summary={summary}
          open={openKey === summary.key}
          onToggle={() => setOpenKey(openKey === summary.key ? null : summary.key)}
        >
          {render(summary.key)}
        </RecordSection>
      ))}
    </div>
  );
}
