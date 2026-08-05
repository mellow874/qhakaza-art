# Deploying to Vercel

The short answer: **one repository, three Vercel projects.** Vercel supports this
directly — it is the normal way to deploy a monorepo, not a workaround.

Each project points at the same repo and differs only in its **Root Directory**.

---

## The shape

```
one GitHub repo  ──┬──► Vercel project "qhakaza-vera"           root: apps/vera
                   ├──► Vercel project "qhakaza-collector"      root: apps/collector
                   └──► Vercel project "qhakaza-command-center" root: apps/command-center
                                          │
                                          └──► ONE Postgres database
```

All three deploy from the same commit, and all three connect to the same
database. That is the architecture working as intended: separation is by role
and by RLS, not by having three databases.

---

## Setting up each project

For each of the three, in the Vercel dashboard: **Add New → Project**, import the
repo, then:

| Setting            | Value                                                    |
| ------------------ | -------------------------------------------------------- |
| **Root Directory** | `apps/vera` (or `apps/collector`, `apps/command-center`) |
| Framework Preset   | Next.js (detected)                                       |
| Build Command      | leave default — `next build`                             |
| Install Command    | leave default                                            |
| Node version       | 20 or newer                                              |

**Leave "Include files outside the root directory" ON.** It is on by default and
must stay on: each app imports `@qhakaza/shared-db`, `shared-auth` and
`shared-ui` from `packages/`, which sits outside the app folder. With it off the
build fails to resolve them.

npm workspaces handle the linking; nothing else is needed.

### Only rebuild what changed (optional)

By default all three rebuild on every push. To skip unaffected ones, set each
project's **Ignored Build Step** to:

```bash
npx turbo-ignore || git diff --quiet HEAD^ HEAD -- . ../../packages
```

Or simply leave it — three small builds is not a problem at this size.

---

## Environment variables

Set these per project, in Vercel → Settings → Environment Variables.

### All three

| Variable              | Value                                                | Notes                            |
| --------------------- | ---------------------------------------------------- | -------------------------------- |
| `DATABASE_URL`        | `postgresql://qhakaza_app:…@host/db?sslmode=require` | **the app role** — not the owner |
| `DIRECT_DATABASE_URL` | `postgresql://qhakaza:…@host/db?sslmode=require`     | the owner; migrations only       |
| `AUTH_SECRET`         | `npx auth secret`                                    | **the same value in all three**  |

`AUTH_SECRET` must match across the apps or a session minted by one is
unreadable by the others.

### Per project

| Project        | `AUTH_URL`                       |
| -------------- | -------------------------------- |
| Vera           | `https://qhakaza.art`            |
| Collector      | `https://collectors.qhakaza.art` |
| Command Center | `https://ops.qhakaza.art`        |

Optional, where used: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (redirect URI
`<AUTH_URL>/api/auth/callback/google`).

> ### ⚠ `DATABASE_URL` must be the app role
>
> If you point it at the owner, every RLS policy is silently bypassed and the
> apps regain full access to every table — including collector intakes from
> Vera. It will look like it works. That is exactly the danger.
>
> Sanity check after the first deploy: the app connection should report
> `superuser: false, bypassrls: false`.

---

## The database

Any managed Postgres works — Supabase, Neon, RDS, Vercel Postgres. It needs to
support creating a role and enabling RLS, which they all do.

**Nothing in the code is tied to a provider.** You are swapping a connection
string, not migrating. The local `embedded-postgres` is a development
convenience and is a devDependency — it cannot and does not run on Vercel.

### Supabase specifically

Supabase gives you two connection strings, and **which one goes where matters**:

| Variable              | Supabase string                            | Port |
| --------------------- | ------------------------------------------ | ---- |
| `DIRECT_DATABASE_URL` | **Direct connection**                      | 5432 |
| `DATABASE_URL`        | **Transaction pooler** + `?pgbouncer=true` | 6543 |

