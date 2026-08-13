import type { Metadata } from 'next';

import { LegalPlaceholder } from '@/features/legal/legal-placeholder';

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return <LegalPlaceholder title="Terms of Service" kind="terms of service" />;
}
