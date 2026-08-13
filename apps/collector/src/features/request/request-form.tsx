'use client';

import { useRef, useState } from 'react';

import { Button, Field } from '@qhakaza/shared-ui';
import { request as copy } from '@/content/collectors';
import { privateRequestSchema } from '@/lib/validation/request';

type SubmitResponse = { ok: boolean; fieldErrors?: Record<string, string> };

type Values = { name: string; email: string; subject: string; message: string };

const EMPTY: Values = { name: '', email: '', subject: '', message: '' };

export function RequestForm({
  onSubmit,
}: {
  onSubmit: (values: unknown) => Promise<SubmitResponse>;
}) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const inFlight = useRef(false);

  function set(field: keyof Values, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    const parsed = privateRequestSchema.safeParse(values);

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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <Field label={copy.form.nameLabel} error={errors.name} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="name"
              placeholder={copy.form.namePlaceholder}
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
            />
          )}
        </Field>

        <Field label={copy.form.emailLabel} error={errors.email} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="email"
              autoComplete="email"
              placeholder={copy.form.emailPlaceholder}
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label={copy.form.typeLabel} error={errors.subject} required>
        {(fieldProps) => (
          <select
            {...fieldProps}
            value={values.subject}
            onChange={(event) => set('subject', event.target.value)}
          >
            <option value="">{copy.form.typePlaceholder}</option>
            {copy.form.types.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label={copy.form.requestLabel} error={errors.message} required>
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={`${className} min-h-32 resize-y leading-relaxed`}
            placeholder={copy.form.requestPlaceholder}
            value={values.message}
            onChange={(event) => set('message', event.target.value)}
          />
        )}
      </Field>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={sending} className="self-start">
        {sending ? copy.form.submittingLabel : copy.form.submitLabel}
      </Button>
    </form>
  );
}
