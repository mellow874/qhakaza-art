import type { Metadata } from 'next';

import { LegalPlaceholder } from '@/features/legal/legal-placeholder';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return <LegalPlaceholder title="Privacy Policy" kind="privacy policy" />;
}
