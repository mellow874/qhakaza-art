-- Close the tables Supabase's public REST API could read.
--
-- WHY THIS IS URGENT
-- Supabase exposes every table in `public` through an auto-generated REST API
-- at https://<ref>.supabase.co/rest/v1/. That API authenticates with the `anon`
-- key, which is designed to be public. The ONLY thing standing between it and a
-- table is row-level security.
--
-- Eight tables had RLS switched off entirely, so anyone holding the anon key
-- could read them. Two of them matter a great deal:
--
--   User     email addresses and bcrypt password hashes
--   Session  session tokens, which are as good as being signed in as that user
--
-- The rest are ContactMessage (everything sent through the public forms),
-- Account, VerificationToken, and the legacy Order and Favorite tables.
--
-- This was logged as B9 during the Phase 1 audit and scheduled for the section
-- 22 sweep. Supabase's own scanner raised it first, which is fair - a live
-- exposure should not have waited for a later phase.
--
-- WHY THE POLICIES NAME A ROLE, WHICH THE OTHERS DO NOT
-- Every other policy in this schema decides on `current_setting('qhakaza.role')`
-- and applies to all database roles. That works because the app sets that
-- variable and the REST API never does, so an API caller evaluates as 'public'
-- and is denied.
--
-- It would NOT work here. These tables must stay readable with no actor set:
-- signing in looks a user up by email before anyone is authenticated, so a
-- GUC-based policy would have to permit 'public' - and the REST API would then
-- pass the same test and read the table anyway.
--
-- So these are scoped `TO qhakaza_app`: the role the applications connect as,
-- and one the REST API never uses. PostgREST connects as `anon` or
-- `authenticated`, matches no policy here, and gets nothing.
--
-- Behaviour for the applications is unchanged. This closes an API door; it does
-- not narrow anything the platform itself was doing.
--
-- ASCII only.

-- ---------------------------------------------------------------------------
-- Identity and session tables.
-- ---------------------------------------------------------------------------

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_app_select" ON "User";
DROP POLICY IF EXISTS "user_app_insert" ON "User";
DROP POLICY IF EXISTS "user_app_update" ON "User";
CREATE POLICY "user_app_select" ON "User" FOR SELECT TO qhakaza_app USING (true);
CREATE POLICY "user_app_insert" ON "User" FOR INSERT TO qhakaza_app WITH CHECK (true);
CREATE POLICY "user_app_update" ON "User" FOR UPDATE TO qhakaza_app USING (true);
-- No DELETE policy: this project does not delete people.

ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_app_all" ON "Account";
CREATE POLICY "account_app_all" ON "Account" FOR ALL TO qhakaza_app USING (true) WITH CHECK (true);

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_app_all" ON "Session";
CREATE POLICY "session_app_all" ON "Session" FOR ALL TO qhakaza_app USING (true) WITH CHECK (true);

ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verificationtoken_app_all" ON "VerificationToken";
CREATE POLICY "verificationtoken_app_all" ON "VerificationToken"
  FOR ALL TO qhakaza_app USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Messages from the public forms.
-- ---------------------------------------------------------------------------

ALTER TABLE "ContactMessage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contactmessage_app_select" ON "ContactMessage";
DROP POLICY IF EXISTS "contactmessage_app_insert" ON "ContactMessage";
DROP POLICY IF EXISTS "contactmessage_app_update" ON "ContactMessage";
CREATE POLICY "contactmessage_app_select" ON "ContactMessage"
  FOR SELECT TO qhakaza_app USING (true);
CREATE POLICY "contactmessage_app_insert" ON "ContactMessage"
  FOR INSERT TO qhakaza_app WITH CHECK (true);
CREATE POLICY "contactmessage_app_update" ON "ContactMessage"
  FOR UPDATE TO qhakaza_app USING (true);

-- ---------------------------------------------------------------------------
-- Legacy marketplace tables. Retained, not deleted, per the project's rule.
-- ---------------------------------------------------------------------------

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_app_all" ON "Order";
CREATE POLICY "order_app_all" ON "Order" FOR ALL TO qhakaza_app USING (true) WITH CHECK (true);

ALTER TABLE "Favorite" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "favorite_app_all" ON "Favorite";
CREATE POLICY "favorite_app_all" ON "Favorite" FOR ALL TO qhakaza_app USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Prisma's own migration ledger.
--
-- No policy at all. Migrations run as the OWNER, which bypasses RLS, so this
-- stays fully readable to the tooling while the API gets nothing. It holds only
-- migration names and checksums, but there is no reason to publish those.
-- ---------------------------------------------------------------------------

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
