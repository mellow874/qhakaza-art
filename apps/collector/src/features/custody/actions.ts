'use server';

/**
 * Server actions for the Appreciation Period feature.
 *
 * ADMIN-ONLY. Every action re-validates the session and role server-side,
 * because a server action is a public HTTP endpoint that can be called
 * directly by anyone who has seen the page once.
 *
 * Language: "appreciation period" — not loan, rental, or return.
 */

import { requireRole } from '@qhakaza/shared-auth/guards';
import { auth } from '@qhakaza/shared-auth/server';
import {
  createCustodyPeriod,
  extendCustodyPeriod,
  concludeCustodyPeriod,
} from '@qhakaza/shared-db';

import {
  createCustodyPeriodSchema,
  extendCustodyPeriodSchema,
  concludeCustodyPeriodSchema,
} from '@/lib/validation/custody';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type CustodyActionResult =
  | { ok: true }
  | {
      ok: false;
      error: 'DENIED' | 'INVALID' | 'ACTIVE_CUSTODY_EXISTS' | 'NOT_ACTIVE' | 'NOT_CONcludABLE' | 'UNKNOWN';
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

  const grant = requireRole(await auth(), ['ADMIN', 'ADVISOR']);
  if (!grant.ok) return { ok: false, error: 'DENIED' };

  try {
    const result = await createCustodyPeriod({
      ...parsed.data,
      createdById: grant.userId,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
        existingCustodyId: result.existingCustodyId,
      };
    }

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

  const grant = requireRole(await auth(), ['ADMIN', 'ADVISOR']);
  if (!grant.ok) return { ok: false, error: 'DENIED' };

  try {
    const result = await extendCustodyPeriod({
      ...parsed.data,
      extendedById: grant.userId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

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

  const grant = requireRole(await auth(), ['ADMIN', 'ADVISOR']);
  if (!grant.ok) return { ok: false, error: 'DENIED' };

  try {
    const result = await concludeCustodyPeriod({
      ...parsed.data,
      concludedById: grant.userId,
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  } catch (error) {
    console.error('concludeCustodyPeriodAction failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }
}
