import type { Prisma } from '@prisma/client';

import { prisma } from './client';

/**
 * Declares who is asking, for the duration of one transaction.
 *
 * Row-Level Security policies read two transaction-local settings. `withActor`
 * is the only thing that sets them, so it is the only way to act as anything
 * other than anonymous:
 *
 *     qhakaza.role     admin | advisor | artist | collector | system
 *     qhakaza.user_id  the acting user's id, for the `own` predicates
 *
 * `set_config(..., true)` scopes both to the transaction, so they cannot leak
 * to the next query on a pooled connection — a leaked actor would be a
 * privilege escalation that only shows up under load.
 *
 * FAILS CLOSED. Code that does not use this runs anonymous and gets only what
 * the matrix grants `public`. Forgetting to declare an actor costs you access;
 * it never silently keeps it.
 */

/**
 * Kept in step with `RLS_ROLES` in rls.ts, which is the list the policies are
 * generated from. A role here that the policies do not know is granted nothing,
 * which fails safe but confusingly; a role the policies know and this does not
 * cannot be declared at all.
 */
export type ActorRole = 'admin' | 'advisor' | 'analyst' | 'artist' | 'collector' | 'system';

export type Actor = {
  role: ActorRole;
  /** Required for the roles whose grants are scoped to their own rows. */
  userId?: string | null;
};

/**
 * Declares the actor inside a transaction someone else opened.
 *
 * Prisma has no nested interactive transactions, so anything that already runs
 * in one — the Command Center's audited writes, for instance — must set the
 * actor on that transaction rather than open another.
 */
export async function setActor(tx: Prisma.TransactionClient, actor: Actor): Promise<void> {
  // Parameterised: the role and id reach Postgres as values, never as SQL.
  await tx.$executeRaw`SELECT set_config('qhakaza.role', ${actor.role}, true), set_config('qhakaza.user_id', ${actor.userId ?? ''}, true)`;
}

export async function withActor<T>(
  actor: Actor,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setActor(tx, actor);
    return run(tx);
  });
}

/**
 * The two operations that must run before an actor exists: validating an
 * invitation token, and recording the attempt when that validation fails.
 *
 * Named rather than inlined so every use is greppable. `system` is granted
 * SELECT on MemberInvitation and INSERT on ActivationAttempt — nothing else.
 */
export async function asSystem<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return withActor({ role: 'system' }, run);
}
