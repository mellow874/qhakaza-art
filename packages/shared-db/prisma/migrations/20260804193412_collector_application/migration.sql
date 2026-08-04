-- CreateEnum
CREATE TYPE "CollectorApplicationStatus" AS ENUM ('AWAITING_VERIFICATION', 'UNDER_REVIEW', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "CollectorApplication" (
    "id" TEXT NOT NULL,
    "status" "CollectorApplicationStatus" NOT NULL DEFAULT 'AWAITING_VERIFICATION',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "annualIncomeBand" TEXT,
    "liquidAssetsBand" TEXT,
    "collectingGoal" TEXT,
    "artExposure" TEXT,
    "preferredMediums" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectorApplication_status_createdAt_idx" ON "CollectorApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CollectorApplication_email_idx" ON "CollectorApplication"("email");
