-- Phase 3 - file storage.
--
-- One table for every uploaded file: artwork photographs now, evidence
-- documents and specialist reports in the VERA phases. Section 23 asks the
-- same questions of all of them, so they share a table.
--
-- Purely additive: a new table and two new enum types. Nothing is altered.
--
-- Note there is no DELETE policy anywhere for this table, and no delete path in
-- the application. Section 23 requires files to remain retrievable even when
-- the visible record changes, so withdrawal sets status = DELETED and the
-- object stays in the bucket.
--
-- ASCII only: a previous migration failed to apply because a non-ASCII
-- character in a comment could not be encoded under WIN1252.

-- CreateEnum
CREATE TYPE "FileConfidentiality" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('PENDING', 'STORED', 'DELETED');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'PENDING',
    "confidentiality" "FileConfidentiality" NOT NULL DEFAULT 'INTERNAL',
    "position" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storagePath_key" ON "MediaAsset"("storagePath");

-- CreateIndex
CREATE INDEX "MediaAsset_subjectType_subjectId_status_idx" ON "MediaAsset"("subjectType", "subjectId", "status");

-- CreateIndex
CREATE INDEX "MediaAsset_status_created_date_idx" ON "MediaAsset"("status", "created_date");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "MediaAsset_created_by_id_idx" ON "MediaAsset"("created_by_id");

