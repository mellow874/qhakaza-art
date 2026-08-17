# Issues log

Things found outside the phase being worked on. Logged here rather than fixed
on the spot, so a phase is not derailed by whatever it happens to walk past.

Status: **open** unless marked otherwise.

---

## Blocked on the founder

### B1 — Supabase: which project is production?

**A Supabase project is already connected and working.** Schema, the
`qhakaza_app` role and all 56 RLS policies are applied; the seed has run and the
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

### B4 — What should appear first on the Command Center?

Currently: Verification & vetting, then Collector intake, Communications,
Private Notes, Analytics, Access & permissions, Audit trail.

That order is a **sensible default, pending founder input** — it puts the work
queues first and the reference material last. Reordering is moving JSX blocks.

### B9 - Four tables have no RLS at all

Surfaced by the Phase 1 schema snapshot (`docs/SCHEMA-SNAPSHOT.md`), which
reports RLS state per table rather than assuming it.

Eight tables have row-level security disabled. Four are expected - NextAuth's
`Account`, `Session`, `VerificationToken`, and `_prisma_migrations`. The other
four are not:

- **`User`** - the application role can read every row, including email
  addresses and bcrypt password hashes. Auth needs to look users up by email,
  so this needs a considered policy rather than a blanket one, but "no policy"
  is not the right answer.
- **`ContactMessage`** - written by the public contact form and the collector
  private-request form. Readable by anyone the app role can serve.
- **`Order`, `Favorite`** - legacy marketplace tables, retained but unprotected.

Not fixed here: Phase 1 is migration readiness, and changing policies mid-audit
would invalidate the snapshot it just produced. Belongs to section 22, where
every table gets an `RLS_MATRIX` entry. Raised now because it is a live gap in
production, not a future one.

---

### B7 — No privacy policy or terms of service

Vera's footer has linked to `/privacy` and `/terms` since the design was
transcribed. Neither route existed, so both 404'd from every page on the site —
caught by the new `links.spec.ts`, not by any earlier test.

Both now render an honest placeholder saying the document is being prepared,
marked `noindex`. The text itself is **not** written: a privacy policy and
terms of service are legal instruments describing what this business actually
does with personal data and on what terms it trades. Inventing them would state
obligations the company has not agreed to, and visitors would rely on it.

Needs: the real documents, from whoever advises Qhakaza on this. Then replace
`LegalPlaceholder` in the two routes. The collector app has no such links yet
and will need the same pair before launch.

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

### B8 - Platform is not integrated with Supabase beyond hosted Postgres

Found during the Phase 0 audit of the 14 August handover brief, which assumes
Supabase auth and storage buckets are in use. Neither is. There is no
`@supabase/supabase-js` in the monorepo; auth is Auth.js with bcrypt and JWT
against our own `User` table, and no file storage of any kind exists.

Consequence: the Supabase migration is materially smaller than the brief
describes, and native artwork upload is a from-scratch build rather than a
change to an existing integration.

Flagged for approval in `HANDOVER-RESPONSE.md` rather than worked around.

---

## Open — deferred to a later phase

### I2 — Photography is partly supplied

Six of the nine entries in
[`apps/vera/src/content/images.ts`](apps/vera/src/content/images.ts) now have
assets, plus four on the home page. The remaining three — `collector-hero`,
`collector-belief`, `collector-experience` — are still `null`, as are the
collector app's own three. `EditorialImage` renders a tinted block of the
correct dimensions, so nothing is broken or 404s.

The supplied files are named `photo-1(1).png`, `photo-3.jpg` and so on. They
work, but the parentheses and the `(1)` suffix should be renamed to something
descriptive before launch.

### I9 — Vera has no sitemap or robots.txt

The collector app serves both; Vera serves neither. Vera is the public-facing
marketing site of the two, so it is the one that wants them more. Not a bug —
nothing is broken — but it should exist before launch.

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

### C5 — Sign-up asked "I am joining as" — **fixed**

Was I1. Resolved as option (a): the role selector is gone. Vera's sign-up makes
artists and nothing else, the Collector Platform has its own sign-up that makes
collectors, and each fixes the role server-side. A crafted request naming
another role is ignored — tested on both sites.

### C6 — Six placeholder pages — **fixed**

Was I3. `/browse`, `/artists`, `/artists/[slug]` and `/art/[id]` are now real
catalogue pages reading from the database through `PUBLICLY_VISIBLE_WORK`, so
nothing unreleased or unapproved can reach them. `/forbidden` is a proper
page rather than a scaffold, and `/artist/dashboard` became the artist's studio.
`PhaseZeroStub` is deleted — there is nothing left for it to render.

### C7 — Artists could not submit artwork — **fixed**

Was I4. `/artist/work/new` saves a work as DRAFT against the signed-in artist's
profile. Release stays with the Command Center: there is deliberately no path
from the form to LISTED. Images are URLs, not uploads — no storage provider is
configured.

### C8 — Every briefing link 404'd — **fixed**

Was I5. `/briefings/<slug>` now exists and is prerendered from the content list.
The article bodies were never supplied, so the page shows the excerpt we have
and says the full text is being prepared rather than inventing market claims.
`links.spec.ts` on Vera now walks every internal link and opens every briefing,
so this class of bug fails the build instead of shipping.

### C9 — Two competing "Request Access" flows — **fixed**

The merge brought a second request form. Both were kept briefly, then resolved
on the founder's instruction: the general private request form
(`/collectors/request` → `ContactMessage`) is the one, and the gated
`/collectors/request-access` flow was removed along with its action, schema,
form and tests. `CollectorIntakeKind.ACCESS_REQUEST` stays in the schema
because rows written by the old form still carry it.
