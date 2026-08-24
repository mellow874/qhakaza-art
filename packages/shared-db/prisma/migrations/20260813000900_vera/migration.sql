-- Phase 5 - the VERA evidence and decision-intelligence layer.
--
-- 28 tables and 6 enums. PURELY ADDITIVE: no existing column, table or row is
-- altered or removed. Verified before writing - zero DROP, TRUNCATE or DELETE
-- statements in this file.
--
-- The shape is dictated by six constraints the brief states explicitly, each a
-- thing this schema must not be able to express:
--
--   one evidence -> one claim          EvidenceClaim junction
--   one artwork  -> one Case           CaseArtwork junction
--   one Case     -> one specialist     SpecialistEscalation is many per Case
--   fixed evidence categories          lookup TABLES, never enums
--   conclusions overwriting earlier    CaseVersion has no UPDATE policy at all
--   VERA as a report generator         the graph is the record
--
-- The ANALYST role value is added by the preceding migration, alone, because
-- PostgreSQL will not let a new enum value be used in the transaction that
-- added it.
--
-- ASCII only.

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'EVIDENCE_COLLECTION', 'UNDER_ANALYSIS', 'UNDER_REVIEW', 'AWAITING_SIGNATURE', 'ISSUED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('ASSERTED', 'SUPPORTED', 'CONTESTED', 'UNVERIFIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED_AS_LIMITATION');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'ANSWERED', 'DECLINED');

-- CreateEnum
CREATE TYPE "MethodologyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED');

-- AlterEnum

-- CreateTable
CREATE TABLE "EvidenceType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "EvidenceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReliabilityLevel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ReliabilityLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "GapType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "SpecialistCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyRole" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "PartyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "country" TEXT,
    "contactEmail" TEXT,
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exhibition" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Exhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publishedOn" TIMESTAMP(3),
    "reference" TEXT,
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvenanceTransaction" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "fromPartyId" TEXT,
    "toPartyId" TEXT,
    "occurredOn" TIMESTAMP(3),
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ProvenanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "sourceDate" TIMESTAMP(3),
    "description" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT,
    "evidenceTypeId" TEXT,
    "reliabilityId" TEXT,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "sourceDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'RECEIVED',
    "confidentiality" "FileConfidentiality" NOT NULL DEFAULT 'INTERNAL',
    "contradicted" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT,
    "statement" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'ASSERTED',
    "material" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "conclusion" TEXT NOT NULL,
    "inference" TEXT,
    "uncertainty" TEXT,
    "methodologyVersionId" TEXT,
    "assessedById" TEXT,
    "assessedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gap" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "artworkId" TEXT,
    "claimId" TEXT,
    "assessmentId" TEXT,
    "gapTypeId" TEXT,
    "description" TEXT NOT NULL,
    "materiality" TEXT,
    "responsibleParty" TEXT,
    "actionRequired" TEXT,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "status" "GapStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Gap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contradiction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "firstEvidenceId" TEXT NOT NULL,
    "secondEvidenceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "materiality" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Contradiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialistEscalation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "artworkId" TEXT,
    "categoryId" TEXT,
    "specialistId" TEXT,
    "specialistName" TEXT,
    "issue" TEXT NOT NULL,
    "reason" TEXT,
    "documentsSupplied" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EscalationStatus" NOT NULL DEFAULT 'REQUESTED',
    "response" TEXT,
    "conclusion" TEXT,
    "outstandingQuestions" TEXT,
    "completedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "SpecialistEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "status" "MethodologyStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "approvedBy" TEXT,
    "changeNotes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT,
    "collectorIntakeId" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "IntelligenceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseVersion" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "summary" TEXT,
    "decisionAssessment" TEXT,
    "uncertainties" TEXT,
    "limitations" TEXT,
    "methodologyVersionId" TEXT,
    "accountableName" TEXT,
    "accountableRole" TEXT,
    "accountableAt" TIMESTAMP(3),
    "signatureMethod" TEXT,
    "signatureAssetId" TEXT,
    "preparedByName" TEXT,
    "reviewedByName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CaseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseArtwork" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "role" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CaseArtwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseEvidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CaseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceClaim" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "supports" BOOLEAN NOT NULL DEFAULT true,
    "weight" TEXT,
    "note" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimAssessment" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ClaimAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkParty" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "roleId" TEXT,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "note" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtworkParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseParty" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "roleId" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CaseParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSource" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "EvidenceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkExhibition" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "exhibitionId" TEXT NOT NULL,
    "note" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtworkExhibition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkPublication" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "page" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtworkPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceType_slug_key" ON "EvidenceType"("slug");

