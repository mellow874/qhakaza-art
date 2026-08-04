-- Phase 1 -- the 13 core entities and the standard field convention.
--
-- NON-DESTRUCTIVE BY CONSTRUCTION. Written by hand because `prisma migrate dev`
-- cannot tell a rename from a drop-and-create: left to itself it would have
-- emitted DROP TABLE "ArtistProfile" / CREATE TABLE "Artist" and destroyed every
-- row. Every rename below is an ALTER ... RENAME, which preserves data.
--
-- No DROP TABLE, no DROP COLUMN, no DELETE appears in this file.

-- ---------------------------------------------------------------------------
-- 1. Roles: add ADVISOR (additive; existing values untouched)
-- ---------------------------------------------------------------------------
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ADVISOR';

-- ---------------------------------------------------------------------------
-- 2. Enum rename
-- ---------------------------------------------------------------------------
ALTER TYPE "CollectorApplicationStatus" RENAME TO "CollectorIntakeStatus";

-- ---------------------------------------------------------------------------
-- 3. Table renames -- ArtistProfile->Artist, ArtPiece->Artwork,
--    CollectorApplication->CollectorIntake. Postgres does not rename the
--    dependent indexes and constraints, so those follow explicitly.
-- ---------------------------------------------------------------------------
ALTER TABLE "ArtistProfile" RENAME TO "Artist";
ALTER TABLE "ArtPiece" RENAME TO "Artwork";
ALTER TABLE "CollectorApplication" RENAME TO "CollectorIntake";

ALTER INDEX "ArtistProfile_pkey" RENAME TO "Artist_pkey";
ALTER INDEX "ArtistProfile_userId_key" RENAME TO "Artist_userId_key";
ALTER INDEX "ArtistProfile_slug_key" RENAME TO "Artist_slug_key";
ALTER INDEX "ArtistProfile_approved_idx" RENAME TO "Artist_approved_idx";
ALTER TABLE "Artist" RENAME CONSTRAINT "ArtistProfile_userId_fkey" TO "Artist_userId_fkey";

ALTER INDEX "ArtPiece_pkey" RENAME TO "Artwork_pkey";
ALTER INDEX "ArtPiece_artistId_idx" RENAME TO "Artwork_artistId_idx";
ALTER INDEX "ArtPiece_status_idx" RENAME TO "Artwork_status_idx";
ALTER INDEX "ArtPiece_medium_idx" RENAME TO "Artwork_medium_idx";
ALTER TABLE "Artwork" RENAME CONSTRAINT "ArtPiece_artistId_fkey" TO "Artwork_artistId_fkey";

ALTER INDEX "CollectorApplication_pkey" RENAME TO "CollectorIntake_pkey";
ALTER INDEX "CollectorApplication_email_idx" RENAME TO "CollectorIntake_email_idx";
ALTER INDEX "CollectorApplication_status_createdAt_idx" RENAME TO "CollectorIntake_status_createdAt_idx";

-- Foreign keys pointing at the renamed artwork table
ALTER TABLE "Order" RENAME COLUMN "artPieceId" TO "artworkId";
ALTER TABLE "Order" RENAME CONSTRAINT "Order_artPieceId_fkey" TO "Order_artworkId_fkey";
ALTER INDEX "Order_artPieceId_idx" RENAME TO "Order_artworkId_idx";

ALTER TABLE "Favorite" RENAME COLUMN "artPieceId" TO "artworkId";
ALTER TABLE "Favorite" RENAME CONSTRAINT "Favorite_artPieceId_fkey" TO "Favorite_artworkId_fkey";

-- ---------------------------------------------------------------------------
-- 4. Standard field convention: created_date / updated_date column names.
--    The Prisma property names stay createdAt/updatedAt, so index names
--    (which Prisma derives from field names) do not change.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "User" RENAME COLUMN "updatedAt" TO "updated_date";
ALTER TABLE "Artist" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "Artist" RENAME COLUMN "updatedAt" TO "updated_date";
ALTER TABLE "Artwork" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "Artwork" RENAME COLUMN "updatedAt" TO "updated_date";
ALTER TABLE "CollectorIntake" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "CollectorIntake" RENAME COLUMN "updatedAt" TO "updated_date";
ALTER TABLE "Order" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "Order" RENAME COLUMN "updatedAt" TO "updated_date";
ALTER TABLE "Favorite" RENAME COLUMN "createdAt" TO "created_date";
ALTER TABLE "ContactMessage" RENAME COLUMN "createdAt" TO "created_date";

-- ContactMessage had no updated_date. Backfilled from created_date rather than
-- from now(), so the column does not claim rows were touched today.
ALTER TABLE "ContactMessage" ADD COLUMN "updated_date" TIMESTAMP(3);
UPDATE "ContactMessage" SET "updated_date" = "created_date" WHERE "updated_date" IS NULL;
ALTER TABLE "ContactMessage" ALTER COLUMN "updated_date" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. created_by_id everywhere. Nullable: existing rows have no recorded author
--    and this project does not fabricate data.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "Artist" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "Artwork" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "CollectorIntake" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "Order" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "Favorite" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "ContactMessage" ADD COLUMN "created_by_id" TEXT;

