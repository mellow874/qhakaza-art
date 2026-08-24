# Migration runbook — moving to Qhakaza-owned Supabase

Everything needed to move the platform off Melsoft-owned infrastructure and onto
a Supabase project that Qhakaza controls.

**Status: prepared, not executed.** Blocked only on the new project's
credentials. Once they arrive this is a same-day task — roughly 30 minutes of
work plus verification.

---

## Before you start

### What the founder must provide

| # | Item | Where it comes from |
|---|------|--------------------|
| 1 | A Supabase project created under a **Qhakaza-owned account** | supabase.com — use a Qhakaza email address, not a personal or Melsoft one |
| 2 | The **session pooler** connection string (port 5432) | Project Settings → Database → Connection string → Session pooler |
| 3 | The **transaction pooler** connection string (port 6543) | Same page → Transaction pooler |
| 4 | A strong password for the `qhakaza_app` role | Generate one; it is set in step 4 below |

Share these through a password manager or a one-time secret link. **Not** email
or WhatsApp.

> Do not use the "Direct connection" string Supabase shows first. It resolves
> IPv6-only and is unreachable from most CI runners and some office networks.

### What is *not* being migrated, and why

The platform uses Supabase as **hosted PostgreSQL only**. Confirmed by audit
(see `HANDOVER-RESPONSE.md`, Critical Finding):

- **No Supabase Auth.** Authentication is Auth.js v5 with bcrypt hashes and JWT
  sessions. Users are rows in our own `User` table, so they migrate as data.
- **No storage buckets.** There is no `@supabase/supabase-js` dependency
  anywhere. Artwork images are external URLs in `Artwork.images`. **There is no
  media to migrate.** Object storage arrives in Phase 3, and its migration
  script ships with it.
- **No edge functions, no Supabase RLS policies.** The 56 policies are plain
  PostgreSQL, created by migration `20260805000000_row_level_security` and
  generated from `packages/shared-db/src/rls.ts`. `prisma migrate deploy`
  recreates them.

This makes the migration considerably smaller than a typical Supabase move.

### Take a snapshot of the current database first

```bash
DIRECT_DATABASE_URL="<current owner connection>" \
  npm run export:schema -w packages/shared-db
```

Writes `docs/SCHEMA-SNAPSHOT.md` (and a `.sql` dump if `pg_dump` is on PATH).
Commit it. After migrating you regenerate against the new project and diff the
two — **that diff is the proof the migration was faithful.**

---

## Execution

### 1 — Point the migration at the new project

Do not edit `.env` yet; the old database must stay reachable for the data copy.

```bash
export NEW_OWNER="postgresql://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
export NEW_APP="postgresql://qhakaza_app:APP_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"
export OLD_OWNER="<current owner connection string>"
```

### 2 — Build the schema

```bash
DIRECT_DATABASE_URL="$NEW_OWNER" DATABASE_URL="$NEW_OWNER" \
  npm run deploy -w packages/shared-db
```

Applies all 8 migrations in order. This creates every table, index, the
`qhakaza_app` role, its grants, and all 56 RLS policies.

Idempotent: safe to re-run. Prisma skips migrations already recorded in
`_prisma_migrations`.

> **If it fails on a non-ASCII character**, the migration SQL contains a
> character the server rejects under WIN1252. This bit us once already. Fix the
> SQL, then `npx prisma migrate resolve --rolled-back <name>` before retrying —
> otherwise Prisma refuses to proceed past the failed entry.

### 3 — Confirm the schema landed

```bash
DIRECT_DATABASE_URL="$NEW_OWNER" DATABASE_URL="$NEW_OWNER" \
  npm run verify -w packages/shared-db
```

At this point the database is empty, so expect the "database is empty" warning
and a pass on everything else.

### 4 — Set the application role's password

The migration creates `qhakaza_app` with the default password `qhakaza_app` so
local setup needs no configuration. **On any shared host that default is a
credential anyone who has read the repository already knows.**

```bash
psql "$NEW_OWNER" -c "ALTER ROLE qhakaza_app WITH PASSWORD 'APP_PASSWORD';"
```

Use the same `APP_PASSWORD` you put in `$NEW_APP` above.

### 5 — Copy the data

Dry run first — it writes nothing and prints the plan:

```bash
SOURCE_DATABASE_URL="$OLD_OWNER" TARGET_DATABASE_URL="$NEW_OWNER" \
  npm run migrate:data -w packages/shared-db -- --dry-run
```

