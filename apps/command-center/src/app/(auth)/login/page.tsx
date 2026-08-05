import type { Metadata } from 'next';

import { NarrowPage, PageHeader } from '@/components/page-shell';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  // An operations console has nothing for a search engine, and an indexed
  // sign-in page invites credential stuffing.
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
        <PageHeader eyebrow="Command Center" title="Staff sign in" className="mb-10" />
        <LoginForm callbackUrl={safeCallbackUrl} />
        {/* No "create an account" link, deliberately. Admin and advisor accounts
            are granted from inside this console by an existing administrator —
            a console that lets anyone enrol themselves as staff is not a
            console. */}
        <p className="text-muted mt-10 text-sm">
          Admin and advisor accounts are granted from inside the Command Center. If you need access,
          ask an administrator to change your role.
        </p>
      </NarrowPage>
    </div>
  );
}
