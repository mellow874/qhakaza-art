# Testing

Every phase ends with the full suite green. Nothing moves forward on red.

## Running

| Command                                | What it runs                               |
| -------------------------------------- | ------------------------------------------ |
| `npm test`                             | Both Vitest projects                       |
| `npx vitest run --project unit`        | Logic + component tests only (no database) |
| `npx vitest run --project integration` | Server actions against the test database   |
| `npm run test:watch`                   | Vitest in watch mode                       |
| `npm run test:e2e`                     | Playwright E2E (builds and serves the app) |
| `npm run typecheck`                    | `tsc --noEmit`                             |
| `npm run lint`                         | ESLint                                     |
| `npm run test:all`                     | typecheck → unit → E2E                     |

**Postgres must be running** (`npm run db:up`) for the integration and E2E
suites. Playwright needs its browser once: `npx playwright install chromium`.

## How the suites are split

| Project       | Env   | Files              | Needs Postgres |
| ------------- | ----- | ------------------ | -------------- |
| `unit`        | jsdom | `*.test.ts(x)`     | no             |
| `integration` | node  | `*.db.test.ts`     | yes (`:5433`)  |
| Playwright    | —     | `tests/e2e/*.spec` | yes (`:5432`)  |

The `.db.test.ts` suffix makes it obvious at a glance which tests need a
database. Integration tests run against the **test** instance on `:5433` and
`resetDb()` wipes it before each test; `vitest.setup.integration.ts` refuses to
run if `TEST_DATABASE_URL` does not point there, so they can never touch dev data.

## Conventions

- Unit and component tests live **next to the code they test** (`foo.ts` → `foo.test.ts`).
- E2E specs live in `tests/e2e/`.
- Tests describe **behaviour** — what a user sees and can do, who is allowed in,
  what happens on bad input — not internal implementation.
- Red → green → refactor. The failing test is written and run before the
  implementation exists.
- **E2E tests never depend on seed data.** Each one gets its own user from the
  fixtures in `tests/e2e/fixtures.ts`, created before and deleted after. Sharing
  a seeded account made tests race as soon as one of them wrote to it.
- Playwright runs on its own port (`4319`) with `reuseExistingServer: false`, so
  a dev server from another project can never be tested by mistake — that
  happened, and a pathname-only assertion let it pass silently.

### If the whole suite fails with `Timed out waiting … from config.webServer`

Almost always an **orphaned server still holding port 4319** — left behind when a
previous run was killed or timed out. Because `reuseExistingServer` is off,
Playwright starts its own, hits `EADDRINUSE`, and then waits for a health check
that never passes. The build itself takes roughly four minutes on a slow machine,
well inside the ten-minute budget, so a webServer timeout is rarely about speed.

