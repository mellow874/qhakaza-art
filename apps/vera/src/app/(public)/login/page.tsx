import type { Metadata } from 'next';
import Link from 'next/link';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Only same-origin paths are accepted, so `?callbackUrl=https://evil.test`
  // cannot turn the login page into an open redirect.
  const safeCallbackUrl =
    callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined;

  return (
    <NarrowPage className="max-w-md">
      <PageHeader eyebrow="Welcome back" title="Sign in" className="mb-10" />

      <LoginForm callbackUrl={safeCallbackUrl} />

      <p className="text-muted mt-10 text-sm">
        New here?{' '}
        <Link href="/signup" className="text-accent underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </NarrowPage>
  );
}