-- CreateIndex
CREATE INDEX "EvidenceType_active_ordering_idx" ON "EvidenceType"("active", "ordering");

-- CreateIndex
CREATE INDEX "EvidenceType_created_by_id_idx" ON "EvidenceType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReliabilityLevel_slug_key" ON "ReliabilityLevel"("slug");

-- CreateIndex
CREATE INDEX "ReliabilityLevel_active_rank_idx" ON "ReliabilityLevel"("active", "rank");

-- CreateIndex
CREATE INDEX "ReliabilityLevel_created_by_id_idx" ON "ReliabilityLevel"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "GapType_slug_key" ON "GapType"("slug");

-- CreateIndex
CREATE INDEX "GapType_active_ordering_idx" ON "GapType"("active", "ordering");

-- CreateIndex
CREATE INDEX "GapType_created_by_id_idx" ON "GapType"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistCategory_slug_key" ON "SpecialistCategory"("slug");

-- CreateIndex
CREATE INDEX "SpecialistCategory_active_ordering_idx" ON "SpecialistCategory"("active", "ordering");

-- CreateIndex
CREATE INDEX "SpecialistCategory_created_by_id_idx" ON "SpecialistCategory"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "PartyRole_slug_key" ON "PartyRole"("slug");

-- CreateIndex
CREATE INDEX "PartyRole_active_ordering_idx" ON "PartyRole"("active", "ordering");

-- CreateIndex
CREATE INDEX "PartyRole_created_by_id_idx" ON "PartyRole"("created_by_id");

-- CreateIndex
CREATE INDEX "Party_name_idx" ON "Party"("name");

-- CreateIndex
CREATE INDEX "Party_created_by_id_idx" ON "Party"("created_by_id");

-- CreateIndex
CREATE INDEX "Exhibition_title_idx" ON "Exhibition"("title");

-- CreateIndex
CREATE INDEX "Exhibition_created_by_id_idx" ON "Exhibition"("created_by_id");

-- CreateIndex
CREATE INDEX "Publication_title_idx" ON "Publication"("title");

-- CreateIndex
CREATE INDEX "Publication_created_by_id_idx" ON "Publication"("created_by_id");

-- CreateIndex
CREATE INDEX "ProvenanceTransaction_artworkId_occurredOn_idx" ON "ProvenanceTransaction"("artworkId", "occurredOn");

-- CreateIndex
CREATE INDEX "ProvenanceTransaction_created_by_id_idx" ON "ProvenanceTransaction"("created_by_id");

-- CreateIndex
CREATE INDEX "Source_name_idx" ON "Source"("name");

-- CreateIndex
CREATE INDEX "Source_created_by_id_idx" ON "Source"("created_by_id");

-- CreateIndex
CREATE INDEX "Evidence_artworkId_status_idx" ON "Evidence"("artworkId", "status");

-- CreateIndex
CREATE INDEX "Evidence_evidenceTypeId_idx" ON "Evidence"("evidenceTypeId");

-- CreateIndex
CREATE INDEX "Evidence_status_created_date_idx" ON "Evidence"("status", "created_date");

-- CreateIndex
CREATE INDEX "Evidence_created_by_id_idx" ON "Evidence"("created_by_id");

-- CreateIndex
CREATE INDEX "Claim_artworkId_status_idx" ON "Claim"("artworkId", "status");

-- CreateIndex
CREATE INDEX "Claim_created_by_id_idx" ON "Claim"("created_by_id");

-- CreateIndex
CREATE INDEX "Assessment_methodologyVersionId_idx" ON "Assessment"("methodologyVersionId");

-- CreateIndex
CREATE INDEX "Assessment_created_by_id_idx" ON "Assessment"("created_by_id");

-- CreateIndex
CREATE INDEX "Gap_caseId_status_idx" ON "Gap"("caseId", "status");

-- CreateIndex
CREATE INDEX "Gap_artworkId_idx" ON "Gap"("artworkId");

-- CreateIndex
CREATE INDEX "Gap_status_dueAt_idx" ON "Gap"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Gap_created_by_id_idx" ON "Gap"("created_by_id");

-- CreateIndex
CREATE INDEX "Contradiction_caseId_idx" ON "Contradiction"("caseId");