```
DIRECT_DATABASE_URL="postgresql://postgres:PW@db.PROJECT.supabase.co:5432/postgres"
DATABASE_URL="postgresql://qhakaza_app:APP_PW@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Use the **transaction** pooler, not session mode. `withActor()` sets the actor
with `set_config(..., true)`, which is transaction-scoped — that is exactly what
transaction pooling supports, and it is why it was written that way.

Three Supabase notes:

1. **You are using Supabase as a database only** — not Supabase Auth, not its
   client libraries. Sign-in is Auth.js against the `User` table.
2. **`postgres` is the owner.** Run migrations as it; the migration creates
   `qhakaza_app` and its grants for you.
3. Supabase's dashboard has its own RLS UI. Ignore it — the policies here are in
   migrations, generated from `rls.ts`. Editing them in the dashboard would drift
   from the repo, and `rls.db.test.ts` would start failing, which is the point.

### Neon

Simpler: the pooled string for `DATABASE_URL`, the unpooled one for
`DIRECT_DATABASE_URL`. Same two-string shape.

**One-time setup**, run as the owner:

```bash
DATABASE_URL="<owner url>" DIRECT_DATABASE_URL="<owner url>" \
  npx prisma migrate deploy --schema packages/shared-db/prisma/schema.prisma
```

This creates the schema, the `qhakaza_app` role, its grants, and all 52 RLS
policies — the role and policies are part of the migrations, so there is nothing
to remember.

**Change the app role's password from the development default before going
live:**

```sql
ALTER ROLE qhakaza_app WITH PASSWORD '<something long and random>';
```

Then update `DATABASE_URL` in all three Vercel projects.

### Migrations on deploy

Prisma reads `DIRECT_DATABASE_URL` for migrations, so the app role never needs
schema rights. Either run `migrate deploy` from CI before promoting, or set one
project's build command to:

```bash
prisma migrate deploy --schema ../../packages/shared-db/prisma/schema.prisma && next build
```

Put it on **one** project only — three concurrent builds running migrations
against the same database is a race you do not want.

### Connection pooling

`withActor()` opens a transaction per query to set the actor. On serverless that
means more concurrent connections than a long-lived server would use, so use the
**pooled** connection string your provider offers (Neon's pooler, Supabase's
pgBouncer in _transaction_ mode — session mode will not do).

Transaction-mode pooling is compatible with what we do: `set_config(..., true)`
is transaction-local, which is precisely why it was written that way.

---

## Domains

| Project        | Suggested domain                           |
| -------------- | ------------------------------------------ |
| Vera           | `qhakaza.art` — the public, indexable site |
| Collector      | `collectors.qhakaza.art`                   |
| Command Center | `ops.qhakaza.art`                          |

Nothing links Vera to the collector site, so the domains can be entirely
unrelated if you would rather they were not visibly connected.

`robots.ts` in each app already reflects this: Vera is indexable, the collector
shell is indexable but `/private/` is disallowed, and the Command Center
disallows everything.

---

## After the first deploy — check these

- [ ] All three build and load.
- [ ] `DATABASE_URL` is the **app role** on all three.
- [ ] `AUTH_SECRET` is identical across all three.
- [ ] `AUTH_URL` matches each project's real domain (otherwise sign-in redirects
      off-site).
- [ ] `ops.…/robots.txt` disallows everything.
- [ ] `collectors.…/sitemap.xml` contains no `/private` URL.
- [ ] `collectors.…/private/made-up-token` refuses, and the attempt appears in
      the Command Center.
- [ ] The app role's password is no longer the development default.

---

## What is not ready for production

Honest list, so nothing is a surprise:

- **No email provider.** Invitations are shown on screen for an operator to copy;
  contact messages and intakes are stored, never sent. Wire up a provider before
  a real launch.
- **No rate limiting** on the public forms or on `/private/<token>`. Attempts are
  recorded but not slowed. Vercel's WAF or an upstream limiter is the usual fix.
- **No file/image uploads.** Artwork images are seeded URLs; there is no upload
  path yet.
- **Analytics tables are empty.** Nothing writes `AnalyticsEvent` or
  `DailyMetric`, so those panels show nothing rather than invented figures.
