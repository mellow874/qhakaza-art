import type { Metadata } from 'next';

import { apply } from '@/content/collectors';
import { submitCollectorApplication } from '@/features/collectors/actions';
import { CollectorApplyForm } from '@/features/collectors/apply-form';

export const metadata: Metadata = {
  title: 'Begin Your Application',
  description: apply.lede,
  // An application form has no business in search results.
  robots: { index: false, follow: false },
};

export default function CollectorApplyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-24 sm:py-28">
      <p className="eyebrow">{apply.eyebrow}</p>
      <h1 className="mt-6 text-4xl sm:text-5xl">{apply.title}</h1>
      <p className="text-body mt-6 max-w-2xl leading-relaxed">{apply.lede}</p>

      <div className="mt-20">
        <CollectorApplyForm onSubmit={submitCollectorApplication} />
      </div>
    </main>
  );
}
