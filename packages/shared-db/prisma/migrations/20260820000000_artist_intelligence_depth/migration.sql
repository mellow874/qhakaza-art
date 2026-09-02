-- The Artist Intelligence Platform: depth in the artist and artwork records.
--
-- Adds 18 tables and 3 enums. DROPS NOTHING and DELETES NOTHING - every
-- existing column stays where it is, so code reading the old shape keeps
-- working while new capture moves to the new tables.
--
-- Four defects from the Phase 0 audit are addressed structurally here:
--   D1  a document could belong to only one record  -> "DocumentLink"
--   D2  a stored file had no type                   -> "DocumentType"
--   D4  a price change destroyed the old price      -> "DeclaredPrice"
--   D5  nothing could cite a Source but Evidence    -> "SourceReference"
--   D3  provenance could not express a gap          -> "ProvenanceLinkKind"
--
-- D6, the permission conflict rule, is a behavioural fix and lands separately
-- in 20260820000200_permission_conflict.
--
-- ASCII only: the database is WIN1252 and non-ASCII in migration SQL fails.

-- CreateEnum
CREATE TYPE "ProvenanceLinkKind" AS ENUM ('TRANSFER', 'UNKNOWN_INTERVAL', 'DISPUTED_TRANSFER', 'RETAINED');

