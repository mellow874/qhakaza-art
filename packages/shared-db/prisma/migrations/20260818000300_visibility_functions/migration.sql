-- Visibility checks as SECURITY DEFINER functions.
--
-- WHY THESE EXIST, because it is not obvious.
--
-- Row-level security applies INSIDE a policy's own subqueries. The collector
-- policy on "Artwork" asks whether a release exists to an audience holding this
-- collector - which means reading "ArtworkRelease", "AudienceMember" and
-- "Membership". A collector has no SELECT grant on the first two, deliberately:
-- they must not be able to read Qhakaza's distribution, only receive what it
-- produces.
--
-- So the EXISTS returned false for work that genuinely qualified, and every
-- collector saw nothing. The tests caught it: every negative case passed and
-- both positive cases failed, which is the signature of a check that is too
-- strict rather than too loose.
--
-- These functions run as their owner and so see through RLS. They are narrow on
-- purpose - they take ids and return a boolean, never a row - and EXECUTE is
-- granted only to the application role.
--
-- ASCII only.

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
         FROM "ArtistPermission" perm
         JOIN "Artwork" art ON art."artistId" = perm."artistId"
        WHERE art."id" = work_id
          AND perm."kind" = 'SHARE_PRIVATELY_WITH_COLLECTORS'
          AND perm."granted" = true
          AND (perm."artworkId" IS NULL OR perm."artworkId" = work_id)
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
         FROM "ArtistPermission" perm
         JOIN "Artwork" art ON art."artistId" = perm."artistId"
        WHERE art."id" = work_id
          AND perm."kind" = 'PUBLISH_PUBLICLY'
          AND perm."granted" = true
          AND (perm."artworkId" IS NULL OR perm."artworkId" = work_id)
     );
$fn$;

-- Narrow by construction, and narrower by grant.
REVOKE ALL ON FUNCTION qhakaza_collector_sees_artwork(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION qhakaza_public_sees_artwork(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION qhakaza_collector_sees_artwork(text, text) TO qhakaza_app;
GRANT EXECUTE ON FUNCTION qhakaza_public_sees_artwork(text) TO qhakaza_app;
