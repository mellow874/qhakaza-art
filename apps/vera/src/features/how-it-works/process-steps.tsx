export type ProcessStep = {
  number: string;
  title: string;
  body: string;
};

/**
 * The numbered process from the design: a faint serif numeral, the step, and a
 * short rule closing each one off.
 *
 * The printed numerals are `aria-hidden` — an ordered list already conveys
 * sequence, so exposing them too would have a screen reader announce the
 * position twice.
 */
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step) => (
        <li key={step.number} className="flex gap-8 pb-14 sm:gap-14">
          <span
            aria-hidden="true"
            className="font-display text-muted/40 w-10 shrink-0 pt-1 text-xl tabular-nums sm:text-2xl"
          >
            {step.number}
          </span>

          <div className="flex flex-col gap-4">
            <h2 className="text-2xl sm:text-3xl">{step.title}</h2>
            <p className="text-body max-w-xl leading-relaxed">{step.body}</p>
            <span className="bg-line mt-6 h-px w-28" aria-hidden="true" />
          </div>
        </li>
      ))}
    </ol>
  );
}
