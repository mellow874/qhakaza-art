-- Phase 5 - the Internal Analyst role, alone.
--
-- Split off because PostgreSQL will not let a newly added enum value be USED
-- in the transaction that added it, and the VERA migration's policies name it.
--
-- Confirmed by Qhakaza as a fifth role, distinct from ADVISOR: analysts work
-- Cases, evidence and research; advisors run concierge work.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ANALYST';
