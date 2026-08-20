# Qhakaza Art

A marketplace where **Artists** list original work, **Collectors** discover and buy
it, and an **Admin** oversees the platform.

> **Status: both public sites are built.** The artist-facing site (home, about,
> how-it-works, features, briefings, FAQ, contact) plus sign-in and artist
> onboarding; and the **Collector Intelligence Suite** — a light-themed
> sub-brand with its own chrome — at `/collectors`, `/collectors/about`,
> `/collectors/membership`, `/collectors/methodology` and the working intake at
> `/collectors/apply`. Signed-in screens are built one at a time as their
> designs arrive.
>
> **The signed-in area is being merged.** Confirmed 2026-08-04: one app behind
> sign-in, where the viewer's role decides which panels they see, rather than
> two parallel dashboards. Artists and collectors see different things; they
> just no longer see them in different applications. The current
> `/artist/dashboard` and `/collector/favourites` routes predate that decision
> and will be reshaped by the first dashboard design.
>
> **Note on scope:** the original brief in [docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md)
> describes an art _marketplace_ (collectors browse and buy). The supplied
> designs describe Qhakaza Art Collective as an artist intelligence platform and
> asset-management firm — explicitly "not a gallery, not a marketplace". The
> marketing pages follow the designs; the marketplace data model and catalogue
> components from the brief are still present but no longer surfaced. See
> [Open questions](#open-questions).

## Setup

```bash
npm install
cp .env.example .env          # then fill in AUTH_SECRET and Google credentials
npx auth secret               # generates AUTH_SECRET for you

npm run db:up                 # start Postgres (dev on :5432, test on :5433)
npm run db:migrate            # create the schema
npm run db:seed               # sample users and artwork

npm run dev                   # http://localhost:3000
```

Requires Node 20+. Playwright needs its browser once:
`npx playwright install chromium`.

### The database

`npm run db:up` runs **real PostgreSQL with no Docker and no system install**.
The `embedded-postgres` package ships official Postgres binaries into
`node_modules`, and [`scripts/db.ts`](scripts/db.ts) drives them through `pg_ctl`
against data directories in `.postgres/` (gitignored). It is ordinary Postgres —
migrations, `Decimal`, array columns and transactions behave exactly as they will
in production.

| Command             | Does                            |
| ------------------- | ------------------------------- |
| `npm run db:up`     | Start both instances, then exit |
| `npm run db:down`   | Stop both                       |
| `npm run db:status` | Report what is running          |

Two instances run: **dev** on `:5432` and **test** on `:5433`. The test database
is separate so the suite can wipe it without touching your dev data.

If the machine loses power or a terminal is killed mid-run, a stale
`postmaster.pid` can be left behind and startup fails with _"pre-existing shared
memory block is still in use"_. Kill any leftover `postgres` processes and run
`npm run db:up` again.

A [`docker-compose.yml`](docker-compose.yml) is also included for anyone who
would rather use containers, or for CI — it exposes the same ports and
credentials, so nothing else changes.

### Environment variables

| Variable                       | Required   | Purpose                                     |
| ------------------------------ | ---------- | ------------------------------------------- |
| `DATABASE_URL`                 | yes        | Postgres connection string                  |
| `TEST_DATABASE_URL`            | for tests  | Separate database the suite may wipe        |
| `AUTH_SECRET`                  | yes        | Auth.js JWT signing key (`npx auth secret`) |
| `AUTH_URL`                     | yes        | App origin, e.g. `http://localhost:3000`    |
| `GOOGLE_CLIENT_ID` / `_SECRET` | for Google | OAuth provider                              |
| `STRIPE_*`                     | Phase 2    | Checkout, test mode                         |
| `UPLOADTHING_TOKEN`            | Phase 1    | Artwork image uploads                       |

Google OAuth redirect URI: `http://localhost:3000/api/auth/callback/google`.

### Seeded accounts

Password for all of them: `password123`.

| Email                | Role      | Note                        |
| -------------------- | --------- | --------------------------- |
| `admin@qhakaza.art`  | ADMIN     |                             |
| `thandi@qhakaza.art` | ARTIST    | Approved                    |
| `sipho@qhakaza.art`  | ARTIST    | Awaiting admin approval     |
| `lerato@example.com` | COLLECTOR | Has an order and favourites |
| `james@example.com`  | COLLECTOR |                             |
| `aisha@example.com`  | COLLECTOR |                             |

Plus 10 art pieces across DRAFT / LISTED / SOLD / HIDDEN.

## Scripts

| Command              | Does                                   |
| -------------------- | -------------------------------------- |
| `npm run dev`        | Dev server                             |
| `npm run build`      | Production build                       |
| `npm test`           | Unit + component tests (Vitest)        |
| `npm run test:e2e`   | End-to-end tests (Playwright)          |
| `npm run test:all`   | Typecheck → unit → E2E                 |
| `npm run typecheck`  | `tsc --noEmit`                         |
| `npm run lint`       | ESLint                                 |
| `npm run format`     | Prettier write                         |
| `npm run db:up`      | Start Postgres (dev + test), no Docker |
| `npm run db:down`    | Stop Postgres                          |
| `npm run db:migrate` | Run migrations                         |
| `npm run db:seed`    | Reseed sample data (idempotent)        |
| `npm run db:reset`   | Drop, migrate and reseed               |

### If routes start 404ing in dev

Symptom: recently added pages return 404 while older ones still work, and a
production build of the same code serves them fine.

Cause: `next dev` and `next build` share `.next`, so a production build run
while a dev server is open leaves that server with a stale route manifest. The
E2E suite runs a full build every time, which used to trigger exactly this.

The suite now builds into `.next-e2e` instead (`NEXT_DIST_DIR`, set in
[playwright.config.ts](playwright.config.ts) and read in
[next.config.ts](next.config.ts)), so it can no longer disturb a dev server. If
you hit it another way, stop the dev server, delete `.next`, and start again.

Testing conventions and per-file coverage: [TESTING.md](TESTING.md).
Palette, type and layout rules: [docs/DESIGN.md](docs/DESIGN.md).

## Architecture

**Mid-split.** The app is being separated into three independently deployable
apps over one shared database. The Artist Intelligence Platform is extracted (Phase 2); the collector and
admin apps follow in Phases 3 and 4, and the root app is deleted in Phase 6.

```
apps/
  vera/              # ✅ public artist website — port 3001, E2E on 4320
    src/app/         #    (public) marketing + (artist) area + api/auth
  collector/         # ✅ collector platform — port 3002, E2E on 4321
    src/app/(marketing)/  #  /collectors/* — PUBLIC, indexed, has SEO
    src/app/(private)/    #  /private/<token> — invite-only, noindex
    src/features/private/ #  activation gate, discovery, enquiries
  command-center/    # ⏳ Phase 4 — AdminCommandCenter

packages/
  shared-db/         # the ONLY database client; 13 entities; RLS declarations
    prisma/          #   schema, migrations, seed
  shared-auth/       # roles, rbac, requireRole(), requireToken(), credentials
  shared-ui/         # Button, Field, EditorialImage, cn — used by 2+ apps only

src/                 # ⏳ the /admin and /collector stubs, nothing else.
                     #    Becomes the Command Center in Phase 4; deleted in 6.
```

### How `/private/<token>` is gated

Three things must hold, and they are checked where the database is reachable —
**not** at the edge proxy:

1. The token resolves to a `MemberInvitation` whose SHA-256 fingerprint matches,
   and which is neither expired nor revoked. The plaintext token is never stored.
2. The caller holds COLLECTOR, ADMIN or ADVISOR.
3. Every attempt, successful or not, writes an `ActivationAttempt`.

The gate lives in the **layout** wrapping `/private/[token]`, so a page added
later is covered whether or not its author remembers to guard it.

`/private` is deliberately absent from the proxy's role fence. Fencing it there
would bounce anonymous requests to `/login` before anything could record them —
and anonymous requests are exactly what token guessing looks like.

Every refusal renders identical markup. Forged, expired, revoked and wrong-role
are indistinguishable from outside, so the page cannot be used to discover
whether a guessed token exists. The reason goes to `ActivationAttempt`.

Each app owns its entry point, router, `next.config.ts`, `tsconfig.json`,
Playwright config and env file, and reaches the database **only** through
`@qhakaza/shared-db`. No app defines its own connection.

**Route groups** map onto roles. The group name is not part of the URL, so
`(artist)/artist/dashboard` serves `/artist/dashboard` while keeping each role's
layout, navigation and access rules in their own tree.

### Running it

| Command                  | Does                                    |
| ------------------------ | --------------------------------------- |
| `npm run vera`           | Artist platform dev server on :3001                |
| `npm run dev`            | The not-yet-extracted app on :3000      |
| `npm run test:workspace` | Unit + integration across root and the artist platform |
| `npm run e2e:workspace`  | Both Playwright suites                  |

Each app can also be driven directly: `npm test --workspace @qhakaza/vera`.

**`features/<domain>/`** keeps a domain's UI, server actions and tests together.
`components/` is only for genuinely shared, domain-free UI. This is what stops
`components/` from becoming a dumping ground as the app grows.

### Auth and authorisation

The role lives on the `User` record, is copied onto the JWT at sign-in, and is
read back onto the session on every request.

Authorisation is enforced in **three layers**:

1. `src/lib/auth/rbac.ts` — pure, dependency-free rules. Fully unit tested.
2. `src/proxy.ts` — edge fence that redirects before a page renders. Fast, and a
   good user experience, but treated as a convenience only.
3. Server components and server actions — re-check the session server-side. This
   is the layer that actually protects data; middleware alone is not a boundary.

The Auth.js config is split deliberately: `auth.config.ts` is edge-safe (no
Prisma, no bcrypt) so the proxy can run on the edge runtime, while
`lib/auth/index.ts` adds the Prisma adapter and credentials provider for Node.

Decisions worth knowing:

- Wrong role → `/forbidden`. No session → `/login?callbackUrl=<original path>`.
- **Public pages show only LISTED work by approved artists.** Both conditions
  live in one place — `PUBLICLY_VISIBLE_WORK` in
  [`src/features/home/queries.ts`](src/features/home/queries.ts) — and every
  public query must reuse it rather than restating the rule.
- **ADMIN is not a superuser** over artist and collector areas. Admins oversee
  through `/admin`; they do not act inside other roles' surfaces.
- Nobody can self-register as ADMIN — the sign-up schema only accepts
  ARTIST or COLLECTOR.

### Data model

```
User (id, name, email, passwordHash?, role, avatar, bio, createdAt)
 │  role: ARTIST | COLLECTOR | ADMIN
 ├─1:1─ ArtistProfile (displayName, slug, statement, socials, approved)
 │        └─1:N─ ArtPiece (title, description, images[], medium, dimensions,
 │                         price, currency, status)
 │                  status: DRAFT | LISTED | SOLD | HIDDEN
 │                  ├─1:N─ Order
 │                  └─1:N─ Favorite
 ├─1:N─ Order (artPieceId, collectorId, amount, currency, status,
 │             stripePaymentIntentId, createdAt)
 │        status: PENDING | PAID | CANCELLED | REFUNDED
 └─M:N─ Favorite (collectorId + artPieceId, composite PK)

Account / Session / VerificationToken — Auth.js adapter tables

CollectorApplication — standalone, no relation to User
  (fullName, email, phone, country, city, annualIncomeBand,
   liquidAssetsBand, collectingGoal, artExposure, preferredMediums[], status)
  status: AWAITING_VERIFICATION | UNDER_REVIEW | ACCEPTED | DECLINED
```

Notes:

- **`CollectorApplication` holds sensitive personal and financial information.**
  Income and liquid-asset bands, contact details, free text about someone's
  wealth and intentions. Everything but name and email is optional by design.
  Any screen that reads this table is privileged, and rows are never logged.
- It has **no relation to `User`**: the intake is completed by anonymous
  visitors, before an account exists. Add the link when the signed-in collector
  area lands and an application needs claiming.
- `preferredMediums` is `String[]`, not an enum — the medium list is marketing
  copy that will change without a migration, and a stale enum would reject a
  live option. The server still checks each value against the published list.

- `ArtPiece.artistId` points at `ArtistProfile`, not `User` — artwork belongs to
  the storefront, so a piece can never be orphaned from the profile that sells it.
- `price` and `amount` are `Decimal(12,2)`. Never floats for money.
- `Order.stripePaymentIntentId` is unique — this is what makes the Stripe webhook
  idempotent, and what enforces one winner in the two-collectors-one-piece race
  in Phase 2.
- `Favorite` uses a composite primary key, so a collector cannot double-favourite.
- `passwordHash` is nullable: Google-only accounts have none, and the credentials
  provider refuses to authenticate an account without one.

## Content and images

All marketing copy lives in [`src/content/`](src/content/) — `home.ts`,
`about.ts` and `navigation.ts` — so wording can be edited without touching
layout, and the same strings can be asserted in tests.

Photography is declared in [`src/content/images.ts`](src/content/images.ts).
Every entry is `null` until the real asset is supplied;
[`EditorialImage`](src/components/editorial-image.tsx) renders a tinted
placeholder of the correct dimensions in that case, so nothing 404s and the
page's rhythm stays right. To add a photo, drop the file in `public/images/` and
set its path:

```ts
export const IMAGES = {
  hero: '/images/hero-brushes.jpg', // was null
  …
};
```

Alt text is required regardless of whether the file exists, so it is already
correct when the photograph lands.

## Open questions

Raised by the gap between the brief and the supplied designs:

1. **Is the marketplace still in scope?** `ArtPiece`, `Order`, `Favorite`,
   Stripe checkout and the collector journey all come from the brief. The
   designs show no browse, prices or cart. The models and the catalogue
   components in [`src/features/catalogue/`](src/features/catalogue/) are intact
   and tested but currently unreferenced by any page.
2. **Should the Sx Score be real?** It is presented as a core concept with five
   named metrics (CAM, MCP, ALS, NIS, CSI). It currently renders the
   illustrative figures from the design and has no data model behind it.
3. **Where do Briefings come from?** The home page lists two articles with
   categories and dates. There is no `Briefing` model yet, and no `/briefings`
   route — the links resolve to a 404 until one exists.
4. **FAQ has no questions yet.** The supplied design showed the heading and the
   accordion's divider lines, but no legible question or answer text. Rather
   than invent answers about subscriptions, pricing or regulatory status —
   which would be factual claims about the business — `faqs` in
   [`src/content/faq.ts`](src/content/faq.ts) is an empty array and the page
   renders an honest empty state. Adding entries is the only change needed.
5. **Contact messages are stored, not emailed.** No mail provider is
   configured, and a form that silently discards enquiries is worse than no
   form. Submissions land in the `ContactMessage` table; wire up delivery in
   [`src/features/contact/actions.ts`](src/features/contact/actions.ts) once a
   provider is chosen. There is no admin screen for reading them yet.
6. **Individual briefing articles are not built.** `/briefings` lists them and
   links to `/briefings/<slug>`, which 404s — the article bodies were not
   supplied, only the excerpts.
7. **Unbuilt routes the navigation points at:** `/privacy`, `/terms`,
   `/collectors/suite`, `/collectors/pricing` and `/collectors/experiences`.
   `/collectors/methodology` exists but **nothing links to it** — no supplied
   design places it in the navigation or the footer.
8. **The intake's financial bands are provisional and must be replaced.** The
   design shows only the "Select range" placeholder — the options behind it were
   never supplied. The values in `apply.financial` in
   [`src/content/collectors.ts`](src/content/collectors.ts) are stand-ins sized
   to the stated audience, **not Qhakaza's segmentation**. Both lists are one
   edit; the validation schema derives its allowed values from them.
9. **The verification step does not exist.** The intake's own button says
   "Continue to verification", but no such screen was supplied. Rather than send
   applicants to a 404, the form saves the application and confirms receipt —
   that confirmation copy is **mine, not from a design**. See `apply.received`.
10. **Applications are stored, not emailed or reviewed.** Rows land in
    `CollectorApplication` and rest at `AWAITING_VERIFICATION`. There is no
    admin screen for reading them and no notification, so someone must query the
    table to know an application arrived.
11. **`/collectors` URL structure is an assumption.** The design's navigation
    gave labels but no paths. If the suite should live on its own domain or at a
    different prefix, it is a one-file change in
    [`src/content/collectors.ts`](src/content/collectors.ts).

## Roadmap

- **Phase 0** ✅ — setup, schema, auth, fencing, tests, seed
- **Phase 1** — Artist screens: onboarding ✅ → dashboard → create/edit listing →
  manage listings → sales → public storefront
- **Phase 2** — Collector screens: browse → search/filter → detail → storefront →
  favourites → Stripe checkout → confirmation → order history → profile
- **Phase 3** — Admin dashboard, derived from the models and flows that exist by then
