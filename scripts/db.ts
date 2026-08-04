/**
 * Local Postgres without Docker.
 *
 * `embedded-postgres` ships real PostgreSQL binaries and runs them as an
 * ordinary user process against a data directory inside the repo. No system
 * install, no admin rights, no container runtime — but it is genuine Postgres,
 * so Prisma, migrations, `Decimal`, `String[]` columns and transactions behave
 * exactly as they will in production.
 *
 *   npm run db:up      start dev (:5432) and test (:5433), then exit
 *   npm run db:down    stop both
 *   npm run db:status  report what is running
 *
 * The server is driven through `pg_ctl`, which daemonises it. That matters:
 * the library's own start/stop keeps the server as a child of the Node process,
 * so it would die with the terminal and could not be stopped from a later
 * command. Data directories live in .postgres/ and are gitignored.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import EmbeddedPostgres from 'embedded-postgres';

type Instance = {
  label: string;
  port: number;
  database: string;
  dataDir: string;
};

const ROOT = path.resolve(__dirname, '..');
const USER = 'qhakaza';
const PASSWORD = 'qhakaza';

const INSTANCES: Instance[] = [
  {
    label: 'dev',
    port: 5432,
    database: 'qhakaza_art',
    dataDir: path.join(ROOT, '.postgres/dev'),
  },
  {
    label: 'test',
    port: 5433,
    database: 'qhakaza_art_test',
    dataDir: path.join(ROOT, '.postgres/test'),
  },
];

/** Locates the platform-specific binaries npm installed alongside the wrapper. */
function binDir(): string {
  const platform = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[
    process.platform as 'win32' | 'darwin' | 'linux'
  ];

  if (!platform) {
    throw new Error(`No embedded Postgres binaries for platform "${process.platform}"`);
  }

  const dir = path.join(
    ROOT,
    'node_modules/@embedded-postgres',
    `${platform}-${process.arch}`,
    'native/bin',
  );

  if (!existsSync(dir)) {
    throw new Error(`Embedded Postgres binaries missing at ${dir}. Run \`npm install\`.`);
  }

  return dir;
}

function bin(name: string): string {
  return path.join(binDir(), process.platform === 'win32' ? `${name}.exe` : name);
}

/**
 * `detached` must be used for `start`: pg_ctl daemonises the server, which
 * inherits the stdio pipes. If we captured them, spawnSync would block forever
 * waiting for a pipe that the now-independent server never closes. Startup
 * output goes to the instance's server.log instead.
 */
function pgCtl(args: string[], { detached = false } = {}) {
  return spawnSync(bin('pg_ctl'), args, {
    encoding: 'utf8',
    stdio: detached ? 'ignore' : 'pipe',
  });
}

function isRunning(instance: Instance): boolean {
  return pgCtl(['status', '-D', instance.dataDir]).status === 0;
}

/** initdb formats the data directory. It must run exactly once per instance. */
async function initialiseIfNeeded(instance: Instance): Promise<boolean> {
  if (existsSync(path.join(instance.dataDir, 'PG_VERSION'))) return false;

  console.log(`  ${instance.label.padEnd(4)} initialising data directory…`);
  mkdirSync(path.dirname(instance.dataDir), { recursive: true });

  const server = new EmbeddedPostgres({
    databaseDir: instance.dataDir,
    user: USER,
    password: PASSWORD,
    port: instance.port,
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });

  await server.initialise();
  return true;
}

/**
 * Creating the database needs a running server, so this runs post-start.
 * `createdb` exits non-zero when the database already exists, which is the
 * normal case on every start after the first.
 */
function ensureDatabase(instance: Instance) {
  spawnSync(
    bin('createdb'),
    ['-h', '127.0.0.1', '-p', String(instance.port), '-U', USER, instance.database],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: PASSWORD } },
  );
}

async function up() {
  for (const instance of INSTANCES) {
    if (isRunning(instance)) {
      console.log(`  ${instance.label.padEnd(4)} already running on :${instance.port}`);
      continue;
    }

    await initialiseIfNeeded(instance);

    const result = pgCtl(
      [
        'start',
        '-D',
        instance.dataDir,
        '-l',
        path.join(instance.dataDir, 'server.log'),
        '-o',
        `-p ${instance.port}`,
        '-w', // wait until it is actually accepting connections
      ],
      { detached: true },
    );

    if (result.status !== 0) {
      console.error(`  ${instance.label.padEnd(4)} failed to start`);
      console.error(`  See ${path.join(instance.dataDir, 'server.log')}`);
      process.exit(1);
    }

    ensureDatabase(instance);
    console.log(`  ${instance.label.padEnd(4)} up on :${instance.port} (${instance.database})`);
  }
}

async function down() {
  for (const instance of INSTANCES) {
    if (!isRunning(instance)) {
      console.log(`  ${instance.label.padEnd(4)} not running`);
      continue;
    }

    // `fast` rolls back open transactions rather than waiting for clients.
    const result = pgCtl(['stop', '-D', instance.dataDir, '-m', 'fast', '-w']);

    console.log(
      result.status === 0
        ? `  ${instance.label.padEnd(4)} stopped (:${instance.port})`
        : `  ${instance.label.padEnd(4)} failed to stop: ${result.stderr.trim()}`,
    );
  }
}

async function status() {
  for (const instance of INSTANCES) {
    const running = isRunning(instance);
    console.log(
      `  ${instance.label.padEnd(4)} :${instance.port}  ${running ? 'running' : 'stopped'}  ${instance.database}`,
    );
  }
}

const COMMANDS: Record<string, () => Promise<void>> = { up, down, status };

async function main() {
  const command = process.argv[2] ?? 'up';
  const run = COMMANDS[command];

  if (!run) {
    console.error(`Unknown command "${command}". Use: up | down | status`);
    process.exit(1);
  }

  await run();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
