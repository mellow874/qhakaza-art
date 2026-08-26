-- Rate limiting for the public forms.
--
-- One table, a fixed-window counter. In the database rather than in memory
-- because the apps run on Vercel, where each serverless instance has its own
-- memory - an in-memory limiter there counts a fraction of the requests and
-- lets the rest through, which reads as a control and is not one.
--
-- Written with no actor, through `asSystem`. Rate limiting happens before
-- anyone is authenticated, which is exactly when it matters.
--
-- Creates one table. Drops nothing, deletes nothing.
--
-- ASCII only.

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_windowStart_idx" ON "RateLimitCounter"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitCounter_bucket_windowStart_key" ON "RateLimitCounter"("bucket", "windowStart");