Check the table order looks sane and the row counts match what you expect. Then:

```bash
SOURCE_DATABASE_URL="$OLD_OWNER" TARGET_DATABASE_URL="$NEW_OWNER" \
  npm run migrate:data -w packages/shared-db
```

The copy runs in **one transaction**. If anything fails, the whole thing rolls
back — there is no half-migrated state. It re-counts every table afterwards and
exits non-zero on any mismatch.

### 6 — Verify properly

```bash
DIRECT_DATABASE_URL="$NEW_OWNER" DATABASE_URL="$NEW_APP" \
  npm run verify -w packages/shared-db
```

Note this run uses the **app** connection for `DATABASE_URL`. That is the point:
it checks the policies actually bite, which only the constrained role can prove.

Must pass all of:

- [ ] Both connections alive
- [ ] All 8 migrations applied, none rolled back or half-applied
- [ ] Every core entity table present
- [ ] RLS enabled on every core entity
- [ ] Policies present (expect 56)
- [ ] `qhakaza_app` is not a superuser and does not bypass RLS
- [ ] The application connects **as `qhakaza_app`**, not as the owner
- [ ] An anonymous reader sees **zero** rows in `CollectorIntake`,
      `PrivateNoteSubmission` and `AuditLog`
- [ ] Row counts non-zero and matching the source

### 7 — Regenerate the snapshot and diff it

```bash
DIRECT_DATABASE_URL="$NEW_OWNER" \
  npm run export:schema -w packages/shared-db -- --out docs/SCHEMA-SNAPSHOT-NEW.md

diff docs/SCHEMA-SNAPSHOT.md docs/SCHEMA-SNAPSHOT-NEW.md
```

Expect differences only in the host line and the migration timestamps. Any
difference in tables, policies, roles or row counts is a failed migration.

### 8 — Application checks against the new database

With `.env` pointed at the new project:

```bash
npm run check:env -w packages/shared-db
npm test -w apps/collector          # 77 tests
npm test -w apps/vera               # 220 tests
npm test -w apps/command-center     # 16 tests
```

Then by hand:

- [ ] Sign in as `admin@qhakaza.art` — the Command Center loads with real data
- [ ] Sign in as an artist — the dashboard shows their own work and no one else's
- [ ] Open a `/private/<token>` invitation — it activates
- [ ] Submit the collector application form — the row appears in the Command Center

### 9 — Cut over

1. Update `DATABASE_URL` and `DIRECT_DATABASE_URL` in **all three** Vercel
   projects (the Artist Intelligence Platform, Collector Platform, Command Center).
2. Redeploy all three.
3. Re-run the manual checks in step 8 against the deployed sites.
4. **Leave the old database running, untouched, for at least 14 days.**

---

## Rollback

Nothing is destructive until step 9, and the old database is never written to.

| Failure point | Action |
|---|---|
| Steps 1–8 | Stop. The old database is still live and serving. Nothing to undo. |
| Step 5 fails mid-copy | Already rolled back — it runs in one transaction. Fix and re-run. |
| Step 5 left partial data somehow | Re-run with `--truncate` to empty the target and start clean. |
| After step 9, problem found | Revert the two env vars in the three Vercel projects, redeploy. Back on the old database in minutes. |

**The rollback window closes when the first write lands on the new database and
not the old one.** After cutover, any new row exists only in the new project.
Reverting after that means losing whatever was written in between — so do the
verification properly *before* step 9, not after.

---

## Portability — no dependency on a developer-owned database

Confirmed for Definition-of-Done item 1:

- Every credential is an environment variable, read through
  `packages/shared-db/src/env.ts`. No connection string is hard-coded in
  application code.
- The only literal connection strings in the repository are localhost fallbacks
  in test configuration, pointing at the disposable test database on port 5433.
- The full schema, including the security model, is reproducible from the
  migrations in this repository by a single command.
- No Supabase-specific feature is in use. The platform runs on any PostgreSQL 14+
  instance — Supabase, RDS, or a container.

Handing this platform to another team requires the repository and two connection
strings. Nothing else.

---

## Open items

| Item | Blocked on |
|---|---|
| Executing this runbook | Founder: create the project, share credentials securely |
| Storage migration script | Nothing to migrate today. Ships with Phase 3, which introduces object storage. |
| Rotating the current database's password | Only if you decide *not* to migrate — see `ISSUES.md` B1 |
