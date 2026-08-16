-- Phase 2 - the invitation lifecycle, part 2 of 2.
--
-- Adds the recipient-type table, the lifecycle timestamps, and the columns that
-- make an invitation single-use. Migrates existing rows onto the new status
-- spellings. No column or table is dropped and no row is deleted.
--
-- ASCII only. A previous migration failed to apply because a non-ASCII
-- character in a comment could not be encoded under WIN1252.

-- Who an invitation can be addressed to. A table rather than an enum so the
-- list stays extensible without a migration and a redeploy.
CREATE TABLE IF NOT EXISTS "InvitationRecipientType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grantsRole" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "InvitationRecipientType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvitationRecipientType_slug_key"
  ON "InvitationRecipientType"("slug");
CREATE INDEX IF NOT EXISTS "InvitationRecipientType_active_ordering_idx"
  ON "InvitationRecipientType"("active", "ordering");
CREATE INDEX IF NOT EXISTS "InvitationRecipientType_created_by_id_idx"
  ON "InvitationRecipientType"("created_by_id");

-- The two types the platform recognises today. Seeded here rather than in the
-- application seed because the invitation flow cannot function without them,
-- and a production database is never run through the development seed.
INSERT INTO "InvitationRecipientType" ("id", "slug", "label", "grantsRole", "ordering", "updated_date")
VALUES
  ('invrt_artist',    'ARTIST',    'Artist',    'ARTIST',    10, CURRENT_TIMESTAMP),
  ('invrt_collector', 'COLLECTOR', 'Collector', 'COLLECTOR', 20, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- The lifecycle timestamps, and the two columns that make an invitation
-- single-use. All nullable: existing rows have no history to invent.
ALTER TABLE "MemberInvitation"
  ADD COLUMN IF NOT EXISTS "recipientTypeId"  TEXT,
  ADD COLUMN IF NOT EXISTS "recipientName"    TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "openedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentById"         TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MemberInvitation_recipientTypeId_status_idx"
  ON "MemberInvitation"("recipientTypeId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MemberInvitation_recipientTypeId_fkey'
  ) THEN
    ALTER TABLE "MemberInvitation"
      ADD CONSTRAINT "MemberInvitation_recipientTypeId_fkey"
      FOREIGN KEY ("recipientTypeId") REFERENCES "InvitationRecipientType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing rows onto the new spellings. ISSUED and REVOKED were the original
-- names for what the brief calls Created and Cancelled; this is a rename of the
-- same state, not a change of meaning, so no history is lost.
UPDATE "MemberInvitation" SET "status" = 'CREATED'   WHERE "status" = 'ISSUED';
UPDATE "MemberInvitation" SET "status" = 'CANCELLED' WHERE "status" = 'REVOKED';

-- Every invitation that existed before this migration was a collector
-- invitation: artist invitations did not exist.
UPDATE "MemberInvitation"
   SET "recipientTypeId" = 'invrt_collector'
 WHERE "recipientTypeId" IS NULL;

ALTER TABLE "MemberInvitation" ALTER COLUMN "status" SET DEFAULT 'CREATED';

-- Drift from an earlier migration: the index was left under the pre-convention
-- name when the column was mapped to created_by_id.
ALTER INDEX IF EXISTS "PrivateNote_createdById_idx"
  RENAME TO "PrivateNote_created_by_id_idx";
