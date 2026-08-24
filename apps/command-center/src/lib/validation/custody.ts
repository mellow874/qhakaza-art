import { z } from 'zod';

/**
 * Validation schemas for custody period operations.
 *
 * Language: "appreciation period" — not loan, rental, or return.
 * Pending Qhakaza confirmation of the collector-facing language.
 */

// ---------------------------------------------------------------------------
// Admin: create an appreciation period
// ---------------------------------------------------------------------------

export const createCustodyPeriodSchema = z.object({
  artworkId: z.string().min(1, 'A work must be selected'),
  membershipId: z.string().min(1, 'A collector must be selected'),
  durationDays: z
    .number()
    .int()
    .min(1, 'The appreciation period must be at least 1 day')
    .max(365, 'The appreciation period cannot exceed 365 days'),
  reminderIntervalDays: z
    .number()
    .int()
    .min(1)
    .max(30)
    .nullable()
    .optional(),
  notes: z
    .string()
    .max(2_000)
    .nullable()
    .optional(),
});

// ---------------------------------------------------------------------------
// Admin: extend an appreciation period
// ---------------------------------------------------------------------------

export const extendCustodyPeriodSchema = z.object({
  custodyPeriodId: z.string().min(1),
  extensionDays: z
    .number()
    .int()
    .min(1, 'The extension must be at least 1 day')
    .max(180, 'The extension cannot exceed 180 days'),
  extensionReason: z
    .string()
    .max(1_000)
    .nullable()
    .optional(),
});

// ---------------------------------------------------------------------------
// Admin: conclude an appreciation period early
// ---------------------------------------------------------------------------

export const concludeCustodyPeriodSchema = z.object({
  custodyPeriodId: z.string().min(1),
  concludeReason: z
    .string()
    .max(1_000)
    .nullable()
    .optional(),
});
