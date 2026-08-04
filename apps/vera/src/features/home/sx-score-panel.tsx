import { sxScore } from '@/content/home';

/**
 * The Sx Score readout. The values are the illustrative ones from the design,
 * not a live calculation — see the note in the home page's section comment.
 *
 * Each bar is a `meter`, so the score is conveyed to assistive tech rather than
 * living purely in the bar's width.
 */
export function SxScorePanel() {
  return (
    <div className="border-line/70 bg-surface/40 flex flex-col gap-8 border p-8 sm:p-10">
      <ul className="flex flex-col">
        {sxScore.metrics.map((metric) => (
          <li key={metric.code} className="border-line/50 flex flex-col gap-3 border-b py-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-accent text-xs tracking-[0.2em] uppercase">{metric.code}</span>
              <span className="text-heading text-sm tabular-nums">{metric.value}</span>
            </div>
            <div
              role="meter"
              aria-valuenow={metric.value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${metric.code} — ${metric.label}`}
              className="bg-line/60 h-px w-full"
            >
              <span
                className="bg-accent block h-px"
                style={{ width: `${metric.value}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ul>

      <p className="flex items-baseline gap-3">
        <span className="font-display text-heading text-5xl leading-none">{sxScore.total}</span>
        <span className="text-muted text-sm">
          / {sxScore.totalOutOf} · {sxScore.band}
        </span>
      </p>
    </div>
  );
}