-- CreateEnum
CREATE TYPE "VerificationState" AS ENUM ('UNVERIFIED', 'ARTIST_DECLARED', 'DOCUMENT_ON_FILE', 'INDEPENDENTLY_VERIFIED', 'UNABLE_TO_VERIFY', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AssertionOrigin" AS ENUM ('ARTIST', 'QHAKAZA_STAFF', 'DOCUMENT', 'THIRD_PARTY');

-- AlterEnum

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "basedIn" TEXT,
ADD COLUMN     "biographyInternal" TEXT,
ADD COLUMN     "biographyPublic" TEXT,
ADD COLUMN     "birthYear" INTEGER,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "practice" TEXT;

-- AlterTable
ALTER TABLE "ArtistPermission" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "scopeNote" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "documentTypeId" TEXT;

-- AlterTable
ALTER TABLE "ProvenanceTransaction" ADD COLUMN     "assertedById" TEXT,
ADD COLUMN     "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'QHAKAZA_STAFF',
ADD COLUMN     "kind" "ProvenanceLinkKind" NOT NULL DEFAULT 'TRANSFER',
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- CreateTable
CREATE TABLE "Medium" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "family" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Medium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitionType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ExhibitionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "SignalType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvEntryType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CvEntryType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepresentationType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "RepresentationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "defaultConfidentiality" "FileConfidentiality" NOT NULL DEFAULT 'INTERNAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "DocumentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessCriterion" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ReadinessCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistMedium" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "mediumId" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtistMedium_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistExhibition" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "typeId" TEXT,
    "role" TEXT,
    "curator" TEXT,
    "reference" TEXT,
    "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'ARTIST',
    "assertedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtistExhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistRepresentation" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "typeId" TEXT,
    "territory" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "current" BOOLEAN NOT NULL DEFAULT true,
    "exclusive" BOOLEAN,
    "note" TEXT,
    "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'ARTIST',
    "assertedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtistRepresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CvEntry" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "typeId" TEXT,
    "title" TEXT NOT NULL,
    "organisation" TEXT,
    "location" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "detail" TEXT,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'ARTIST',
    "assertedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CvEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalSignal" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "signalTypeId" TEXT,
    "partyId" TEXT,
    "institution" TEXT,
    "description" TEXT NOT NULL,
    "occurredOn" TIMESTAMP(3),
    "year" INTEGER,
    "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'ARTIST',
    "assertedById" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "InstitutionalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistLink" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "verification" "VerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "checkedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtistLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclaredPrice" (
    "id" TEXT NOT NULL,
    "artistId" TEXT,
    "artworkId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "basis" TEXT,
    "note" TEXT,
    "declaredOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaredVia" "AssertionOrigin" NOT NULL DEFAULT 'ARTIST',
    "declaredById" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "DeclaredPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessAssessment" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "methodologyVersionId" TEXT,
    "summary" TEXT,
    "recommendation" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "ReadinessAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessRating" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "rating" TEXT,
    "evidence" TEXT,
    "concern" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "ReadinessRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordChange" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedRole" "Role",
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "RecordChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLink" (
    "id" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "role" TEXT,
    "primaryLink" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceReference" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "field" TEXT,
    "locator" TEXT,
    "extract" TEXT,
    "assertedVia" "AssertionOrigin" NOT NULL DEFAULT 'QHAKAZA_STAFF',
    "assertedById" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "SourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medium_slug_key" ON "Medium"("slug");

-- CreateIndex
CREATE INDEX "Medium_active_ordering_idx" ON "Medium"("active", "ordering");

-- CreateIndex
CREATE INDEX "Medium_created_by_id_idx" ON "Medium"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitionType_slug_key" ON "ExhibitionType"("slug");

-- CreateIndex
CREATE INDEX "ExhibitionType_active_ordering_idx" ON "ExhibitionType"("active", "ordering");

-- CreateIndex
CREATE INDEX "ExhibitionType_created_by_id_idx" ON "ExhibitionType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "SignalType_slug_key" ON "SignalType"("slug");

-- CreateIndex
CREATE INDEX "SignalType_active_ordering_idx" ON "SignalType"("active", "ordering");

-- CreateIndex
CREATE INDEX "SignalType_created_by_id_idx" ON "SignalType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "CvEntryType_slug_key" ON "CvEntryType"("slug");

-- CreateIndex
CREATE INDEX "CvEntryType_active_ordering_idx" ON "CvEntryType"("active", "ordering");

-- CreateIndex
CREATE INDEX "CvEntryType_created_by_id_idx" ON "CvEntryType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "RepresentationType_slug_key" ON "RepresentationType"("slug");

-- CreateIndex
CREATE INDEX "RepresentationType_active_ordering_idx" ON "RepresentationType"("active", "ordering");

-- CreateIndex
CREATE INDEX "RepresentationType_created_by_id_idx" ON "RepresentationType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentType_slug_key" ON "DocumentType"("slug");

-- CreateIndex
CREATE INDEX "DocumentType_active_ordering_idx" ON "DocumentType"("active", "ordering");

-- CreateIndex
CREATE INDEX "DocumentType_created_by_id_idx" ON "DocumentType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessCriterion_slug_key" ON "ReadinessCriterion"("slug");

-- CreateIndex
CREATE INDEX "ReadinessCriterion_active_ordering_idx" ON "ReadinessCriterion"("active", "ordering");

-- CreateIndex
CREATE INDEX "ReadinessCriterion_created_by_id_idx" ON "ReadinessCriterion"("created_by_id");

-- CreateIndex
CREATE INDEX "ArtistMedium_artistId_primary_idx" ON "ArtistMedium"("artistId", "primary");

-- CreateIndex
CREATE INDEX "ArtistMedium_created_by_id_idx" ON "ArtistMedium"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistMedium_artistId_mediumId_key" ON "ArtistMedium"("artistId", "mediumId");

-- CreateIndex
CREATE INDEX "ArtistExhibition_artistId_verification_idx" ON "ArtistExhibition"("artistId", "verification");

-- CreateIndex
CREATE INDEX "ArtistExhibition_created_by_id_idx" ON "ArtistExhibition"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistExhibition_artistId_exhibitionId_key" ON "ArtistExhibition"("artistId", "exhibitionId");

-- CreateIndex
CREATE INDEX "ArtistRepresentation_artistId_current_idx" ON "ArtistRepresentation"("artistId", "current");

-- CreateIndex
CREATE INDEX "ArtistRepresentation_partyId_idx" ON "ArtistRepresentation"("partyId");

-- CreateIndex
CREATE INDEX "ArtistRepresentation_created_by_id_idx" ON "ArtistRepresentation"("created_by_id");

-- CreateIndex
CREATE INDEX "CvEntry_artistId_ordering_idx" ON "CvEntry"("artistId", "ordering");

-- CreateIndex
CREATE INDEX "CvEntry_artistId_verification_idx" ON "CvEntry"("artistId", "verification");

-- CreateIndex
CREATE INDEX "CvEntry_created_by_id_idx" ON "CvEntry"("created_by_id");

-- CreateIndex
CREATE INDEX "InstitutionalSignal_artistId_verification_idx" ON "InstitutionalSignal"("artistId", "verification");

-- CreateIndex
CREATE INDEX "InstitutionalSignal_partyId_idx" ON "InstitutionalSignal"("partyId");

-- CreateIndex
CREATE INDEX "InstitutionalSignal_created_by_id_idx" ON "InstitutionalSignal"("created_by_id");

-- CreateIndex
CREATE INDEX "ArtistLink_artistId_idx" ON "ArtistLink"("artistId");

-- CreateIndex
CREATE INDEX "ArtistLink_created_by_id_idx" ON "ArtistLink"("created_by_id");

-- CreateIndex
CREATE INDEX "DeclaredPrice_artworkId_current_idx" ON "DeclaredPrice"("artworkId", "current");

-- CreateIndex
CREATE INDEX "DeclaredPrice_artistId_declaredOn_idx" ON "DeclaredPrice"("artistId", "declaredOn");

-- CreateIndex
CREATE INDEX "DeclaredPrice_created_by_id_idx" ON "DeclaredPrice"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_supersedesId_key" ON "ReadinessAssessment"("supersedesId");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_artistId_assessedAt_idx" ON "ReadinessAssessment"("artistId", "assessedAt");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_created_by_id_idx" ON "ReadinessAssessment"("created_by_id");

-- CreateIndex
CREATE INDEX "ReadinessRating_criterionId_idx" ON "ReadinessRating"("criterionId");

-- CreateIndex
CREATE INDEX "ReadinessRating_created_by_id_idx" ON "ReadinessRating"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessRating_assessmentId_criterionId_key" ON "ReadinessRating"("assessmentId", "criterionId");

-- CreateIndex
CREATE INDEX "RecordChange_subjectType_subjectId_changedAt_idx" ON "RecordChange"("subjectType", "subjectId", "changedAt");

-- CreateIndex
CREATE INDEX "RecordChange_changedById_changedAt_idx" ON "RecordChange"("changedById", "changedAt");

-- CreateIndex
CREATE INDEX "RecordChange_created_by_id_idx" ON "RecordChange"("created_by_id");

-- CreateIndex
CREATE INDEX "DocumentLink_subjectType_subjectId_idx" ON "DocumentLink"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "DocumentLink_created_by_id_idx" ON "DocumentLink"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentLink_mediaAssetId_subjectType_subjectId_key" ON "DocumentLink"("mediaAssetId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "SourceReference_subjectType_subjectId_idx" ON "SourceReference"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "SourceReference_sourceId_idx" ON "SourceReference"("sourceId");

-- CreateIndex
CREATE INDEX "SourceReference_created_by_id_idx" ON "SourceReference"("created_by_id");

-- CreateIndex
CREATE INDEX "MediaAsset_documentTypeId_idx" ON "MediaAsset"("documentTypeId");

-- CreateIndex
CREATE INDEX "ProvenanceTransaction_artworkId_sequence_idx" ON "ProvenanceTransaction"("artworkId", "sequence");

-- CreateIndex
CREATE INDEX "ProvenanceTransaction_artworkId_kind_idx" ON "ProvenanceTransaction"("artworkId", "kind");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistMedium" ADD CONSTRAINT "ArtistMedium_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistMedium" ADD CONSTRAINT "ArtistMedium_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "Medium"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistExhibition" ADD CONSTRAINT "ArtistExhibition_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistExhibition" ADD CONSTRAINT "ArtistExhibition_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistExhibition" ADD CONSTRAINT "ArtistExhibition_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ExhibitionType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistRepresentation" ADD CONSTRAINT "ArtistRepresentation_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistRepresentation" ADD CONSTRAINT "ArtistRepresentation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistRepresentation" ADD CONSTRAINT "ArtistRepresentation_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "RepresentationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvEntry" ADD CONSTRAINT "CvEntry_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CvEntry" ADD CONSTRAINT "CvEntry_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "CvEntryType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalSignal" ADD CONSTRAINT "InstitutionalSignal_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalSignal" ADD CONSTRAINT "InstitutionalSignal_signalTypeId_fkey" FOREIGN KEY ("signalTypeId") REFERENCES "SignalType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalSignal" ADD CONSTRAINT "InstitutionalSignal_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistLink" ADD CONSTRAINT "ArtistLink_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaredPrice" ADD CONSTRAINT "DeclaredPrice_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaredPrice" ADD CONSTRAINT "DeclaredPrice_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessAssessment" ADD CONSTRAINT "ReadinessAssessment_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessAssessment" ADD CONSTRAINT "ReadinessAssessment_methodologyVersionId_fkey" FOREIGN KEY ("methodologyVersionId") REFERENCES "MethodologyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessAssessment" ADD CONSTRAINT "ReadinessAssessment_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ReadinessAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessRating" ADD CONSTRAINT "ReadinessRating_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessRating" ADD CONSTRAINT "ReadinessRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ReadinessCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceReference" ADD CONSTRAINT "SourceReference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- BACKFILL
-- ---------------------------------------------------------------------------

-- Every existing file keeps the attachment it already had, now expressed as a
-- link row. Marked primaryLink so the original owner stays identifiable after
-- further attachments are added. Idempotent via the unique constraint.
INSERT INTO "DocumentLink" ("id", "mediaAssetId", "subjectType", "subjectId", "primaryLink", "created_date", "updated_date")
SELECT
  'dl_' || "id",
  "id",
  "subjectType",
  "subjectId",
  true,
  now(),
  now()
FROM "MediaAsset"
ON CONFLICT ("mediaAssetId", "subjectType", "subjectId") DO NOTHING;

-- Existing provenance rows get an explicit position in their chain, ordered by
-- the only signal available: the date, with undated links last rather than
-- first. They remain TRANSFER, which is what they asserted when nothing else
-- was expressible.
WITH ordered AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "artworkId"
      ORDER BY "occurredOn" ASC NULLS LAST, "created_date" ASC
    ) AS position
  FROM "ProvenanceTransaction"
)
UPDATE "ProvenanceTransaction" t
   SET "sequence" = ordered.position
  FROM ordered
 WHERE t."id" = ordered."id";

