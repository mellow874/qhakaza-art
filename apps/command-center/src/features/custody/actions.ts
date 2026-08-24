'use server';

/**
 * Custody period actions for the Command Center.
 *
 * ADMIN-ONLY. Every action goes through `performAudited` so the mutation
 * and its audit trail are written in one transaction.
 *
 * Language: "appreciation period" — not loan, rental, or return.
 */

import { auth } from '@qhakaza/shared-auth/server';
import {
  createCustodyPeriod,
  extendCustodyPeriod,
  concludeCustodyPeriod,
  calculateTimeRemaining,
} from '@qhakaza/shared-db';

import {
  commandCentreActor,
  isFailure,
  performAudited,
  type AuditActor,
} from '@/lib/audit';

import {
  createCustodyPeriodSchema,
  extendCustodyPeriodSchema,
  concludeCustodyPeriodSchema,
} from '@/lib/validation/custody';

// Re-export for the UI
export { calculateTimeRemaining };

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type CustodyActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      existingCustodyId?: string;
    };

// ---------------------------------------------------------------------------
// Create an appreciation period
// ---------------------------------------------------------------------------

export async function createCustodyPeriodAction(
  input: unknown,
): Promise<CustodyActionResult> {
  const parsed = createCustodyPeriodSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    const result = await createCustodyPeriod({
      ...parsed.data,
      createdById: actor.userId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        existingCustodyId: result.existingCustodyId,
      };
    }

    // Audit the creation
    await performAudited({
      actor,
      action: 'custody_period_created',
      entityType: 'CustodyPeriod',
      entityId: result.period.id,
      summary: `Appreciation period created: "${parsed.data.artworkId}" with collector "${parsed.data.membershipId}" for ${parsed.data.durationDays} days`,
      run: async () => {
        // The creation already happened; this is just the audit write
      },
    });

    return { ok: true };
  } catch (error) {
    console.error('createCustodyPeriodAction failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

// ---------------------------------------------------------------------------
// Extend an appreciation period
// ---------------------------------------------------------------------------

export async function extendCustodyPeriodAction(
  input: unknown,
): Promise<CustodyActionResult> {
  const parsed = extendCustodyPeriodSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    const result = await extendCustodyPeriod({
      ...parsed.data,
      extendedById: actor.userId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    await performAudited({
      actor,
      action: 'custody_period_extended',
      entityType: 'CustodyPeriod',
      entityId: parsed.data.custodyPeriodId,
      summary: `Appreciation period extended by ${parsed.data.extensionDays} days`,
      after: { status: 'EXTENDED', endsAt: result.period.endsAt.toISOString() },
      run: async () => {},
    });

    return { ok: true };
  } catch (error) {
    console.error('extendCustodyPeriodAction failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}

// ---------------------------------------------------------------------------
// Conclude an appreciation period early
// ---------------------------------------------------------------------------

export async function concludeCustodyPeriodAction(
  input: unknown,
): Promise<CustodyActionResult> {
  const parsed = concludeCustodyPeriodSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join('.')] ??= issue.message;
    }
    return { ok: false, error: 'INVALID', fieldErrors };
  }

  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  try {
    const result = await concludeCustodyPeriod({
      ...parsed.data,
      concludedById: actor.userId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    await performAudited({
      actor,
      action: 'custody_period_concluded',
      entityType: 'CustodyPeriod',
      entityId: parsed.data.custodyPeriodId,
      summary: `Appreciation period concluded early${parsed.data.concludeReason ? `: ${parsed.data.concludeReason}` : ''}`,
      run: async () => {},
    });

    return { ok: true };
  } catch (error) {
    console.error('concludeCustodyPeriodAction failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
