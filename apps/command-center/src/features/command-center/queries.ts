import { prisma } from '@qhakaza/shared-db';

/**
 * Everything the Command Center reads.
 *
 * This app is the only place raw submissions and collector intakes are
 * visible — that is its job. Access is gated in the page, and Phase 5's RLS
 * matrix restricts these tables to ADMIN and ADVISOR at the database level.
 */

export async function getVettingQueue() {
  const [pendingArtists, unreleasedArtworks] = await Promise.all([
    prisma.artist.findMany({
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
    prisma.artwork.findMany({
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
}

export async function getIntakeQueue() {
  return prisma.collectorIntake.findMany({
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
  });
}

/** The communications hub: enquiries from members, and public contact messages. */
export async function getCommunications() {
  const [notes, messages] = await Promise.all([
    prisma.privateNoteSubmission.findMany({
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
    prisma.contactMessage.findMany({
      where: { handled: false },
      select: { id: true, name: true, email: true, subject: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  return { notes, messages };
}

/**
 * Analytics.
 *
 * Reads whatever has been recorded. Nothing writes AnalyticsEvent or
 * DailyMetric yet, so these panels are honestly empty rather than filled with
 * invented figures — a dashboard showing made-up numbers is worse than one
 * showing none.
 */
export async function getAnalytics() {
  const [events, metrics, attempts, counts] = await Promise.all([
    prisma.analyticsEvent.findMany({
      select: { id: true, name: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    }),
    prisma.dailyMetric.findMany({
      select: { id: true, day: true, metric: true, value: true },
      orderBy: [{ day: 'desc' }, { metric: 'asc' }],
      take: 10,
    }),
    // Failed activations are a security signal, not a vanity metric.
    prisma.activationAttempt.findMany({
      where: { outcome: { not: 'SUCCESS' } },
      select: { id: true, outcome: true, createdAt: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    Promise.all([
      prisma.artist.count(),
      prisma.artist.count({ where: { approved: true } }),
      prisma.artwork.count({ where: { status: 'LISTED' } }),
      prisma.collectorIntake.count(),
      prisma.membership.count({ where: { status: 'ACTIVE' } }),
    ]),
  ]);

  const [artists, approvedArtists, releasedArtworks, intakes, activeMemberships] = counts;

  return {
    events,
    metrics,
    attempts,
    totals: { artists, approvedArtists, releasedArtworks, intakes, activeMemberships },
  };
}

export async function getPeople() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/** The audit trail. Append-only: nothing in this app updates or deletes it. */
export async function getAuditTrail() {
  return prisma.auditLog.findMany({
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
  });
}
