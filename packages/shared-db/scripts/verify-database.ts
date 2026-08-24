/**
 * Prove a database is correctly built and correctly locked down.
 *
 *   npx tsx packages/shared-db/scripts/verify-database.ts
 *
 * This is the verification checklist from MIGRATION_RUNBOOK.md, written as code
 * so that "we checked" is a command with an exit status rather than a claim.
 * Run it against the new Qhakaza project immediately after migrating, and
 * against production whenever a connection string changes.
 *
 * It uses BOTH connections deliberately:
 *
 *   owner  — to read pg_policies and role attributes, which the app role
 *            cannot see for tables it does not own.
 *   app    — to attempt reads that MUST come back empty. This is the only
 *            check that catches the failure that matters most: a DATABASE_URL
 *            pointing at the owner, which silently disables all 53 policies
 *            while leaving every screen working perfectly.
 *
 * Exit code 0 = safe to serve traffic. Non-zero = do not.
 */
import './load-env';

import { PrismaClient } from '@prisma/client';

import { CORE_ENTITIES } from '../src/entities';
import { appDatabaseUrl, describeConnection, ownerDatabaseUrl } from '../src/env';

const ownerUrl = ownerDatabaseUrl();
const appUrl = appDatabaseUrl();

const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
const app = new PrismaClient({ datasources: { db: { url: appUrl } } });

const failures: string[] = [];
const warnings: string[] = [];

function check(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
}

function warn(label: string, detail: string) {
  console.log(`  WARN  ${label} — ${detail}`);
  warnings.push(label);
}

async function main() {
  console.log('Verifying database\n');
  console.log(`  owner: ${describeConnection(ownerUrl)}`);
  console.log(`  app:   ${describeConnection(appUrl)}\n`);

  // -- 1. Both connections are alive ---------------------------------------
  console.log('Connectivity');
  await owner.$queryRawUnsafe('SELECT 1');
  check(true, 'owner connection');
  await app.$queryRawUnsafe('SELECT 1');
  check(true, 'application connection');

  // -- 2. Migrations ---------------------------------------------------------
  console.log('\nMigrations');
  const migrations = await owner.$queryRawUnsafe<
    { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
  >('SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at');

  const unfinished = migrations.filter((m) => !m.finished_at && !m.rolled_back_at);
  const rolledBack = migrations.filter((m) => m.rolled_back_at);

  check(migrations.length > 0, 'migrations have been applied', `${migrations.length} found`);
  check(unfinished.length === 0, 'no migration left half-applied',
    unfinished.map((m) => m.migration_name).join(', ') || 'none');
  check(rolledBack.length === 0, 'no migration rolled back',
    rolledBack.map((m) => m.migration_name).join(', ') || 'none');

  // -- 3. Every core entity has a table -------------------------------------
  console.log('\nSchema');
  const tables = await owner.$queryRawUnsafe<{ relname: string; relrowsecurity: boolean }[]>(`
    SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
  `);
  const present = new Set(tables.map((t) => t.relname));

  for (const entity of CORE_ENTITIES) {
    check(present.has(entity), `table ${entity} exists`);
  }

  // -- 4. RLS is on, and policies exist -------------------------------------
  console.log('\nRow-level security');
  const withoutRls = CORE_ENTITIES.filter(
    (e) => present.has(e) && !tables.find((t) => t.relname === e)?.relrowsecurity,
  );
  check(withoutRls.length === 0, 'RLS enabled on every core entity',
    withoutRls.join(', ') || 'all enabled');

  const [{ n: policyCount }] = await owner.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM pg_policies WHERE schemaname = 'public'`,
  );
  check(Number(policyCount) > 0, 'policies are present', `${policyCount} policies`);

  // -- 5. The app role is genuinely constrained ------------------------------
  console.log('\nApplication role');
  const [appRole] = await owner.$queryRawUnsafe<
    { rolname: string; rolsuper: boolean; rolbypassrls: boolean }[]
  >(`SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'qhakaza_app'`);

  if (!appRole) {
    check(false, 'role qhakaza_app exists');
  } else {
    check(!appRole.rolsuper, 'qhakaza_app is not a superuser');
    check(!appRole.rolbypassrls, 'qhakaza_app does not bypass RLS');
  }

  const [{ current_user: appUser }] = await app.$queryRawUnsafe<{ current_user: string }[]>(
    'SELECT current_user',
  );
  check(appUser === 'qhakaza_app', 'application connects as qhakaza_app', `connected as ${appUser}`);

  // -- 6. The policies actually bite ----------------------------------------
  // The decisive check. With no actor configured the app is "public", and a
  // public reader must see nothing in the sensitive tables. If these come back
  // populated, the policies are present but not applying — which is exactly
  // what happens when DATABASE_URL points at the owner.
  console.log('\nEnforcement (the check that matters)');
  for (const entity of ['CollectorIntake', 'PrivateNoteSubmission', 'AuditLog']) {
    if (!present.has(entity)) continue;

    const [{ n }] = await app.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${entity}"`,
    );
    check(Number(n) === 0, `anonymous reader sees no ${entity} rows`, `saw ${n}`);
  }

  // -- 7. Data is present ----------------------------------------------------
  console.log('\nData');
  let total = 0;
  for (const entity of CORE_ENTITIES.filter((e) => present.has(e))) {
    const [{ n }] = await owner.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${entity}"`,
    );
    total += Number(n);
  }
  console.log(`  INFO  ${total} rows across ${CORE_ENTITIES.length} core entities`);
  if (total === 0) {
    warn('database is empty', 'expected after a fresh migrate, not after a data migration');
  }

  // -- 8. The default role password has been changed -------------------------
  // The migration creates qhakaza_app with a known default so local setup works
  // without configuration. In production that default is a credential anyone
  // who has read the repository already knows.
  if (appUrl.includes(':qhakaza_app@') && !appUrl.includes('localhost')) {
    warn(
      'qhakaza_app still uses the default password on a non-local host',
      'run ALTER ROLE qhakaza_app WITH PASSWORD … — see MIGRATION_RUNBOOK.md step 4',
    );
  }

  // -- Result ----------------------------------------------------------------
  console.log('\n' + '-'.repeat(60));
  if (warnings.length > 0) console.log(`${warnings.length} warning(s): ${warnings.join('; ')}`);

  if (failures.length > 0) {
    console.error(`\nFAILED — ${failures.length} check(s):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('\nDo not serve traffic from this database.');
    process.exit(1);
  }

  console.log('\nAll checks passed. Database is correctly built and enforcing.');
}

main()
  .catch((error) => {
    console.error('\nVerification could not complete:', error);
    process.exit(1);
  })
  .finally(async () => {
    await owner.$disconnect();
    await app.$disconnect();
  });
