-- Make the new append-only tables append-only at the GRANT level too.
--
-- The RLS matrix already denies UPDATE and DELETE on these by declaring no
-- policy for them, which is the primary control. This is the second half of
-- the same guarantee, following the pattern set in
-- 20260813001100_append_only_hardening: "no policy grants it" and "the role
-- cannot do it" are different promises, and a future matrix edit that
-- accidentally widened one of these would still be refused because the role
-- holds no privilege to exercise.
--
-- qhakaza_app keeps SELECT and INSERT. It does not own these tables, so this
-- cannot be undone from the application.
--
-- ASCII only.

-- A price once declared is not quietly revised. Correcting a figure means
-- declaring a new one, which is also how it works in life.
REVOKE UPDATE, DELETE ON "DeclaredPrice" FROM qhakaza_app;

-- An assessment that can be rewritten is not a record of what was decided.
-- A revised view supersedes its predecessor and leaves it standing.
REVOKE UPDATE, DELETE ON "ReadinessAssessment" FROM qhakaza_app;
REVOKE UPDATE, DELETE ON "ReadinessRating"     FROM qhakaza_app;

-- The field-level history of the record. If this could be edited it would be
-- worth nothing at the only moment it matters, which is when a record is
-- challenged.
REVOKE UPDATE, DELETE ON "RecordChange" FROM qhakaza_app;
