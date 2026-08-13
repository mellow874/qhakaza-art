'use client';

import { useRef, useState } from 'react';

import { Button, Field, cn } from '@qhakaza/shared-ui';

import { privateNote as copy } from '@/content/private-note';
import { privateNoteSchema } from '@/lib/validation/private-note';

type Result = { ok: boolean; fieldErrors?: Record<string, string> };

/** The collector suite's field styling, as used by the intake. */
const FIELD = { labelCase: 'caps', control: 'underline', marks: 'required' } as const;

const EMPTY = {
  fullName: '',
  email: '',
  subjects: '',
  acquisitionPace: '',
  budgetBand: '',
  advisoryStyle: '',
  contactStyle: '',
  building: '',
  frustrations: '',
  goodOutcome: '',
};

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-8">
      <legend className="contents">
        <span className="flex flex-col gap-3">
          <span className="rule" aria-hidden="true" />
          <span className="font-display text-heading text-2xl">{title}</span>
          <span className="text-muted text-sm italic">{note}</span>
        </span>
      </legend>
      {children}
    </fieldset>
  );
}

/** A multi-select chip group. Checkboxes, so the state is announced. */
function Chips({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="text-accent-ink caps">{legend}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className={cn(
                'caps focus-within:border-accent relative border px-5 py-3 transition-colors',
                checked
                  ? 'bg-accent text-on-accent border-accent'
                  : 'border-line-strong text-body hover:border-accent',
              )}
            >
              {/* Stretched and transparent rather than `sr-only`: a 1px control
                  is a 1px hit target. */}
              <input
                type="checkbox"
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                checked={checked}
                onChange={() => onToggle(option)}
              />
              {option}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <Field {...FIELD} label={label} error={error}>
      {(fieldProps) => (
        <select {...fieldProps} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">No preference</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function PrivateNoteForm({ onSubmit }: { onSubmit: (values: unknown) => Promise<Result> }) {
  const [values, setValues] = useState(EMPTY);
  const [mediums, setMediums] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [mayContact, setMayContact] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const inFlight = useRef(false);

  const set = (field: keyof typeof EMPTY, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));

  const toggle = (list: string[], setList: (next: string[]) => void, value: string) =>
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    // The same schema the server action runs, so the two cannot disagree.
    const parsed = privateNoteSchema.safeParse({ ...values, mediums, regions, mayContact });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setSending(true);

    try {
      const result = await onSubmit(parsed.data);

      if (result.ok) {
        setSent(true);
        setValues(EMPTY);
        setMediums([]);
        setRegions([]);
        setMayContact(false);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError(copy.error);
      }
    } catch {
      setFormError(copy.error);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="border-line/70 bg-surface flex flex-col gap-3 border p-10">
        <p className="font-display text-heading text-2xl">{copy.received.title}</p>
        <p className="text-body text-sm leading-relaxed">{copy.received.body}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <Field {...FIELD} label={copy.fields.fullName.label} error={errors.fullName} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="name"
              placeholder={copy.fields.fullName.placeholder}
              value={values.fullName}
              onChange={(event) => set('fullName', event.target.value)}
            />
          )}
        </Field>

        <Field {...FIELD} label={copy.fields.email.label} error={errors.email} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="email"
              autoComplete="email"
              placeholder={copy.fields.email.placeholder}
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Section title={copy.sections.interests.title} note={copy.sections.interests.note}>
        <Chips
          legend={copy.fields.mediums.label}
          options={copy.mediums}
          selected={mediums}
          onToggle={(value) => toggle(mediums, setMediums, value)}
        />
        <Chips
          legend={copy.fields.regions.label}
          options={copy.regions}
          selected={regions}
          onToggle={(value) => toggle(regions, setRegions, value)}
        />
        <Field {...FIELD} label={copy.fields.subjects.label} error={errors.subjects}>
          {({ className, ...fieldProps }) => (
            <textarea
              {...fieldProps}
              className={cn(className, 'min-h-28 resize-y leading-relaxed')}
              placeholder={copy.fields.subjects.placeholder}
              value={values.subjects}
              onChange={(event) => set('subjects', event.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title={copy.sections.preferences.title} note={copy.sections.preferences.note}>
        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          <Choice
            label={copy.fields.acquisitionPace.label}
            options={copy.acquisitionPaces}
            value={values.acquisitionPace}
            onChange={(value) => set('acquisitionPace', value)}
            error={errors.acquisitionPace}
          />
          <Choice
            label={copy.fields.budgetBand.label}
            options={copy.budgetBands}
            value={values.budgetBand}
            onChange={(value) => set('budgetBand', value)}
            error={errors.budgetBand}
          />
          <Choice
            label={copy.fields.advisoryStyle.label}
            options={copy.advisoryStyles}
            value={values.advisoryStyle}
            onChange={(value) => set('advisoryStyle', value)}
            error={errors.advisoryStyle}
          />
          <Choice
            label={copy.fields.contactStyle.label}
            options={copy.contactStyles}
            value={values.contactStyle}
            onChange={(value) => set('contactStyle', value)}
            error={errors.contactStyle}
          />
        </div>
      </Section>

      <Section title={copy.sections.serve.title} note={copy.sections.serve.note}>
        {(
          [
            ['building', copy.fields.building],
            ['frustrations', copy.fields.frustrations],
            ['goodOutcome', copy.fields.goodOutcome],
          ] as const
        ).map(([field, text]) => (
          <Field key={field} {...FIELD} label={text.label} error={errors[field]}>
            {({ className, ...fieldProps }) => (
              <textarea
                {...fieldProps}
                className={cn(className, 'min-h-28 resize-y leading-relaxed')}
                placeholder={text.placeholder}
                value={values[field]}
                onChange={(event) => set(field, event.target.value)}
              />
            )}
          </Field>
        ))}

        {/* Consent is opt-in and unticked. A pre-ticked box is not consent. */}
        <label className="text-body flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={mayContact}
            onChange={(event) => setMayContact(event.target.checked)}
            className="mt-1 accent-[var(--color-accent)]"
          />
          {copy.fields.mayContact.label}
        </label>
      </Section>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={sending} className="caps self-start">
        {sending ? copy.submittingLabel : copy.submitLabel}
      </Button>
    </form>
  );
}
