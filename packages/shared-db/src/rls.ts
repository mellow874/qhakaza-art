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
 *         qhakaza.role     admin | advisor | analyst | artist | collector | system
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
  /**
   * Internal Analyst. Confirmed by Qhakaza as a FIFTH role, distinct from
   * advisor: analysts work Cases, evidence and research, but have no part in
   * concierge work and cannot change what anyone is allowed to do.
   */
  'analyst',
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
  // PUBLISHED only. Not APPROVED: approval is the vetting decision, publication
  // is the release, and an approved-but-unreleased work must stay invisible.
  Artwork: `"status" = 'PUBLISHED' AND "artistId" IN (SELECT "id" FROM "Artist" WHERE "approved" = true)`,
  NewsArticle: `"status" = 'PUBLISHED'`,
  FaqItem: `"published" = true`,
  Briefing: `"status" = 'PUBLISHED'`,
  LegalDocumentVersion: `"status" = 'PUBLISHED'`,
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
  InvitationRecipientType: {
    // Reference data, not personal data. Every actor may read it -- `system`
    // needs it while accepting an invitation, before a session exists, to learn
    // which role the invitation grants. Only an admin may change the list.
    select: { admin: true, advisor: true, artist: true, collector: true, system: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  InternalNote: {
    // Staff only, with no policy at all for artists or collectors -- the
    // strongest form of "internal". The brief requires this to be enforced by
    // RLS rather than by the UI, so there is deliberately no row here that
    // could be widened by a careless change to a screen.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  InternalNoteRevision: {
    // Append-only history. Nobody edits or deletes a revision, including staff:
    // a revision log that can be rewritten records nothing.
    select: { admin: true, advisor: true },
    insert: { admin: true, advisor: true },
    update: {},
    delete: {},
  },
  ArtworkReviewRequest: {
    // The artist MUST be able to read this -- being told "returned for
    // information" without the question is useless. They cannot write one.
    select: { admin: true, advisor: true, artist: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  // ---------------------------------------------------------------------
  // VERA
  //
  // Staff only, throughout. There is deliberately no artist, collector or
  // public row anywhere below: section 22 names internal analysis and
  // unpublished evidence as things that must never reach client-facing
  // permissions, and the strongest way to guarantee that is to grant nothing.
  //
  // ANALYST is granted alongside ADMIN and ADVISOR on the working tables, and
  // withheld from the taxonomy: an analyst uses the categories, an admin
  // decides what the categories are.
  // ---------------------------------------------------------------------
  EvidenceType: {
    // Read by anyone doing the work; changed only by an admin. Taxonomy drift
    // mid-Case would make two Cases incomparable.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  ReliabilityLevel: {
    // Read by anyone doing the work; changed only by an admin. Taxonomy drift
    // mid-Case would make two Cases incomparable.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  GapType: {
    // Read by anyone doing the work; changed only by an admin. Taxonomy drift
    // mid-Case would make two Cases incomparable.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  SpecialistCategory: {
    // Read by anyone doing the work; changed only by an admin. Taxonomy drift
    // mid-Case would make two Cases incomparable.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  PartyRole: {
    // Read by anyone doing the work; changed only by an admin. Taxonomy drift
    // mid-Case would make two Cases incomparable.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  Party: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Exhibition: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Publication: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  ProvenanceTransaction: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Source: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Evidence: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Claim: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Assessment: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Gap: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  Contradiction: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  SpecialistEscalation: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  CaseArtwork: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  CaseEvidence: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  EvidenceClaim: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  ClaimAssessment: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  ArtworkParty: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  CaseParty: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  EvidenceSource: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  ArtworkExhibition: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  ArtworkPublication: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  MethodologyVersion: {
    // An analyst applies a methodology; only an admin issues one. A method that
    // anyone could revise is not a method anyone can be held to.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  IntelligenceCase: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: {},
  },
  CaseVersion: {
    // INSERT ONLY, AND NO UPDATE FOR ANYONE -- including admins.
    //
    // This is where "a revised Case never destroys a previously issued
    // version" stops being a promise and becomes a database constraint. A
    // revision inserts a new row; nothing can rewrite what was already issued.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: {},
    delete: {},
  },
  // --- Content surfaces --------------------------------------------------
  // Read by everyone, written only by staff. The `released` grant means a
  // visitor sees PUBLISHED rows and nothing else, so an unfinished Briefing or
  // an unpublished Terms revision cannot leak by guessing a URL.
  FaqCategory: {
    select: { admin: true, advisor: true, analyst: true, artist: true, collector: true, public: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  FaqItem: {
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: 'released',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  Briefing: {
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: 'released',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  BriefingRelation: {
    select: { admin: true, advisor: true, analyst: true, artist: true, collector: true, public: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  LegalDocumentVersion: {
    // No delete for anyone. You must be able to show what someone agreed to on
    // the day they agreed to it.
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: 'released',
      collector: 'released',
      public: 'released',
    },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  MediaAsset: {
    // Artists write their own uploads and read them back. Staff see everything.
    // Collectors are NOT granted a read: released artwork images are served
    // through the artwork record, and a collector who could read this table
    // directly could enumerate evidence documents by changing an id.
    select: { admin: true, advisor: true, artist: true },
    insert: { admin: true, advisor: true, artist: true },
    update: { admin: true, advisor: true, artist: true },
    // Never. Section 23 requires files to stay retrievable; withdrawal is a
    // status change, not a delete.
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
    //
    // `analyst` must be able to INSERT. Every audited action writes its log row
    // in the same transaction as the change, so a role that cannot write here
    // cannot act at all -- adding ANALYST without this line would have made
    // every analyst action fail at the audit step.
    select: { admin: true },
    insert: { admin: true, advisor: true, analyst: true },
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
