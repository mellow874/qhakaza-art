'use client';

import { useRef, useState } from 'react';

import { Button, Field } from '@qhakaza/shared-ui';
import { artistProfileSchema } from '@/lib/validation/user';

export type ArtistProfileValues = {
  displayName: string;
  statement?: string;
  socials?: Record<string, string>;
};

type SaveResponse = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

type Props = {
  profile?: {
    displayName: string;
    statement?: string | null;
    socials?: Record<string, string> | null;
  };
  onSave: (values: ArtistProfileValues) => Promise<SaveResponse>;
};

const SOCIAL_FIELDS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourname' },
  { key: 'website', label: 'Website', placeholder: 'https://yourstudio.com' },
] as const;

export function ArtistProfileForm({ profile, onSave }: Props) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [statement, setStatement] = useState(profile?.statement ?? '');
  const [socials, setSocials] = useState<Record<string, string>>(() =>
    Object.fromEntries(SOCIAL_FIELDS.map(({ key }) => [key, profile?.socials?.[key] ?? ''])),
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // A double-click fires both clicks before React re-renders, so the `saving`
  // state is still false in the second handler's closure. A ref updates
  // synchronously and is what actually prevents a duplicate submission.
  const inFlight = useRef(false);

  const isEditing = profile !== undefined;

  function collectValues(): ArtistProfileValues {
    const filledSocials = Object.fromEntries(
      Object.entries(socials)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ''),
    );

    return {
      displayName: displayName.trim(),
      // Blank optional fields are omitted entirely rather than sent as ''.
      ...(statement.trim() ? { statement: statement.trim() } : {}),
      ...(Object.keys(filledSocials).length > 0 ? { socials: filledSocials } : {}),
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    const values = collectValues();

    // Validated client-side with the same schema the server action uses, so the
    // two can never disagree about what is acceptable.
    const parsed = artistProfileSchema.safeParse(values);

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrors[issue.path.join('.')] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setSaving(true);

    try {
      const result = await onSave(values);

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        else setFormError('We could not save your profile. Please try again.');
      }
    } catch {
      setFormError('We could not save your profile. Please try again.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-6 border-0 p-0">
        <legend className="sr-only">Your storefront</legend>

        <Field
          label="Display name"
          error={errors.displayName}
          required
          hint="The name collectors will see on your storefront."
        >
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. Thandi Mokoena"
            />
          )}
        </Field>

        <Field
          label="Artist statement"
          error={errors.statement}
          hint="A short introduction to your practice. You can change this later."
        >
          {({ className, ...fieldProps }) => (
            <textarea
              {...fieldProps}
              className={`${className} min-h-40 resize-y leading-relaxed`}
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="What do you make, and what is it about?"
            />
          )}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-6 border-0 p-0">
        <legend className="text-muted mb-2 text-xs tracking-[0.2em] uppercase">
          Where to find you
        </legend>

        {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
          <Field key={key} label={label} error={errors[`socials.${key}`]}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="url"
                value={socials[key] ?? ''}
                onChange={(event) => setSocials((prev) => ({ ...prev, [key]: event.target.value }))}
                placeholder={placeholder}
              />
            )}
          </Field>
        ))}
      </fieldset>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Continue'}
        </Button>
        {!isEditing && (
          <p className="text-muted text-xs">
            Your storefront stays private until an admin approves it.
          </p>
        )}
      </div>
    </form>
  );
}
