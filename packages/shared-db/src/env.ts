/**
 * Every database credential the platform uses, read in one place.
 *
 * WHY THIS EXISTS
 * The handover brief requires that Supabase configuration is centralised in
 * environment variables with separate production and development credential
 * sets, and that no key is hard-coded. Before this module each consumer read
 * `process.env` directly, so a missing variable surfaced as whatever error
 * Prisma happened to raise several layers down — usually "the URL must start
 * with postgresql://", which does not tell you which variable is unset.
 *
 * LAZY ON PURPOSE
 * Nothing here runs at import time. A module-level throw would break
 * `next build`, which imports application code in an environment that has no
 * database, and would break `prisma generate` in CI. Call the accessors when
 * you actually need a connection.
 *
 * TWO URLS, DIFFERENT IDENTITIES — this distinction is load-bearing:
 *
 *   DATABASE_URL         the application, as `qhakaza_app`.
 *                        NOSUPERUSER, NOBYPASSRLS, not the table owner.
 *                        This is what makes the 53 RLS policies bite.
 *                        On Supabase: the transaction pooler, port 6543.
 *
 *   DIRECT_DATABASE_URL  migrations, as the owner.
 *                        Correctly bypasses RLS — the app role has no rights
 *                        to ALTER anything.
 *                        On Supabase: the session pooler, port 5432.
 *                        The "direct connection" Supabase also offers is
 *                        IPv6-only and unreachable from most CI runners.
 *
 * Pointing DATABASE_URL at the owner silently disables every policy in the
 * database. `assertAppRoleIsConstrained()` in verify-database.ts exists to
 * catch exactly that, because nothing else would.
 */

export type DatabaseEnvironment = 'production' | 'development' | 'test';

/** Which credential set is in play. Derived, never guessed at the call site. */
export function currentEnvironment(): DatabaseEnvironment {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return 'test';
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

function required(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}.\n` +
        `  Environment: ${currentEnvironment()}\n` +
        `  Copy .env.example to .env and fill it in, or set ${name} in your ` +
        `deployment's environment settings.\n` +
        `  See MIGRATION_RUNBOOK.md for where each value comes from.`,
    );
  }

  return value.trim();
}

/**
 * The URL the application connects with.
 *
 * In tests this is TEST_DATABASE_URL, so a misconfigured suite cannot reach a
 * real database — a protection added after an E2E run was found pointing at
 * live Supabase.
 */
export function appDatabaseUrl(): string {
  return currentEnvironment() === 'test'
    ? required('TEST_DATABASE_URL')
    : required('DATABASE_URL');
}

/** The URL migrations connect with. Falls back to the app URL only locally. */
export function ownerDatabaseUrl(): string {
  const direct = process.env.DIRECT_DATABASE_URL?.trim();
  if (direct) return direct;

  // Locally the two are usually the same database and the developer owns it.
  // In production they are genuinely different identities, so silence there
  // would mean migrations quietly running as the app role and failing on the
  // first ALTER — with a permissions error that reads like a bug.
  if (currentEnvironment() === 'production') {
    throw new Error(
      'DIRECT_DATABASE_URL is required in production.\n' +
        '  Migrations must connect as the database owner; DATABASE_URL is the ' +
        'constrained application role and cannot ALTER anything.\n' +
        '  On Supabase this is the session pooler on port 5432.',
    );
  }

  return appDatabaseUrl();
}

/**
 * Host and database name only — safe to print.
 *
 * Used by the scripts to say which database they are about to write to. Never
 * log a connection string: it carries the password.
 */
export function describeConnection(url: string): string {
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || '(default)';
    return `${parsed.hostname}:${parsed.port || '5432'}/${database} as ${parsed.username}`;
  } catch {
    return '(unparseable connection string)';
  }
}

/**
 * Fail early, with every problem at once.
 *
 * Run by `npm run check:env`. Returns the problems rather than throwing on the
 * first, so a fresh deployment learns about all its missing variables in one
 * pass instead of one redeploy each.
 */
export function collectEnvironmentProblems(): string[] {
  const problems: string[] = [];
  const environment = currentEnvironment();

  const check = (name: string, why: string) => {
    if (!process.env[name]?.trim()) problems.push(`${name} is not set — ${why}`);
  };

  if (environment === 'test') {
    check('TEST_DATABASE_URL', 'the test suite needs its own throwaway database');
  } else {
    check('DATABASE_URL', 'the application cannot reach the database');
  }

  if (environment === 'production') {
    check('DIRECT_DATABASE_URL', 'migrations must connect as the owner');
    check('AUTH_SECRET', 'sessions cannot be signed');

    const appUrl = process.env.DATABASE_URL ?? '';
    if (appUrl.includes('://postgres:') || appUrl.includes('://postgres@')) {
      problems.push(
        'DATABASE_URL connects as `postgres` — the database owner, which ' +
          'bypasses every RLS policy. It must connect as `qhakaza_app`.',
      );
    }
  }

  return problems;
}
