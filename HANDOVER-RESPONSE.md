# Qhakaza Development Handover — Response

Phase 0 deliverable. Audit of the existing platform against the 14 August brief,
assessment of the 17 Definition-of-Done items, per-requirement response for
sections 2–23, and the derived task list for Phases 1–8.

Audited at commit `b8b6607` on `main`.

---

## Open items — reported from day one

| # | Item | Status | What is needed |
|---|------|--------|----------------|
| 1 | **Qhakaza-owned Supabase project** | Blocked on founder | Project created under a Qhakaza account, then the two connection strings shared securely (session pooler :5432 for migrations, transaction pooler :6543 for the app). See §2. |
| 2 | **Email connection** for `desk@qhakazaartcollective.co.za` | Blocked on founder | Provider choice (recommend Resend), an API key, and three DNS records on `qhakazaartcollective.co.za` — SPF, DKIM, and a return-path CNAME. Detail in §3. |
| 3 | **Background audio asset** | Blocked on founder | The licensed track. Mechanism built against a placeholder; swapping it is a config change. See §21. |
| 4 | **Four specification questions** | Blocked on Qhakaza | Logged below under *Questions raised*. None block Phases 1–4. Q1 and Q2 must be answered before Phase 5 lands. |

---

## Critical finding — the platform is not integrated with Supabase

**This must be read before Phases 1 and 3 are costed.**

The brief describes the platform as "built on Supabase" and asks for migration of
"auth, database, … storage buckets". The audit found that Supabase is used as
**hosted PostgreSQL and nothing else**:

| Assumed | Actual | Evidence |
|---|---|---|
| Supabase SDK in use | No `@supabase/supabase-js` anywhere in the monorepo | no match in any `package.json` |
| Supabase Auth | Auth.js v5, bcrypt password hashes, JWT sessions, users in our own `User` table | [`packages/shared-auth/src/server.ts`](packages/shared-auth/src/server.ts), [`auth.config.ts`](packages/shared-auth/src/auth.config.ts) |
| Supabase Storage buckets | **No storage of any kind exists.** Artwork images are external URLs in a `String[]` column | [`schema.prisma:198`](packages/shared-db/prisma/schema.prisma) |
| Supabase RLS via `auth.uid()` | Plain PostgreSQL RLS driven by session variables (`qhakaza.role`, `qhakaza.user_id`) and a non-superuser `qhakaza_app` role | [`packages/shared-db/src/rls.ts:239`](packages/shared-db/src/rls.ts) |

**Consequences, both directions:**

- **Phase 1 gets easier.** There is no Supabase-specific state to migrate — no
  auth users, no buckets, no edge functions, no Supabase policies. The entire
  platform is Prisma migrations plus data. Migration is `prisma migrate deploy`
  against the new connection string, then a data copy. Genuinely a same-day task.
- **Phase 3 gets harder.** "Replace URL-only submission with native file upload"
  is not a change to an existing storage integration; it is building one from
  nothing — bucket provisioning, signed-URL policy, upload endpoint, and the
  metadata model in §23.
- **§22's "verify with RLS tests"** is achievable and already the house pattern —
  but the policies are ours, not Supabase's, so they are authored in
  `rls.ts` and regenerated, not clicked into a dashboard.

**Flagged as a specification deviation, not adopted.** I have not changed
approach. Phase 1 is planned against the real architecture above; confirm you
are content with that reading before I execute.

---

## Definition of Done — current state

✅ Done · ⚠️ Partial · ❌ Not implemented

