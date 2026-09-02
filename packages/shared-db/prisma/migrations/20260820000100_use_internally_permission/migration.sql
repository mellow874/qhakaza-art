-- An eighth permission: USE_INTERNALLY.
--
-- Storing material and using it are separable acts, and the brief names both.
-- An artist may hand over a contract so it is on file and not expect it
-- weighed in an assessment they will never see. Without this value there was
-- no way to record the narrower intention.
--
-- ALONE IN ITS OWN MIGRATION. Postgres will not let a value added to an enum
-- be used in the same transaction that adds it, so anything that reads or
-- writes USE_INTERNALLY has to land in a later migration. This has bitten this
-- project before; the split is deliberate, not tidiness.
--
-- Added AFTER STORE_MATERIAL so the ordering reads in escalating exposure.
-- Existing rows are untouched: no artist is assumed to have granted it.
--
-- ASCII only.

ALTER TYPE "PermissionKind" ADD VALUE IF NOT EXISTS 'USE_INTERNALLY' AFTER 'STORE_MATERIAL';
