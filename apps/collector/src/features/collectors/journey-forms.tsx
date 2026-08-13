'use client';

import { useRef, useState } from 'react';

import { Button, Field, cn } from '@qhakaza/shared-ui';

import { considerationSchema } from '@/lib/validation/journeys';

/**
 * Membership Consideration — the shorter collector journey.
 *
 * Reuses the collector suite's field styling — caps labels, hairline
 * underlines, `*` on required — so it reads as the same site as the intake,
 * without being the intake.
 */

type Result = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const FIELD = { labelCase: 'caps', control: 'underline', marks: 'required' } as const;

function Received({ title, body }: { title: string; body: string }) {
  return (
    <div role="status" className="border-line/70 bg-surface flex flex-col gap-3 border p-10">
      <p className="font-display text-heading text-2xl">{title}</p>
      <p className="text-body text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------

export function ConsiderationForm({
  onSubmit,
}: {
  onSubmit: (values: unknown) => Promise<Result>;
}) {
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    country: '',
    city: '',
    collectingGoal: '',
    considerationNote: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);

  const set = (field: keyof typeof values, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);

    const parsed = considerationSchema.safeParse(values);
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
      if (result.ok) setSent(true);
      else if (result.fieldErrors) setErrors(result.fieldErrors);
      else setFormError('We could not send your request. Please try again.');
    } catch {
      setFormError('We could not send your request. Please try again.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Received
        title="Your request has been received"
        body="Qhakaza will read what you have written and come back to you directly."
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-10">
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <Field {...FIELD} label="Full name" error={errors.fullName} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="name"
              placeholder="As it should appear"
              value={values.fullName}
              onChange={(event) => set('fullName', event.target.value)}
            />
          )}
        </Field>

        <Field {...FIELD} label="Email address" error={errors.email} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="email"
              autoComplete="email"
              placeholder="For all correspondence"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>

        <Field {...FIELD} label="Country" error={errors.country}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="country-name"
              value={values.country}
              onChange={(event) => set('country', event.target.value)}
            />
          )}
        </Field>

        <Field {...FIELD} label="City" error={errors.city}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="address-level2"
              value={values.city}
              onChange={(event) => set('city', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field {...FIELD} label="What draws you to African art" error={errors.collectingGoal}>
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={cn(className, 'min-h-28 resize-y leading-relaxed')}
            value={values.collectingGoal}
            onChange={(event) => set('collectingGoal', event.target.value)}
          />
        )}
      </Field>

      <Field
        {...FIELD}
        label="What you would like us to consider"
        error={errors.considerationNote}
        required
      >
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={cn(className, 'min-h-32 resize-y leading-relaxed')}
            placeholder="Your circumstances, and what membership would mean for you"
            value={values.considerationNote}
            onChange={(event) => set('considerationNote', event.target.value)}
          />
        )}
      </Field>

      {formError && <Alert>{formError}</Alert>}

      <Button type="submit" size="lg" disabled={sending} className="caps self-start">
        {sending ? 'Sending…' : 'Send for consideration'}
      </Button>
    </form>
  );
}
