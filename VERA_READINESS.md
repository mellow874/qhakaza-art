# VERA readiness

What the artist and artwork records now hold, and how VERA reaches it without
re-declaring anything.

The requirement this document answers: **VERA must be able to operate on these
records without duplicating them.** Every decision below was taken with that as
the test, and where the existing schema failed it, the schema changed rather
than VERA being asked to work around it.

---

## The one-line summary

Artists, artworks, exhibitions, parties, publications, sources and documents are
now a single connected graph. VERA does not need a table of its own for any of
them. What VERA adds on top — evidence, claims, assessments, gaps,
contradictions, Cases — already exists and already points at these records.

---

## How VERA reaches each thing

| VERA needs | It reads | Notes |
|---|---|---|
| An artist | `Artist` | Now carries biography (internal and public), practice, base, nationality, birth year |
| What they work in | `ArtistMedium` → `Medium` | Configurable list, not free text |
| Where they have shown | `ArtistExhibition` → `Exhibition` | **The same `Exhibition` rows artworks link to** |
| Who represents them | `ArtistRepresentation` → `Party` | **The same `Party` rows that appear in provenance** |
| Their CV | `CvEntry` → `CvEntryType` | Structured lines, not an uploaded PDF |
| Institutional recognition | `InstitutionalSignal` → `SignalType`, `Party` | |
| Their presence elsewhere | `ArtistLink` | Replaces the unverifiable `socials` JSON |
| Declared value over time | `DeclaredPrice` | Append-only. `Artwork.price` is the current figure |
| Readiness | `ReadinessAssessment` → `ReadinessRating` → `ReadinessCriterion` | Append-only, staff-only, never the artist's to read |
| An artwork | `Artwork` | Unchanged |
| Its provenance | `ProvenanceTransaction` | Now ordered, typed and able to carry gaps |
| Its documents | `MediaAsset` → `DocumentLink`, `DocumentType` | One document may serve several records |
| What supports a claim | `SourceReference` → `Source` | Anything may now cite a source |
| What changed, and when | `RecordChange` | Field-level, append-only |

---

## The five decisions worth recording

### 1. Exhibitions and parties are joined, not copied

The Phase 0 audit's central finding was that `Exhibition`, `Party`,
`Publication` and `Source` already existed as first-class entities, and that
**every junction hung off `Artwork` or `Evidence`** — nothing connected an
artist to any of them.

The obvious shortcut was an `ArtistExhibitionHistory` table with the venue and
dates written into it. That would have been faster and would have meant the
same gallery existed as a `Party` row for provenance and as a string on the
artist record, drifting apart from the moment either was edited.

`ArtistExhibition` and `ArtistRepresentation` are therefore **junctions to the
existing rows**. A gallery is one `Party` whether it is representing the artist
or selling the work, which is why `Party` was one table to begin with.

### 2. A document belongs to as many records as it evidences

`MediaAsset` addressed exactly one owner through `subjectType`/`subjectId`. The
brief's own example breaks that: an exhibition catalogue evidences both the
artist's exhibition history and a work's provenance. Under the old shape that
meant the same PDF uploaded twice.

`DocumentLink` now carries the attachments, with a `role` per link — the same
catalogue is "exhibition record" on one and "provenance support" on another.
The original columns remain and were backfilled as the primary link, so nothing
that read them broke.

### 3. Provenance gaps are rows in the chain

`ProvenanceTransaction` could only say "A sold to B on a date". Real provenance
is mostly not that: it has periods where custody is unknown, transfers that are
asserted and contested, and links resting on one unverified source.

A table that can only express clean transfers forces the incomplete parts to be
left out — **and a chain with its gaps silently omitted reads as complete.**
That is the failure that matters, because a collector relies on it.

`ProvenanceLinkKind` adds `UNKNOWN_INTERVAL`, `DISPUTED_TRANSFER` and
`RETAINED` alongside `TRANSFER`, with `periodStart`/`periodEnd` for the boundary
of a gap and `sequence` for explicit ordering. A gap is a row **in** the chain
rather than a separate table, so the chain stays one ordered sequence.

### 4. What is true is separate from who said it

Every asserted fact carries two independent fields:

- `verification` — `UNVERIFIED`, `ARTIST_DECLARED`, `DOCUMENT_ON_FILE`,
  `INDEPENDENTLY_VERIFIED`, `UNABLE_TO_VERIFY`, `DISPUTED`
- `assertedVia` / `assertedById` — whose account it is

Deliberately not a boolean. **"We have not looked" and "we looked and could not
confirm" are different states**, and an intelligence product that cannot tell
them apart misleads in the direction that matters. `DISPUTED` exists so a
contested fact is preserved rather than quietly dropped.

### 5. History is append-only at the grant level

`DeclaredPrice`, `ReadinessAssessment`, `ReadinessRating` and `RecordChange`
have `UPDATE` and `DELETE` revoked from `qhakaza_app`, not merely un-granted by
policy. A price that can be edited is not a pricing history; an assessment that
can be rewritten is not a record of what was decided.

Withdrawing a claim is a `removedAt` timestamp on the artist's child tables, not
a delete — a claim that was made and later retracted is itself part of the
record, and a row that can vanish cannot be reconciled against an assessment
that relied on it.

---

## What VERA still has to build

Nothing structural. The remaining work is VERA's own, and the brief
deprioritises it for this phase:

- Case production workflow and issued Case versions (`IntelligenceCase`,
  `CaseVersion` exist; the workflow does not)
- Automated evidence gathering
- Specialist referral routing

---

## What is deliberately absent

**`ReadinessCriterion` is seeded empty.** The readiness framework is Qhakaza's
own intellectual property; the platform applies it and does not author it.
Criteria invented by a developer would look authoritative and be worthless. The
admin screen says so rather than presenting the emptiness as a fault.

**No readiness score is computed.** Ratings are labels, never numbers, because
numbers invite averaging and an averaged readiness score is a finding nobody
made.

**Readiness is never visible to the artist.** Confirmed as absolute. Enforced by
the absence of an `artist` grant on `ReadinessAssessment`, `ReadinessRating`
**and `ReadinessCriterion`** — the criteria are excluded too, because a list of
what an artist is judged on is most of the assessment.

---

## One thing to watch

**RLS is row-level, not column-level.** The public may read an approved
`Artist` row, and that row contains `biographyInternal`. It is kept out of
public output by the explicit field whitelist in the catalogue queries, not by
the policy.

Any new public read of `Artist` must select fields explicitly. There is a test
asserting the current ones do; a new query is not covered by it until it is
added.
