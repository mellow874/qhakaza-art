-- Phase 4 - the artwork review workflow, part 1 of 2: enum values only.
--
-- Split for the same reason as the invitation statuses: PostgreSQL will not let
-- a newly added enum value be USED in the transaction that added it, and part 2
-- migrates existing LISTED rows onto PUBLISHED.
--
-- Purely additive. LISTED stays in the type because PostgreSQL cannot drop an
-- enum value without recreating it.

ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'RETURNED_FOR_INFORMATION';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
