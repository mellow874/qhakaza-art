# Phase 0 audit — Artist Intelligence Platform depth

Audited at `5cd262d`. Every claim checked against the schema, not recalled.

---

## Correction to the brief's open items

**Open item 1 says the Qhakaza-owned Supabase project and credentials are still
pending. They are not.** The migration was executed on 17 August (`770b31a`).

The platform runs on the Qhakaza-owned project `iupgwxjesitqkhvsymfj` in
`eu-central-1`; all data was migrated and verified, and the previous
developer-owned database has since been deleted by the founder. No credential
or access is outstanding, and nothing in this phase is waiting on it.

Flagging rather than silently ignoring, because a stale blocker on a status
report costs someone a conversation.

---

## The central finding

**The tables VERA needs already exist. Nothing connects an artist to any of
them.**

The previous cycle built `Source`, `Exhibition`, `Publication`,
`ProvenanceTransaction` and `Party` as first-class entities. An `Artist` today
relates to exactly two things: its `artworks` and its `permissions`.

Every junction built so far hangs off **Artwork** or **Evidence** —
`ArtworkExhibition`, `ArtworkParty`, `ArtworkPublication`, `EvidenceSource`.
There is no `ArtistExhibition`, no artist-level source reference, no
representation link.

So the work of Phase 1 is mostly **connective, not inventive**. The temptation
this audit exists to head off is building a second, artist-shaped copy of
`Exhibition` or `Source` — which is precisely the duplication Phase 3 forbids.

---

## Architectural defects

### D1 — A document can only belong to one record

`MediaAsset` addresses its owner with a single `subjectType` + `subjectId`
pair. One document, one record.

Phase 5 requires the opposite: *"A document may link to more than one record (a
catalogue evidencing both an artist's exhibition and a work's provenance)."*
Phase 3.6 names it explicitly as an assumption not to build.

I built this in the previous cycle, and it was the wrong shape for where the
platform was always going. It needs a `DocumentLink` join table; the existing
column pair can stay and be backfilled, so nothing breaks.

### D2 — `MediaAsset` has no document type

It records filename, MIME type and size, but not what the document *is* — a
certificate, a condition report, a catalogue, correspondence. Phase 5 requires
a typed taxonomy, configurable from admin.

### D3 — Provenance cannot represent a gap

`ProvenanceTransaction` holds `fromParty`, `toParty`, a date and an amount. It
cannot say "the chain is unknown between 1992 and 2018", which Phase 2 requires
to be *representable rather than hidden*. It also carries no verification
status, no ordering, and no link to the source that evidences it.

### D4 — Declared pricing is overwritten

`Artwork.price` is a single column. Changing a price destroys the previous one.
Phase 1 requires historic values retained.

### D5 — No claim can cite a source

`Source` exists but only `Evidence` can reference it. Nothing on an artist or
artwork record can be linked to the source that supports it, which is the hook
Phase 1 calls "the VERA hook — build it properly".

---

## Field-by-field gap table

### Phase 1 — the artist record

| Field | State | Where it stands |
|---|:--:|---|
| Artist biography | ❌ | Only `Artist.statement` exists. No internal/public split |
| Artist statement | ✅ | `Artist.statement`, artist's own words, preserved verbatim |
| Artistic practice | ❌ | — |
| Primary mediums | ❌ | `Artwork.medium` is a free string per work; the artist has none, and there is no configurable medium list |
| Exhibitions | ⚠️ | `Exhibition` table exists with `ArtworkExhibition`. **No artist link**, no curator, catalogue reference, type or verification status |
| Representation | ⚠️ | `Party` can hold a gallery; `ArtworkParty` links it to a work. **No artist-level representation**, no territory or dates |
| Curriculum vitae | ❌ | No structured entries, no CV upload |
| Institutional signals | ❌ | — |
| Portfolio information | ❌ | — |
| Artwork documentation | ⚠️ | `MediaAsset` exists but is untyped (D2) and single-subject (D1) |
| Provenance information | ⚠️ | `ProvenanceTransaction` exists at artwork level; cannot express gaps (D3) |
| Supporting documents | ⚠️ | As above |
| **Source references** | ❌ | `Source` exists but nothing on an artist or artwork can cite it (D5) |
| Declared pricing | ⚠️ | `Artwork.price` present, overwritten on change (D4). No artist-level positioning |
| Artist readiness | ❌ | No assessment, no configurable criteria |
| Submission history | ⚠️ | `AuditLog` records transitions and `ArtworkReviewRequest` records questions. Not assembled into a per-artist history |
| Qhakaza review comments | ✅ | `InternalNote` + `InternalNoteRevision`, staff-only, edit history preserved |
| Review status | ✅ | `ArtStatus` (12 states) for work; `Artist.approved` for the artist |
| Permissions | ✅ | `ArtistPermission`, 7 kinds, enforced in RLS |

