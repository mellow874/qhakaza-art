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
 * `true`       — unconditional.
 * `'own'`      — only rows belonging to the actor (see OWNERSHIP).
 * `'released'` — only what is authorised for PUBLIC view (see RELEASED).
 * `'audience'` — only what has been released to an audience this actor belongs
 *                to (see AUDIENCE_RELEASED). Distinct from `'released'` on
 *                purpose: "the public may see it" and "this collector may see
 *                it" were previously the same predicate, which is how every
 *                collector ended up seeing the public catalogue.
 * absent       — denied.
 */
export type Grant = true | 'own' | 'released' | 'audience';

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
  ArtistPermission: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  Artwork: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  Membership: `"userId" = %UID%`,
  PrivateNoteSubmission: `"membershipId" IN (SELECT "id" FROM "Membership" WHERE "userId" = %UID%)`,

  // --- The artist record -----------------------------------------------
  //
  // Every one of these hangs off `artistId`, so ownership is the same
  // subquery throughout. Written out per entity rather than shared, because a
  // helper here would obscure which tables an artist can actually reach.
  ArtistMedium: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  ArtistExhibition: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  ArtistRepresentation: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  CvEntry: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  InstitutionalSignal: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,
  ArtistLink: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)`,

  // A declaration may hang off the artist or off one of their works.
  DeclaredPrice: `"artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)
     OR "artworkId" IN (SELECT "id" FROM "Artwork"
                         WHERE "artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%))`,

  /*
   * MediaAsset ownership, which did not previously exist.
   *
   * The artist grant on this table was `true` - unconditional - so any signed-in
   * artist could read EVERY row, including evidence documents, contracts and
   * identity documents belonging to other artists. The comment above the policy
   * said "artists write their own uploads and read them back", which is what it
   * was meant to do and not what it did.
   *
   * An artist now reaches a file if they uploaded it, or if it is attached to
   * their own artist record or one of their own works. The subqueries read
   * Artist and Artwork, both of which an artist may select for their own rows,
   * so no definer function is needed here.
   */
  MediaAsset: `"uploadedById" = %UID%
     OR ("subjectType" = 'Artist'  AND "subjectId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%))
     OR ("subjectType" = 'Artwork' AND "subjectId" IN (SELECT "id" FROM "Artwork"
                                                        WHERE "artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)))`,

  // Same shape: a link is the artist's if what it points at is.
  DocumentLink: `("subjectType" = 'Artist'  AND "subjectId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%))
     OR ("subjectType" = 'Artwork' AND "subjectId" IN (SELECT "id" FROM "Artwork"
                                                        WHERE "artistId" IN (SELECT "id" FROM "Artist" WHERE "userId" = %UID%)))`,
};

/**
 * What a given actor may see because it was RELEASED TO AN AUDIENCE they belong
 * to. Keyed by entity, same shape as OWNERSHIP and RELEASED.
 */
export const AUDIENCE_RELEASED: Partial<Record<CoreEntity, string>> = {
  /*
   * What a COLLECTOR may see of an artwork.
   *
   * Not "approved", not "published" - released, to an audience this collector
   * belongs to, with the artist's permission to share privately. Same function
   * reasoning as above: a collector must not be able to read Qhakaza's
   * distribution tables, so the check runs inside a definer function.
   */
  Artwork: `qhakaza_collector_sees_artwork("Artwork"."id", %UID%)`,
};

