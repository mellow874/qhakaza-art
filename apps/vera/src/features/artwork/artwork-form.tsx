'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button, Field, cn } from '@qhakaza/shared-ui';

import { artPieceDraftSchema } from '@/lib/validation/art';

type Result = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const EMPTY = {
  title: '',
  description: '',
  medium: '',
  dimensions: '',
  price: '',
  images: '',
};

/**
 * Submitting a work.
 *
 * Only the title is required. A work in progress should be savable, and the
 * fuller record is what the Command Center asks for before releasing it — so
 * the form says which fields that release needs rather than demanding them now.
 */
export function ArtworkForm({ onSubmit }: { onSubmit: (values: unknown) => Promise<Result> }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const router = useRouter();
  const inFlight = useRef(false);

  const set = (field: keyof typeof EMPTY, value: string) =>
    setValues((previous) => ({ ...previous, [field]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    // One image URL per line, which is easier to paste than a comma list.
    const images = values.images
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    // Blank optional fields are omitted rather than sent as '' — the schema
    // treats an empty string as a value and would reject some of them.
    const payload = {
      title: values.title,
      ...(values.description.trim() && { description: values.description.trim() }),
      ...(values.medium.trim() && { medium: values.medium.trim() }),
      ...(values.dimensions.trim() && { dimensions: values.dimensions.trim() }),
      ...(values.price.trim() && { price: values.price.trim() }),
      ...(images.length > 0 && { images }),
    };

    const parsed = artPieceDraftSchema.safeParse(payload);

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
        setValues(EMPTY);
        router.push('/artist/dashboard');
        router.refresh();
        return;
      }

      if (result.error === 'NO_PROFILE') {
        setFormError('Complete your artist profile before submitting work.');
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError('We could not save this work. Please try again.');
      }
    } catch {
      setFormError('We could not save this work. Please try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <Field label="Title" error={errors.title} required>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="What the work is called"
          />
        )}
      </Field>

      <Field
        label="Description"
        error={errors.description}
        hint="Needed before the work can be released."
      >
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={cn(className, 'min-h-32 resize-y leading-relaxed')}
            value={values.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="The work, its making, and anything a collector should understand about it"
          />
        )}
      </Field>

      <div className="grid gap-8 sm:grid-cols-2">
        <Field label="Medium" error={errors.medium}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              value={values.medium}
              onChange={(event) => set('medium', event.target.value)}
              placeholder="Oil on canvas"
            />
          )}
        </Field>

        <Field label="Dimensions" error={errors.dimensions}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              value={values.dimensions}
              onChange={(event) => set('dimensions', event.target.value)}
              placeholder="900 x 1200 mm"
            />
          )}
        </Field>
      </div>

      <Field
        label="Price (ZAR)"
        error={errors.price}
        hint="Numbers only. You can change this later."
      >
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            inputMode="decimal"
            value={values.price}
            onChange={(event) => set('price', event.target.value)}
            placeholder="18500"
          />
        )}
      </Field>

      <Field
        label="Image links"
        error={errors.images}
        // No uploader exists yet. Said plainly rather than presenting a field
        // that looks like it should accept a file.
        hint="One URL per line. File uploads are not available yet, so link to images hosted elsewhere."
      >
        {({ className, ...fieldProps }) => (
          <textarea
            {...fieldProps}
            className={cn(className, 'min-h-24 resize-y font-mono text-xs leading-relaxed')}
            value={values.images}
            onChange={(event) => set('images', event.target.value)}
            placeholder={'https://…/front.jpg\nhttps://…/detail.jpg'}
          />
        )}
      </Field>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <p className="text-muted text-sm leading-relaxed">
        Work is saved as a draft. Qhakaza reviews it and releases it to collectors once your profile
        is approved and the record is complete.
      </p>

      <Button type="submit" size="lg" disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save work'}
      </Button>
    </form>
  );
}
