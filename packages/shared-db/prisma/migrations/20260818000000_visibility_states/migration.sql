-- Phase 2, part 1 of 2: the new publication states and the two new enums.
--
-- Split because PostgreSQL will not let a newly added enum value be USED in the
-- transaction that added it, and part 2 migrates existing rows onto them.
--
-- Purely additive. PUBLISHED, SOLD, HIDDEN and LISTED stay in the type because
-- PostgreSQL cannot drop an enum value; part 2 empties them of rows.

ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'COLLECTOR_READY';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'RELEASED_TO_AUDIENCE';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'RESTRICTED';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'PUBLIC_EDITORIAL';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "ArtStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VisibilityTier') THEN
    CREATE TYPE "VisibilityTier" AS ENUM (
      'ARTIST_WORKING_RECORD',
      'INTERNAL_REVIEW',
      'PRIVATE_COLLECTOR_PROJECTION',
      'PUBLIC_EDITORIAL'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionKind') THEN
    CREATE TYPE "PermissionKind" AS ENUM (
      'STORE_MATERIAL',
      'SHARE_PRIVATELY_WITH_COLLECTORS',
      'USE_IN_PRIVATE_BRIEF',
      'PRESENT_TO_PARTNERS',
      'PUBLISH_PUBLICLY',
      'PUBLISH_ARTIST_STORY',
      'RETAIN_DOCUMENTATION'
    );
  END IF;
END $$;
