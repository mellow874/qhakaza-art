import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';

import { AdminCommandCenter } from '@/components/AdminCommandCenter';
import {
  getAnalytics,
  getAuditTrail,
  getCommunications,
  getIntakeQueue,
  getPeople,
  getVettingQueue,
} from '@/features/command-center/queries';

export const metadata: Metadata = {
  title: 'Command Center',
  // An operations console has no business in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export default async function CommandCenterPage() {
  const grant = requireRole(await auth(), COMMAND_CENTER_ROLES);

  if (!grant.ok && grant.reason === 'UNAUTHENTICATED') {
    redirect('/login?callbackUrl=%2F');
  }

  // A signed-in artist or collector who reaches this URL gets nothing — not a
  // partial page, not an empty shell. The queries below never run for them.
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

  // The acting member of staff, in the shape the queries and RLS both expect.
  const actor = { userId: grant.userId, role: grant.role as 'ADMIN' | 'ADVISOR' };

  const [vetting, intakes, comms, analytics, people, audit] = await Promise.all([
    getVettingQueue(actor),
    getIntakeQueue(actor),
    getCommunications(actor),
    getAnalytics(actor),
    getPeople(actor),
    getAuditTrail(actor),
  ]);

  return (
    <div className="theme-light bg-canvas text-body min-h-svh">
      <AdminCommandCenter
        actorRole={grant.role as 'ADMIN' | 'ADVISOR'}
        actorId={grant.userId}
        vetting={vetting}
        intakes={intakes}
        comms={comms}
        analytics={analytics}
        people={people}
        audit={audit}
      />
    </div>
  );
}
