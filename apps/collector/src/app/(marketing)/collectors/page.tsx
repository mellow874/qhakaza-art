import type { Metadata } from 'next';

import { hero } from '@/content/collectors';
import {
  Belief,
  Benefits,
  CollectorClosing,
  CollectorHero,
  CollectorNews,
  FeaturedExperience,
  IntelligencePreview,
} from '@/features/collectors/collector-sections';

export const metadata: Metadata = {
  title: 'Collector Intelligence Suite',
  description: hero.body,
  openGraph: {
    title: 'The Private Route Into African Contemporary Art',
    description: hero.note,
    type: 'website',
  },
};

export default function CollectorsPage() {
  return (
    <main className="flex flex-col">
      <CollectorHero />
      <Benefits />
      <Belief />
      <IntelligencePreview />
      <FeaturedExperience />
      <CollectorNews />
      <CollectorClosing />
    </main>
  );
}
