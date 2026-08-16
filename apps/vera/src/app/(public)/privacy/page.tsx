import type { Metadata } from 'next';

import { LegalDocument } from '@/features/content/legal-document';
import { getLegalDocument, getLegalDocumentHistory } from '@/features/content/queries';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  // A legal document is not search-engine material, and a placeholder version
  // certainly is not.
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [document, history] = await Promise.all([
    getLegalDocument('PRIVACY'),
    getLegalDocumentHistory('PRIVACY'),
  ]);

  return (
    <LegalDocument
      fallbackTitle="Privacy Policy"
      kind="privacy policy"
      document={document}
      history={history}
    />
  );
}
