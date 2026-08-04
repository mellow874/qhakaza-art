'use client';

import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { form as copy } from '@/content/contact';
import { contactMessageSchema } from '@/lib/validation/user';

type SubmitResponse = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

type Values = { name: string; email: string; subject: string; message: string };

const EMPTY: Values = { name: '', email: '', subject: '', message: '' };

export function ContactForm({
  onSubmit,
}: {
  onSubmit: (values: Values) => Promise<SubmitResponse>;
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

    // Same schema the server action uses, so the two cannot disagree.
    const parsed = contactMessageSchema.safeParse(values);

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
        setFormError('We could not send your message. Please try again.');
      }
    } catch {
      setFormError('We could not send your message. Please try again.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="border-line/70 bg-surface/40 flex flex-col gap-3 border p-10">
        <p className="font-display text-heading text-2xl">{copy.successTitle}</p>
        <p className="text-body text-sm leading-relaxed">{copy.successBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <Field label={copy.nameLabel} error={errors.name} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              autoComplete="name"
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
            />
          )}
        </Field>

        <Field label={copy.emailLabel} error={errors.email} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => set('email', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label={copy.subjectLabel} error={errors.subject} required>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            value={values.subject}
            onChange={(event) => set('subject', event.target.value)}
          />
        )}
      </Field>

      <Field label={copy.messageLabel} error={errors.message} required>
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={`${className} min-h-44 resize-y leading-relaxed`}
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
        {sending ? 'Sending…' : copy.submitLabel}
      </Button>
    </form>
  );
}
