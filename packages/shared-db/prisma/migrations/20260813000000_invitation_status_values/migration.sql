-- Phase 2 - the invitation lifecycle, part 1 of 2: the enum values only.
--
-- SPLIT DELIBERATELY. PostgreSQL will not let a newly added enum value be USED
-- in the same transaction that added it. Prisma runs each migration in one
-- transaction, so adding CREATED and then setting it as a column default in a
-- single file fails with "unsafe use of new value of enum type".
--
-- Part 2 (20260813000100_invitation_lifecycle) does the using.
--
-- Purely additive. ISSUED and REVOKED are left in place: PostgreSQL cannot drop
-- an enum value without recreating the type, and existing rows still carry them
-- until part 2 migrates them.

ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'OPENED';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';
ALTER TYPE "InvitationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
