# Issues log

Things found outside the phase being worked on. Logged here rather than fixed
on the spot, so a phase is not derailed by whatever it happens to walk past.

Status: **open** unless marked otherwise.

---

## Blocked on the founder

### B1 — Supabase: which project is production?

**A Supabase project is already connected and working.** Schema, the
`qhakaza_app` role and all 53 RLS policies are applied; the seed has run and the
three apps use it.

The brief asks for a _new_ database created by the founder to migrate onto. That
is a decision, not a task: nothing needs rebuilding, only re-pointing.

To migrate, all that is needed is:

1. The new project created, and its **two** connection strings shared securely
   (direct/session on 5432, transaction pooler on 6543 — see `docs/SUPABASE.md`).
2. `prisma migrate deploy` against it — creates schema, role and policies.
3. `ALTER ROLE qhakaza_app WITH PASSWORD …` — the migration uses a default.
4. Seed, or create the first admin by hand.
5. Update three Vercel projects' env vars.

Roughly ten minutes once the credentials exist. **Nothing is blocked in the
meantime** — development and testing continue against the current project, and
E2E runs against a local database regardless.

⚠ The current project's credentials were briefly pasted into `.env.example`, a
committed file. Caught before any commit, so they never reached git — but if
that project is superseded anyway, rotating its password costs nothing.

### B2 — FAQ page has no content

`/faq` renders an honest empty state. `faqs` in
[`apps/vera/src/content/faq.ts`](apps/vera/src/content/faq.ts) is an empty array
because the supplied design showed the accordion's dividers but no legible text.

Needs: the actual questions and answers, or a decision to drop the page.
Answers about pricing, subscriptions or regulatory status are factual claims
about the business and will not be invented.

### B3 — Background music for the Private Note

No audio file exists anywhere in the repo. The player is built and renders a
clearly-labelled unavailable state.

Needs: the track. Drop it in `apps/collector/public/audio/` and set
`privateNote.audio.src` — nothing else changes.

### B4 — What should appear first on the Command Center?

Currently: Verification & vetting, then Collector intake, Communications,
Private Notes, Analytics, Access & permissions, Audit trail.

That order is a **sensible default, pending founder input** — it puts the work
queues first and the reference material last. Reordering is moving JSX blocks.

### B5 — Provisional financial bands

Two sets of money bands are stand-ins, not Qhakaza's segmentation, and are
marked `⚠ PROVISIONAL` in code:

- Collector intake: income and liquid-asset bands
  ([`content/collectors.ts`](apps/collector/src/content/collectors.ts))
- Private Note: budget band
  ([`content/private-note.ts`](apps/collector/src/content/private-note.ts))

Needs: the real bands before either form is shown to a real applicant.

### B6 — Is "Private Note" the same as core entity #8?

The canonical 13 entities include `PrivateNoteSubmission`. In Phase 3 of the
earlier brief that was built as a _member-to-advisor enquiry_, from the name
alone — no design existed.

The founder's Private Note is an RSVP survey from a **prospect**, who has no
membership for that entity to point at. It is therefore a **separate table**
(`PrivateNote`), so nothing already working was repurposed.

Needs: confirmation these are two concepts. If they are one, they should be
merged deliberately rather than by side effect.

---

## Open — deferred to a later phase

### I1 — Sign-up asks "I am joining as"

The Vera sign-up form offers an Artist/Collector choice. The new brief says
sign-in should identify the user **simply as an artist**.

These conflict for a real reason: a collector needs an account **before** they
can open an invitation to `/private/<token>`, and Vera is the only site with
public sign-up.

Options: (a) drop the choice on Vera and give the Collector Platform its own
sign-up; (b) keep it. Needs a decision — see the Phase 0 report.

### I2 — Photography is entirely placeholder

All 9 entries in [`apps/vera/src/content/images.ts`](apps/vera/src/content/images.ts)
are `null`. `EditorialImage` renders a tinted block of the correct dimensions,
so nothing is broken or 404s — but no real photograph is present anywhere on
Vera. The collector app's three images are the same.

### I3 — Six placeholder pages remain

`PhaseZeroStub` renders a title and nothing else on:
`/browse`, `/artists`, `/artists/[slug]`, `/art/[id]`, `/artist/dashboard`
(Vera), plus `/forbidden` which is legitimately minimal.

`/artist/dashboard` is the significant one: an artist can sign in and complete a
profile, then lands on a placeholder.

### I4 — Artists cannot submit artwork through the UI

The Command Center can vet and release artwork, and the pipeline is tested — but
there is no artwork submission form in Vera. Work has to be created directly in
the database.

### I5 — Individual briefing articles 404

`/briefings` lists articles linking to `/briefings/<slug>`, which does not
exist. Only excerpts were supplied, never article bodies.

### I6 — No email anywhere

Invitations are shown on screen for an operator to copy. Contact messages,
intakes and Private Notes are stored and never sent. No provider is configured.

### I7 — No rate limiting

Public forms and `/private/<token>` accept unlimited attempts. Failed
activations are recorded but not slowed.

### I8 — Analytics tables are never written

`AnalyticsEvent` and `DailyMetric` have no writer, so those Command Center
panels are honestly empty rather than showing invented figures.

---

## Closed

### C1 — Three collector CTAs all led to `/collectors/apply` — **fixed**

Eleven separate literals all hardcoded the same destination. Now three distinct
routes. See the Phase 0 report.

### C2 — Four dead links in the collector shell — **fixed**

`Suite`, `Pricing`, `Private Experiences` and `Artists` all 404'd.
`links.spec.ts` now walks every internal link and fails if any does.

### C3 — Prisma client never generated on deploy — **fixed**

Vercel builds failed with `Can't resolve '@prisma/client'`. Now generated by
both a root `postinstall` and each app's `build`.

### C4 — Command Center opened seven concurrent transactions — **fixed**

Loading the console opened one interactive transaction per query, exhausting a
pooled connection and failing with `P2028`. Now one transaction for the page.
