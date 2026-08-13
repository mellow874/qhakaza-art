import type { Metadata } from 'next';
import Link from 'next/link';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { signUpCollector } from '@/features/auth/signup-actions';
import { SignUpForm } from '@/features/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create an account',
  // Reached from an invitation or from the sign-in page, never from a search.
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Same-origin paths only, so `?callbackUrl=https://evil.test` cannot turn
  // this into an open redirect — it matters more here than on a public site,
  // because the link arrives by email.
  const safeCallbackUrl =
    callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined;

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <NarrowPage className="max-w-md">
        <PageHeader
          eyebrow="Private access"
          title="Create your account"
          intro="An account lets you open the invitation your advisor has prepared. It does not grant access on its own."
          className="mb-10"
        />

        <SignUpForm onSubmit={signUpCollector} callbackUrl={safeCallbackUrl} />

        <p className="text-muted mt-10 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-ink underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </NarrowPage>
    </div>
  );
}
