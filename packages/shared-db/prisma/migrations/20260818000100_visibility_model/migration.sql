-- Phase 2, part 2 of 2: the visibility model, and the data moves it implies.
--
-- Purely additive in structure. Verified before writing: zero DROP, TRUNCATE
-- or DELETE statements.
--
-- ASCII only.

-- CreateEnum

-- CreateEnum

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.



-- CreateTable
CREATE TABLE "AudienceType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isLiveProduct" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "AudienceType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "typeId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceMember" (
    "id" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "addedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "AudienceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkRelease" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "tier" "VisibilityTier" NOT NULL DEFAULT 'PRIVATE_COLLECTOR_PROJECTION',
    "reason" TEXT,
    "versionLabel" TEXT,
    "releasedById" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtworkRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistPermission" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "artworkId" TEXT,
    "kind" "PermissionKind" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "confirmingAction" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "ArtistPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AudienceType_slug_key" ON "AudienceType"("slug");

-- CreateIndex
CREATE INDEX "AudienceType_active_ordering_idx" ON "AudienceType"("active", "ordering");

-- CreateIndex
CREATE INDEX "AudienceType_created_by_id_idx" ON "AudienceType"("created_by_id");

-- CreateIndex
CREATE INDEX "Audience_active_idx" ON "Audience"("active");

-- CreateIndex
CREATE INDEX "Audience_typeId_idx" ON "Audience"("typeId");

-- CreateIndex
CREATE INDEX "Audience_created_by_id_idx" ON "Audience"("created_by_id");

-- CreateIndex
CREATE INDEX "AudienceMember_membershipId_removedAt_idx" ON "AudienceMember"("membershipId", "removedAt");

-- CreateIndex
CREATE INDEX "AudienceMember_created_by_id_idx" ON "AudienceMember"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceMember_audienceId_membershipId_key" ON "AudienceMember"("audienceId", "membershipId");

-- CreateIndex
CREATE INDEX "ArtworkRelease_artworkId_revokedAt_idx" ON "ArtworkRelease"("artworkId", "revokedAt");

-- CreateIndex
CREATE INDEX "ArtworkRelease_audienceId_revokedAt_idx" ON "ArtworkRelease"("audienceId", "revokedAt");

-- CreateIndex
CREATE INDEX "ArtworkRelease_tier_revokedAt_idx" ON "ArtworkRelease"("tier", "revokedAt");

-- CreateIndex
CREATE INDEX "ArtworkRelease_created_by_id_idx" ON "ArtworkRelease"("created_by_id");

-- CreateIndex
CREATE INDEX "ArtistPermission_artworkId_kind_granted_idx" ON "ArtistPermission"("artworkId", "kind", "granted");

-- CreateIndex
CREATE INDEX "ArtistPermission_created_by_id_idx" ON "ArtistPermission"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistPermission_artistId_artworkId_kind_key" ON "ArtistPermission"("artistId", "artworkId", "kind");

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AudienceType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMember" ADD CONSTRAINT "AudienceMember_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceMember" ADD CONSTRAINT "AudienceMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRelease" ADD CONSTRAINT "ArtworkRelease_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkRelease" ADD CONSTRAINT "ArtworkRelease_audienceId_fkey" FOREIGN KEY ("audienceId") REFERENCES "Audience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistPermission" ADD CONSTRAINT "ArtistPermission_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistPermission" ADD CONSTRAINT "ArtistPermission_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Audience types.
--
-- Rows, not enum values, because the list must grow without a deployment.
-- Three of these are STRUCTURAL PLACEHOLDERS: the audience type exists so a
-- work can be released to it, but the product behind it is a later phase.
-- `isLiveProduct` says which is which, so nobody mistakes a placeholder for a
-- finished feature.
-- ---------------------------------------------------------------------------

INSERT INTO "AudienceType" ("id", "slug", "label", "isLiveProduct", "ordering", "updated_date") VALUES
  ('audt_collector',  'SINGLE_COLLECTOR',    'One collector',          true,  10, CURRENT_TIMESTAMP),
  ('audt_selected',   'SELECTED_COLLECTORS', 'Selected collectors',    true,  20, CURRENT_TIMESTAMP),
  ('audt_segment',    'COLLECTOR_SEGMENT',   'Collector segment',      true,  30, CURRENT_TIMESTAMP),
  ('audt_membership', 'APPROVED_MEMBERSHIP', 'Wider approved membership', true, 40, CURRENT_TIMESTAMP),
  ('audt_brief',      'PRIVATE_BRIEF',       'Private brief',          false, 50, CURRENT_TIMESTAMP),
  ('audt_partner',    'PARTNER_PROGRAMME',   'Partner programme',      false, 60, CURRENT_TIMESTAMP),
  ('audt_experience', 'PRIVATE_EXPERIENCE',  'Private experience',     false, 70, CURRENT_TIMESTAMP),
  ('audt_editorial',  'PUBLIC_EDITORIAL',    'Public editorial',       true,  80, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- ---------------------------------------------------------------------------
-- THE STATE MIGRATION.
--
-- Everything becomes unreleased until explicitly assigned. This is the
-- founder's decision, taken knowingly: it is the safer of the two options and
-- the more disruptive one.
--
-- Work that was PUBLISHED was, under the old model, simultaneously on the open
-- web and in every collector's private area. It becomes COLLECTOR_READY:
-- vetted and prepared, held back until someone decides who should see it.
-- After this migration NO artwork is visible to any collector or to the public
-- until an ArtworkRelease is created.
--
-- SOLD and HIDDEN fold into ARCHIVED, per the founder's answer.
-- ---------------------------------------------------------------------------

UPDATE "Artwork" SET "status" = 'COLLECTOR_READY' WHERE "status" IN ('PUBLISHED', 'LISTED');
UPDATE "Artwork" SET "status" = 'ARCHIVED'        WHERE "status" IN ('SOLD', 'HIDDEN');

ALTER TABLE "Artwork" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- ---------------------------------------------------------------------------
-- Existing artist consent.
--
-- We hold no record of any artist agreeing to anything, because the question
-- was never asked. Absence of a permission therefore has to mean NO - a work
-- cannot be shared or published until its artist says so.
--
-- No permissions are seeded. Granting consent on an artist's behalf, to make a
-- demo look complete, would be exactly the wrong thing to do with a consent
-- record.
-- ---------------------------------------------------------------------------
