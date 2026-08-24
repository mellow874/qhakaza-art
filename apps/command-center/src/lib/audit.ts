import { headers } from 'next/headers';

import { requireRole, type Session } from '@qhakaza/shared-auth/guards';
import { COMMAND_CENTER_ROLES } from '@qhakaza/shared-auth';
import { prisma, setActor, withActor } from '@qhakaza/shared-db';
import type { Prisma } from '@prisma/client';

/**
 * Every Command Center action goes through here.
 *
 * The action and its AuditLog row are written in **one transaction**. That is
 * the whole point: "remember to also write an audit record" is a rule that
 * holds until the day someone is in a hurry. Here, an action that cannot be
 * recorded does not happen — the transaction rolls back and the caller gets an
 * error rather than a silent, untraceable change.
 *
 * Authorisation is checked here too, so no admin mutation can be written
 * without both a permitted role and a trail.
 */

export type AuditActor = { userId: string; role: 'ADMIN' | 'ADVISOR' | 'ANALYST' };

export type AdminFailure = { ok: false; error: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'UNKNOWN' };

/** Narrows a session to a Command Center actor, or explains why not. */
export function commandCentreActor(session: Session): AuditActor | AdminFailure {
  const grant = requireRole(session, COMMAND_CENTER_ROLES);
  if (!grant.ok) return { ok: false, error: 'FORBIDDEN' };
  return { userId: grant.userId, role: grant.role as AuditActor['role'] };
}

export function isFailure(value: AuditActor | AdminFailure): value is AdminFailure {
  return 'ok' in value && value.ok === false;
}

/**
 * The Command Center's roles, in the lower-case form the RLS policies read.
 *
 * SPELLED OUT PER ROLE, deliberately. This was written as
 * `role === 'ADMIN' ? 'admin' : 'advisor'` when there were two roles, which
 * silently mapped a third to `advisor` the moment one existed -- handing every
 * analyst the collector-table access that advisors have and analysts must not.
 *
 * An exhaustive switch means the next role added fails to compile here rather
 * than quietly inheriting someone else's privileges.
 */
export function actorContext(actor: AuditActor) {
  const role = ((): 'admin' | 'advisor' | 'analyst' => {
    switch (actor.role) {
      case 'ADMIN':
        return 'admin';
      case 'ADVISOR':
        return 'advisor';
      case 'ANALYST':
        return 'analyst';
    }
  })();

  return { role, userId: actor.userId };
}

/**
 * A read performed as the acting member of staff.
 *
 * Every query in this app goes through here. Without it the query runs
 * anonymous, and the collector tables — which grant nothing to `public` —
 * simply return empty. That failure mode is quiet, which is exactly why the
 * helper exists rather than a convention.
 */
export function readAs<T>(
  actor: AuditActor,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withActor(actorContext(actor), run);
}

type Audited<T> = {
  actor: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  /** The mutation. Runs inside the same transaction as the audit write. */
  run: (tx: Prisma.TransactionClient) => Promise<T>;
};

export async function performAudited<T>(input: Audited<T>): Promise<T> {
  const headerList = await headers();
  // Attacker-controlled; recorded as evidence, never trusted for a decision.
  const ipAddress = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  return prisma.$transaction(async (tx) => {
    // Declared on the transaction this function already opens: Prisma has no
    // nested interactive transactions, so `withActor` cannot be used here.
    await setActor(tx, actorContext(input.actor));

    const result = await input.run(tx);

    await tx.auditLog.create({
      data: {
        actorId: input.actor.userId,
        actorRole: input.actor.role,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary ?? null,
        before: input.before ?? undefined,
        after: input.after ?? undefined,
        ipAddress,
        createdById: input.actor.userId,
      },
    });

    return result;
  });
}