-- The current declared price of every work becomes the first entry in its
-- pricing history. Without this the history would begin at the next edit and
-- appear to show a work that had never had a price.
INSERT INTO "DeclaredPrice" ("id", "artworkId", "amount", "currency", "basis", "declaredOn", "declaredVia", "current", "created_date")
SELECT
  'dp_' || "id",
  "id",
  "price",
  "currency",
  'Carried forward from the artwork record at migration',
  "created_date",
  'ARTIST',
  true,
  now()
FROM "Artwork"
WHERE NOT EXISTS (SELECT 1 FROM "DeclaredPrice" d WHERE d."artworkId" = "Artwork"."id");

-- ---------------------------------------------------------------------------
-- REFERENCE DATA
--
-- These are standing art-world vocabulary, not Qhakaza's proprietary
-- judgements: an exhibition is solo or group whoever is looking at it. They
-- are seeded so the admin screens have something to manage on day one, and
-- every one of them is editable and deactivatable from the Command Center.
--
-- "ReadinessCriterion" IS DELIBERATELY LEFT EMPTY. The readiness framework is
-- Qhakaza's own intellectual property and the platform's job is to apply it,
-- not to author it. Criteria invented by a developer would look authoritative
-- and be worthless. The admin screen explains the emptiness rather than
-- presenting it as a fault.
-- ---------------------------------------------------------------------------