| # | Item | Status | Evidence / gap |
|---|---|:--:|---|
| 1 | Production on Qhakaza-controlled Supabase | ⚠️ | **Preparation complete (Phase 1).** Scripts, runbook and verification all built and exercised against the live database. Currently still a Melsoft-owned project — execution blocked on credentials only. |
| 2 | Admin sends artist **and** collector invitations | ✅ | [`inviteCollector`](apps/command-center/src/features/command-center/actions.ts) exists — collectors only, and only from an already-verified intake. No artist invitations, no recipient name, no sending. |
| 3 | Invitation status tracked | ✅ | `InvitationStatus` has `ISSUED/ACCEPTED/EXPIRED/REVOKED`. Missing `Created`, `Sent`, `Opened`, `Completed`; no `sentAt`/`openedAt`/`sender` columns. |
| 4 | Artists upload artwork images directly | ❌ | URL-only. [`artwork-form.tsx:183`](apps/vera/src/features/artwork/artwork-form.tsx) states this plainly to the artist. |
| 5 | Private Notes live with permissions | ⚠️ | Two note tables exist (`PrivateNoteSubmission`, `PrivateNote`) but **neither is the internal administrative note this brief describes**. See §5 and Q2. |
| 6 | Artwork submission & approval statuses | ⚠️ | `ArtStatus` is `DRAFT/LISTED/SOLD/HIDDEN`. Admin release/withdraw works ([`setArtworkRelease`](apps/command-center/src/features/command-center/actions.ts)); the 7-state review workflow does not exist. |
| 7 | VERA evidence, claims, gaps, contradictions, escalation | ❌ | No such entities. 21 models in schema, none VERA. |
| 8 | Collector Intelligence Cases | ❌ | Not present. |
| 9 | Methodology versions attachable to Cases | ❌ | Not present. |
| 10 | Named accountable parties on issued Cases | ❌ | Not present. |
| 11 | Material activity auditable | ✅ | `AuditLog` model with `before`/`after` JSON, plus a `performAudited()` wrapper used by every Command Center mutation. Append-only in practice; see §15 for the one hardening change needed. |
| 12 | Core VERA KPIs captured | ❌ | Depends on 7–10. `AnalyticsEvent`/`DailyMetric` exist but have no writer. |
| 13 | FAQ manageable without code changes | ❌ | [`content/faq.ts`](apps/vera/src/content/faq.ts) is a TypeScript file; editing needs a deploy. |
| 14 | Briefings created & published from the platform | ⚠️ | A `NewsArticle` model exists with `status`/`publishedAt`. The site does **not** read it — [`content/briefings.ts`](apps/vera/src/content/briefings.ts) is a hardcoded array. No admin UI. |
| 15 | Terms of Service versioned publication | ❌ | [`/terms`](apps/vera/src/app/(public)/terms/page.tsx) is an honest placeholder. No model. |
| 16 | Background audio implemented | ⚠️ | [`ambient-audio.tsx`](apps/collector/src/features/private-note/ambient-audio.tsx) has opt-in playback, `loop`, and a labelled failure state. Missing: mute/unmute (it is play/pause), session persistence, and a config/storage-swappable source. |
| 17 | Permissions prevent unauthorised exposure | ✅ | 56 RLS policies generated from [`rls.ts`](packages/shared-db/src/rls.ts), enforced by a `NOBYPASSRLS` role, covered by integration tests. **Must be extended to every new table in Phases 2–8** — this ✅ describes today's surface only. |

**Totals at Phase 0: 2 done, 6 partial, 9 not implemented.**
**After Phase 1: item 1 moved ❌ → ⚠️ (prepared, execution blocked).**
**After Phase 2: items 2 and 3 moved ⚠️ → ✅. Delivery of email itself is still blocked on a provider.**

---

## Handover Response — sections 2–23

Section numbering inferred from the brief's own references (§7–14 VERA, §15–17
audit/dashboard/KPI, §18–20 content, §21–23 audio/security/storage), which leaves
§2–6 for Priorities 1–5. Confirm if this mapping is wrong.

### §2 — Supabase migration readiness

| | |
|---|---|
| **Requirement** | New Qhakaza-owned project; schema, data and storage migration prepared; env-driven config; runbook. |
| **Proposed implementation** | Export current schema via `prisma migrate diff` to a reviewed baseline. Idempotent SQL for role creation, grants and all 56 policies (already generated, not hand-written). A `scripts/migrate-data.ts` streaming table-by-table in FK order inside one transaction. Storage script deferred — nothing to migrate (see Critical Finding). Split env into `.env.development` / `.env.production` conventions with a single typed loader that fails loudly on a missing var. `MIGRATION_RUNBOOK.md` with pre-flight, execution, verification and rollback. |
| **Dependencies** | New project + both connection strings. |
| **Status** | ✅ **Phase 1 complete** — everything but execution. See `MIGRATION_RUNBOOK.md`. |
| **Blocker** | Credentials. Everything else proceeds. |

