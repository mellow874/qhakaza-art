/**
 * Row-Level Security: the canonical policy declarations.
 *
 * ============================ STATUS =====================================
 * DECLARED, NOT YET ENFORCED. Phase 1 establishes the single place these
 * policies live; Phase 5 generates the SQL, applies it, and adversarially
 * tests it. Until then this file documents intent and is the input to that
 * work — it is not protection. Application-layer guards in @qhakaza/shared-auth
 * are what actually enforce access today.
 * =========================================================================
 *
 * TWO THINGS MUST BE TRUE BEFORE THIS IS REAL, and neither is yet:
 *
 *  1. A non-owner database role. Every connection currently uses the `qhakaza`
 *     role, which owns every table. **Table owners bypass RLS.** Enabling
 *     policies without also either moving the apps onto a non-owning role or
 *     setting `FORCE ROW LEVEL SECURITY` achieves exactly nothing, while
 *     looking like it achieves everything. This is the single most dangerous
 *     misconception available here.
 *
 *  2. The current actor must reach Postgres. Policies are written against
 *     `current_setting('qhakaza.role')` and `current_setting('qhakaza.user_id')`,
 *     which the client must SET LOCAL per transaction. That plumbing does not
 *     exist yet.
 */

import { CORE_ENTITIES, type CoreEntity } from './entities';

/** The four roles. Mirrors the Role enum; kept as strings so this file stays pure. */
export const RLS_ROLES = ['admin', 'advisor', 'artist', 'collector'] as const;
export type RlsRole = (typeof RLS_ROLES)[number];

export type Operation = 'select' | 'insert' | 'update' | 'delete';

/**
 * `own` means the row is scoped to the actor — an artist may update *their*
 * artwork, not any artwork. `true` is unconditional, `false` is denied.
 */
export type Grant = boolean | 'own';

export type EntityPolicy = Record<Operation, Partial<Record<RlsRole, Grant>>>;

const none: EntityPolicy = {
  select: {},
  insert: {},
  update: {},
  delete: {},
};

/**
 * The matrix. Anything not named is denied — these are allow-lists, and the
 * absence of an entry is a deny, never an oversight that defaults open.
 *
 * `satisfies Record<CoreEntity, …>` is load-bearing: adding an entity to
 * CORE_ENTITIES without a policy here is a type error.
 */
export const RLS_MATRIX = {
  // --- Supply side -------------------------------------------------------
  Artist: {
    select: { admin: true, advisor: true, artist: 'own', collector: true },
    insert: { admin: true, artist: 'own' },
    update: { admin: true, advisor: true, artist: 'own' },
    delete: { admin: true },
  },
  Artwork: {
    // Collectors see only released, curated work — enforced by the policy
    // predicate, not by the app remembering to filter.
    select: { admin: true, advisor: true, artist: 'own', collector: true },
    insert: { admin: true, artist: 'own' },
    update: { admin: true, advisor: true, artist: 'own' },
    delete: { admin: true },
  },

  // --- Collector side. Artists appear nowhere in this block, deliberately. --
  Membership: {
    select: { admin: true, advisor: true, collector: 'own' },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: { admin: true },
  },
  CollectorIntake: {
    // The brief restricts intake records to admin and advisor. Anonymous
    // INSERT is what the public /collectors/apply form needs, and is the one
    // deliberate exception: write-only, never readable by its submitter.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true, collector: true },
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
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  ActivationAttempt: {
    // Append-only forensics. Nobody edits an attempt log.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true, collector: true },
    update: {},
    delete: {},
  },
  PrivateNoteSubmission: {
    select: { admin: true, advisor: true, collector: 'own' },
    insert: { admin: true, advisor: true, collector: 'own' },
    update: { admin: true, advisor: true },
    delete: {},
  },

  // --- Platform ----------------------------------------------------------
  NewsArticle: {
    // Published articles are public; drafts are not. The predicate carries it.
    select: { admin: true, advisor: true, artist: true, collector: true },
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
    insert: { admin: true, advisor: true, artist: true, collector: true },
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
    // Append-only by policy: no role gets UPDATE or DELETE, including admin.
    // An audit trail an administrator can rewrite is not an audit trail.
    select: { admin: true },
    insert: { admin: true, advisor: true },
    update: {},
    delete: {},
  },
} as const satisfies Record<CoreEntity, EntityPolicy>;

/** Every entity carries a policy. Guards against a silent gap in the matrix. */
export function entitiesWithoutPolicy(): CoreEntity[] {
  return CORE_ENTITIES.filter((entity) => !(entity in RLS_MATRIX));
}

/** Whether `role` may perform `operation` on `entity`, per the declared matrix. */
export function declaredGrant(entity: CoreEntity, operation: Operation, role: RlsRole): Grant {
  const policy: EntityPolicy = RLS_MATRIX[entity] ?? none;
  return policy[operation][role] ?? false;
}