### Phase 2 — the artwork record

| Field | State | Where it stands |
|---|:--:|---|
| Existing: title, description, medium, dimensions, price, images | ✅ | Retained |
| Supporting documentation | ⚠️ | `MediaAsset`, untyped (D2) |
| Provenance chain | ⚠️ | Exists, cannot express gaps or verification (D3) |
| Source references | ❌ | D5 |
| Qhakaza review information | ✅ | `InternalNote`, `ArtworkReviewRequest` |
| Review status | ✅ | `ArtStatus` |
| Permissions | ✅ | `ArtistPermission` supports per-artwork rows |

**Totals: 6 exist, 8 partial, 8 missing.**

---

## Phase 4 — what is already in place

The brief asks this be confirmed so Phase 4 extends rather than rebuilds. It is
substantially built:

| Requirement | State |
|---|:--:|
| Permission types | ⚠️ 7 exist. The brief names **use internally** and **retain documentation** — the second exists, the first does not |
| Per-artist and per-artwork capture | ✅ `artworkId` nullable; a work-specific row is intended to win |
| Granted/denied, date, confirming action | ✅ |
| Scope limits and expiry | ❌ Missing |
| **More restrictive wins on conflict** | ❌ **Not implemented.** Current SQL is `artworkId IS NULL OR artworkId = id` — an artist-wide grant satisfies it even where a work-specific row denies. A real defect, listed as D6 below |
| Approval is not publication | ✅ Three distinct states, enforced |
| RLS enforcement | ✅ 247 policies; visibility runs through `SECURITY DEFINER` functions |
| Adversarial tests | ✅ 17 in `visibility.db.test.ts` |
| Public projection as a whitelist | ⚠️ `PUBLIC_WORK_FIELDS` is an explicit whitelist for artwork. No equivalent for the artist record |

### D6 — a work-specific denial does not override an artist-wide grant

`qhakaza_collector_sees_artwork` accepts any granted row where
`artworkId IS NULL OR artworkId = work_id`. If an artist grants sharing
generally but denies it for one work, the general grant still satisfies the
check and the work is shown.

Phase 4.1 requires the more restrictive to win. This is a live permission bug,
not a future requirement, and it is the first thing to fix.

---

## Derived task list

**Phase 1a — fix the defects before building on them**
1. D6, the permission conflict rule — a live bug.
2. D1, `DocumentLink` so a document can evidence several records.
3. D2, document types as a configurable table.
4. D5, `SourceReference` linking any record to a `Source`.

**Phase 1b — connect the artist to what already exists**
5. `ArtistExhibition`, `ArtistRepresentation` joining to `Exhibition` / `Party`.
6. `CvEntry` and `InstitutionalSignal` as child records.
7. Configurable lists: mediums, exhibition types, signal types, source types,
   document types, readiness criteria.
8. Artist biography, practice, internal/public split.
9. `DeclaredPrice` as append-only history (D4).
10. `ReadinessAssessment`, append-only, against configurable criteria.

**Phase 2** — provenance gaps and verification (D3); typed artwork
documentation; source references on artwork claims.

**Phase 3** — `VERA_READINESS.md` recording the decisions above.

**Phases 5–8** — documents, admin surfaces, artist experience, QA.

---

## Questions logged

**Q1 — Does the artist see their own biography split?** The brief suggests
separate internal and public biographies. Confirm the artist writes one and
Qhakaza curates the public version, rather than the artist maintaining two.

**Q2 — Is readiness ever visible to the artist?** The brief says internal-only.
Confirmed as absolute? An artist asking "am I ready" is a fair question, and
the answer shapes whether the field is written defensively.

**Q3 — Should `use internally` be added as an eighth permission?** If storing
material already implies internal use, the two collapse. If not, they are
different and I will add it.