**Correction to the brief:** there are no storage buckets, no Supabase Auth users
and no functions/triggers beyond what Prisma emits. The migration is materially
smaller than described.

### §3 — Automated invitation system

| | |
|---|---|
| **Requirement** | Admin-driven invitations for Artist and Collector, extensible types, full status model, no duplicate users, sent from `desk@qhakazaartcollective.co.za`. |
| **Proposed implementation** | Generalise `MemberInvitation` → add `recipientName`, `recipientType` (FK to a lookup table, not an enum, per "extensible"), `sentAt`, `openedAt`, `completedAt`, `sentById`. Extend status to `CREATED/SENT/OPENED/ACCEPTED/COMPLETED/EXPIRED/CANCELLED`. Open-tracking via a redirect endpoint on the invitation link, which is honest and needs no tracking pixel. Duplicate prevention already half-solved: `tokenHash` is unique and single-use; add a partial unique index on `(email, recipientType)` for live invitations and make acceptance idempotent. Email behind an `EmailService` interface with a `LoggingEmailService` default, so nothing blocks. |
| **Dependencies** | Email provider (open item 2). |
| **Status** | ✅ **Phase 2 complete.** Workflow, statuses, single-use guarantee and admin UI all built and tested. Sending runs through the logging service until a provider is connected. |
| **Blocker** | None for the workflow. Sending blocked on provider + DNS. |

**What is needed to connect email** — recommend **Resend**: an API key, and on
`qhakazaartcollective.co.za` an SPF TXT record, a DKIM CNAME/TXT, and a
return-path CNAME. Without DKIM/SPF, invitations will be filed as spam.

> ⚠ **Constraint the founder must know.** `inviteCollector` stores only
> `fingerprintToken(token)` and returns the plaintext link once. This is correct
> security, and it means **email must be sent at the moment of creation, and a
> true "resend the same link" is impossible.** "Resend" will re-issue a fresh
> invitation and expire the old one. Flagging rather than silently redefining.

### §4 — Direct artwork image uploads

| | |
|---|---|
| **Requirement** | Native upload with preview, progress, replace, delete; type/size validation; Supabase Storage; metadata; URL demoted to optional; desktop + mobile. |
| **Proposed implementation** | Add `@supabase/supabase-js` for Storage only (not auth, not data). Private bucket + short-lived signed upload URLs issued by a server action, so the browser never holds a service key. New `MediaAsset` model (§23) replacing reliance on `Artwork.images`; keep the column populated for backward compatibility rather than dropping it. Client uploader with `XMLHttpRequest` progress, object-URL previews, and pre-submission delete. Validate MIME **and** magic bytes server-side; a rejected type never reaches the bucket. |
| **Dependencies** | Storage bucket in whichever project is live. Works against the current project today. |
| **Status** | ❌ → buildable now. |
| **Blocker** | None. |

### §5 — Private Notes (internal administrative)

| | |
|---|---|
| **Requirement** | Notes on artist/artwork/collector/Case; author + timestamps + edit history; internal-only via RLS; never auto-surface into a Case. |
| **Proposed implementation** | New `InternalNote` model with a polymorphic subject (`subjectType`, `subjectId`) plus a nullable `caseId`. Append-only `InternalNoteRevision` for material edits. RLS restricted to `admin`/`advisor` with no public or collector policy at all — the strongest form of "internal only". A deliberate `convertToEvidence()` action is the **only** path into §8. |
| **Dependencies** | §7–8 for the Case link (build the FK nullable now, wire later). |
| **Status** | ❌ → buildable now. |
| **Blocker** | Q2 below. |

**Naming collision flagged:** two things already carry this name — `PrivateNote`
(the collector-facing RSVP) and `PrivateNoteSubmission` (a member's enquiry to
their advisor). The brief's Private Note is a third, distinct concept. I am
**not** repurposing either. See Q2.

