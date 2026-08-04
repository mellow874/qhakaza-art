export type IntelligenceRow = { label: string; value: string };

export type IntelligenceRecord = {
  /** e.g. "Artist Intelligence Record" — the kind of record this is. */
  kind: string;
  /** e.g. "Emerging" / "Available" — the record's current standing. */
  badge: string;
  title: string;
  subtitle: string;
  rows: IntelligenceRow[];
  tags?: string[];
  note?: { label: string; body: string };
};

/**
 * A structured intelligence record — the recurring unit of the collector suite,
 * used for both artists and artworks.
 *
 * The label/value rows are a description list rather than a table: they are
 * attribute pairs about one subject, not a grid of records, so `<dl>` is the
 * markup that actually describes them.
 */
export function IntelligenceCard({ record }: { record: IntelligenceRecord }) {
  return (
    <article className="bg-surface flex flex-col gap-7 p-8 sm:p-10">
      {/*
        A real <header>, not a div: the kind and standing describe the card as a
        whole. It also keeps the badge distinguishable from row values, which
        can legitimately repeat it — an artwork can be "Available" in both.
      */}
      <header className="flex flex-wrap items-center gap-3">
        <span className="border-line-strong text-muted caps border px-3 py-1.5">{record.kind}</span>
        <span className="bg-accent text-on-accent caps px-3 py-1.5">{record.badge}</span>
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="text-3xl">{record.title}</h3>
        <p className="text-body text-sm">{record.subtitle}</p>
      </div>

      <dl className="flex flex-col">
        {record.rows.map((row) => (
          <div
            key={row.label}
            className="border-line/70 flex flex-wrap items-baseline justify-between gap-4 border-b py-4"
          >
            <dt className="text-muted caps">{row.label}</dt>
            <dd className="text-body text-right text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>

      {record.tags && record.tags.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {record.tags.map((tag) => (
            <li key={tag} className="border-line-strong text-muted caps border px-3 py-2">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {record.note && (
        <div className="border-line/70 flex flex-col gap-3 border-t pt-7">
          <p className="eyebrow">{record.note.label}</p>
          <p className="text-body leading-relaxed">{record.note.body}</p>
        </div>
      )}
    </article>
  );
}
