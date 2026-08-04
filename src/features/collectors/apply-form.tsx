'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { apply } from '@/content/collectors';
import { cn } from '@/lib/cn';
import { collectorApplicationSchema } from '@/lib/validation/collector';

type Result = { ok: boolean; fieldErrors?: Record<string, string> };

type Values = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  annualIncomeBand: string;
  liquidAssetsBand: string;
  collectingGoal: string;
  artExposure: string;
  preferredMediums: string[];
};

const EMPTY: Values = {
  fullName: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  annualIncomeBand: '',
  liquidAssetsBand: '',
  collectingGoal: '',
  artExposure: '',
  preferredMediums: [],
};

/** The collector suite's fields: caps labels, hairline underlines, `*` on required. */
const FIELD = { labelCase: 'caps', control: 'underline', marks: 'required' } as const;

function SectionHeading({ children }: { children: string }) {
  return (
    <div className="flex flex-col gap-6">
      <span className="rule" aria-hidden="true" />
      <h2 className="text-2xl">{children}</h2>
    </div>
  );
}

export function CollectorApplyForm({
  onSubmit,
}: {
  onSubmit: (values: unknown) => Promise<Result>;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const inFlight = useRef(false);

  function set(field: keyof Values, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  function toggleMedium(medium: string) {
    setValues((previous) => ({
      ...previous,
      preferredMediums: previous.preferredMediums.includes(medium)
        ? previous.preferredMediums.filter((value) => value !== medium)
        : [...previous.preferredMediums, medium],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    // The same schema the server action runs, so client and server cannot
    // disagree about what a valid application is.
    const parsed = collectorApplicationSchema.safeParse(values);

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setSaving(true);

    try {
      const result = await onSubmit(parsed.data);

      if (result.ok) {
        setSaved(true);
        setValues(EMPTY);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError(apply.error);
      }
    } catch {
      setFormError(apply.error);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div role="status" className="border-line/70 bg-surface flex flex-col gap-3 border p-10">
        <p className="font-display text-heading text-2xl">{apply.received.title}</p>
        <p className="text-body text-sm leading-relaxed">{apply.received.body}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-16">
      <fieldset className="flex flex-col gap-10">
        <legend className="contents">
          <SectionHeading>{apply.personal.title}</SectionHeading>
        </legend>

        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          <Field {...FIELD} label={apply.personal.fullName.label} error={errors.fullName} required>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                autoComplete="name"
                placeholder={apply.personal.fullName.placeholder}
                value={values.fullName}
                onChange={(event) => set('fullName', event.target.value)}
              />
            )}
          </Field>

          <Field {...FIELD} label={apply.personal.email.label} error={errors.email} required>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="email"
                autoComplete="email"
                placeholder={apply.personal.email.placeholder}
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
              />
            )}
          </Field>

          <Field {...FIELD} label={apply.personal.phone.label} error={errors.phone}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="tel"
                autoComplete="tel"
                placeholder={apply.personal.phone.placeholder}
                value={values.phone}
                onChange={(event) => set('phone', event.target.value)}
              />
            )}
          </Field>

          <Field {...FIELD} label={apply.personal.country.label} error={errors.country}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                autoComplete="country-name"
                placeholder={apply.personal.country.placeholder}
                value={values.country}
                onChange={(event) => set('country', event.target.value)}
              />
            )}
          </Field>

          <Field {...FIELD} label={apply.personal.city.label} error={errors.city}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                autoComplete="address-level2"
                placeholder={apply.personal.city.placeholder}
                value={values.city}
                onChange={(event) => set('city', event.target.value)}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-10">
        <legend className="contents">
          <SectionHeading>{apply.financial.title}</SectionHeading>
        </legend>

        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          <Field {...FIELD} label={apply.financial.income.label} error={errors.annualIncomeBand}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                value={values.annualIncomeBand}
                onChange={(event) => set('annualIncomeBand', event.target.value)}
              >
                <option value="">{apply.financial.placeholder}</option>
                {apply.financial.incomeBands.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field {...FIELD} label={apply.financial.assets.label} error={errors.liquidAssetsBand}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                value={values.liquidAssetsBand}
                onChange={(event) => set('liquidAssetsBand', event.target.value)}
              >
                <option value="">{apply.financial.placeholder}</option>
                {apply.financial.assetBands.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-10">
        <legend className="contents">
          <SectionHeading>{apply.collecting.title}</SectionHeading>
        </legend>

        {/* The two long-form answers keep a boxed control: a hairline underline
            reads as a one-line field, and these invite a paragraph. */}
        <Field
          labelCase="caps"
          marks="required"
          label={apply.collecting.goal.label}
          error={errors.collectingGoal}
        >
          {({ className, ...fieldProps }) => (
            <textarea
              {...fieldProps}
              className={cn(className, 'min-h-32 resize-y leading-relaxed')}
              placeholder={apply.collecting.goal.placeholder}
              value={values.collectingGoal}
              onChange={(event) => set('collectingGoal', event.target.value)}
            />
          )}
        </Field>

        <Field
          labelCase="caps"
          marks="required"
          label={apply.collecting.exposure.label}
          error={errors.artExposure}
        >
          {({ className, ...fieldProps }) => (
            <textarea
              {...fieldProps}
              className={cn(className, 'min-h-32 resize-y leading-relaxed')}
              placeholder={apply.collecting.exposure.placeholder}
              value={values.artExposure}
              onChange={(event) => set('artExposure', event.target.value)}
            />
          )}
        </Field>

        {/* Checkboxes, not buttons: this is a multi-select answer, and a
            `role="button"` chip would neither announce its checked state nor
            respond to the keys people expect. */}
        <fieldset className="flex flex-col gap-5">
          <legend className="text-accent-ink caps">{apply.collecting.mediumsLabel}</legend>
          <div className="flex flex-wrap gap-3">
            {apply.collecting.mediums.map((medium) => {
              const checked = values.preferredMediums.includes(medium);
              return (
                <label
                  key={medium}
                  className={cn(
                    'caps focus-within:border-accent relative border px-5 py-3 transition-colors',
                    checked
                      ? 'bg-accent text-on-accent border-accent'
                      : 'border-line-strong text-body hover:border-accent',
                  )}
                >
                  {/* Transparent and stretched over the whole chip rather than
                      `sr-only`: a 1px control is a 1px hit target for anything
                      driving the page directly. */}
                  <input
                    type="checkbox"
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                    checked={checked}
                    onChange={() => toggleMedium(medium)}
                  />
                  {medium}
                </label>
              );
            })}
          </div>
        </fieldset>
      </fieldset>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={saving} className="caps w-full">
        {saving ? apply.submittingLabel : apply.submitLabel}
      </Button>
    </form>
  );
}
