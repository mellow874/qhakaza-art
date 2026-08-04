import type { Metadata } from 'next';

import {
  ArtistNeeds,
  Begin,
  Briefings,
  EvidenceFramework,
  FrameworkQuote,
  Hero,
  PlatformPreview,
} from '@/features/home/home-sections';
import { PlatformPreviewPanel } from '@/features/home/platform-preview-panel';
import { SxScorePanel } from '@/features/home/sx-score-panel';

export const metadata: Metadata = {
  title: 'Qhakaza Art Collective — artist intelligence platform',
  description:
    'Your practice, structured for serious attention. Build the record behind your work so it can be understood, trusted, and introduced with confidence.',
  openGraph: {
    title: 'Qhakaza Art Collective',
    description: 'Make your practice easier to trust, present, and collect.',
    type: 'website',
  },
};

/**
 * Static marketing page. The Sx Score and platform-preview panels show the
 * illustrative figures from the design — neither reads from the database yet.
 */
export default function HomePage() {
  return (
    <main className="flex flex-col">
      <Hero />

      <div className="flex flex-col gap-(--spacing-section-sm) py-(--spacing-section-sm) sm:gap-(--spacing-section) sm:py-(--spacing-section)">
        <ArtistNeeds />
      </div>

      <FrameworkQuote />

      <div className="flex flex-col gap-(--spacing-section-sm) py-(--spacing-section-sm) sm:gap-(--spacing-section) sm:py-(--spacing-section)">
        <EvidenceFramework panel={<SxScorePanel />} />
        <PlatformPreview panel={<PlatformPreviewPanel />} />
        <Briefings />
      </div>

      <Begin />
    </main>
  );
}
