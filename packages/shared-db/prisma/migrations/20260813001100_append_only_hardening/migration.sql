-- Phase 6 - make the append-only tables append-only at the GRANT level too.
--
-- RLS already denies UPDATE and DELETE on these by having no policy for them,
-- which is the primary control. This is defence in depth: a future policy edit
-- that accidentally widened one of these would still be refused, because the
-- role has no privilege to exercise.
--
-- The brief asks for append-only audit tables. "No policy grants it" and "the
-- role cannot do it" are different guarantees, and material history is worth
-- both.
--
-- qhakaza_app keeps SELECT and INSERT. It is not the table owner, so this
-- cannot be worked around from the application.

REVOKE UPDATE, DELETE ON "AuditLog"             FROM qhakaza_app;
REVOKE UPDATE, DELETE ON "ActivationAttempt"    FROM qhakaza_app;
REVOKE UPDATE, DELETE ON "InternalNoteRevision" FROM qhakaza_app;

-- CaseVersion: an issued version is never rewritten. A revision inserts a new
-- row. This is what makes "a revised Case never destroys a previously issued
-- version" a database guarantee rather than a convention.
REVOKE UPDATE, DELETE ON "CaseVersion" FROM qhakaza_app;

-- Contradictions are preserved. Resolving one records HOW and leaves both
-- sides standing, so UPDATE is legitimate here and is NOT revoked -- only
-- DELETE, because a contradiction that can be deleted was never a record.
REVOKE DELETE ON "Contradiction" FROM qhakaza_app;
