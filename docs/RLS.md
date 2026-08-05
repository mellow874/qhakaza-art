# Row-Level Security

The policy matrix is declared once, in
[`packages/shared-db/src/rls.ts`](../packages/shared-db/src/rls.ts), generated
into SQL by `scripts/generate-rls.ts`, and asserted against the live database by
`rls.db.test.ts`. Editing the matrix without regenerating fails the suite rather
than drifting quietly.

**52 policies across the 13 core entities. 30 adversarial tests.**

## ⚠ Current status: proven, not yet protecting production

|                                                                     | State                  |
| ------------------------------------------------------------------- | ---------------------- |
| Policies applied to dev and test databases                          | ✅                     |
| `qhakaza_app` role exists — NOSUPERUSER, NOBYPASSRLS, not the owner | ✅                     |
| Adversarial tests pass against that constrained role                | ✅ 30/30               |
| **Apps connect as that role**                                       | ❌ **still `qhakaza`** |

`qhakaza` is a superuser **and holds BYPASSRLS**, so for the running apps the
policies are currently inert. They are real and enforced for any connection made
as `qhakaza_app` — which is what the test suite proves — but the applications
have not been cut over.

**This is the honest gap.** RLS that is enabled but bypassed by the connecting
role is the single most dangerous state available: it looks finished. It is
recorded here rather than quietly claimed as done.

## The cutover

One environment change per app:

```diff
-DATABASE_URL="postgresql://qhakaza:qhakaza@localhost:5432/qhakaza_art?schema=public"
+DATABASE_URL="postgresql://qhakaza_app:qhakaza_app@localhost:5432/qhakaza_art?schema=public"
```

Migrations keep using the owner. Add to the root `.env`:

```
DIRECT_DATABASE_URL="postgresql://qhakaza:qhakaza@localhost:5432/qhakaza_art?schema=public"
```

### Already adopted

| Path                                     | Actor                                  |
| ---------------------------------------- | -------------------------------------- |
| `shared-auth/guards.ts` — `requireToken` | `system`                               |
| `collector` — activation logging         | `system`                               |
| `collector` — private discovery queries  | `collector`                            |
| `collector` — enquiry submission         | `collector`                            |
| `collector` — public intake form         | anonymous (granted INSERT)             |
| `vera` — public catalogue queries        | anonymous (granted SELECT on released) |

### Still to adopt before cutover

| Path                                | Needs               | Note                                                                                      |
| ----------------------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `vera` — `saveArtistProfile`        | `artist`            | See the slug problem below                                                                |
| `vera` — `getMyArtistProfile`       | `artist`            | Straightforward wrap                                                                      |
| `command-center` — all queries      | `admin` / `advisor` | Straightforward wrap                                                                      |
| `command-center` — `performAudited` | `admin` / `advisor` | Use `setActor` on its existing transaction; Prisma has no nested interactive transactions |

## Three things RLS changes that are easy to miss

These were found by running the tests against the constrained role, not by
reading the policies.

### 1. `create()` breaks on write-only tables

Prisma's `create()` issues `INSERT ... RETURNING`, and `RETURNING` requires
**SELECT** permission on the new row. `CollectorIntake` is deliberately
write-only for the public, so `create()` inserts successfully and is then
refused the read-back — surfacing as _"new row violates row-level security
policy"_, which points at entirely the wrong thing.

Use `createMany` for any genuinely write-only table. Already done for
`CollectorIntake`, `ActivationAttempt` and `PrivateNoteSubmission`.

### 2. Empty string, not NULL

A custom GUC that has never been touched reads as `NULL`. Once `set_config` has
set it in **any** transaction on a connection, it resets to the **empty string**
at commit, not to `NULL`. On a pooled connection the second anonymous request
therefore behaves differently from the first.

Every policy uses `nullif(current_setting(...), '')` before `coalesce`. Removing
that would make the public site intermittently lose its own public data.

### 3. Uniqueness checks stop seeing what they need — **unresolved**

`saveArtistProfile` mints a slug by asking whether a candidate is already taken.
Under the `artist` policy an artist sees only their own row, so that check
returns "free" for a slug another artist already holds, and the insert then
fails on the unique constraint.

This is not yet fixed and is why Vera's artist path has not been cut over. The
options are to catch `P2002` and retry with a suffix, to move slug minting into
a `system` context, or to add a narrow policy exposing slugs alone. Each has
trade-offs and none should be chosen in a hurry.

## Two contexts that exist before a user does

`system` is granted exactly two things and nothing else:

- `SELECT` on `MemberInvitation` — the door validates a token before any actor
  exists.
- `INSERT` on `ActivationAttempt` — a failed attempt has, by definition, no
  valid actor, and it is precisely the one worth recording.

Anonymous (`public`) gets: released artists and artworks, published articles,
`INSERT` on `CollectorIntake` and `AnalyticsEvent`. Nothing else.

## Tables without RLS

`User`, `ContactMessage`, `Order`, `Favorite` and the Auth.js adapter tables.
None is among the 13 the brief names.

`User` is the deliberate one: the credentials provider must look an account up
by email **before** a session exists, so a policy there would have to grant
anonymous SELECT — which is worse than no policy. It should instead be reached
only through the auth layer. `ContactMessage` holds submitted names, emails and
messages and has a reasonable claim to a policy; it is listed here as follow-up
rather than left unmentioned.
