import type { Metadata } from 'next';

import { methodology } from '@/content/collectors';
import { Methodology } from '@/features/collectors/methodology-sections';

export const metadata: Metadata = {
  title: 'Methodology',
  description: methodology.lede,
  openGraph: {
    title: 'Methodology — Collector Intelligence Suite',
    description: methodology.essence.body,
    type: 'website',
  },
};

export default function MethodologyPage() {
  return (
    <main>
      <Methodology />
    </main>
  );
}
