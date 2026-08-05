/**
 * Row-Level Security: the canonical policy declarations.
 *
 * ============================ STATUS =====================================
 * DECLARED **AND ENFORCED** from Phase 5. This file is the single source of
 * truth: `scripts/generate-rls.ts` turns it into the SQL that is applied, and
 * `rls.db.test.ts` asserts the live database still matches it. Editing the
 * matrix without regenerating is caught by that test, not discovered in
 * production.
 * =========================================================================
 *
 * HOW IT ACTUALLY BITES
 *
 *  1. Applications connect as `qhakaza_app` — a role that is NOT the table
 *     owner, is not a superuser and does not hold BYPASSRLS. This is the part
 *     that makes RLS real. Before Phase 5 everything connected as `qhakaza`,
 *     which owns every table and holds BYPASSRLS, so policies would have been
 *     decorative: present, inert, and reassuring to exactly the wrong degree.
 *
 *  2. Migrations still run as the owner, which correctly bypasses RLS.
 *
 *  3. The current actor reaches Postgres through two transaction-local
 *     settings, applied by `withActor()`:
 *         qhakaza.role     admin | advisor | artist | collector | system
 *         qhakaza.user_id  the acting user's id
 *     With neither set, `current_setting(..., true)` returns NULL and the actor
 *     is treated as anonymous. Anything a policy does not explicitly grant to
 *     the anonymous context therefore FAILS CLOSED — code that forgets to
 *     declare its actor loses access rather than silently keeping it.
 */

import { CORE_ENTITIES, type CoreEntity } from './entities';

/** The four real roles, plus the two contexts that exist before a user does. */
export const RLS_ROLES = [
  'admin',
  'advisor',
  'artist',
  'collector',
  /** Anonymous. The public artist site and the collector membership shell. */
  'public',
  /**
   * Operations that must run before an actor is known: validating an invitation
   * token, and recording the attempt when that validation fails. Deliberately
   * narrow — `system` is granted on exactly two tables, for exactly what the
   * door needs, and nothing else.
   */
  'system',
] as const;

export type RlsRole = (typeof RLS_ROLES)[number];

export type Operation = 'select' | 'insert' | 'update' | 'delete';

/**
 * `true`  — unconditional.
 * `'own'` — only rows belonging to the actor (see OWNERSHIP).
 * `'released'` — only vetted, published rows (see RELEASED).
 * absent  — denied.
 */
export type Grant = true | 'own' | 'released';

export type EntityPolicy = Partial<Record<Operation, Partial<Record<RlsRole, Grant>>>>;

/**
 * SQL fragments, by entity, for the two conditional grants.
 *
 * `%UID%` is replaced with the acting user id. These are the only places raw
 * SQL predicates live, so a change to what "own" or "released" means is one
 * edit rather than a search.
 */
export const OWNERSHIP: Partial<Record<CoreEntity, string>> = {
  Artist: `"userId" = %UID%`,
  Artwork: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  Membership: `"userId" = %UID%`,
  PrivateNoteSubmission: `"membershipId" IN (SELECT "id" FROM "Membership" WHERE "userId" = %UID%)`,
};

/** What "vetted and released" means, per entity. Never raw submissions. */
export const RELEASED: Partial<Record<CoreEntity, string>> = {
  Artist: `"approved" = true`,
  Artwork: `"status" = 'LISTED' AND "artistId" IN (SELECT "id" FROM "Artist" WHERE "approved" = true)`,
  NewsArticle: `"status" = 'PUBLISHED'`,
};

/**
 * The matrix. Anything not named is denied: these are allow-lists, and an
 * absent entry is a deny, never an oversight that defaults open.
 *
 * `satisfies Record<CoreEntity, …>` is load-bearing — adding an entity to
 * CORE_ENTITIES without a policy here is a type error.
 */