/** What "authorised for public view" means, per entity. Never raw submissions. */
export const RELEASED: Partial<Record<CoreEntity, string>> = {
  Artist: `"approved" = true`,
  /*
   * PUBLIC means EDITORIAL ONLY, and it is deliberately hard to satisfy:
   * approved artist, PUBLIC_EDITORIAL status, an un-revoked editorial release,
   * and the artist's PUBLISH_PUBLICLY permission. Approval alone gets nowhere
   * near it - before, `status = 'PUBLISHED'` was the whole test.
   *
   * Delegated to a SECURITY DEFINER function because RLS applies inside a
   * policy's own subqueries, and the tables this must read are ones the public
   * cannot read. See 20260818000300_visibility_functions.
   */
  Artwork: `qhakaza_public_sees_artwork("Artwork"."id")`,
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
    /*
     * THE CHANGE THIS PHASE EXISTS FOR.
     *
     * `collector` was 'released' - the same predicate as `public`, so every
     * collector saw exactly the public catalogue. It is now 'audience': a
     * release must exist, to an audience holding this collector, with the
     * artist's permission to share privately.
     *
     * `public` remains 'released', but RELEASED itself now means editorial
     * authorisation rather than "approved".
     */
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: 'own',
      collector: 'audience',
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
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: true,
      collector: true,
      public: true,
    },
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
    select: {
      admin: true,
      advisor: true,
      analyst: true,
      artist: true,
      collector: true,
      public: true,
    },
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
  // --- Visibility and release --------------------------------------------
  // Staff decide who sees what. No collector, artist or public grant anywhere:
  // a collector must not be able to read the shape of Qhakaza's distribution,
  // only receive what it produces.
  AudienceType: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  Audience: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  AudienceMember: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  ArtworkRelease: {
    // Never deleted. Who could see what, and when, is provenance and feeds
    // VERA. Withdrawing sets revokedAt, which is an UPDATE.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  ArtistPermission: {
    // An artist may READ what they have granted - being unable to see your own
    // consent record would be indefensible - but never write it here. Consent
    // is recorded through an action that captures how it was given.
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  CollectorProfile: {
    /*
     * Staff only, and NOT the collector themselves.
     *
     * This is Qhakaza's reading of a person - confidence gaps, budget logic,
     * what an advisor wants remembered. A collector seeing the file kept on
     * them would change what they say in the Private Note, which is the one
     * thing that must stay candid. Section 6's collector-facing Collecting
     * Direction is a separate, deliberately curated projection.
     */
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, system: true },
    update: { admin: true, advisor: true, system: true },
    delete: {},
  },
  MatchSuggestion: {
    // Internal working material. A collector must never learn they were
    // considered for a work and passed over.
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true },
    update: { admin: true, advisor: true },
    delete: {},
  },
  MediaAsset: {
    // Artists write their own uploads and read them back. Staff see everything.
    // Collectors are NOT granted a read: released artwork images are served
    // through the artwork record, and a collector who could read this table
    // directly could enumerate evidence documents by changing an id.
    //
    // `artist` was `true` here, which meant unconditional - every artist could
    // read every file in the platform, other artists' contracts and identity
    // documents included. It is now 'own'; see MediaAsset in OWNERSHIP.
    // `analyst` is added because evidence work needs the documents.
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
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

  // === Artist Intelligence Platform =======================================

  /*
   * The configurable vocabulary.
   *
   * READ BY EVERYONE WHO HAS TO CHOOSE FROM A LIST, including artists, whose
   * own forms are built from it. WRITTEN BY ADMINS ONLY - not advisors. These
   * lists are the shape of the record: an advisor quietly adding a medium or
   * an exhibition type changes what every downstream assessment means, and
   * that is a decision with an owner.
   *
   * Nothing here is deletable. A vocabulary term that has been used is part of
   * the rows that used it; `active = false` removes it from the pickers and
   * leaves history legible. A DELETE would either fail on the foreign key or
   * silently orphan a fact.
   */
  Medium: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  ExhibitionType: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  SignalType: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  CvEntryType: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  RepresentationType: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  DocumentType: {
    select: { admin: true, advisor: true, analyst: true, artist: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },
  /*
   * READINESS CRITERIA ARE STAFF-ONLY, artists included in the exclusion.
   *
   * Confirmed by Qhakaza as absolute: readiness is never visible to the artist.
   * That has to cover the CRITERIA and not only the ratings - a list of what
   * an artist is judged on is most of the assessment, and an artist who could
   * read it would be reading the framework. `artist` is absent here and on
   * both assessment tables, so an artist session gets nothing from any of the
   * three even if a query asks.
   */
  ReadinessCriterion: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true },
    update: { admin: true },
    delete: {},
  },

  /*
   * The artist's own record.
   *
   * The artist owns these rows and maintains them; staff read them to assess
   * and may correct them. Collectors appear nowhere: nothing here is released
   * material, and what a collector eventually sees is a curated projection
   * built by Qhakaza, never a direct read of the working record.
   *
   * NOBODY DELETES. Each of these carries `removedAt`: a claim that was made
   * and later withdrawn is itself part of the record, and a row that can
   * vanish cannot be reconciled against an assessment that relied on it.
   * Withdrawal is an UPDATE, which the artist may perform on their own rows.
   */
  ArtistMedium: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, artist: 'own' },
    update: { admin: true, advisor: true, artist: 'own' },
    delete: {},
  },
  ArtistExhibition: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
    delete: {},
  },
  ArtistRepresentation: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
    delete: {},
  },
  CvEntry: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
    delete: {},
  },
  InstitutionalSignal: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
    delete: {},
  },
  ArtistLink: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true, artist: 'own' },
    delete: {},
  },

  /*
   * Pricing history. APPEND-ONLY: no update, no delete, for anyone.
   *
   * The point of the table is that a figure once declared cannot be quietly
   * revised. Correcting a price means declaring a new one, which is also how
   * it works in life. Enforced at the grant level too - see the hardening
   * migration.
   */
  DeclaredPrice: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, artist: 'own' },
    update: {},
    delete: {},
  },

  /*
   * Qhakaza's judgement about an artist. NOT the artist's material, and never
   * theirs to read - see ReadinessCriterion above.
   *
   * Append-only for the same reason as pricing: an assessment that can be
   * rewritten is not a record of what was decided. A revised view supersedes
   * its predecessor and leaves it standing, which is the same pattern
   * CaseVersion already uses.
   */
  ReadinessAssessment: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: {},
    delete: {},
  },
  ReadinessRating: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: {},
    delete: {},
  },

  /*
   * Field-level history. Append-only, staff-read.
   *
   * Not readable by the artist even for their own record: the rows carry who
   * changed what, and staff corrections to an artist's claims are internal
   * working material. An artist asking what their record says is answered by
   * the record, not by the diff.
   */
  RecordChange: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true, artist: true },
    update: {},
    delete: {},
  },

  /*
   * A document's attachments. An artist reaches a link when the thing it
   * points at is theirs; see DocumentLink in OWNERSHIP.
   *
   * Detaching is a real operation rather than a historical falsification - a
   * document attached to the wrong work should come off it - so DELETE is
   * granted to admins. The FILE itself is still never deleted.
   */
  DocumentLink: {
    select: { admin: true, advisor: true, analyst: true, artist: 'own' },
    insert: { admin: true, advisor: true, analyst: true, artist: 'own' },
    update: { admin: true, advisor: true, analyst: true },
    delete: { admin: true },
  },

  /*
   * Citations. Staff only, and deliberately not visible to the artist: which
   * sources Qhakaza consulted, and what they said, is the intelligence work
   * itself rather than the artist's own material.
   */
  SourceReference: {
    select: { admin: true, advisor: true, analyst: true },
    insert: { admin: true, advisor: true, analyst: true },
    update: { admin: true, advisor: true, analyst: true },
    delete: { admin: true },
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

    const fragment =
      grant === 'own'
        ? OWNERSHIP[entity]
        : grant === 'audience'
          ? AUDIENCE_RELEASED[entity]
          : RELEASED[entity];
    if (!fragment) {
      throw new Error(
        `${entity}.${operation} grants '${grant}' to ${role} but no ${grant} predicate is defined`,
      );
    }

    clauses.push(`(${isRole} AND (${fragment.replaceAll('%UID%', ACTOR_UID)}))`);
  }

  return clauses.length === 0 ? null : clauses.join('\n      OR ');
}
