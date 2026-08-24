/**
 * Custody periods — the time a work spends with a collector before it is
 * concluded.
 *
 * THE SYSTEM RECORDS. IT NEVER DECIDES. These functions create, read,
 * extend and conclude appreciation periods; they never auto-create or
 * auto-conclude. An administrator acts deliberately every time.
 *
 * PAST CUSTODIES ARE PERMANENT. Concluded periods are never deleted.
 * This is provenance information that feeds into VERA in due course.
 *
 * AVOIDS loan, rental, return terminology. The collector-facing language
 * is "appreciation period" and "placed with".
 */

import { prisma } from './client';
import { withActor } from './actor';

/** The default appreciation period in days, if none is set per case. */
export const DEFAULT_CUSTODY_DURATION_DAYS = 30;

/** How far ahead (in days) a reminder is sent before conclusion. */
export const DEFAULT_REMINDER_AHEAD_DAYS = 3;

/** How far ahead (in days) a second reminder is sent before conclusion. */
export const SECOND_REMINDER_AHEAD_DAYS = 7;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export type CustodyPeriodWithRelations = Awaited<
  ReturnType<typeof getCustodyPeriodById>
>;

export async function getCustodyPeriodById(id: string) {
  return prisma.custodyPeriod.findUnique({
    where: { id },
    include: {
      artwork: {
        select: {
          id: true,
          title: true,
          medium: true,
          artist: { select: { displayName: true, slug: true } },
        },
      },
      membership: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
          intake: { select: { fullName: true } },
        },
      },
    },
  });
}

/**
 * All active custody periods, for the administrator dashboard.
 * Shows time remaining at a glance.
 */
export async function getActiveCustodyPeriods() {
  return prisma.custodyPeriod.findMany({
    where: { status: 'ACTIVE' },
    include: {
      artwork: {
        select: {
          id: true,
          title: true,
          medium: true,
          artist: { select: { displayName: true, slug: true } },
        },
      },
      membership: {
        select: {
          id: true,
          user: { select: { id: true, name: true, email: true } },
          intake: { select: { fullName: true } },
        },
      },
    },
    orderBy: { endsAt: 'asc' },
  });
}

/**
 * Past custody periods for a specific artwork — the provenance record.
 * Kept permanently; this feeds VERA in due course.
 */
