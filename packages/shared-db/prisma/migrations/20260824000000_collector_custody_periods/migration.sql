-- Collector Custody Periods
--
-- Appreciation periods: the time a work spends with a collector before it is
-- concluded. Past custodies are retained permanently as provenance — this is
-- provenance information that feeds into VERA in due course.
--
-- Avoids loan, rental, return terminology. The collector-facing language is
-- "appreciation period" and "placed with".

-- Enum for the lifecycle of an appreciation period
CREATE TYPE "CustodyPeriodStatus" AS ENUM ('ACTIVE', 'CONCLUDED', 'EXTENDED');

-- The custody record linking artwork, collector (membership), and period
CREATE TABLE "CustodyPeriod" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "CustodyPeriodStatus" NOT NULL DEFAULT 'ACTIVE',
    "durationDays" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "concludedAt" TIMESTAMP(3),
    "concludedById" TEXT,
    "concludeReason" TEXT,
    "extendedAt" TIMESTAMP(3),
    "extendedById" TEXT,
    "extensionDays" INTEGER,
    "extensionReason" TEXT,
    "reminderIntervalDays" INTEGER,
    "notes" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "CustodyPeriod_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "CustodyPeriod_status_endsAt_idx" ON "CustodyPeriod"("status", "endsAt");
CREATE INDEX "CustodyPeriod_membershipId_idx" ON "CustodyPeriod"("membershipId");
CREATE INDEX "CustodyPeriod_artworkId_idx" ON "CustodyPeriod"("artworkId");
CREATE INDEX "CustodyPeriod_created_by_id_idx" ON "CustodyPeriod"("created_by_id");

-- Foreign keys
ALTER TABLE "CustodyPeriod" ADD CONSTRAINT "CustodyPeriod_artworkId_fkey"
    FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustodyPeriod" ADD CONSTRAINT "CustodyPeriod_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS policies (matching the RLS_MATRIX for CustodyPeriod)
ALTER TABLE "CustodyPeriod" ENABLE ROW LEVEL SECURITY;

-- SELECT: admin, advisor see all; collector sees own (via membership userId)
DROP POLICY IF EXISTS "custodyperiod_select" ON "CustodyPeriod";
CREATE POLICY "custodyperiod_select" ON "CustodyPeriod" FOR SELECT USING (
    coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
    OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
    OR (coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'collector'
        AND ("membershipId" IN (
            SELECT "id" FROM "Membership"
            WHERE "userId" = nullif(current_setting('qhakaza.user_id', true), '')
        )))
);

-- INSERT: admin and advisor only
DROP POLICY IF EXISTS "custodyperiod_insert" ON "CustodyPeriod";
CREATE POLICY "custodyperiod_insert" ON "CustodyPeriod" FOR INSERT WITH CHECK (
    coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
    OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
);

-- UPDATE: admin and advisor only (conclude, extend)
DROP POLICY IF EXISTS "custodyperiod_update" ON "CustodyPeriod";
CREATE POLICY "custodyperiod_update" ON "CustodyPeriod" FOR UPDATE USING (
    coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
    OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
) WITH CHECK (
    coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'admin'
    OR coalesce(nullif(current_setting('qhakaza.role', true), ''), 'public') = 'advisor'
);

-- DELETE: no one. Past custodies are provenance, retained permanently.
DROP POLICY IF EXISTS "custodyperiod_delete" ON "CustodyPeriod";
CREATE POLICY "custodyperiod_delete" ON "CustodyPeriod" FOR DELETE USING (false);
