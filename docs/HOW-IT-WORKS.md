# How the three sites work together

Three applications. **One database.** They never call each other and never
import from each other — everything they share, they share through Postgres and
the `packages/` layer.

```
              ┌──────────────────────────────────────────────┐
              │            ONE POSTGRES DATABASE             │
              │   51 entities, Row-Level Security on    │
              └───────▲──────────────▲──────────────▲────────┘
                      │              │              │
        @qhakaza/shared-db  ·  shared-auth  ·  shared-ui
                      │              │              │
        ┌─────────────┴───┐  ┌───────┴──────┐  ┌────┴──────────────┐
        │  ARTIST         │  │  COLLECTOR   │  │  COMMAND CENTER   │
        │  INTELLIGENCE   │  │   platform   │  │    staff only     │
        │  PLATFORM       │  │              │  │                   │
        │    port 3001    │  │  port 3002   │  │    port 3003      │
        └─────────────────┘  └──────────────┘  └───────────────────┘
             artists            collectors    admin + advisor + analyst
```

There is **no link between the Artist Intelligence Platform and the Collector Platform**. They are separate
websites for separate audiences. The only thing connecting them is the Command
Center, and it connects them through data, not navigation.

---

## The three apps

### the Artist Intelligence Platform — `localhost:3001`

The public, indexable artist website. Marketing pages, sign-in, sign-up, artist
onboarding.

The Artist Intelligence Platform can read released artists and artworks, and write its own artist's profile.
It **cannot touch a single collector table** — not by convention, but because the
database refuses.

### Collector Platform — `localhost:3002`

Two surfaces in one app, with opposite rules:

| Route                              | Public? | Indexed?                     |
| ---------------------------------- | ------- | ---------------------------- |
| `/collectors/*` — membership shell | yes     | **yes**, has SEO             |
| `/private/<token>/*` — concierge   | **no**  | **no** — noindex, no sitemap |

`/` redirects to `/collectors`.

### Command Center — `localhost:3003`

The staff console, and **the only bridge between the two sites**. Admins and
advisors vet artists, release work, verify collector applications, issue
invitations, triage enquiries, and manage permissions.

Never indexed. Every action writes an audit record.

---

## The pipeline

This is the loop the whole system exists to carry:

```
 1. ARTIST          signs up on the Artist Intelligence Platform, builds a profile, submits work
                      ↓  invisible to everyone — unapproved, unreleased
 2. ADMIN/ADVISOR   approves the artist in the Command Center
                    releases the work to LISTED
                      ↓
 3. COLLECTOR       applies at /collectors/apply
 4. ADMIN/ADVISOR   verifies the application
                    issues an invitation → a token, shown ONCE
                      ↓
 5. COLLECTOR       opens /private/<token>, signs in, browses released work
                    sends a private enquiry
                      ↓
 6. ADVISOR         sees the enquiry in the Command Center, attached to the
                    artwork and the artist behind it
```

Every step in 2 and 4 writes an `AuditLog` row in the same transaction as the
change, so an action that could not be recorded did not happen.

**Approval is a live gate, not a one-off stamp.** Withdraw an artist's approval
and their released work disappears from the collector side immediately.

---

## Try it end to end

```bash
npm install
npm run db:up          # Postgres on :5432 (dev) and :5433 (test)
npm run db:migrate     # or db:deploy
npm run db:seed
```

Then, in three terminals:

```bash
npm run vera            # → http://localhost:3001
npm run collector       # → http://localhost:3002
npm run command-center  # → http://localhost:3003
```

### Seeded accounts — password `password123` for all

| Email                 | Role      | Use it for                                          |
| --------------------- | --------- | --------------------------------------------------- |
| `admin@qhakaza.art`   | ADMIN     | everything, including permissions                   |
| `advisor@qhakaza.art` | ADVISOR   | vetting and invitations, **not** permissions        |
| `thandi@qhakaza.art`  | ARTIST    | an approved artist with listed work                 |
| `sipho@qhakaza.art`   | ARTIST    | **awaiting approval** — approve them in the console |
| `lerato@example.com`  | COLLECTOR | signing in to open an invitation                    |

### The five-minute demo

1. **the Artist Intelligence Platform** (`:3001`) — browse the public site. Sign in as `thandi@qhakaza.art`,
   or create a new account at `/signup`.
2. **Collector shell** (`:3002/collectors`) — read the membership pages, then
   submit `/collectors/apply`.
3. **Command Center** (`:3003`) — sign in as `admin@qhakaza.art`.
   - Approve **Sipho Ndlovu Studio** under _Verification & vetting_.
   - Release one of their works.
   - Find your application under _Collector intake_ → **Verify** → **Issue
     invitation**.
   - **Copy the link it shows you. It is displayed once and never again** — only
     a SHA-256 of the token is stored, so it cannot be read back out of the
     database by anyone.
4. **Collector private area** — open `:3002/private/<token>`. You will be sent to
   sign in; use `lerato@example.com`. You then land in the member area, can
   browse released work, and can send an enquiry.
5. **Back to the Command Center** — the enquiry is under _Communications_,
   attached to the artwork and its artist. Every step you took is in the
   _Audit trail_ panel.

Try `:3002/private/made-up-token` too. It refuses, tells you nothing about why,
and writes an `ActivationAttempt` row you can see in the console.

---

## Why they cannot interfere with each other

Three layers, and the deepest one does not depend on anybody remembering:

1. **Route fencing** at the edge (`proxy.ts`) — fast, and bypassable.
2. **Server-side guards** — `requireRole()` and `requireToken()` re-checked in
   every server action, because a server action is a public HTTP endpoint.
3. **Row-Level Security** in Postgres. The apps connect as `qhakaza_app`, which
   is not the table owner, not a superuser, and holds no BYPASSRLS. An artist
   session querying `CollectorIntake` gets an empty result from the database
   itself.

Anything that does not declare an actor runs as anonymous and gets only what the
public is granted — so forgetting costs access rather than silently keeping it.

Full detail, including the policy matrix: [RLS.md](RLS.md).

---

## Who can do what

|           | The Artist Intelligence Platform                      | `/collectors` | `/private/<token>`        | Command Center        |
| --------- | ------------------------- | ------------- | ------------------------- | --------------------- |
| Anonymous | ✅ browse, apply, sign up | ✅            | ❌                        | ❌                    |
| Artist    | ✅ own profile and work   | ✅            | ❌                        | ❌                    |
| Collector | ✅                        | ✅            | ✅ **with a valid token** | ❌                    |
| Advisor   | ✅                        | ✅            | ✅                        | ✅ except permissions |
| Admin     | ✅                        | ✅            | ✅                        | ✅                    |

Staff cannot enrol themselves. `/signup` offers ARTIST and COLLECTOR only;
ADMIN and ADVISOR are granted from inside the Command Center by an existing
administrator, and an administrator cannot demote themselves — nothing in the
console could put the rights back.
