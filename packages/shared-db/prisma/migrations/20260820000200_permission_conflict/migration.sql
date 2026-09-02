-- D6: the permission conflict rule. MORE RESTRICTIVE WINS.
--
-- WHAT WAS WRONG, because this one was live and it mattered.
--
-- Both visibility functions tested the artist's permission like this:
--
--     EXISTS (SELECT 1 FROM "ArtistPermission" perm
--              WHERE perm."kind" = ...
--                AND perm."granted" = true
--                AND (perm."artworkId" IS NULL OR perm."artworkId" = work_id))
--
-- An EXISTS over GRANTING rows only. So an artist who permitted private
-- sharing across their work, and then denied it for one particular piece, was
-- still shown that piece: the artist-wide grant satisfied the EXISTS on its
-- own and the work-specific denial was never consulted. The rule the brief
-- asks for was not merely absent - it was inverted, and it failed in the
-- direction that exposes work the artist asked to be held back.
--
-- THE RULE NOW: a permission holds only if some applicable row grants it AND
-- no applicable row denies it. A row applies when it is artist-wide
-- (artworkId IS NULL) or names this work. One denial anywhere is a denial.
--
-- Chosen over "the more specific row wins" deliberately. Specificity-wins is
-- the more flexible rule and would let a work-specific grant override a
-- blanket refusal - which is exactly the case where being wrong is worst.
-- Restrictive-wins fails closed. Where an artist really does want one work
-- treated differently from a general refusal, that is a conversation with
-- Qhakaza, not a silent database precedence rule.
--
-- AN EXPIRED GRANT IS NOT A DENIAL. It stops satisfying the grant test and
-- takes no part in the denial test: permission lapses rather than the artist
-- being recorded as having refused. Denials do not expire.
--
-- "now() AT TIME ZONE 'UTC'", NOT "now()".
--
-- Prisma maps DateTime to "timestamp without time zone" and writes UTC into
-- it. now() is a timestamptz, so comparing the two makes Postgres cast now()
-- into the SESSION's time zone - and the database server is on
-- Africa/Johannesburg, UTC+2. A grant set to expire an hour from now was
-- therefore read as having expired an hour ago.
--
-- Caught by permission.db.test.ts, which asserted a live grant still carried a
-- work and got nothing back. Worth stating plainly because the failure is
-- silent and direction-dependent: at UTC+2 permissions lapse two hours early,
-- and west of UTC they would keep working for hours AFTER the artist's
-- deadline, which is the direction that actually harms someone.
--
-- ASCII only.

CREATE OR REPLACE FUNCTION qhakaza_permission_granted(
  artist_id  text,
  work_id    text,
  permission "PermissionKind"
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    EXISTS (
      SELECT 1
        FROM "ArtistPermission" p
       WHERE p."artistId" = artist_id
         AND p."kind"     = permission
         AND p."granted"  = true
         AND (p."expiresAt" IS NULL OR p."expiresAt" > (now() AT TIME ZONE 'UTC'))
         AND (p."artworkId" IS NULL OR p."artworkId" = work_id)
    )
    AND NOT EXISTS (
      SELECT 1
        FROM "ArtistPermission" p
       WHERE p."artistId" = artist_id
         AND p."kind"     = permission
         AND p."granted"  = false
         AND (p."artworkId" IS NULL OR p."artworkId" = work_id)
    );
$fn$;

REVOKE ALL ON FUNCTION qhakaza_permission_granted(text, text, "PermissionKind") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qhakaza_permission_granted(text, text, "PermissionKind") TO qhakaza_app;

-- ---------------------------------------------------------------------------
-- Both visibility functions now route their permission test through it.
--
-- The release and status halves are unchanged. Only the permission clause is
-- replaced, so this migration cannot widen visibility by accident: the new
-- clause is strictly narrower than the one it replaces for every input.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION qhakaza_collector_sees_artwork(work_id text, actor_uid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT actor_uid IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM "ArtworkRelease" rel
         JOIN "AudienceMember" am ON am."audienceId" = rel."audienceId"
         JOIN "Membership" mem   ON mem."id" = am."membershipId"
        WHERE rel."artworkId" = work_id
          AND rel."revokedAt" IS NULL
          AND rel."tier" = 'PRIVATE_COLLECTOR_PROJECTION'
          AND am."removedAt" IS NULL
          AND mem."userId" = actor_uid
          AND mem."status" = 'ACTIVE'
     )
     AND EXISTS (
       SELECT 1
         FROM "Artwork" art
        WHERE art."id" = work_id
          AND qhakaza_permission_granted(
                art."artistId", work_id, 'SHARE_PRIVATELY_WITH_COLLECTORS'::"PermissionKind")
     );
$fn$;

CREATE OR REPLACE FUNCTION qhakaza_public_sees_artwork(work_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
       SELECT 1
         FROM "Artwork" art
         JOIN "Artist" a ON a."id" = art."artistId"
        WHERE art."id" = work_id
          AND art."status" = 'PUBLIC_EDITORIAL'
          AND a."approved" = true
     )
     AND EXISTS (
       SELECT 1 FROM "ArtworkRelease" rel
        WHERE rel."artworkId" = work_id
          AND rel."tier" = 'PUBLIC_EDITORIAL'
          AND rel."revokedAt" IS NULL
     )
     AND EXISTS (
       SELECT 1
         FROM "Artwork" art
        WHERE art."id" = work_id
          AND qhakaza_permission_granted(
                art."artistId", work_id, 'PUBLISH_PUBLICLY'::"PermissionKind")
     );
$fn$;
