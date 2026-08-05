'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button, Field, cn } from '@qhakaza/shared-ui';

import { SIGNUP_ROLES, signUpSchema } from '@/lib/validation/user';

type Result = { ok: boolean; fieldErrors?: Record<string, string> };
type Role = (typeof SIGNUP_ROLES)[number];

/** What each role gets, in the words the site uses elsewhere. */
const ROLE_COPY: Record<Role, { label: string; blurb: string }> = {
  ARTIST: {
    label: 'Artist',
    blurb: 'Build a profile, submit work, and follow it through vetting.',
  },
  COLLECTOR: {
    label: 'Collector',
    blurb: 'For members joining the Collector Intelligence Suite by invitation.',
  },
};

export function SignUpForm({ onSubmit }: { onSubmit: (values: unknown) => Promise<Result> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('ARTIST');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const router = useRouter();
  const inFlight = useRef(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    // The same schema the server action runs, so the two cannot disagree.
    const parsed = signUpSchema.safeParse({ name, email, password, role });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    inFlight.current = true;
    setPending(true);

    try {
      const result = await onSubmit(parsed.data);

      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        else setFormError('We could not create your account. Please try again.');
        return;
      }

      // Sign in with the credentials just used, so the visitor is not made to
      // type them again immediately after proving they know them.
      const signedIn = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (signedIn?.error) {
        // The account exists; only the automatic sign-in failed.
        router.push('/login');
        return;
      }

      router.push(parsed.data.role === 'ARTIST' ? '/artist/onboarding' : '/');
      router.refresh();
    } catch {
      setFormError('We could not create your account. Please try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Field label="Name" error={errors.name} required>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="As it should appear"
          />
        )}
      </Field>

      <Field label="Email" error={errors.email} required>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        )}
      </Field>

      <Field label="Password" error={errors.password} hint="At least 8 characters." required>
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      {/* Radios, not a select: two options with an explanation each, and the
          choice changes where the visitor lands. ADMIN and ADVISOR are absent
          by design — staff accounts are provisioned in the Command Center. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="text-heading text-sm font-medium">I am joining as</legend>

        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {SIGNUP_ROLES.map((option) => {
            const selected = role === option;
            return (
              <label
                key={option}
                className={cn(
                  'focus-within:border-accent flex cursor-pointer flex-col gap-1 border p-4 transition-colors',
                  selected
                    ? 'border-accent bg-accent-soft/40'
                    : 'border-line hover:border-accent/60',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={selected}
                    onChange={() => setRole(option)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="text-heading text-sm font-medium">
                    {ROLE_COPY[option].label}
                  </span>
                </span>
                <span className="text-muted pl-6 text-xs leading-relaxed">
                  {ROLE_COPY[option].blurb}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  );
}
