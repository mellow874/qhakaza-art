import type { Metadata } from 'next';
import Link from 'next/link';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  // Members reach this only from an invitation link. There is nothing here for
  // a search engine, and an indexed sign-in page invites credential stuffing.
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  // Only same-origin paths are accepted, so `?callbackUrl=https://evil.test`
  // cannot turn the sign-in page into an open redirect. This matters more here
  // than on the public site: the link arrives by email, where a doctored
  // callbackUrl is exactly the payload a phisher would want carried.
  const safeCallbackUrl =
    callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : undefined;

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <NarrowPage className="max-w-md">
        <PageHeader eyebrow="Private access" title="Sign in" className="mb-10" />
        {/* Server-side: only offer Google when it is actually configured. */}
        <LoginForm
          callbackUrl={safeCallbackUrl}
          googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID)}
        />
        <p className="text-muted mt-10 text-sm">
          New here?{' '}
          <Link
            href={`/signup${safeCallbackUrl ? `?callbackUrl=${encodeURIComponent(safeCallbackUrl)}` : ''}`}
            className="text-accent-ink underline underline-offset-4"
          >
            Create an account
          </Link>{' '}
          — then open the invitation your advisor prepared. Access to the member area remains by
          invitation.
        </p>
      </NarrowPage>
    </div>
  );
}
