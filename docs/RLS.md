# Row-Level Security

The policy matrix is declared once, in
[`packages/shared-db/src/rls.ts`](../packages/shared-db/src/rls.ts), generated
into SQL by `scripts/generate-rls.ts`, and asserted against the live database by
`rls.db.test.ts`. Editing the matrix without regenerating fails the suite rather
than drifting quietly.

**52 policies across the 13 core entities. 30 adversarial tests.**

## Status: enforced

|                                                              | State                            |
| ------------------------------------------------------------ | -------------------------------- |
| Policies applied to dev and test databases                   | ✅                               |
| `qhakaza_app` role — NOSUPERUSER, NOBYPASSRLS, not the owner | ✅                               |
| Adversarial tests pass against that constrained role         | ✅ 30/30                         |
| **All three apps connect as that role**                      | ✅                               |
| Full regression under the constrained role                   | ✅ 323 unit/integration, 226 E2E |

The apps connect as `qhakaza_app`. Migrations use `DIRECT_DATABASE_URL` (the
owner), which correctly bypasses RLS — the app role has no rights to `ALTER`
anything.

Confirmed live against the dev database after cutover: the app connection
reports `superuser: false, bypassrls: false`, sees **3 of 10** artworks (only
released ones) and **0 of 17** collector intakes.

## Where each actor is declared

| Path                                     | Actor                              |
| ---------------------------------------- | ---------------------------------- |
| `shared-auth/guards.ts` — `requireToken` | `system`                           |
| `collector` — activation logging         | `system`                           |
| `collector` — private discovery, enquiry | `collector`                        |
| `collector` — public intake form         | anonymous (granted INSERT only)    |
| `vera` — public catalogue                | anonymous (SELECT on released)     |
| `vera` — artist profile read and write   | `artist`                           |
| `command-center` — every query           | `admin` / `advisor` via `readAs`   |
| `command-center` — every audited write   | `setActor` inside `performAudited` |

Anything not on this list runs anonymous and gets only what the matrix grants
`public`. Forgetting to declare an actor costs access; it never silently keeps
it.

### Tests connect as the owner

E2E fixtures and integration suites seed with a **privileged** client
(`DIRECT_DATABASE_URL`). Creating an artist or an invitation is something RLS
correctly forbids an anonymous app connection from doing. The app under test
still runs constrained — that is the point; the fixtures only arrange the world
around it.

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

### 3. Uniqueness checks stop seeing what they need — **fixed**

`saveArtistProfile` used to mint a slug by asking whether a candidate was
already taken. Under the `artist` policy an artist sees only their own row, so
that check reported every other artist's slug as free and the insert then failed
on the unique constraint.

Fixed by inverting it: `slugCandidates()` produces `base`, `base-2`, `base-3`…
and each is _attempted_, with a `P2002` on `slug` moving to the next. The unique
index is the only thing that actually knows what is free, so it is what decides.

This was a latent bug independent of RLS — check-then-insert also loses to two
artists onboarding simultaneously. RLS surfaced it; it was always wrong.

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
