import type { Prisma } from '@prisma/client';

import { readAs, type AuditActor } from '@/lib/audit';

/**
 * Everything the Command Center reads.
 *
 * ONE TRANSACTION FOR THE WHOLE PAGE.
 *
 * Each reader used to open its own `readAs`, and the page ran them in a
 * `Promise.all` — so loading the console opened seven concurrent interactive
 * transactions. Against a pooled connection that exhausts the pool and Prisma
 * gives up with P2028 ("unable to start a transaction in the given time"),
 * which presents as a blank console rather than as a database problem.
 *
 * So the readers below take a transaction client, and `getCommandCentreData`
 * opens exactly one. Declaring the actor once is also the more honest shape:
 * it is one person loading one page.
 */

type Tx = Prisma.TransactionClient;

async function vettingQueue(tx: Tx) {
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
      where: { status: { not: 'PUBLISHED' } },
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

function intakeQueue(tx: Tx) {
  return tx.collectorIntake.findMany({
    select: {
      id: true,
      kind: true,
      fullName: true,
      email: true,
      country: true,
      city: true,
      status: true,
      createdAt: true,
      // Only ever set on their own kind of request; shown so an advisor can
      // read what was asked without opening the row.
      accessInterest: true,
      considerationNote: true,
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
async function communications(tx: Tx) {
  const [notes, messages] = await Promise.all([
    tx.privateNoteSubmission.findMany({
      select: {
        id: true,
        subject: true,
        body: true,
        status: true,
        createdAt: true,
        artwork: { select: { id: true, title: true, artist: { select: { displayName: true } } } },
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
}

/**
 * The Private Notes — RSVP surveys from prospective collectors.
 *
 * A different table from PrivateNoteSubmission, which is a *member* writing to
 * their advisor. This is someone not yet a member telling us what they collect,
 * so the team can personalise what is prepared for them.
 */
function privateNotes(tx: Tx) {
  return tx.privateNote.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      mediums: true,
      regions: true,
      subjects: true,
      acquisitionPace: true,
      budgetBand: true,
      advisoryStyle: true,
      contactStyle: true,
      building: true,
      frustrations: true,
      goodOutcome: true,
      mayContact: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
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
async function analytics(tx: Tx) {
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
      tx.artwork.count({ where: { status: 'PUBLISHED' } }),
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
}

function people(tx: Tx) {
  // `User` carries no RLS policy — the credentials provider must find an
  // account before a session exists. Read through the actor anyway, so the
  // pattern is uniform and the day a policy is added nothing has to change.
  return tx.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/** The audit trail. Append-only: RLS grants no UPDATE or DELETE to any role. */
function auditTrail(tx: Tx) {
  return tx.auditLog.findMany({
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

/** Everything the console shows, read as the acting member of staff, once. */
/**
 * Invitations, newest first.
 *
 * Includes cancelled and expired ones: the brief asks for status to be
 * tracked, and a list that quietly drops everything that did not work out
 * tracks only the happy path.
 */
async function invitations(tx: Tx) {
  return tx.memberInvitation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      email: true,
      recipientName: true,
      status: true,
      createdAt: true,
      sentAt: true,
      openedAt: true,
      acceptedAt: true,
      completedAt: true,
      expiresAt: true,
      recipientType: { select: { slug: true, label: true } },
    },
  });
}

/**
 * The dashboard figures, every one counted from the underlying records.
 *
 * Nothing here is a stored total. Section 16 asks for live database state, and
 * a maintained counter is a number that can be wrong; a COUNT cannot.
 *
 * KPIs are defined as a list rather than written into the JSX, so adding one
 * is an entry here and not a redevelopment - which is what section 17's
 * "design so new KPIs can be added without major redevelopment" asks for.
 */
async function dashboard(tx: Tx) {
  /*
   * ONE round trip, not nine.
   *
   * These were nine separate counts. Each is fast, but the database is a
   * managed instance in another region and every query costs a round trip -
   * and because the actor is transaction-scoped, they all share one connection
   * and therefore run strictly one after another. Nine round trips became
   * several seconds of a page load that does nothing but count.
   *
   * Promise.all does not help here: a transaction has one connection, so the
   * queries queue regardless. Fewer statements is the only real fix.
   *
   * RLS still applies - this runs as the declared actor like any other query,
   * so a role that may not read Evidence counts zero of them rather than
   * seeing a total it should not.
   */
  const [row] = await tx.$queryRawUnsafe<
    Record<string, bigint>[]
  >(`
    SELECT
      (SELECT count(*) FROM "MemberInvitation" WHERE "status" IN ('CREATED','SENT','OPENED'))      AS inv_outstanding,
      (SELECT count(*) FROM "MemberInvitation" WHERE "status" = 'ACCEPTED')                        AS inv_accepted,
      (SELECT count(*) FROM "MemberInvitation" WHERE "status" = 'COMPLETED')                       AS inv_completed,
      (SELECT count(*) FROM "MemberInvitation")                                                    AS inv_total,
      (SELECT count(*) FROM "Artist")                                                              AS artists_total,
      (SELECT count(*) FROM "Artist" WHERE "approved")                                             AS artists_approved,
      (SELECT count(*) FROM "Artist" WHERE NOT "approved")                                         AS artists_awaiting,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'DRAFT')                                    AS art_draft,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'SUBMITTED')                                AS art_submitted,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'UNDER_REVIEW')                             AS art_under_review,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'RETURNED_FOR_INFORMATION')                 AS art_returned,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'APPROVED')                                 AS art_approved,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'PUBLISHED')                                AS art_published,
      (SELECT count(*) FROM "Artwork" WHERE "status" = 'REJECTED')                                 AS art_rejected,
      (SELECT count(*) FROM "Evidence")                                                            AS evidence_records,
      (SELECT count(*) FROM "Gap" WHERE "status" IN ('OPEN','IN_PROGRESS'))                        AS gaps_open,
      (SELECT count(*) FROM "Contradiction" WHERE "resolvedAt" IS NULL)                            AS contradictions_open,
      (SELECT count(*) FROM "SpecialistEscalation" WHERE "status" <> 'ANSWERED')                   AS escalations_open,
      (SELECT count(*) FROM "IntelligenceCase")                                                    AS cases_total,
      (SELECT count(*) FROM "IntelligenceCase" WHERE "status" = 'ISSUED')                          AS cases_issued,
      (SELECT count(*) FROM "CaseVersion" WHERE "issuedAt" IS NOT NULL)                            AS versions_issued
  `);

  const n = (key: string) => Number(row?.[key] ?? 0);

  return {
    invitations: {
      total: n('inv_total'),
      accepted: n('inv_accepted'),
      completed: n('inv_completed'),
      outstanding: n('inv_outstanding'),
    },
    artists: {
      total: n('artists_total'),
      approved: n('artists_approved'),
      awaiting: n('artists_awaiting'),
    },
    artwork: {
      DRAFT: n('art_draft'),
      SUBMITTED: n('art_submitted'),
      UNDER_REVIEW: n('art_under_review'),
      RETURNED_FOR_INFORMATION: n('art_returned'),
      APPROVED: n('art_approved'),
      PUBLISHED: n('art_published'),
      REJECTED: n('art_rejected'),
    } as Record<string, number>,
    evidence: {
      records: n('evidence_records'),
      openGaps: n('gaps_open'),
      unresolvedContradictions: n('contradictions_open'),
      escalationsOutstanding: n('escalations_open'),
    },
    cases: {
      total: n('cases_total'),
      issued: n('cases_issued'),
      issuedVersions: n('versions_issued'),
    },
  };
}

export async function getCommandCentreData(actor: AuditActor) {
  return readAs(actor, async (tx) => ({
    vetting: await vettingQueue(tx),
    dashboard: await dashboard(tx),
    invitations: await invitations(tx),
    recipientTypes: await tx.invitationRecipientType.findMany({
      where: { active: true },
      orderBy: { ordering: 'asc' },
      select: { id: true, slug: true, label: true },
    }),
    intakes: await intakeQueue(tx),
    comms: await communications(tx),
    privateNotes: await privateNotes(tx),
    analytics: await analytics(tx),
    people: await people(tx),
    audit: await auditTrail(tx),
  }));
}

export type CommandCentreData = Awaited<ReturnType<typeof getCommandCentreData>>;

/**
 * The communications hub on its own.
 *
 * A separate export because the pipeline test asserts an enquiry arrives here,
 * and loading the entire console to check one list would be a poor test.
 */
export function getCommunications(actor: AuditActor) {
  return readAs(actor, (tx) => communications(tx));
}