export async function getArtworkCustodyHistory(artworkId: string) {
  return prisma.custodyPeriod.findMany({
    where: { artworkId },
    include: {
      membership: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          intake: { select: { fullName: true } },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * The current active custody period for a specific artwork.
 * Used to prevent releasing a work in active custody to a second collector.
 */
export async function getActiveCustodyForArtwork(artworkId: string) {
  return prisma.custodyPeriod.findFirst({
    where: { artworkId, status: 'ACTIVE' },
    include: {
      membership: {
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          intake: { select: { fullName: true } },
        },
      },
    },
  });
}

/**
 * The active custody periods for a specific collector (membership).
 * Used on the collector-facing appreciation period page.
 */
export async function getCollectorCustodyPeriods(membershipId: string) {
  return prisma.custodyPeriod.findMany({
    where: {
      membershipId,
      status: 'ACTIVE',
    },
    include: {
      artwork: {
        select: {
          id: true,
          title: true,
          medium: true,
          dimensions: true,
          price: true,
          currency: true,
          images: true,
          artist: { select: { displayName: true, slug: true } },
        },
      },
    },
    orderBy: { endsAt: 'asc' },
  });
}

/**
 * All custody periods (active and concluded) for a collector.
 * Shows their full history of appreciation periods.
 */
export async function getAllCollectorCustodyPeriods(membershipId: string) {
  return prisma.custodyPeriod.findMany({
    where: { membershipId },
    include: {
      artwork: {
        select: {
          id: true,
          title: true,
          medium: true,
          artist: { select: { displayName: true, slug: true } },
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// Mutations (admin/advisor only — enforced by RLS)
// ---------------------------------------------------------------------------

export type CreateCustodyPeriodInput = {
  artworkId: string;
  membershipId: string;
  durationDays: number;
  reminderIntervalDays?: number | null;
  notes?: string | null;
  /** The user creating this custody period. */
  createdById: string;
};

/**
 * Create a new appreciation period.
 *
 * PREVENTS DUAL CUSTODY. Before creating, checks that no active custody
 * exists for this artwork. Returns an error rather than throwing.
 */
export async function createCustodyPeriod(input: CreateCustodyPeriodInput) {
  return withActor({ role: 'admin', userId: input.createdById }, async (tx) => {
    // Check no active custody exists for this artwork
    const existing = await tx.custodyPeriod.findFirst({
      where: { artworkId: input.artworkId, status: 'ACTIVE' },
      select: { id: true },
    });

    if (existing) {
      return {
        ok: false as const,
        error: 'ACTIVE_CUSTODY_EXISTS' as const,
        existingCustodyId: existing.id,
      };
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

    const period = await tx.custodyPeriod.create({
      data: {
        artworkId: input.artworkId,
        membershipId: input.membershipId,
        durationDays: input.durationDays,
        startedAt: now,
        endsAt,
        reminderIntervalDays: input.reminderIntervalDays ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById,
      },
    });

    return { ok: true as const, period };
  });
}

export type ExtendCustodyPeriodInput = {
  custodyPeriodId: string;
  extensionDays: number;
  extensionReason?: string | null;
  extendedById: string;
};

/**
 * Extend an active appreciation period.
 *
 * Records the extension as a separate event on the same row, so the
 * history of when and why it was extended is part of the record.
 */
export async function extendCustodyPeriod(input: ExtendCustodyPeriodInput) {
  return withActor({ role: 'admin', userId: input.extendedById }, async (tx) => {
    const existing = await tx.custodyPeriod.findUnique({
      where: { id: input.custodyPeriodId },
      select: { id: true, status: true, endsAt: true },
    });

    if (!existing || existing.status !== 'ACTIVE') {
      return { ok: false as const, error: 'NOT_ACTIVE' as const };
    }

    const newEndsAt = new Date(
      existing.endsAt.getTime() + input.extensionDays * 24 * 60 * 60 * 1000,
    );

    const period = await tx.custodyPeriod.update({
      where: { id: input.custodyPeriodId },
      data: {
        status: 'EXTENDED',
        endsAt: newEndsAt,
        extendedAt: new Date(),
        extendedById: input.extendedById,
        extensionDays: input.extensionDays,
        extensionReason: input.extensionReason ?? null,
      },
    });

    return { ok: true as const, period };
  });
}

export type ConcludeCustodyPeriodInput = {
  custodyPeriodId: string;
  concludeReason?: string | null;
  concludedById: string;
};

/**
 * Conclude an appreciation period early.
 *
 * Sets concludedAt and the reason. The row stays forever as provenance.
 */
export async function concludeCustodyPeriod(input: ConcludeCustodyPeriodInput) {
  return withActor({ role: 'admin', userId: input.concludedById }, async (tx) => {
    const existing = await tx.custodyPeriod.findUnique({
      where: { id: input.custodyPeriodId },
      select: { id: true, status: true },
    });

    if (!existing || (existing.status !== 'ACTIVE' && existing.status !== 'EXTENDED')) {
      return { ok: false as const, error: 'NOT_CONcludABLE' as const };
    }

    const period = await tx.custodyPeriod.update({
      where: { id: input.custodyPeriodId },
      data: {
        status: 'CONCLUDED',
        concludedAt: new Date(),
        concludedById: input.concludedById,
        concludeReason: input.concludeReason ?? null,
      },
    });

    return { ok: true as const, period };
  });
}

/**
 * Check whether a work is currently in active custody.
 * Used to prevent releasing to a second collector.
 */
export async function isArtworkInActiveCustody(artworkId: string): Promise<boolean> {
  const active = await prisma.custodyPeriod.findFirst({
    where: { artworkId, status: { in: ['ACTIVE', 'EXTENDED'] } },
    select: { id: true },
  });
  return active !== null;
}

// ---------------------------------------------------------------------------
// Time remaining calculations
// ---------------------------------------------------------------------------

export type TimeRemaining = {
  totalDays: number;
  daysRemaining: number;
  hoursRemaining: number;
  isOverdue: boolean;
  percentageElapsed: number;
};

/**
 * Calculate the time remaining in an appreciation period.
 * The collector sees this as a calm appreciation countdown, not a deadline.
 */
export function calculateTimeRemaining(
  startedAt: Date,
  endsAt: Date,
  now: Date = new Date(),
): TimeRemaining {
  const totalMs = endsAt.getTime() - startedAt.getTime();
  const remainingMs = endsAt.getTime() - now.getTime();
  const totalDays = Math.ceil(totalMs / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  const hoursRemaining = Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000)));
  const isOverdue = remainingMs < 0;
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const percentageElapsed = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  return { totalDays, daysRemaining, hoursRemaining, isOverdue, percentageElapsed };
}
