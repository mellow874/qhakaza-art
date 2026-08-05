import type { Metadata } from 'next';

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
        <LoginForm callbackUrl={safeCallbackUrl} />
        <p className="text-muted mt-10 text-sm">
          Access to the member area is by invitation. If you do not have an account, speak to your
          advisor.
        </p>
      </NarrowPage>
    </div>
  );
}
