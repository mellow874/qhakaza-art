import type { Metadata } from 'next';

import { about } from '@/content/collectors';
import { CollectorAbout } from '@/features/collectors/about-sections';

export const metadata: Metadata = {
  title: 'About Qhakaza',
  description: about.lede,
  openGraph: {
    title: 'A Private Gateway into African Art',
    description: about.lede,
    type: 'website',
  },
};

export default function CollectorAboutPage() {
  return (
    <main className="flex flex-col">
      <CollectorAbout />
    </main>
  );
}
