-- Phase 4 - part 2: internal notes, their revision history, review requests,
-- and the move of LISTED onto PUBLISHED.
--
-- Additive throughout. No column or table is dropped and no row is deleted.
-- ASCII only.

CREATE TABLE IF NOT EXISTS "InternalNote" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "convertedToEvidenceId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "convertedById" TEXT,
    "authorId" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalNote_subjectType_subjectId_idx"
  ON "InternalNote"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "InternalNote_authorId_idx" ON "InternalNote"("authorId");
CREATE INDEX IF NOT EXISTS "InternalNote_created_by_id_idx" ON "InternalNote"("created_by_id");

-- Append-only: the previous text of a note, written before each material edit.
CREATE TABLE IF NOT EXISTS "InternalNoteRevision" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "previousBody" TEXT NOT NULL,
    "editedById" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "InternalNoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InternalNoteRevision_noteId_created_date_idx"
  ON "InternalNoteRevision"("noteId", "created_date");
CREATE INDEX IF NOT EXISTS "InternalNoteRevision_created_by_id_idx"
  ON "InternalNoteRevision"("created_by_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InternalNoteRevision_noteId_fkey') THEN
    ALTER TABLE "InternalNoteRevision"
      ADD CONSTRAINT "InternalNoteRevision_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "InternalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- What a reviewer asked for. A record, not just a status: an artist told
-- "returned for information" without the question has been told nothing.
CREATE TABLE IF NOT EXISTS "ArtworkReviewRequest" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "requestedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "ArtworkReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ArtworkReviewRequest_artworkId_resolvedAt_idx"
  ON "ArtworkReviewRequest"("artworkId", "resolvedAt");
CREATE INDEX IF NOT EXISTS "ArtworkReviewRequest_created_by_id_idx"
  ON "ArtworkReviewRequest"("created_by_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtworkReviewRequest_artworkId_fkey') THEN
    ALTER TABLE "ArtworkReviewRequest"
      ADD CONSTRAINT "ArtworkReviewRequest_artworkId_fkey"
      FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- LISTED was the original name for what the brief calls Published. Same state,
-- same meaning; only the spelling changes.
UPDATE "Artwork" SET "status" = 'PUBLISHED' WHERE "status" = 'LISTED';