INSERT INTO "Medium" ("id", "slug", "label", "family", "ordering", "created_date", "updated_date") VALUES
  ('med_oil',         'oil-on-canvas', 'Oil on canvas', 'Painting',       10, now(), now()),
  ('med_acrylic',     'acrylic',       'Acrylic',       'Painting',       20, now(), now()),
  ('med_watercolour', 'watercolour',   'Watercolour',   'Painting',       30, now(), now()),
  ('med_mixed',       'mixed-media',   'Mixed media',   'Painting',       40, now(), now()),
  ('med_photo',       'photography',   'Photography',   'Photography',    50, now(), now()),
  ('med_print',       'printmaking',   'Printmaking',   'Works on paper', 60, now(), now()),
  ('med_drawing',     'drawing',       'Drawing',       'Works on paper', 70, now(), now()),
  ('med_sculpture',   'sculpture',     'Sculpture',     'Sculpture',      80, now(), now()),
  ('med_ceramic',     'ceramics',      'Ceramics',      'Sculpture',      90, now(), now()),
  ('med_textile',     'textile',       'Textile',       'Textile',       100, now(), now()),
  ('med_installation','installation',  'Installation',  'Installation',  110, now(), now()),
  ('med_video',       'video',         'Video',         'Time-based',    120, now(), now()),
  ('med_performance', 'performance',   'Performance',   'Time-based',    130, now(), now()),
  ('med_digital',     'digital',       'Digital',       'Time-based',    140, now(), now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "ExhibitionType" ("id", "slug", "label", "guidance", "ordering", "created_date", "updated_date") VALUES
  ('ext_solo',     'solo',          'Solo exhibition',       'The artist is the sole exhibitor.',           10, now(), now()),
  ('ext_two',      'two-person',    'Two-person exhibition', 'Shared with one other artist.',               20, now(), now()),
  ('ext_group',    'group',         'Group exhibition',      'Three or more artists.',                      30, now(), now()),
  ('ext_biennale', 'biennale',      'Biennale or triennial', 'A recurring international survey.',           40, now(), now()),
  ('ext_fair',     'art-fair',      'Art fair',              'Presented on a gallery stand.',               50, now(), now()),
  ('ext_museum',   'institutional', 'Institutional survey',  'Mounted by a museum or public institution.',  60, now(), now()),
  ('ext_online',   'online',        'Online exhibition',     'Presented online only.',                      70, now(), now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "SignalType" ("id", "slug", "label", "guidance", "ordering", "created_date", "updated_date") VALUES
  ('sig_acquisition', 'public-acquisition',   'Public collection acquisition', 'Acquired into a museum or public collection.',    10, now(), now()),
  ('sig_corporate',   'corporate-collection', 'Corporate collection',          'Acquired into a corporate collection.',           20, now(), now()),
  ('sig_prize',       'prize',                'Prize or award',                'Won or shortlisted.',                             30, now(), now()),
  ('sig_residency',   'residency',            'Residency',                     'A funded or selected residency.',                 40, now(), now()),
  ('sig_commission',  'commission',           'Commission',                    'Commissioned by an institution or public body.',  50, now(), now()),
  ('sig_grant',       'grant',                'Grant or funding',              'Awarded project or development funding.',         60, now(), now()),
  ('sig_biennale',    'biennale-selection',   'Biennale selection',            'Selected for a biennale or major survey.',        70, now(), now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CvEntryType" ("id", "slug", "label", "ordering", "created_date", "updated_date") VALUES
  ('cv_education',   'education',         'Education',          10, now(), now()),
  ('cv_solo',        'solo-exhibitions',  'Solo exhibitions',   20, now(), now()),
  ('cv_group',       'group-exhibitions', 'Group exhibitions',  30, now(), now()),
  ('cv_residency',   'residencies',       'Residencies',        40, now(), now()),
  ('cv_award',       'awards',            'Awards',             50, now(), now()),
  ('cv_collection',  'collections',       'Public collections', 60, now(), now()),
  ('cv_teaching',    'teaching',          'Teaching',           70, now(), now()),
  ('cv_press',       'selected-press',    'Selected press',     80, now(), now()),
  ('cv_publication', 'publications',      'Publications',       90, now(), now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RepresentationType" ("id", "slug", "label", "ordering", "created_date", "updated_date") VALUES
  ('rep_primary',   'primary-gallery',   'Primary gallery',   10, now(), now()),
  ('rep_secondary', 'secondary-gallery', 'Secondary gallery', 20, now(), now()),
  ('rep_agent',     'agent',             'Agent',             30, now(), now()),
  ('rep_estate',    'estate',            'Estate',            40, now(), now()),
  ('rep_self',      'self-represented',  'Self-represented',  50, now(), now())
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "DocumentType" ("id", "slug", "label", "guidance", "defaultConfidentiality", "ordering", "created_date", "updated_date") VALUES
  ('doc_certificate', 'certificate-of-authenticity', 'Certificate of authenticity', 'Issued by the artist, gallery or an authenticating body.', 'INTERNAL',      10, now(), now()),
  ('doc_condition',   'condition-report',            'Condition report',            'The physical state of the work at a point in time.',       'INTERNAL',      20, now(), now()),
  ('doc_provenance',  'provenance-document',         'Provenance document',         'Evidences a change of hands.',                             'CONFIDENTIAL',  30, now(), now()),
  ('doc_invoice',     'invoice',                     'Invoice or receipt',          'Names parties and amounts.',                               'CONFIDENTIAL',  40, now(), now()),
  ('doc_catalogue',   'exhibition-catalogue',        'Exhibition catalogue',        'May evidence both an exhibition and a provenance link.',   'INTERNAL',      50, now(), now()),
  ('doc_press',       'press-article',               'Press article',               'Published coverage.',                                      'INTERNAL',      60, now(), now()),
  ('doc_cv',          'artist-cv',                   'Artist CV',                   'The uploaded original behind the structured entries.',     'INTERNAL',      70, now(), now()),
  ('doc_contract',    'contract',                    'Contract or agreement',       'Representation, consignment or sale terms.',               'CONFIDENTIAL',  80, now(), now()),
  ('doc_correspond',  'correspondence',              'Correspondence',              'Letters and email relied on as evidence.',                 'CONFIDENTIAL',  90, now(), now()),
  ('doc_identity',    'identity-document',           'Identity document',           'Held only where a check requires it.',                     'CONFIDENTIAL', 100, now(), now()),
  ('doc_artwork_img', 'artwork-image',               'Artwork image',               'A photograph of the work itself.',                          'PUBLIC',       110, now(), now()),
  ('doc_other',       'other',                       'Other',                       'Use sparingly. An untyped document is hard to rely on.',    'INTERNAL',     120, now(), now())
ON CONFLICT ("slug") DO NOTHING;

-- Existing artwork images are the one document type that can be inferred
-- safely: they were uploaded against an Artwork and they are images.
UPDATE "MediaAsset"
   SET "documentTypeId" = 'doc_artwork_img'
 WHERE "documentTypeId" IS NULL
   AND "subjectType" = 'Artwork'
   AND "contentType" LIKE 'image/%';
