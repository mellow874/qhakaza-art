import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import { addTerm, getAllLists, setTermActive } from '@/features/vocabulary/actions';
import { ListManager } from '@/features/vocabulary/list-manager';

export const metadata: Metadata = {
  title: 'Lists',
  robots: { index: false, follow: false, nocache: true },
};

export default async function ListsPage() {
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect('/login?callbackUrl=%2Flists');
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

  const lists = await getAllLists();
  if (!lists) redirect('/');

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <nav className="border-line/70 border-b px-6 py-4">
        <Link href="/" className="text-muted hover:text-accent caps text-xs">
          ← Command Center
        </Link>
      </nav>

      <ListManager
        lists={lists}
        // Everyone on staff can read the vocabulary; only admins change it.
        // These lists are the shape of the record.
        canEdit={grant.role === 'ADMIN'}
        onAdd={addTerm}
        onSetActive={setTermActive}
      />
    </div>
  );
}
