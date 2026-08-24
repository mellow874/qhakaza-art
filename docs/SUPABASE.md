# Setting up Supabase

What to create, and which app gets which URL.

**Short answer:** create **one** Supabase project. All three apps point at it
with the **same** two connection strings. The only per-app value is `AUTH_URL`.

You are using Supabase as a **database only** — not Supabase Auth, not its
client libraries, not its storage. Sign-in is Auth.js against the `User` table
in your own schema.

---

## 1. Create the project

Supabase dashboard → **New project**.

- Name: anything.
- **Database password**: generate one and save it. This is the `postgres`
  (owner) password and you cannot see it again.
- Region: nearest your Vercel region.

That is the only thing you create in the dashboard. No tables, no policies, no
auth settings — the migrations do all of it.

## 2. Get the two connection strings

**Project Settings → Database → Connection string**, and take **both**:

| Supabase label         | Port | Goes in               |
| ---------------------- | ---- | --------------------- |
| **Direct connection**  | 5432 | `DIRECT_DATABASE_URL` |
| **Transaction pooler** | 6543 | `DATABASE_URL`        |

Session pooler is the wrong one. `withActor()` declares the current actor with
`set_config(..., true)`, which is scoped to a transaction — which is exactly
what the transaction pooler supports.

Append `?pgbouncer=true` to the pooled string.

## 3. Create the schema, the role and the policies

Once, from your machine, against the **direct** connection as the owner:

```bash
DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
npx prisma migrate deploy --schema packages/shared-db/prisma/schema.prisma
```

This creates all the tables, the `qhakaza_app` role, its grants, and all 52 RLS
policies. Nothing to click.

**Then change the app role's password** — the migration creates it with the
development default. In Supabase's SQL editor:

```sql
ALTER ROLE qhakaza_app WITH PASSWORD 'a-long-random-string';
```

## 4. Seed the demo data

```bash
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
npm run db:seed
```

This is what creates `admin@qhakaza.art` on the live database. Your local
accounts do not travel — they live in `.postgres/` on your machine.

Skip this for a real launch and create the first admin by hand instead.

## 5. Put the variables on the three Vercel projects

### Identical in all three

| Variable              | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | the **pooled** string, as `qhakaza_app`                     |
| `DIRECT_DATABASE_URL` | the **direct** string, as `postgres`                        |
| `AUTH_SECRET`         | one value from `npx auth secret`, **the same in all three** |

```
DATABASE_URL="postgresql://qhakaza_app:APP_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_DATABASE_URL="postgresql://postgres:DB_PASSWORD@db.PROJECT.supabase.co:5432/postgres"
AUTH_SECRET="<the one value>"
```

If `AUTH_SECRET` differs between apps, a session created by one is unreadable
by the others and people appear signed out when they move between sites.

### Different per app

| Vercel project           | `AUTH_URL`                   |
| ------------------------ | ---------------------------- |
| `qhakaza-vera`           | `https://<vera domain>`      |
| `qhakaza-collector`      | `https://<collector domain>` |
| `qhakaza-command-center` | `https://<ops domain>`       |

That is the **only** variable that differs. Get it wrong and sign-in redirects
to the wrong site.

### Optional, per app

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. Leave them unset and the "Continue
with Google" button is not rendered — email and password still work. Redirect
URI is `<AUTH_URL>/api/auth/callback/google`.

---

## Why the app connects as `qhakaza_app`

`postgres` owns every table **and bypasses Row-Level Security**. If
`DATABASE_URL` points at it, every policy is silently ignored and the apps get
full access to everything — the Artist Intelligence Platform could read collector intakes.

It will look like it works. That is what makes it dangerous.

`qhakaza_app` is not the owner, not a superuser, and holds no BYPASSRLS, so the
policies actually apply to it. Check after your first deploy — the app
connection should report `superuser: false, bypassrls: false`.

## Ignore Supabase's RLS dashboard

Supabase has its own UI for policies. Do not use it here. The policies are
generated from `packages/shared-db/src/rls.ts` into a migration, and
`rls.db.test.ts` asserts the live database still matches. Editing them in the
dashboard drifts from the repo and the test starts failing — which is the point.

## Checklist

- [ ] One Supabase project, database password saved
- [ ] `migrate deploy` run against the **direct** connection
- [ ] `qhakaza_app` password changed from the default
- [ ] `DATABASE_URL` = pooled, as `qhakaza_app`, on all three
- [ ] `DIRECT_DATABASE_URL` = direct, as `postgres`, on all three
- [ ] `AUTH_SECRET` identical across all three
- [ ] `AUTH_URL` set to each app's own domain
- [ ] Seeded, or a first admin created by hand