export const RLS_MATRIX = {
  // --- Supply side -------------------------------------------------------
  Artist: {
    // Anonymous and members see approved artists only. An artist sees their own
    // record whatever its state, which is how they can work before approval.
    select: {
      admin: true,
      advisor: true,
      artist: 'own',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true, artist: 'own' },
    update: { admin: true, advisor: true, artist: 'own' },
    delete: { admin: true },
  },
  Artwork: {
    select: {
      admin: true,
      advisor: true,
      artist: 'own',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true, artist: 'own' },
    update: { admin: true, advisor: true, artist: 'own' },
    delete: { admin: true },
  },

  // --- Collector side. `artist` appears nowhere in this block, deliberately.
  Membership: {
    select: { admin: true, advisor: true, collector: 'own' },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: { admin: true },
  },
  CollectorIntake: {
    // Read is restricted to staff, per the brief. Anonymous INSERT is the one
    // deliberate exception: the public apply form needs it. Write-only — an
    // applicant cannot read back even their own submission.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true, collector: true, public: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  CollectorVerification: {
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  MemberInvitation: {
    // `system` reads it to validate a token presented at the door, before any
    // actor exists. It cannot write, and nothing else anonymous can read.
    select: { admin: true, advisor: true, system: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  ActivationAttempt: {
    // Append-only forensics. `system` inserts the record of a failed attempt,
    // which by definition happens with no valid actor. Nobody edits the log.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true, system: true },
    update: {},
    delete: {},
  },
  PrivateNoteSubmission: {
    select: { admin: true, advisor: true, collector: 'own' },
    insert: { admin: true, advisor: true, collector: true },
    update: { admin: true, advisor: true },
    delete: {},
  },

  // --- Platform ----------------------------------------------------------
  NewsArticle: {
    // Published articles are public; drafts are staff-only.
    select: {
      admin: true,
      advisor: true,
      artist: 'released',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true },
    update: { admin: true },
    delete: { admin: true },
  },
  Partner: {
    select: { admin: true, advisor: true },
    insert: { admin: true },
    update: { admin: true },
    delete: { admin: true },
  },
  AnalyticsEvent: {
    select: { admin: true },
    insert: { admin: true, advisor: true, artist: true, collector: true, public: true },
    update: {},
    delete: {},
  },
  DailyMetric: {
    select: { admin: true, advisor: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  AuditLog: {
    // Append-only by policy: NO role gets UPDATE or DELETE, including admin.
    // An audit trail an administrator can rewrite is not an audit trail.
    select: { admin: true },
    insert: { admin: true, advisor: true },
    update: {},
    delete: {},
  },
} as const satisfies Record<CoreEntity, EntityPolicy>;

/** Guards against a silent gap between the entity list and the matrix. */
export function entitiesWithoutPolicy(): CoreEntity[] {
  return CORE_ENTITIES.filter((entity) => !(entity in RLS_MATRIX));
}

/** Whether `role` may perform `operation` on `entity`, per the declared matrix. */
export function declaredGrant(
  entity: CoreEntity,
  operation: Operation,
  role: RlsRole,
): Grant | false {
  const policy = RLS_MATRIX[entity] as EntityPolicy;
  return policy[operation]?.[role] ?? false;
}

// ---------------------------------------------------------------------------
// SQL generation
// ---------------------------------------------------------------------------

/*
 * `nullif(..., '')` is load-bearing, not defensive noise.
 *
 * A custom GUC that has never been touched reads as NULL. But once `set_config`
 * has set it in ANY transaction on a connection, it resets to the EMPTY STRING
 * rather than to NULL at commit. On a pooled connection that means the second
 * anonymous request behaves differently from the first — `coalesce('', 'public')`
 * is `''`, which matches no role, so the public site silently loses its own
 * public data. Caught by the anonymous tests, which run after an actor test on
 * the same pool.
 */
const ACTOR_ROLE = `coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public')`;
const ACTOR_UID = `nullif(current_setting('qhakaza.user_id', true), '')`;

/** The boolean expression for one entity/operation, or null when nothing is granted. */
export function policyExpression(entity: CoreEntity, operation: Operation): string | null {
  const grants = (RLS_MATRIX[entity] as EntityPolicy)[operation] ?? {};
  const clauses: string[] = [];

  for (const role of RLS_ROLES) {
    const grant = grants[role];
    if (!grant) continue;

    const isRole = `${ACTOR_ROLE} = '${role}'`;

    if (grant === true) {
      clauses.push(isRole);
      continue;
    }

    const fragment = grant === 'own' ? OWNERSHIP[entity] : RELEASED[entity];
    if (!fragment) {
      throw new Error(
        `${entity}.${operation} grants '${grant}' to ${role} but no ${grant} predicate is defined`,
      );
    }

    clauses.push(`(${isRole} AND (${fragment.replaceAll('%UID%', ACTOR_UID)}))`);
  }

  return clauses.length === 0 ? null : clauses.join('\n      OR ');
}
