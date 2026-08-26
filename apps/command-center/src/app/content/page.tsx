import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import {
  addFaqCategory,
  getContentForAdmin,
  publishLegalVersion,
  saveBriefing,
  saveFaqItem,
  saveNewsArticle,
  setFaqPublished,
} from '@/features/content/actions';
import { ContentManager } from '@/features/content/content-manager';

export const metadata: Metadata = {
  title: 'Content',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ContentPage() {
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect('/login?callbackUrl=%2Fcontent');
  }

  if (!grant.ok) {
    return (
      <main className="theme-light bg-canvas text-body flex min-h-svh flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-heading text-3xl">Not available</h1>
        <p className="text-body mt-4 max-w-md leading-relaxed">
          This area is limited to Qhakaza staff.
        </p>
      </main>
    );
  }

  const content = await getContentForAdmin();
  if (!content) redirect('/');

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <nav className="border-line/70 border-b px-6 py-4">
        <Link href="/" className="text-muted hover:text-accent caps text-xs">
          ← Command Center
        </Link>
      </nav>

      <ContentManager
        content={content}
        // Advisors write the FAQ and briefings, which is editorial work.
        // News and the legal documents are the organisation speaking as
        // itself, so those stay with an administrator.
        canEditNews={grant.role === 'ADMIN'}
        canEditLegal={grant.role === 'ADMIN'}
        onSaveFaq={saveFaqItem}
        onPublishFaq={setFaqPublished}
        onAddCategory={addFaqCategory}
        onSaveBriefing={saveBriefing}
        onSaveNews={saveNewsArticle}
        onPublishLegal={publishLegalVersion}
      />
    </div>
  );
}
