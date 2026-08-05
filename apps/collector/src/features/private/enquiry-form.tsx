'use client';

import { useRef, useState } from 'react';

import { Button, Field } from '@qhakaza/shared-ui';

type Result = { ok: boolean; fieldErrors?: Record<string, string> };

/**
 * A member's enquiry to their advisor.
 *
 * The token is carried in a hidden field and re-validated server-side. It is
 * already in the URL, so this leaks nothing new; the server does not trust
 * either copy without checking.
 */
export function EnquiryForm({
  token,
  artworkId,
  onSubmit,
}: {
  token: string;
  artworkId?: string;
  onSubmit: (values: unknown) => Promise<Result>;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const inFlight = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);
    const next: Record<string, string> = {};
    if (subject.trim() === '') next.subject = 'A subject is required';
    if (body.trim().length < 10) next.body = 'Please give your advisor a little more detail';

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setSending(true);

    try {
      const result = await onSubmit({ token, artworkId, subject, body });

      if (result.ok) {
        setSent(true);
        setSubject('');
        setBody('');
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError('We could not send your enquiry. Please try again.');
      }
    } catch {
      setFormError('We could not send your enquiry. Please try again.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="border-line/70 bg-surface flex flex-col gap-3 border p-10">
        <p className="font-display text-heading text-2xl">Your enquiry has been sent</p>
        <p className="text-body text-sm leading-relaxed">
          Your advisor has it and will come back to you directly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-8">
      <Field label="Subject" error={errors.subject} required labelCase="caps" marks="required">
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        )}
      </Field>

      <Field label="Your enquiry" error={errors.body} required labelCase="caps" marks="required">
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={`${className} min-h-40 resize-y leading-relaxed`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={sending} className="caps self-start">
        {sending ? 'Sending…' : 'Send enquiry'}
      </Button>
    </form>
  );
}
