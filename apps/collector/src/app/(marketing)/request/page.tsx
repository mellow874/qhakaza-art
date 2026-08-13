import type { Metadata } from 'next';

import { request } from '@/content/collectors';
import { RequestPanel } from '@/features/request/request-panel';

export const metadata: Metadata = {
  title: 'Make a Private Request',
  description: request.lede,
  robots: { index: false, follow: false },
};

export default function RequestPage() {
  return (
    <main className="flex flex-col">
      <section className="border-line/60 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-28 sm:py-36">
          <p className="eyebrow">{request.eyebrow}</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">{request.title}</h1>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-6 py-24 lg:py-28">
        <p className="text-body max-w-2xl leading-relaxed">{request.lede}</p>

        <div className="max-w-2xl">
          <RequestPanel />
        </div>
      </div>
    </main>
  );
}
