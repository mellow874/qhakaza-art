/**
 * Document what is actually in the database, as opposed to what the schema
 * file says should be.
 *
 *   npx tsx packages/shared-db/scripts/export-schema.ts [--out docs/SCHEMA-SNAPSHOT.md]
 *
 * Phase 1 of the handover brief asks for the current schema to be exported and
 * documented before migration. `schema.prisma` is the intent; this is the
 * observed state, and the two are not automatically the same — RLS policies,
 * the `qhakaza_app` role and its grants live in migration SQL that Prisma does
 * not model, so they are invisible to anyone reading the schema file.
 *
 * Reads through the OWNER connection: the application role cannot see
 * `pg_policies` rows for tables it does not own.
 *
 * Writes a Markdown snapshot to commit alongside the migration, so that after
 * the move to the Qhakaza project the two can be diffed to prove the new
 * database is the same shape as the old one.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import './load-env';

import { PrismaClient } from '@prisma/client';

import { describeConnection, ownerDatabaseUrl } from '../src/env';

/**
 * Resolve against the repository root, not the shell's cwd.
 *
 * `npm run -w packages/shared-db` runs with the workspace as cwd, which would
 * scatter snapshots into `packages/shared-db/docs/` instead of the repository's
 * own `docs/`.
 */
function repositoryRoot(): string {
  let directory = process.cwd();
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(resolve(directory, 'package-lock.json'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return process.cwd();
}

const outFlag = process.argv.indexOf('--out');
const OUT = resolve(
  repositoryRoot(),
  outFlag !== -1 ? process.argv[outFlag + 1] : 'docs/SCHEMA-SNAPSHOT.md',
);

/**
 * The snapshot is committed, so it must not name the infrastructure.
 *
 * A Supabase host and username embed the project reference. That is not a
 * password, but it identifies the project to anyone reading the repository and
 * there is no reason for a schema document to carry it. The operator still
 * sees the real target on the console.
 */
function redactHost(description: string): string {
  // Redact the host AND the username: on Supabase the username is
  // `postgres.<projectref>`, so leaving it in defeats the point.
  return description.replace(/^\S+/, '<host redacted>').replace(/as \S+$/, 'as <user redacted>');
}

const url = ownerDatabaseUrl();
const prisma = new PrismaClient({ datasources: { db: { url } } });

type Row = Record<string, unknown>;

/** A Markdown table from rows, or an explicit note when there are none. */
function table(rows: Row[], empty: string): string {
  if (rows.length === 0) return `_${empty}_\n`;

  const columns = Object.keys(rows[0]);
  const header = `| ${columns.join(' | ')} |`;
  const rule = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${columns.map((c) => String(row[c] ?? '')).join(' | ')} |`)
    .join('\n');

  return `${header}\n${rule}\n${body}\n`;
}

async function main() {
  console.log(`Reading ${describeConnection(url)}`);

  const tables = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT c.relname AS "table",
           c.relrowsecurity AS "rls_enabled",
           c.relforcerowsecurity AS "rls_forced",
           (SELECT count(*) FROM pg_policies p
             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS "policies"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
     ORDER BY c.relname
  `);

  const policies = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT tablename AS "table", policyname AS "policy", cmd AS "command",
           roles::text AS "roles"
      FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename, cmd, policyname
  `);

  const columns = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT table_name AS "table", column_name AS "column", data_type AS "type",
           is_nullable AS "nullable"
      FROM information_schema.columns
     WHERE table_schema = 'public'
     ORDER BY table_name, ordinal_position
  `);

  const functions = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT p.proname AS "function", pg_get_function_identity_arguments(p.oid) AS "arguments"
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY p.proname
  `);

  const triggers = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT event_object_table AS "table", trigger_name AS "trigger",
           action_timing AS "timing", event_manipulation AS "event"
      FROM information_schema.triggers
     WHERE trigger_schema = 'public'
     ORDER BY event_object_table, trigger_name
  `);

  // Role attributes are the part most easily lost in a migration, and the part
  // that silently disables security when wrong.
  const roles = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT rolname AS "role", rolsuper AS "superuser", rolbypassrls AS "bypasses_rls",
           rolcanlogin AS "can_login"
      FROM pg_roles
     WHERE rolname IN ('qhakaza_app', 'postgres', current_user)
     ORDER BY rolname
  `);

  const extensions = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT extname AS "extension", extversion AS "version"
      FROM pg_extension ORDER BY extname
  `);

  const applied = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT migration_name AS "migration",
           to_char(finished_at, 'YYYY-MM-DD HH24:MI') AS "applied",
           CASE WHEN rolled_back_at IS NOT NULL THEN 'ROLLED BACK' ELSE 'ok' END AS "state"
      FROM _prisma_migrations
     ORDER BY started_at
  `);

  const counts: Row[] = [];
  for (const row of tables) {
    const name = String(row.table);
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${name}"`,
    );
    counts.push({ table: name, rows: Number(n) });
  }

  const rlsGaps = tables.filter((t) => !t.rls_enabled).map((t) => String(t.table));

  const document = `# Database schema snapshot

Observed state of the live database, generated by
\`packages/shared-db/scripts/export-schema.ts\`. Do not hand-edit — regenerate.

Source: \`${redactHost(describeConnection(url))}\`

This records what \`schema.prisma\` cannot: the RLS policies, the constrained
application role, and the grants. Regenerate against the new Qhakaza project
after migrating and diff the two files — that diff is the migration's proof.

## Applied migrations

${table(applied, 'no migrations recorded')}

## Tables, RLS and row counts

${table(
  tables.map((t) => ({
    ...t,
    rows: counts.find((c) => c.table === t.table)?.rows ?? 0,
  })),
  'no tables',
)}

${
  rlsGaps.length > 0
    ? `> **${rlsGaps.length} table(s) without RLS enabled:** ${rlsGaps.join(', ')}.\n> ` +
      `Expected for NextAuth's \`Account\`/\`Session\`/\`VerificationToken\` and ` +
      `\`_prisma_migrations\`. Anything else here is a finding.\n`
    : '> Every table has RLS enabled.\n'
}