### §6 — Artwork approval workflow

| | |
|---|---|
| **Requirement** | `Draft → Submitted → Under Review → Approved → Published`, plus `Returned for Information` and `Rejected`; admin review actions; artist visibility; nothing public before approval. |
| **Proposed implementation** | Extend `ArtStatus` with the new states, retaining `LISTED/SOLD/HIDDEN` (existing rows must keep meaning; `LISTED` maps to `Published`). A `ReviewRequest` record carries the "additional information" ask so the artist sees the actual request, not a status alone. Public visibility already funnels through a single shared condition — [`PUBLICLY_VISIBLE_WORK`](apps/vera/src/features/catalogue/queries.ts) — so the hard rule is enforced in one place and mirrored in RLS. |
| **Dependencies** | None. |
| **Status** | ⚠️ → extend, do not rebuild. |
| **Blocker** | None. |

### §7–14 — VERA data architecture

| | |
|---|---|
| **Requirement** | Many-to-many evidence graph; evidence records; evidence/inference/uncertainty as distinct concepts; gap & contradiction tracking; specialist escalation; 21-field versioned Case; named accountability; methodology versioning. |
| **Proposed implementation** | ~22 new models, junction tables throughout, no composite shortcuts. Lookup tables (`EvidenceType`, `SpecialistCategory`, `GapType`) rather than enums, per the explicit "never hard-coded enums that require redeployment". Reasoning path modelled as real edges: `Source → Evidence → (EvidenceClaim) → Claim → (ClaimAssessment) → Assessment → Gap \| Conclusion`. Case versioning by immutable `CaseVersion` snapshots — issuing a revision writes a new row and never mutates the prior one. Contradictions are first-class rows, never a field later evidence overwrites. |
| **Dependencies** | Phase 4 for note→evidence conversion. |
| **Status** | ❌ → largest single body of work in the cycle. |
| **Blocker** | Q1 must be answered first. |

The six "do not assume" constraints are treated as schema tests, not prose: I
will add integration tests that fail if the schema ever permits one evidence →
one claim, or a conclusion that overwrites an earlier one.

### §15–17 — Audit, dashboard, KPIs

| | |
|---|---|
| **Requirement** | Append-only audit of material actions; live dashboard; KPIs computed from records. |
| **Proposed implementation** | `AuditLog` and `performAudited()` already do most of §15 — extend coverage to the new VERA actions and add a database-level `REVOKE UPDATE, DELETE` on the table so append-only is enforced, not merely observed. Dashboard counts derive from live queries in one transaction (the existing `getCommandCentreData` pattern, added after a `P2028` incident — see `ISSUES.md` C4). KPIs computed on read from underlying records, with a registry so new KPIs are a config addition. |
| **Dependencies** | §7–14 for the VERA half. |
| **Status** | ⚠️ (§15) / ❌ (§16 VERA panels, §17). |
| **Blocker** | None for the non-VERA half. |

### §18–20 — Content surfaces

| | |
|---|---|
| **Requirement** | FAQ, Briefings and versioned Terms, all admin-editable without deployment. |
| **Proposed implementation** | `FaqCategory` + `FaqItem` (ordering, published flag) seeded with the six named categories. Briefings: adopt the **existing** `NewsArticle` model, extend with `subtitle/author/coverImage/sources/related`, and repoint the site at the database — the model is already there and unused. `TermsVersion` with `versionNumber`, `effectiveDate`, `status`, body; publishing a new version only ever inserts. Admin CRUD in the Command Center. |
| **Dependencies** | None. |
| **Status** | ❌ / ⚠️ (Briefings model exists). |
| **Blocker** | Content itself — but the surfaces do not wait on it. |

### §21 — Background audio