```powershell
Get-NetTCPConnection -State Listen -LocalPort 4319 |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

## Coverage log

### `src/lib/auth/rbac.test.ts` — 21 tests

Pure authorisation rules, no framework dependencies.

- `requiredRoleForPath` fences `/artist/**` → ARTIST, `/collector/**` → COLLECTOR,
  `/admin/**` → ADMIN, and leaves public paths unfenced.
- Prefix matching respects segment boundaries: `/artists` (public storefront index)
  is **not** captured by the `/artist` fence; nor is `/administrators` by `/admin`.
- `isPublicPath` for home, browse, art detail, storefronts, login, signup.
- `authorize` returns: allow for public routes; login redirect **carrying a
  callbackUrl** for anonymous visitors; `/forbidden` for the wrong role.
- Each role is allowed into its own area and rejected from both others —
  including ADMIN, which is deliberately _not_ a superuser over artist and
  collector surfaces.

### `src/lib/auth/access.test.ts` — 15 tests

The glue between the session and the edge proxy.

- `roleFromSession` extracts a valid role, and returns `null` for a missing
  session, a missing role, or an unrecognised role string (e.g. `SUPERUSER`) —
  so a tampered token cannot escalate.
- `applyAccessRules` produces a 200 pass-through for allowed requests and a 307
  redirect otherwise, with the right `Location` for every role/area combination.
- Redirects are resolved against the request URL, so they cannot be pointed
  off-origin.

### `src/lib/validation/art.test.ts` — 17 tests

- `artPieceDraftSchema`: a title alone is enough to save a draft; whitespace-only
  titles are rejected; titles are trimmed.
- `artPieceListedSchema`: **a piece cannot be listed with missing required
  fields** — description, images, medium, dimensions and price are each proven to
  fail individually, with the error reported on the right field.
- Empty image arrays, non-positive prices and prices with more than two decimal
  places are rejected.
- Prices arriving from a form as strings are coerced to numbers.
- Unsupported currencies rejected.
- Non-https image URLs (including `javascript:`) rejected.
- `artPieceSchemaForStatus` picks the lenient schema for DRAFT/HIDDEN and the
  strict one for LISTED/SOLD — this is the rule that blocks the DRAFT → LISTED
  transition on an incomplete piece.

### `src/lib/validation/user.test.ts` — 12 tests

- `signUpSchema`: valid sign-up accepted; email trimmed and lowercased;
  malformed email rejected; passwords under 8 characters rejected; role defaults
  to COLLECTOR; **self-registering as ADMIN is rejected**.
- `credentialsSchema`: email + password required.
- `artistProfileSchema`: display name required; socials must be full URLs;
  statement and socials optional.

### `src/features/artist-profile/slug.test.ts` — 10 tests

- `slugify` lowercases, hyphenates, strips punctuation, folds accents to ASCII
  (`Zoë Müller` → `zoe-muller`), collapses separator runs, keeps digits, caps
  length, and falls back to `artist` when nothing usable survives.
- Apostrophes are dropped rather than turned into separators, so `Sipho's Studio`
  becomes `siphos-studio`, not `sipho-s-studio`.
- `uniqueSlug` returns the base slug when free and otherwise counts up
  (`-2`, `-3`…), asking about the base first.

### `src/features/artist-profile/actions.db.test.ts` — 18 tests (needs Postgres)

Real database, real Prisma. The session is mocked so each test decides who is asking.

- **Authorisation**: anonymous, COLLECTOR and ADMIN callers are all rejected and
  write nothing; a session whose user no longer exists is rejected too. The role
  is re-read from the database, not trusted from the JWT.
- **Creating**: the profile is written for the signed-in artist, the slug is
  derived from the display name, and collides safely when another artist already
  holds it.
- **Approval cannot be self-granted** — a new profile is always unapproved, an
  `approved: true` smuggled into the payload is ignored, and an already-approved
  artist does not lose approval by editing.
- **Updating**: a second save updates rather than duplicating, and the slug is
  **not** regenerated when the display name changes — it is a public URL.
- **Cross-artist access fails**: saving as one artist leaves another artist's
  profile untouched.
- **Validation**: an empty display name or a non-URL social link is rejected with
  a field error and nothing is written.
- `getMyArtistProfile` returns null before onboarding and only ever the caller's
  own profile.

### `src/features/artist-profile/artist-profile-form.test.tsx` — 14 tests

- Empty state: the right fields, optional ones marked as such, empty for a new artist.
- Edit state: fields prefilled, and the action reads "Save changes" rather than "Continue".
- Validation: will not submit without a display name; rejects a non-URL social
  link; the error is wired to the field with `aria-describedby` so it is
  announced, not merely displayed; the error clears once corrected.
- Submission: values are trimmed, blank optional fields are omitted entirely
  rather than sent as `''`, and only filled-in social links are included.
- In-flight: the button disables and announces progress, a second submit while
  saving does nothing, and a second save is allowed once the first finishes.
- Server-side field errors and outright failures both surface, and the form stays
  usable after a failure.

### `src/features/auth/login-form.test.tsx` — 12 tests

- Renders email and password fields; the password is not readable text.
- Refuses to submit without a valid email or a password.
- Calls the credentials provider with `redirect: false` so failures stay on the
  page, then navigates to the callback URL — or `/` when none was given.
- Rejected credentials show one deliberately vague message ("that email or
  password is incorrect") that does **not** reveal whether the account exists,
  and no navigation happens.
- Progress is shown while signing in; the form is usable again after a failure.
- Google is offered as an alternative.

### `src/lib/format/money.test.ts` — 7 tests

- Rands format with the symbol and space thousands separators (`R18 500`).
- Whole amounts drop the decimals; amounts with cents keep them.
- Accepts the string form Prisma `Decimal` serialises to, as well as numbers.
- USD and GBP format in their own conventions.
- Zero formats as `R0` rather than rendering nothing; an unreadable value gives `—`.

### `src/features/home/queries.db.test.ts` — 15 tests (needs Postgres)

The rules governing what the public may see.

- Only LISTED work surfaces — DRAFT, SOLD and HIDDEN are each proven excluded.
- **Work by an artist awaiting approval is hidden**, even when the piece itself
  is LISTED, and the approved artist's work still shows when both kinds exist.
- Newest first; a default cap of 8; an explicit limit is honoured.
- The artist is included so a card can credit the work.
- Empty results return `[]` rather than throwing.
- `getFeaturedArtists` returns approved artists **who have work available**,
  excludes those awaiting approval, skips empty storefronts (a dead end for a
  collector), and counts only LISTED pieces.

### `src/features/home/art-card.test.tsx` — 7 tests

- Title, artist, medium and formatted price all render; the card links to the
  piece and the artist to their storefront.
- **The card exposes one link to the piece, not two** — the image link is
  `aria-hidden` and untabbable, so a screen reader hears it once.
- The cover image is decorative (the adjacent title names the work).
- A piece with no image renders a placeholder instead of collapsing the grid.
- Prices carrying cents format correctly.

### `src/features/home/featured-works.test.tsx` — 5 tests

- One card per piece; a link through to the full gallery.
- An explicit empty state, with **no dead-end gallery link** when there is
  nothing to show.
- Exposed as a titled landmark region.

### `src/features/home/panels.test.tsx` — 7 tests

The two data-shaped panels on the home page.

- Every Sx Score metric renders with its code and value.
- **Each score is exposed as a `meter` with `aria-valuenow`**, so the number is
  available to assistive tech rather than living only in a bar's width, and each
  meter is named in full ("documentation strength"), not just by abbreviation.
- The overall score and its band render.
- The platform-preview record is **labelled as an example**, so it is not
  mistaken for live data, and lists each work with reference, score and status.

### `src/features/how-it-works/process-steps.test.tsx` — 6 tests

- Every step renders, in the order given, with its title and body.
- **Marked up as an ordered list**, because the sequence is the meaning.
- The printed numerals are visible but carry `aria-hidden` — the `<ol>` already
  conveys position, so exposing them would have a screen reader announce it
  twice.
- An empty list of steps renders nothing rather than throwing.

### `src/features/platform-features/feature-grid.test.tsx` — 5 tests

- Every feature renders with a heading and its description.
- Grouped as a list, so the count is announced.
- **The icons are `aria-hidden`** — each one restates the heading beside it, so
  announcing it adds nothing. Asserted on every icon, not just the first.
- An empty list renders nothing rather than throwing.

### `src/features/briefings/briefing-card.test.tsx` — 4 tests

- Category, title, excerpt and date render; the title links to the article.
- **One link per card, not two** — the image links for the mouse but is hidden
  from assistive tech, so the article is announced once.
- The date is a machine-readable `<time datetime>`.

### `src/features/faq/faq-accordion.test.tsx` — 8 tests

- Every question renders as a real `<button>` with `aria-expanded`.
- All answers start collapsed; activating a question opens it, activating it
  again closes it, and only one is open at a time.
- **Operable by keyboard** — tab to the first question, press Enter, it opens.
- Each question's `aria-controls` points at the panel that holds its answer.
- An empty list renders nothing rather than throwing.

### `src/features/contact/contact-form.test.tsx` — 11 tests

- All four fields render and are marked required.
- Validation: an empty form, a malformed email and a too-short message are each
  rejected without calling the server.
- Values are trimmed and the email lowercased before submission.
- On success the form is replaced by a `role="status"` confirmation.
- No second submission while one is in flight; the form stays usable after a
  failure; server-side field errors surface.

### `src/features/contact/actions.db.test.ts` — 9 tests (needs Postgres)

- A valid enquiry is recorded, with the email normalised so replies are not
  lost to casing.
- New enquiries are stored unhandled, and **a `handled: true` smuggled into the
  payload is ignored** — that flag belongs to whoever triages the inbox.
- A bad name, email, subject or message is rejected with a field error and
  **nothing is written**.
- More than one enquiry can be recorded.

### `src/features/collectors/intelligence-card.test.tsx` — 10 tests

The recurring unit of the collector suite, used for both artist and artwork records.

- Record kind, standing badge, subject and detail line all render.
- **Every label is paired with its value**, asserted positionally against the
  source data, and marked up as a `<dl>` — these are attributes of one subject,
  not a grid of records.
- Supporting signals and the intelligence note render when present, and are
  omitted entirely when the record has none.
- **The standing badge stays distinguishable from a row that repeats its
  wording** — an artwork can be "Available" both as its standing and as its
  certificate value, so the badge lives in a `<header>`.

### `src/components/site-header.test.tsx` — 12 tests

- Signed out: the wordmark links home, all six main destinations resolve to the
  right paths, both sign-in and the suite CTA appear, and no account link does.
- Current page: the active destination carries `aria-current="page"`. **Home is
  matched exactly**, not by prefix — otherwise `/` would mark itself current on
  every page in the site.
- Signed in: each role gets its own destination — artist → dashboard, collector →
  favourites, admin → admin — and the sign-in link disappears.
- Mobile menu: starts closed, toggles open and shut, and `aria-controls` points
  at an element that actually exists.

### `tests/e2e/marketing.spec.ts` — 29 tests (per browser project)

The public marketing pages. Static content, read-only.

**Home** — loads for an anonymous visitor; all five section headings render;
the framework line is marked up as a real `blockquote`; the Sx Score meters
expose their values; **the page is server-rendered** (the markup contains the
hero copy and Open Graph tags when fetched without a browser); briefings link to
their articles; the closing CTA reaches the suite and the about page.

**About** — loads for an anonymous visitor; the position statement and its pull
quote render; **exactly one `h1`**; the closing CTA links out; reachable from the
main navigation, and marked `aria-current` once there.

**How it works** — loads for an anonymous visitor; **all seven steps present and
in order**, first `Sign Up`, last `Track Progress`; the process is a real `<ol>`;
step detail renders; the CTA links out; reachable from the navigation and marked
current; no sideways scroll at 390px.

**Features** — loads for an anonymous visitor; **all six features present**, each
named and carrying its detail; the CTA renders and links out; reachable from the
navigation and marked current; no sideways scroll at 390px.

**Briefings** — loads for an anonymous visitor; both briefings listed with their
categories and dates; each links to its article; reachable from the navigation
and marked current.

**FAQ** — loads for an anonymous visitor; the closing band offers **both** a
contact route and a sign-up route.

**Contact** — loads for an anonymous visitor; the enquiries address is a real
`mailto:` link; all four form fields and the submit button render; an incomplete
enquiry is refused; **a complete enquiry is accepted and confirmed** (this one
writes a row, using a unique email per run).

**Chrome** — the footer groups links under headed `Platform` / `Company` /
`Legal` navigations; the header offers both sign-in and the suite; and **the page
does not scroll sideways at 390px**, checked by comparing `scrollWidth` against
`clientWidth`.

### `tests/e2e/collectors.spec.ts` — 10 tests (per browser project)

The Collector Intelligence Suite landing page.

- Loads for an anonymous visitor with the right `h1`; all six sections present.
- All six membership benefits render; both intelligence records show their
  evidence — price range, pricing context, risk note, suggested step.
- **The collector navigation is its own** — Suite / About / Membership /
  Pricing / Apply — and the artist site's items are asserted _absent_, so the
  two sub-brands cannot bleed into each other.
- Footer groups links under Suite / Discover / Access; every CTA leads to the
  intake.
- **The theme flip is verified by measurement**: computed background luminance
  is < 40 on the artist site and > 200 on the collector suite. A class-name
  assertion would pass even if the tokens never applied.
- Server-rendered; no sideways scroll at 390px.

### `tests/e2e/collectors-methodology.spec.ts` — 6 tests (per browser project)

`/collectors/methodology` — the five-step sequence.

- All five steps render, **in order**, asserted as a list of `h2` text rather
  than five independent visibility checks; order is part of the content here.
- **The "01"–"05" ordinals are asserted `aria-hidden`.** The `<ol>` already
  conveys sequence; announcing "zero one" before each heading is noise.
- The essence statement and the membership action close the page.
- Wears the collector chrome — Membership present, Briefings absent — and the
  light ground is confirmed by luminance, not by class name.
- No sideways scroll at 390px.

### `tests/e2e/collectors-about.spec.ts` — 7 tests (per browser project)

`/collectors/about` — dark hero, mission, story, structure, intake.

- The mission is **three paragraphs**, counted, so a dropped one fails rather
  than passing on the two that remain.
- The story states what the name means and that this is not a marketplace —
  both load-bearing claims about what the business is.
- The three teams render in order.
- **About is marked `aria-current="page"`** in the header, which is what the
  design's darkened nav item means semantically.
- No sideways scroll at 390px.

### `tests/e2e/collectors-membership.spec.ts` — 7 tests (per browser project)

`/collectors/membership` — the Founding Circle offer.

- **The price is asserted as one statement**, `$10,000 / year`, not as an
  isolated figure. A test that only found "$10,000" would pass on a page that
  had lost the period, which is a materially different claim.
- All five inclusions render; the annual rhythm has exactly five items.
- **Both "Request membership consideration" links go to the intake**, checked by
  reading every matching `href` rather than the first — the page's own headline
  says the route is a conversation, not a checkout, so a stray payment link
  would contradict it.
- Membership is marked `aria-current="page"`; no sideways scroll at 390px.

### `src/features/collectors/apply-form.test.tsx` — 14 tests

The collector intake form.

- Every field from the design is present and labelled; the three section
  headings render.
- **Only name and email are `required`.** The financial questions are intrusive
  and the design leaves them unmarked — a test guards against them quietly
  becoming mandatory.
- The nine mediums are `checkbox`es, none preselected; both bands open on the
  placeholder rather than a default guess.
- An untouched optional field is **omitted**, not sent as `''`.
- A failed save **keeps what was typed**. Losing a completed application to a
  transient error is the worst outcome this form has.
- A double click submits once.

### `src/features/collectors/actions.db.test.ts` — 10 tests

`submitCollectorApplication`, against a real database.

- A full application round-trips; so does one with **nothing but a name and an
  email** — declining the financial questions must not cost an applicant.
- Email is lower-cased and trimmed, so one person is one applicant.
- Applications rest at `AWAITING_VERIFICATION`, the only status this screen can
  produce.
- **A medium or band not on the published list is refused and nothing is
  written.** The chips are client state; a crafted request can send anything.
- Duplicate mediums collapse to one.

### `tests/e2e/collectors-apply.spec.ts` — 7 tests (per browser project)

The intake journey — the one every CTA on the collector sub-brand ends at.

- An application succeeds with the minimum, and with everything filled in.
- A missing name blocks submission, shows the error, and **keeps the email that
  was already typed**.
- **Every collector page is asserted to have a working route into the intake**,
  by clicking it. A dead `/collectors/apply` would strand the whole sub-brand.
- The page is `noindex`; no sideways scroll at 390px.

> These tests go through `waitForFormHydration` before typing. The fields are
> controlled, and these specs navigate with `domcontentloaded` — text filled
> into a server-rendered input before React mounts is silently discarded on
> hydration, and the test then fails on an empty field far from the cause.

### `tests/e2e/artist-onboarding.spec.ts` — 8 tests (per browser project)

The Phase 1 screen-1 journey, each test with its own generated account.

- An artist hitting `/artist/onboarding` cold is bounced to login and returned
  there after signing in.
- A new artist sees an empty form and a "Continue" action; an artist with a
  profile sees it prefilled with "Save changes".
- Completing the profile lands on the dashboard.
- Submitting without a display name, or with a malformed social link, is blocked
  client-side and stays on the page.
- **A collector who signs in on the way to artist onboarding lands on `/forbidden`.**
- Wrong credentials produce the vague error and stay on `/login`.

### `tests/e2e/smoke.spec.ts` — 10 tests (per browser project)

Runs against a production build, in Chromium and a mobile viewport.

- The app boots and the home page returns 200 with the right title.
- `/`, `/browse`, `/artists`, `/login`, `/signup` are reachable with no session.
- `/artist/dashboard`, `/collector/favourites` and `/admin` each redirect an
  anonymous visitor to `/login` with `callbackUrl` set to where they were going.
- `/artists` resolves publicly and is not swallowed by the `/artist` fence.

## Not yet covered (deliberately — later phases)

- Sign-up (creating an account) — the login half exists; registration lands with
  the Phase 1 exit journey.
- Image upload type/size validation — Phase 1, with the create-listing screen.
- Listing lifecycle, including the DRAFT → LISTED guard end-to-end — Phase 1.
- Stripe checkout, webhook handling, and the two-collectors-one-piece race —
  Phase 2.
- Admin authorisation and audit logging — Phase 3.