## Policies

${table(policies, 'no policies — this would be a critical finding')}

## Roles

${table(roles, 'no roles found')}

> \`qhakaza_app\` must show \`superuser: false\` and \`bypasses_rls: false\`.
> If either is true the policies above are decorative.

## Extensions

${table(extensions, 'none')}

## Functions

${table(functions, 'none — expected; this schema uses no stored procedures')}

## Triggers

${table(triggers, 'none — expected; Prisma handles updatedAt in application code')}

## Storage buckets

_None._ The platform has no object storage: artwork images are external URLs in
\`Artwork.images\`, and there is no \`@supabase/supabase-js\` dependency anywhere
in the monorepo. Nothing to migrate. Object storage arrives in Phase 3, and its
migration script ships with it.

## Columns

<details><summary>Full column listing (${columns.length} columns)</summary>

${table(columns, 'none')}

</details>
`;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, document, 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(
    `  ${tables.length} tables, ${policies.length} policies, ` +
      `${counts.reduce((sum, c) => sum + Number(c.rows), 0)} rows total`,
  );

  // A plain SQL dump alongside the Markdown, when the tooling is present. This
  // is the artefact you restore from; the Markdown is the one you read.
  try {
    const sqlOut = OUT.replace(/\.md$/, '.sql');
    execFileSync('pg_dump', ['--schema-only', '--no-owner', '--file', sqlOut, url], {
      stdio: 'pipe',
    });
    console.log(`Wrote ${sqlOut}`);
  } catch {
    console.log('  (pg_dump not on PATH — Markdown snapshot only, which is sufficient)');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