-- CreateIndex
CREATE INDEX "Contradiction_firstEvidenceId_idx" ON "Contradiction"("firstEvidenceId");

-- CreateIndex
CREATE INDEX "Contradiction_secondEvidenceId_idx" ON "Contradiction"("secondEvidenceId");

-- CreateIndex
CREATE INDEX "Contradiction_created_by_id_idx" ON "Contradiction"("created_by_id");

-- CreateIndex
CREATE INDEX "SpecialistEscalation_caseId_status_idx" ON "SpecialistEscalation"("caseId", "status");

-- CreateIndex
CREATE INDEX "SpecialistEscalation_categoryId_idx" ON "SpecialistEscalation"("categoryId");

-- CreateIndex
CREATE INDEX "SpecialistEscalation_created_by_id_idx" ON "SpecialistEscalation"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "MethodologyVersion_versionNumber_key" ON "MethodologyVersion"("versionNumber");

-- CreateIndex
CREATE INDEX "MethodologyVersion_status_effectiveFrom_idx" ON "MethodologyVersion"("status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MethodologyVersion_created_by_id_idx" ON "MethodologyVersion"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceCase_reference_key" ON "IntelligenceCase"("reference");

-- CreateIndex
CREATE INDEX "IntelligenceCase_status_openedAt_idx" ON "IntelligenceCase"("status", "openedAt");

-- CreateIndex
CREATE INDEX "IntelligenceCase_collectorIntakeId_idx" ON "IntelligenceCase"("collectorIntakeId");

-- CreateIndex
CREATE INDEX "IntelligenceCase_created_by_id_idx" ON "IntelligenceCase"("created_by_id");

-- CreateIndex
CREATE INDEX "CaseVersion_caseId_issuedAt_idx" ON "CaseVersion"("caseId", "issuedAt");

-- CreateIndex
CREATE INDEX "CaseVersion_created_by_id_idx" ON "CaseVersion"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "CaseVersion_caseId_versionNumber_key" ON "CaseVersion"("caseId", "versionNumber");

-- CreateIndex
CREATE INDEX "CaseArtwork_artworkId_idx" ON "CaseArtwork"("artworkId");

-- CreateIndex
CREATE INDEX "CaseArtwork_created_by_id_idx" ON "CaseArtwork"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "CaseArtwork_caseId_artworkId_key" ON "CaseArtwork"("caseId", "artworkId");

-- CreateIndex
CREATE INDEX "CaseEvidence_evidenceId_idx" ON "CaseEvidence"("evidenceId");

-- CreateIndex
CREATE INDEX "CaseEvidence_created_by_id_idx" ON "CaseEvidence"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "CaseEvidence_caseId_evidenceId_key" ON "CaseEvidence"("caseId", "evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceClaim_claimId_idx" ON "EvidenceClaim"("claimId");

-- CreateIndex
CREATE INDEX "EvidenceClaim_created_by_id_idx" ON "EvidenceClaim"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceClaim_evidenceId_claimId_key" ON "EvidenceClaim"("evidenceId", "claimId");

-- CreateIndex
CREATE INDEX "ClaimAssessment_assessmentId_idx" ON "ClaimAssessment"("assessmentId");

-- CreateIndex
CREATE INDEX "ClaimAssessment_created_by_id_idx" ON "ClaimAssessment"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimAssessment_claimId_assessmentId_key" ON "ClaimAssessment"("claimId", "assessmentId");

-- CreateIndex
CREATE INDEX "ArtworkParty_artworkId_idx" ON "ArtworkParty"("artworkId");

-- CreateIndex
CREATE INDEX "ArtworkParty_partyId_idx" ON "ArtworkParty"("partyId");

-- CreateIndex
CREATE INDEX "ArtworkParty_created_by_id_idx" ON "ArtworkParty"("created_by_id");

-- CreateIndex
CREATE INDEX "CaseParty_partyId_idx" ON "CaseParty"("partyId");

-- CreateIndex
CREATE INDEX "CaseParty_created_by_id_idx" ON "CaseParty"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "CaseParty_caseId_partyId_roleId_key" ON "CaseParty"("caseId", "partyId", "roleId");

-- CreateIndex
CREATE INDEX "EvidenceSource_sourceId_idx" ON "EvidenceSource"("sourceId");

-- CreateIndex
CREATE INDEX "EvidenceSource_created_by_id_idx" ON "EvidenceSource"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceSource_evidenceId_sourceId_key" ON "EvidenceSource"("evidenceId", "sourceId");

-- CreateIndex
CREATE INDEX "ArtworkExhibition_exhibitionId_idx" ON "ArtworkExhibition"("exhibitionId");

-- CreateIndex
CREATE INDEX "ArtworkExhibition_created_by_id_idx" ON "ArtworkExhibition"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkExhibition_artworkId_exhibitionId_key" ON "ArtworkExhibition"("artworkId", "exhibitionId");

-- CreateIndex
CREATE INDEX "ArtworkPublication_publicationId_idx" ON "ArtworkPublication"("publicationId");

-- CreateIndex
CREATE INDEX "ArtworkPublication_created_by_id_idx" ON "ArtworkPublication"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkPublication_artworkId_publicationId_key" ON "ArtworkPublication"("artworkId", "publicationId");

-- AddForeignKey
ALTER TABLE "ProvenanceTransaction" ADD CONSTRAINT "ProvenanceTransaction_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvenanceTransaction" ADD CONSTRAINT "ProvenanceTransaction_fromPartyId_fkey" FOREIGN KEY ("fromPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProvenanceTransaction" ADD CONSTRAINT "ProvenanceTransaction_toPartyId_fkey" FOREIGN KEY ("toPartyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_evidenceTypeId_fkey" FOREIGN KEY ("evidenceTypeId") REFERENCES "EvidenceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_reliabilityId_fkey" FOREIGN KEY ("reliabilityId") REFERENCES "ReliabilityLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_methodologyVersionId_fkey" FOREIGN KEY ("methodologyVersionId") REFERENCES "MethodologyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_gapTypeId_fkey" FOREIGN KEY ("gapTypeId") REFERENCES "GapType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_firstEvidenceId_fkey" FOREIGN KEY ("firstEvidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_secondEvidenceId_fkey" FOREIGN KEY ("secondEvidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistEscalation" ADD CONSTRAINT "SpecialistEscalation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistEscalation" ADD CONSTRAINT "SpecialistEscalation_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistEscalation" ADD CONSTRAINT "SpecialistEscalation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SpecialistCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistEscalation" ADD CONSTRAINT "SpecialistEscalation_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelligenceCase" ADD CONSTRAINT "IntelligenceCase_collectorIntakeId_fkey" FOREIGN KEY ("collectorIntakeId") REFERENCES "CollectorIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVersion" ADD CONSTRAINT "CaseVersion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseVersion" ADD CONSTRAINT "CaseVersion_methodologyVersionId_fkey" FOREIGN KEY ("methodologyVersionId") REFERENCES "MethodologyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseArtwork" ADD CONSTRAINT "CaseArtwork_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseArtwork" ADD CONSTRAINT "CaseArtwork_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvidence" ADD CONSTRAINT "CaseEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAssessment" ADD CONSTRAINT "ClaimAssessment_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAssessment" ADD CONSTRAINT "ClaimAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkParty" ADD CONSTRAINT "ArtworkParty_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkParty" ADD CONSTRAINT "ArtworkParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkParty" ADD CONSTRAINT "ArtworkParty_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PartyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "IntelligenceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "PartyRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "EvidenceSource_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSource" ADD CONSTRAINT "EvidenceSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkExhibition" ADD CONSTRAINT "ArtworkExhibition_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkExhibition" ADD CONSTRAINT "ArtworkExhibition_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkPublication" ADD CONSTRAINT "ArtworkPublication_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkPublication" ADD CONSTRAINT "ArtworkPublication_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Seed the taxonomy.
--
-- These are the categories the brief names. They are seeded here rather than in
-- the development seed because a production database is never run through that,
-- and VERA cannot categorise anything with empty lookup tables.
--
-- They are ROWS, so Qhakaza can add to them without a deployment. That is the
-- whole reason these are tables.
-- ---------------------------------------------------------------------------

INSERT INTO "GapType" ("id", "slug", "label", "ordering", "updated_date") VALUES
  ('gap_missing',      'MISSING_EVIDENCE',          'Missing Evidence',          10, CURRENT_TIMESTAMP),
  ('gap_requested',    'EVIDENCE_REQUESTED',        'Evidence Requested',        20, CURRENT_TIMESTAMP),
  ('gap_received',     'EVIDENCE_RECEIVED',         'Evidence Received',         30, CURRENT_TIMESTAMP),
  ('gap_weak',         'WEAK_EVIDENCE',             'Weak Evidence',             40, CURRENT_TIMESTAMP),
  ('gap_contradictory','CONTRADICTORY_EVIDENCE',    'Contradictory Evidence',    50, CURRENT_TIMESTAMP),
  ('gap_unverified',   'UNVERIFIED_CLAIM',          'Unverified Claim',          60, CURRENT_TIMESTAMP),
  ('gap_specialist',   'SPECIALIST_REVIEW_REQUIRED','Specialist Review Required',70, CURRENT_TIMESTAMP),
  ('gap_resolved',     'RESOLVED',                  'Resolved',                  80, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "SpecialistCategory" ("id", "slug", "label", "ordering", "updated_date") VALUES
  ('spc_provenance',  'PROVENANCE',       'Provenance',        10, CURRENT_TIMESTAMP),
  ('spc_authentic',   'AUTHENTICATION',   'Authentication',    20, CURRENT_TIMESTAMP),
  ('spc_valuation',   'VALUATION',        'Valuation',         30, CURRENT_TIMESTAMP),
  ('spc_legal',       'LEGAL',            'Legal',             40, CURRENT_TIMESTAMP),
  ('spc_condition',   'CONDITION',        'Condition',         50, CURRENT_TIMESTAMP),
  ('spc_conservation','CONSERVATION',     'Conservation',      60, CURRENT_TIMESTAMP),
  ('spc_tax',         'TAX',              'Tax',               70, CURRENT_TIMESTAMP),
  ('spc_cultural',    'CULTURAL_PROPERTY','Cultural Property', 80, CURRENT_TIMESTAMP),
  ('spc_scholarship', 'ARTIST_SCHOLARSHIP','Artist Scholarship',90, CURRENT_TIMESTAMP),
  ('spc_insurance',   'INSURANCE',        'Insurance',        100, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "PartyRole" ("id", "slug", "label", "ordering", "updated_date") VALUES
  ('pr_owner',      'OWNER',          'Owner',          10, CURRENT_TIMESTAMP),
  ('pr_prev_owner', 'PREVIOUS_OWNER', 'Previous Owner', 20, CURRENT_TIMESTAMP),
  ('pr_gallery',    'GALLERY',        'Gallery',        30, CURRENT_TIMESTAMP),
  ('pr_dealer',     'DEALER',         'Dealer',         40, CURRENT_TIMESTAMP),
  ('pr_institution','INSTITUTION',    'Institution',    50, CURRENT_TIMESTAMP),
  ('pr_specialist', 'SPECIALIST',     'Specialist',     60, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- A starting scale, deliberately coarse. Qhakaza may replace it; historical
-- Cases keep whichever level they referenced.
INSERT INTO "ReliabilityLevel" ("id", "slug", "label", "rank", "updated_date") VALUES
  ('rel_primary',     'PRIMARY_DOCUMENTARY', 'Primary documentary', 40, CURRENT_TIMESTAMP),
  ('rel_secondary',   'SECONDARY',           'Secondary',           30, CURRENT_TIMESTAMP),
  ('rel_testimonial', 'TESTIMONIAL',         'Testimonial',         20, CURRENT_TIMESTAMP),
  ('rel_unverified',  'UNVERIFIED',          'Unverified',          10, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "EvidenceType" ("id", "slug", "label", "ordering", "updated_date") VALUES
  ('evt_certificate',  'CERTIFICATE',      'Certificate of authenticity', 10, CURRENT_TIMESTAMP),
  ('evt_invoice',      'INVOICE',          'Invoice or receipt',          20, CURRENT_TIMESTAMP),
  ('evt_provenance',   'PROVENANCE_RECORD','Provenance record',           30, CURRENT_TIMESTAMP),
  ('evt_exhibition',   'EXHIBITION_RECORD','Exhibition record',           40, CURRENT_TIMESTAMP),
  ('evt_publication',  'PUBLICATION',      'Publication reference',       50, CURRENT_TIMESTAMP),
  ('evt_correspond',   'CORRESPONDENCE',   'Correspondence',              60, CURRENT_TIMESTAMP),
  ('evt_photograph',   'PHOTOGRAPH',       'Photograph',                  70, CURRENT_TIMESTAMP),
  ('evt_condition',    'CONDITION_REPORT', 'Condition report',            80, CURRENT_TIMESTAMP),
  ('evt_specialist',   'SPECIALIST_REPORT','Specialist report',           90, CURRENT_TIMESTAMP),
  ('evt_testimony',    'TESTIMONY',        'Testimony',                  100, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
