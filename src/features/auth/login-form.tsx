'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { credentialsSchema } from '@/lib/validation/user';

type Props = {
  callbackUrl?: string;
};

export function LoginForm({ callbackUrl }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const router = useRouter();
  const inFlight = useRef(false);
  const redirectTo = callbackUrl || '/';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    setFormError(null);

    const parsed = credentialsSchema.safeParse({ email, password });

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
    setPending(true);

    try {
      // `redirect: false` keeps the failure on this page so the error can be
      // shown inline, rather than bouncing through /login?error=…
      const result = await signIn('credentials', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.error) {
        // Deliberately vague: saying "no such account" would let anyone probe
        // which email addresses are registered.
        setFormError('That email or password is incorrect.');
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setFormError('We could not sign you in. Please try again.');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
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

        <Field label="Password" error={errors.password} required>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="password"
              autoComplete="current-password"
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
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="flex items-center gap-4">
        <span className="bg-line h-px flex-1" />
        <span className="text-muted text-xs tracking-[0.2em] uppercase">or</span>
        <span className="bg-line h-px flex-1" />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={() => signIn('google', { redirectTo })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
