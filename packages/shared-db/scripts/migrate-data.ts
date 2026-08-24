/**
 * Copy every row from one database into another.
 *
 *   SOURCE_DATABASE_URL=…  TARGET_DATABASE_URL=…  \
 *     npx tsx packages/shared-db/scripts/migrate-data.ts [--dry-run] [--truncate]
 *
 * For the move onto Qhakaza-owned infrastructure. Run AFTER
 * `prisma migrate deploy` has built the target's schema — this script moves
 * data only, never structure.
 *
 * WHY THE ORDER IS DISCOVERED, NOT LISTED
 * Rows must be inserted parents-first or foreign keys reject them. A hardcoded
 * list would be correct today and wrong the moment Phase 5 adds its ~22 VERA
 * tables — and it would fail in the middle of a migration, which is the worst
 * possible time to find out. So the script reads the actual foreign-key graph
 * from the target and topologically sorts it. Add tables, change relations; the
 * order keeps up on its own.
 *
 * SAFETY
 *  - Both connections must be the OWNER. RLS would silently filter rows out of
 *    the copy, producing a target that looks fine and is quietly incomplete.
 *  - One transaction on the target. Any failure rolls the whole copy back;
 *    there is no half-migrated state to reason about.
 *  - Refuses to run against a non-empty target unless --truncate is passed.
 *  - --dry-run reports the plan and row counts without writing.
 *
 * Cycles: if two tables reference each other the sort cannot order them. The
 * script reports the cycle and stops rather than guessing. There are none in
 * this schema today; self-references (a column pointing at its own table) are
 * fine and are ignored.
 */
import './load-env';

import { PrismaClient } from '@prisma/client';

import { describeConnection } from '../src/env';
import { buildDependencyGraph, topologicallySort } from '../src/table-order';

const DRY_RUN = process.argv.includes('--dry-run');
const TRUNCATE = process.argv.includes('--truncate');
const BATCH = 500;

function requireUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(
      `Missing ${name}.\n\n` +
        '  SOURCE_DATABASE_URL  the database being left behind (owner connection)\n' +
        '  TARGET_DATABASE_URL  the new Qhakaza database (owner connection)\n\n' +
        'Both must be owner connections — the application role cannot see every row.',
    );
    process.exit(1);
  }
  return value;
}

const sourceUrl = requireUrl('SOURCE_DATABASE_URL');
const targetUrl = requireUrl('TARGET_DATABASE_URL');

