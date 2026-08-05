import type { Metadata } from 'next';

import { membership } from '@/content/collectors';
import { CollectorMembership } from '@/features/collectors/membership-sections';

export const metadata: Metadata = {
  title: 'Membership',
  description: membership.lede,
  openGraph: {
    title: membership.titleLines.join(' '),
    description: membership.lede,
    type: 'website',
  },
};

export default function CollectorMembershipPage() {
  return (
    <main className="flex flex-col">
      <CollectorMembership />
    </main>
  );
}
