import type { Metadata } from 'next';

import { requestMembershipConsideration } from '@/features/collectors/journey-actions';
import { ConsiderationForm } from '@/features/collectors/journey-forms';

export const metadata: Metadata = {
  title: 'Request membership consideration',
  description: 'For collectors who cannot currently meet the membership fee.',
  robots: { index: false, follow: false },
};

export default function MembershipConsiderationPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-24 sm:py-28">
      <p className="eyebrow">Membership consideration</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Ask to be considered</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        The Founding Circle carries an annual fee, and it is not the right moment for everyone. If
        you would like to be part of Qhakaza but cannot meet it now, write to us instead.
      </p>
      {/*
        No income or liquid-asset bands on this page, deliberately. Asking those
        of someone who has just said they cannot meet the fee would be a poor
        thing to do — and the form's whole purpose is that the fee is the
        obstacle.
      */}
      <p className="text-muted mt-4 max-w-2xl text-sm italic">
        This is not the collector intake, and it asks nothing about your finances.
      </p>

      <div className="mt-16">
        <ConsiderationForm onSubmit={requestMembershipConsideration} />
      </div>
    </main>
  );
}
