'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { newAccountSchema } from '@qhakaza/shared-auth';
import { Button, Field } from '@qhakaza/shared-ui';

type Result = { ok: boolean; fieldErrors?: Record<string, string> };

/**
 * Creating an artist account.
 *
 * There is no "what are you joining as" step: this is the artist site, so
 * everyone who signs up here is an artist. The role is set server-side and is
 * not part of what the form sends.
 */
export function SignUpForm({ onSubmit }: { onSubmit: (values: unknown) => Promise<Result> }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    const parsed = newAccountSchema.safeParse({ name, email, password });

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

      // Sign in with the credentials just used, so nobody is made to type them
      // again immediately after proving they know them.
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

      // Straight into building the profile — the next thing they came to do.
      router.push('/artist/onboarding');
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
            placeholder="As it should appear on your profile"
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

      {formError && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger border p-4 text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Creating your account…' : 'Create artist account'}
      </Button>
    </form>
  );
}