CREATE INDEX "User_createdById_idx" ON "User"("created_by_id");
CREATE INDEX "Artist_createdById_idx" ON "Artist"("created_by_id");
CREATE INDEX "Artwork_createdById_idx" ON "Artwork"("created_by_id");
CREATE INDEX "CollectorIntake_createdById_idx" ON "CollectorIntake"("created_by_id");
CREATE INDEX "Order_createdById_idx" ON "Order"("created_by_id");

-- ---------------------------------------------------------------------------
-- 6. New enums
-- ---------------------------------------------------------------------------
CREATE TYPE "VerificationOutcome" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'LAPSED', 'DECLINED', 'REVOKED');
CREATE TYPE "InvitationStatus" AS ENUM ('ISSUED', 'ACCEPTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "ActivationOutcome" AS ENUM ('SUCCESS', 'MISSING_TOKEN', 'INVALID_TOKEN', 'EXPIRED_TOKEN', 'REVOKED_TOKEN', 'ROLE_DENIED');
CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "NoteStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'ACTIONED', 'ARCHIVED');
CREATE TYPE "PartnerStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'DORMANT');

-- ---------------------------------------------------------------------------
-- 7. The ten entities that did not exist
-- ---------------------------------------------------------------------------

CREATE TABLE "CollectorVerification" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "outcome" "VerificationOutcome" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "CollectorVerification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectorVerification_intakeId_key" ON "CollectorVerification"("intakeId");
CREATE INDEX "CollectorVerification_outcome_idx" ON "CollectorVerification"("outcome");
CREATE INDEX "CollectorVerification_createdById_idx" ON "CollectorVerification"("created_by_id");
ALTER TABLE "CollectorVerification" ADD CONSTRAINT "CollectorVerification_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "CollectorIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "intakeId" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "tier" TEXT,
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Membership_intakeId_key" ON "Membership"("intakeId");
CREATE INDEX "Membership_status_idx" ON "Membership"("status");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_createdById_idx" ON "Membership"("created_by_id");
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "CollectorIntake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MemberInvitation" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "MemberInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemberInvitation_tokenHash_key" ON "MemberInvitation"("tokenHash");
CREATE INDEX "MemberInvitation_status_expiresAt_idx" ON "MemberInvitation"("status", "expiresAt");
CREATE INDEX "MemberInvitation_email_idx" ON "MemberInvitation"("email");
CREATE INDEX "MemberInvitation_createdById_idx" ON "MemberInvitation"("created_by_id");
ALTER TABLE "MemberInvitation" ADD CONSTRAINT "MemberInvitation_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ActivationAttempt" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT,
    "tokenFingerprint" TEXT NOT NULL,
    "outcome" "ActivationOutcome" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "ActivationAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ActivationAttempt_outcome_createdAt_idx" ON "ActivationAttempt"("outcome", "created_date");
CREATE INDEX "ActivationAttempt_tokenFingerprint_idx" ON "ActivationAttempt"("tokenFingerprint");
CREATE INDEX "ActivationAttempt_createdById_idx" ON "ActivationAttempt"("created_by_id");
ALTER TABLE "ActivationAttempt" ADD CONSTRAINT "ActivationAttempt_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "MemberInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PrivateNoteSubmission" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT,
    "artworkId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "PrivateNoteSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivateNoteSubmission_status_createdAt_idx" ON "PrivateNoteSubmission"("status", "created_date");
CREATE INDEX "PrivateNoteSubmission_membershipId_idx" ON "PrivateNoteSubmission"("membershipId");
CREATE INDEX "PrivateNoteSubmission_createdById_idx" ON "PrivateNoteSubmission"("created_by_id");
ALTER TABLE "PrivateNoteSubmission" ADD CONSTRAINT "PrivateNoteSubmission_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrivateNoteSubmission" ADD CONSTRAINT "PrivateNoteSubmission_artworkId_fkey"
    FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NewsArticle_slug_key" ON "NewsArticle"("slug");
CREATE INDEX "NewsArticle_status_publishedAt_idx" ON "NewsArticle"("status", "publishedAt");
CREATE INDEX "NewsArticle_createdById_idx" ON "NewsArticle"("created_by_id");

CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "website" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Partner_status_idx" ON "Partner"("status");
CREATE INDEX "Partner_createdById_idx" ON "Partner"("created_by_id");

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "sessionId" TEXT,
    "properties" JSONB,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsEvent_name_occurredAt_idx" ON "AnalyticsEvent"("name", "occurredAt");
CREATE INDEX "AnalyticsEvent_actorId_idx" ON "AnalyticsEvent"("actorId");
CREATE INDEX "AnalyticsEvent_createdById_idx" ON "AnalyticsEvent"("created_by_id");

CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyMetric_day_metric_key" ON "DailyMetric"("day", "metric");
CREATE INDEX "DailyMetric_metric_day_idx" ON "DailyMetric"("metric", "day");
CREATE INDEX "DailyMetric_createdById_idx" ON "DailyMetric"("created_by_id");

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "created_date");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "created_date");
CREATE INDEX "AuditLog_createdById_idx" ON "AuditLog"("created_by_id");
