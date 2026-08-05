import { readAs, type AuditActor } from '@/lib/audit';

/**
 * Everything the Command Center reads.
 *
 * This app is the only place raw submissions and collector intakes are
 * visible — that is its job. Access is gated in the page AND by RLS, which
 * restricts these tables to admin and advisor at the database level.
 *
 * Every function takes the acting member of staff. That is not a convenience:
 * without a declared actor these queries run anonymous, and the collector
 * tables grant nothing to `public`, so they would quietly return empty rather
 * than fail loudly. Threading the actor makes forgetting it a type error.
 */

export async function getVettingQueue(actor: AuditActor) {
  return readAs(actor, async (tx) => {
    const [pendingArtists, unreleasedArtworks] = await Promise.all([
      tx.artist.findMany({
        where: { approved: false },
        select: {
          id: true,
          displayName: true,
          slug: true,
          statement: true,
          createdAt: true,
          _count: { select: { artworks: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
      }),
      tx.artwork.findMany({
        where: { status: { not: 'LISTED' } },
        select: {
          id: true,
          title: true,
          medium: true,
          status: true,
          artist: { select: { displayName: true, approved: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 25,
      }),
    ]);

    return { pendingArtists, unreleasedArtworks };
  });
}

export async function getIntakeQueue(actor: AuditActor) {
  return readAs(actor, (tx) =>
    tx.collectorIntake.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        country: true,
        city: true,
        status: true,
        createdAt: true,
        verification: { select: { outcome: true, decidedAt: true } },
        membership: {
          select: {
            id: true,
            status: true,
            invitations: {
              select: { id: true, status: true, expiresAt: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
  );
}

/** The communications hub: enquiries from members, and public contact messages. */
export async function getCommunications(actor: AuditActor) {
  return readAs(actor, async (tx) => {
    const [notes, messages] = await Promise.all([
      tx.privateNoteSubmission.findMany({
        select: {
          id: true,
          subject: true,
          body: true,
          status: true,
          createdAt: true,
          artwork: {
            select: { id: true, title: true, artist: { select: { displayName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      tx.contactMessage.findMany({
        where: { handled: false },
        select: { id: true, name: true, email: true, subject: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    return { notes, messages };
  });
}

/**
 * Analytics.
 *
 * Reads whatever has been recorded. Nothing writes AnalyticsEvent or
 * DailyMetric yet, so those panels are honestly empty rather than filled with
 * invented figures — a dashboard showing made-up numbers is worse than one
 * showing none.
 */
export async function getAnalytics(actor: AuditActor) {
  return readAs(actor, async (tx) => {
    const [events, metrics, attempts, counts] = await Promise.all([
      tx.analyticsEvent.findMany({
        select: { id: true, name: true, occurredAt: true },
        orderBy: { occurredAt: 'desc' },
        take: 10,
      }),
      tx.dailyMetric.findMany({
        select: { id: true, day: true, metric: true, value: true },
        orderBy: [{ day: 'desc' }, { metric: 'asc' }],
        take: 10,
      }),
      // Failed activations are a security signal, not a vanity metric.
      tx.activationAttempt.findMany({
        where: { outcome: { not: 'SUCCESS' } },
        select: { id: true, outcome: true, createdAt: true, ipAddress: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      Promise.all([
        tx.artist.count(),
        tx.artist.count({ where: { approved: true } }),
        tx.artwork.count({ where: { status: 'LISTED' } }),
        tx.collectorIntake.count(),
        tx.membership.count({ where: { status: 'ACTIVE' } }),
      ]),
    ]);

    const [artists, approvedArtists, releasedArtworks, intakes, activeMemberships] = counts;

    return {
      events,
      metrics,
      attempts,
      totals: { artists, approvedArtists, releasedArtworks, intakes, activeMemberships },
    };
  });
}

export async function getPeople(actor: AuditActor) {
  // `User` carries no RLS policy — the credentials provider must find an
  // account before a session exists. Read through the actor anyway, so the
  // pattern is uniform and the day a policy is added nothing has to change.
  return readAs(actor, (tx) =>
    tx.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  );
}

/** The audit trail. Append-only: RLS grants no UPDATE or DELETE to any role. */
export async function getAuditTrail(actor: AuditActor) {
  return readAs(actor, (tx) =>
    tx.auditLog.findMany({
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        actorId: true,
        actorRole: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
  );
}
