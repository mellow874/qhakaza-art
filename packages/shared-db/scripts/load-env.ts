/**
 * Load the repository's `.env` for scripts run through tsx.
 *
 * The Prisma CLI reads `.env` on its own, which is why `migrate` and `deploy`
 * work without this. Plain `tsx` does not, so every script here would otherwise
 * report DATABASE_URL missing while a perfectly good `.env` sat two directories
 * up.
 *
 * ALREADY-SET VARIABLES WIN. The migration scripts are invoked as
 *
 *   SOURCE_DATABASE_URL=… TARGET_DATABASE_URL=… npm run migrate:data
 *
 * and it would be dangerous for a stale `.env` to quietly replace a connection
 * string the operator typed on the command line — that is how you copy data
 * into the wrong database. Hence the explicit precedence rather than Node's
 * `process.loadEnvFile()`, which offers no such guarantee.
 *
 * Import for side effects, before anything that reads configuration:
 *
 *   import './load-env';
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Walk up from this file to the repository root, wherever it is checked out. */
function findRepositoryRoot(from: string): string | null {
  let directory = from;

  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(resolve(directory, 'package-lock.json'))) return directory;

    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  return null;
}

function parse(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Strip one layer of matching quotes; a connection string containing `#`
    // must not be treated as a comment, so nothing else is stripped.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) values[key] = value;
  }

  return values;
}

const root = findRepositoryRoot(process.cwd());
const envFile = root ? resolve(root, '.env') : null;

if (envFile && existsSync(envFile)) {
  const values = parse(readFileSync(envFile, 'utf8'));
  let loaded = 0;

  for (const [key, value] of Object.entries(values)) {
    // The command line and the real environment both outrank the file.
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }

  if (process.env.QHAKAZA_ENV_DEBUG) {
    console.log(`[env] loaded ${loaded} value(s) from ${envFile}`);
  }
}
