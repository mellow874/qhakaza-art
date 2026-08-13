import type { Metadata } from 'next';

import { requestAccess } from '@/features/collectors/journey-actions';
import { RequestAccessForm } from '@/features/collectors/journey-forms';

export const metadata: Metadata = {
  title: 'Request access',
  description: 'A preview window into the Collector Intelligence Suite, after onboarding.',
  // A request form has no business in search results.
  robots: { index: false, follow: false },
};

export default function RequestAccessPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-24 sm:py-28">
      <p className="eyebrow">Preview access</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">Request Access</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">
        A limited window into the suite, opened once your intake is complete. Tell us what you would
        like to look at and your advisor will prepare it.
      </p>
      {/* Stated up front rather than discovered on submit. */}
      <p className="text-muted mt-4 max-w-2xl text-sm italic">
        Access follows onboarding. If you have not completed a collector intake yet, begin there.
      </p>

      <div className="mt-16">
        <RequestAccessForm onSubmit={requestAccess} />
      </div>
    </main>
  );
}
