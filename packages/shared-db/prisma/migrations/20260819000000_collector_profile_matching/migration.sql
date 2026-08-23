-- Phase 3 - collector profiles and match suggestions.
--
-- Purely additive. The preference data these hold already existed, scattered
-- across CollectorIntake and PrivateNote and keyed by email rather than
-- attached to a membership. This gives it a home so it can be used.
--
-- ASCII only.

-- AlterTable
ALTER TABLE "Artwork" ADD COLUMN     "themes" TEXT[];

-- CreateTable
CREATE TABLE "CollectorProfile" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "mediums" TEXT[],
    "regions" TEXT[],
    "themes" TEXT[],
    "motivations" TEXT,
    "budgetLogic" TEXT,
    "acquisitionPace" TEXT,
    "collectingIntent" TEXT,
    "confidenceLevel" TEXT,
    "confidenceGaps" TEXT,
    "sourcedFrom" TEXT,
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CollectorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSuggestion" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "rationale" TEXT,
    "actedOn" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "decidedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectorProfile_membershipId_key" ON "CollectorProfile"("membershipId");

-- CreateIndex
CREATE INDEX "CollectorProfile_created_by_id_idx" ON "CollectorProfile"("created_by_id");

-- CreateIndex
CREATE INDEX "MatchSuggestion_membershipId_score_idx" ON "MatchSuggestion"("membershipId", "score");

-- CreateIndex
CREATE INDEX "MatchSuggestion_artworkId_score_idx" ON "MatchSuggestion"("artworkId", "score");

-- CreateIndex
CREATE INDEX "MatchSuggestion_created_by_id_idx" ON "MatchSuggestion"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSuggestion_artworkId_membershipId_key" ON "MatchSuggestion"("artworkId", "membershipId");

-- AddForeignKey
ALTER TABLE "CollectorProfile" ADD CONSTRAINT "CollectorProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSuggestion" ADD CONSTRAINT "MatchSuggestion_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

