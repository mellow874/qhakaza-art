-- A seventh activation outcome: RATE_LIMITED.
--
-- An attempt turned away by the rate limiter before its token was examined.
-- Recorded rather than dropped: sustained guessing is the single most
-- important pattern this table exists to show, and it is exactly the pattern
-- that trips the limiter. Without this value the forensic log would go quiet
-- at the moment it became interesting.
--
-- ALONE IN ITS OWN MIGRATION. Postgres will not let a value added to an enum
-- be used in the same transaction that adds it. This has bitten the project
-- before; the split is deliberate.
--
-- ASCII only.

ALTER TYPE "ActivationOutcome" ADD VALUE IF NOT EXISTS 'RATE_LIMITED';
