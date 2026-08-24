-- Phase 7 - content surfaces.
--
-- FAQ, Briefings and versioned legal documents, so the words on the public
-- sites can change without a deployment. Purely additive.
--
-- ASCII only.

-- CreateTable
CREATE TABLE "FaqCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "FaqCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "author" TEXT,
    "category" TEXT,
    "body" TEXT,
    "excerpt" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "sources" TEXT,
    "publishedAt" TIMESTAMP(3),
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BriefingRelation" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "BriefingRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FaqCategory_slug_key" ON "FaqCategory"("slug");

-- CreateIndex
CREATE INDEX "FaqCategory_active_ordering_idx" ON "FaqCategory"("active", "ordering");

-- CreateIndex
CREATE INDEX "FaqCategory_created_by_id_idx" ON "FaqCategory"("created_by_id");

-- CreateIndex
CREATE INDEX "FaqItem_categoryId_ordering_idx" ON "FaqItem"("categoryId", "ordering");

-- CreateIndex
CREATE INDEX "FaqItem_published_idx" ON "FaqItem"("published");

-- CreateIndex
CREATE INDEX "FaqItem_created_by_id_idx" ON "FaqItem"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "Briefing_slug_key" ON "Briefing"("slug");

-- CreateIndex
CREATE INDEX "Briefing_status_publishedAt_idx" ON "Briefing"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Briefing_created_by_id_idx" ON "Briefing"("created_by_id");

-- CreateIndex
CREATE INDEX "BriefingRelation_toId_idx" ON "BriefingRelation"("toId");

-- CreateIndex
CREATE INDEX "BriefingRelation_created_by_id_idx" ON "BriefingRelation"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "BriefingRelation_fromId_toId_key" ON "BriefingRelation"("fromId", "toId");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_documentKey_status_effectiveFrom_idx" ON "LegalDocumentVersion"("documentKey", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_created_by_id_idx" ON "LegalDocumentVersion"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_documentKey_versionNumber_key" ON "LegalDocumentVersion"("documentKey", "versionNumber");

-- AddForeignKey
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FaqCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRelation" ADD CONSTRAINT "BriefingRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BriefingRelation" ADD CONSTRAINT "BriefingRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