| | |
|---|---|
| **Requirement** | Loop, mute/unmute, non-blocking, session-persistent, cross-device, failure-safe, no forced autoplay, swappable asset. |
| **Proposed implementation** | Keep the existing component's correct decisions (opt-in, `loop`, labelled failure). Add: a real mute control distinct from stop, `sessionStorage` persistence, and resolution of the track through an `AUDIO_TRACK_URL` config value resolved from storage — so the final asset is a config change. Ship a short silent placeholder so every behaviour is testable now. |
| **Dependencies** | Final asset (open item 3). |
| **Status** | ⚠️ → completable now against a placeholder. |
| **Blocker** | None for the mechanism. |

### §22 — Security & permissions

| | |
|---|---|
| **Requirement** | Four roles; internal records never exposed client-side; verified by RLS tests. |
| **Proposed implementation** | Existing roles are `ADMIN/ADVISOR/ARTIST/COLLECTOR`; **`ADVISOR` is the brief's Internal Analyst** — confirm rather than rename, since renaming a live enum touches every policy. Every new table added in Phases 2–8 gets a `RLS_MATRIX` entry in the same commit that creates it, plus a negative test proving a collector and an artist each get zero rows. |
| **Dependencies** | Every other phase. |
| **Status** | ✅ today / ⚠️ must extend. |
| **Blocker** | None. |

### §23 — File storage

| | |
|---|---|
| **Requirement** | Every uploaded file linked to its record with uploader, date, original filename, type, size, confidentiality; retrievable even if the visible record changes. |
| **Proposed implementation** | One `MediaAsset` table serving artwork images, evidence documents, specialist reports and correspondence — polymorphic subject plus a `confidentiality` level. "Retrievable even if the record changes" implemented as soft-delete only: `MediaAsset` rows are never hard-deleted and the storage object outlives the visible record. |
| **Dependencies** | §4 bucket. |
| **Status** | ❌ → buildable now. |
| **Blocker** | None. |

---

## Questions raised (not assumed away)

**Q1 — Case ↔ artwork cardinality.** §5.9 forbids assuming "one artwork → one
Case", and the Case field list includes "artwork" singular. I will implement
many-to-many via a junction unless told otherwise, since that is the
non-destructive reading — but it changes the Case UI materially. *Blocks Phase 5.*

**Q2 — Which "Private Note" survives?** Three concepts now share the name. My
proposal: keep all three, name the new one `InternalNote`, and leave the existing
two untouched. Confirm. *Blocks Phase 4.*

**Q3 — Is `ADVISOR` the Internal Analyst?** If Internal Analyst is a *fifth*
distinct role, say so before Phase 5 — retrofitting a role across 56+ policies is
far cheaper decided up front.

**Q4 — Section numbering.** My §2–23 mapping above is inferred. If the brief's
own numbering differs, the response table needs re-indexing only, not rework.

---

## Derived task list — Phases 1–8

| Phase | Scope | Blocked? | Est. |
|---|---|---|---|
| **1** | Schema export, idempotent migration SQL, data-migration script, env split, `MIGRATION_RUNBOOK.md` | Execution only | M |
| **2** | Invitation model extension, admin UI (artist + collector), status model, `EmailService` abstraction + logging default | Sending only | M |
| **3** | Supabase Storage client, signed uploads, `MediaAsset`, uploader UI, validation | No | M |
| **4** | `InternalNote` + revisions + RLS; artwork approval states, `ReviewRequest`, artist-facing status | Q2 | M |
| **5** | ~22 VERA models, junctions, lookup tables, Case versioning, methodology, accountability | Q1, Q3 | **L** |
| **6** | Audit hardening (`REVOKE UPDATE/DELETE`), dashboard panels, KPI registry | After 5 | M |
| **7** | FAQ, Briefings (adopt `NewsArticle`), `TermsVersion`, admin CRUD | No | M |
| **8** | Audio completion against placeholder; RLS sweep over everything new; storage metadata verification | Asset only | S |

**Recommended order change, for approval:** §22's RLS work is listed last but is
cheapest and safest done *inside* each phase. I intend to add policies in the
same commit as each new table rather than sweeping at the end, and to keep Phase
8 as a verification pass. This does not change scope.

---

## What was not touched

Nothing was built in Phase 0. No schema change, no migration, no new dependency.
The audit is read-only; the only artefact is this document.
