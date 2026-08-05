import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { activate } from '@/features/private/activation';
import { AccessDenied } from '@/features/private/access-denied';
import { PrivateChrome } from '@/features/private/private-chrome';

/**
 * Every private route passes through here.
 *
 * The gate is in the layout rather than in each page so that adding a page
 * cannot accidentally add an unguarded route. Children only render once
 * `activate` has granted access, so no page below this needs its own check —
 * and none can forget one.
 */
export const metadata: Metadata = {
  // Belt and braces with robots.ts: this area must never be indexed, and the
  // two mechanisms fail independently.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivateLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await activate(token);

  if (result.status === 'sign-in-required') {
    redirect(`/login?callbackUrl=${encodeURIComponent(result.callbackUrl)}`);
  }

  // One response for every failure — expired, revoked, forged or wrong role all
  // look identical from outside. Distinguishing them would turn this page into
  // an oracle for whether a guessed token exists. The reason is in the
  // ActivationAttempt row instead.
  if (result.status === 'denied') {
    return <AccessDenied />;
  }

  return <PrivateChrome token={token}>{children}</PrivateChrome>;
}
