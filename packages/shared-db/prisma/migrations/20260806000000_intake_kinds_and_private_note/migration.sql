-- Three collector journeys, and the Private Note.
--
-- Purely additive: one new enum, one new column with a default, two new
-- nullable columns, one new index, one new table. No DROP, no DELETE, and no
-- existing row changes meaning.

-- ---------------------------------------------------------------------------
-- 1. Which journey produced an intake
-- ---------------------------------------------------------------------------
CREATE TYPE "CollectorIntakeKind" AS ENUM ('INTAKE', 'ACCESS_REQUEST', 'MEMBERSHIP_CONSIDERATION');

-- Defaults to INTAKE, so every row written before the journeys were separated
-- keeps exactly the meaning it had.
ALTER TABLE "CollectorIntake" ADD COLUMN "kind" "CollectorIntakeKind" NOT NULL DEFAULT 'INTAKE';

-- Only ever set on their own kind of request; nullable for every other row.
ALTER TABLE "CollectorIntake" ADD COLUMN "considerationNote" TEXT;
ALTER TABLE "CollectorIntake" ADD COLUMN "accessInterest" TEXT;

CREATE INDEX "CollectorIntake_kind_created_date_idx" ON "CollectorIntake"("kind", "created_date");

-- ---------------------------------------------------------------------------
-- 2. The Private Note
--
-- A separate table from PrivateNoteSubmission on purpose. That one is a member
-- writing to their advisor and requires a Membership; this one is a prospect
-- who has no membership for it to point at.
-- ---------------------------------------------------------------------------
CREATE TABLE "PrivateNote" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mediums" TEXT[],
    "regions" TEXT[],
    "subjects" TEXT,
    "acquisitionPace" TEXT,
    "budgetBand" TEXT,
    "advisoryStyle" TEXT,
    "contactStyle" TEXT,
    "building" TEXT,
    "frustrations" TEXT,
    "goodOutcome" TEXT,
    "mayContact" BOOLEAN NOT NULL DEFAULT false,
    "status" "NoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "PrivateNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateNote_status_created_date_idx" ON "PrivateNote"("status", "created_date");
CREATE INDEX "PrivateNote_email_idx" ON "PrivateNote"("email");
CREATE INDEX "PrivateNote_createdById_idx" ON "PrivateNote"("created_by_id");

-- ---------------------------------------------------------------------------
-- 3. Row-Level Security for the new table
--
-- Same shape as CollectorIntake: anyone may submit one, only staff may read
-- them. The public form needs INSERT; nothing else anonymous gets anything.
-- Written here rather than generated because PrivateNote is not one of the 13
-- core entities the matrix is keyed by.
-- ---------------------------------------------------------------------------
ALTER TABLE "PrivateNote" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privatenote_select" ON "PrivateNote";
CREATE POLICY "privatenote_select" ON "PrivateNote" FOR SELECT USING (
      coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
);

DROP POLICY IF EXISTS "privatenote_insert" ON "PrivateNote";
CREATE POLICY "privatenote_insert" ON "PrivateNote" FOR INSERT WITH CHECK (
      coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'collector'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'public'
);

DROP POLICY IF EXISTS "privatenote_update" ON "PrivateNote";
CREATE POLICY "privatenote_update" ON "PrivateNote" FOR UPDATE USING (
      coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
) WITH CHECK (
      coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
      OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
);

-- Nobody deletes a submission.
DROP POLICY IF EXISTS "privatenote_delete" ON "PrivateNote";
CREATE POLICY "privatenote_delete" ON "PrivateNote" FOR DELETE USING (false);

-- The app role can reach the new table at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON "PrivateNote" TO qhakaza_app;