if (sourceUrl === targetUrl) {
  console.error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL are the same database.');
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

/** Tables in the public schema, excluding Prisma's own bookkeeping. */
async function readTables(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<{ relname: string }[]>(`
    SELECT c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND c.relname NOT LIKE '\\_prisma%'
     ORDER BY c.relname
  `);
  return rows.map((r) => r.relname);
}

/** child -> the tables it depends on, read from the live foreign-key graph. */
async function readDependencies(client: PrismaClient) {
  const rows = await client.$queryRawUnsafe<{ child: string; parent: string }[]>(`
    SELECT c.conrelid::regclass::text AS child,
           c.confrelid::regclass::text AS parent
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.contype = 'f' AND n.nspname = 'public'
  `);
  return buildDependencyGraph(rows);
}

/**
 * The SQL cast each column needs, by column name.
 *
 * Values read back through `$queryRaw` arrive as plain JavaScript, so an enum
 * comes back as a string and Postgres refuses it: "column is of type Role but
 * expression is of type text". It will not cast text to an enum implicitly.
 * The same applies to arrays and jsonb. So every parameter is cast to the
 * column's own type on the way in.
 */
async function readColumnCasts(
  client: PrismaClient,
  table: string,
): Promise<Map<string, string>> {
  const rows = await client.$queryRawUnsafe<
    { column_name: string; data_type: string; udt_name: string }[]
  >(
    `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    table,
  );

  const casts = new Map<string, string>();

  for (const { column_name, data_type, udt_name } of rows) {
    if (data_type === 'USER-DEFINED') {
      // An enum. Quoted: these names are PascalCase and case-sensitive.
      casts.set(column_name, `"${udt_name}"`);
    } else if (data_type === 'ARRAY') {
      // udt_name for text[] is "_text"; the element type is what we cast to.
      casts.set(column_name, `${udt_name.replace(/^_/, '')}[]`);
    } else if (data_type === 'jsonb' || data_type === 'json') {
      casts.set(column_name, data_type);
    }
  }

  return casts;
}

async function countRows(client: PrismaClient, table: string): Promise<number> {
  const [{ n }] = await client.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint AS n FROM "${table}"`,
  );
  return Number(n);
}

async function main() {
  console.log('Data migration\n');
  console.log(`  from: ${describeConnection(sourceUrl)}`);
  console.log(`  to:   ${describeConnection(targetUrl)}`);
  if (DRY_RUN) console.log('\n  DRY RUN — nothing will be written\n');

  const sourceTables = await readTables(source);
  const targetTables = await readTables(target);

  // A table in the source but not the target means the target's schema is
  // behind. Copying anyway would drop data silently.
  const missing = sourceTables.filter((t) => !targetTables.includes(t));
  if (missing.length > 0) {
    console.error(
      `\nTarget is missing ${missing.length} table(s): ${missing.join(', ')}\n` +
        'Run `npm run deploy -w packages/shared-db` against the target first.',
    );
    process.exit(1);
  }

  const order = topologicallySort(sourceTables, await readDependencies(target));

  console.log(`\n  ${order.length} tables, insertion order derived from foreign keys:`);
  console.log(`  ${order.join(' → ')}\n`);

  // Refuse to write into a database that already holds data.
  const occupied: string[] = [];
  for (const table of order) {
    if ((await countRows(target, table)) > 0) occupied.push(table);
  }

  if (occupied.length > 0 && !TRUNCATE) {
    console.error(
      `Target is not empty — ${occupied.length} table(s) hold rows: ${occupied.join(', ')}\n\n` +
        'Re-run with --truncate to empty them first, or point at a fresh database.\n' +
        'Refusing to merge into existing data: that produces duplicates, not a migration.',
    );
    process.exit(1);
  }

  let copied = 0;
  const report: { table: string; rows: number }[] = [];

  const run = async (tx: Pick<PrismaClient, '$executeRawUnsafe'>) => {
    // Inside the transaction on purpose. Emptying the target and then failing
    // the copy would leave it worse than when we started.
    if (occupied.length > 0 && TRUNCATE && !DRY_RUN) {
      console.log(`  Truncating ${occupied.length} table(s) in the target…`);
      await tx.$executeRawUnsafe(
        `TRUNCATE TABLE ${order.map((t) => `"${t}"`).join(', ')} CASCADE`,
      );
    }

    for (const table of order) {
      const total = await countRows(source, table);
      report.push({ table, rows: total });

      if (total === 0) {
        console.log(`  ${table.padEnd(26)} empty`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ${table.padEnd(26)} ${String(total).padStart(6)} rows (would copy)`);
        copied += total;
        continue;
      }

      for (let offset = 0; offset < total; offset += BATCH) {
        const rows = await source.$queryRawUnsafe<Record<string, unknown>[]>(
          `SELECT * FROM "${table}" ORDER BY 1 LIMIT ${BATCH} OFFSET ${offset}`,
        );
        if (rows.length === 0) break;

        const columns = Object.keys(rows[0]);
        const columnList = columns.map((c) => `"${c}"`).join(', ');
        const casts = await readColumnCasts(target, table);

        // Parameterised: values are data, never concatenated into SQL. The
        // cast is derived from the target's own catalogue, not from the value.
        const values: unknown[] = [];
        const tuples = rows.map((row) => {
          const placeholders = columns.map((column) => {
            values.push(row[column]);
            const cast = casts.get(column);
            return cast ? `$${values.length}::${cast}` : `$${values.length}`;
          });
          return `(${placeholders.join(', ')})`;
        });

        await tx.$executeRawUnsafe(
          `INSERT INTO "${table}" (${columnList}) VALUES ${tuples.join(', ')}`,
          ...values,
        );
      }

      console.log(`  ${table.padEnd(26)} ${String(total).padStart(6)} rows copied`);
      copied += total;
    }
  };

  if (DRY_RUN) {
    await run(target);
  } else {
    // All or nothing. A failure at table 19 must not leave 18 tables migrated.
    await target.$transaction(async (tx) => run(tx as unknown as PrismaClient), {
      timeout: 30 * 60 * 1000,
      maxWait: 60 * 1000,
    });
  }

  console.log(`\n  ${copied} rows across ${order.length} tables.`);

  if (!DRY_RUN) {
    console.log('\nVerifying row counts match…');
    let mismatched = 0;
    for (const { table, rows } of report) {
      const actual = await countRows(target, table);
      if (actual !== rows) {
        console.error(`  MISMATCH ${table}: source ${rows}, target ${actual}`);
        mismatched++;
      }
    }

    if (mismatched > 0) {
      console.error(`\n${mismatched} table(s) do not match. Investigate before cutting over.`);
      process.exit(1);
    }
    console.log('  Every table matches.');
    console.log('\nNext: npx tsx packages/shared-db/scripts/verify-database.ts');
  }
}

main()
  .catch((error) => {
    console.error('\nMigration failed — the target transaction was rolled back.\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
