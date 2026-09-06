/**
 * Is the domain move working yet?
 *
 * Run this repeatedly while DNS propagates. It checks each hostname through
 * three stages in order, and stops at the first one that fails - so the answer
 * is always "you are stuck at stage N", never a wall of noise.
 *
 *   npm run check:domains
 *
 * WHY A 500 COUNTS AS A PASS HERE.
 *
 * These checks are about DNS, certificates and routing. They are deliberately
 * NOT about whether the application works. A 500 from our own app proves the
 * request travelled the whole way - name resolved, certificate accepted,
 * Vercel matched the hostname to the right project - which is exactly what
 * this script exists to confirm.
 *
 * That distinction matters right now, because the database is unreachable and
 * every data-backed page is returning 500 regardless of the domain. Without
 * this separation the two faults are indistinguishable, and the domain work
 * would look broken when it is fine.
 */

/** What we expect a correctly-pointed hostname to look like. */
const VERCEL_CNAME_HINT = 'vercel-dns.com';

type Target = {
  host: string;
  what: string;
  /** The Vercel project it should land on, for the report only. */
  project: string;
};

const TARGETS: Target[] = [
  {
    host: 'qhakaza.leselimothae.com',
    what: 'Artist site',
    project: 'qhakaza-art-vera',
  },
  {
    host: 'collectors.leselimothae.com',
    what: 'Collector platform',
    project: 'qhakaza-art-collector',
  },
  {
    host: 'command.leselimothae.com',
    what: 'Command Center',
    project: 'qhakaza-art-command-center',
  },
];

type Stage = 'dns' | 'tls' | 'routing';

type Result = {
  target: Target;
  reached: Stage | null;
  detail: string;
  /** True when nothing further is needed from anyone. */
  done: boolean;
};

/**
 * Resolve over DNS-over-HTTPS rather than the system resolver.
 *
 * The machine running this may have cached the old answer, or sit behind a
 * resolver that lags. Asking a public resolver directly gives the same answer
 * a visitor's browser would get, which is the question actually being asked.
 */
async function resolve(host: string, type: 'A' | 'CNAME'): Promise<string[]> {
  const response = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
    { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15_000) },
  );

  if (!response.ok) return [];

  const body = (await response.json()) as { Answer?: { data: string }[] };
  return (body.Answer ?? []).map((answer) => answer.data);
}

async function check(target: Target): Promise<Result> {
  // --- Stage 1: does the name resolve at all? ------------------------------
  const [cname, a] = await Promise.all([resolve(target.host, 'CNAME'), resolve(target.host, 'A')]);
  const records = [...cname, ...a];

  if (records.length === 0) {
    return {
      target,
      reached: null,
      done: false,
      detail: 'Not in DNS yet. Add the record at the registrar, or wait for it to propagate.',
    };
  }

  const pointsAtVercel = records.some((record) => record.includes(VERCEL_CNAME_HINT));

  // --- Stages 2 and 3: does a request actually arrive? ---------------------
  //
  // One request settles both. Any HTTP response at all means the certificate
  // was accepted, because the request could not have completed otherwise.
  let status: number | null = null;
  let transportError = '';

  try {
    const response = await fetch(`https://${target.host}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(25_000),
    });
    status = response.status;
  } catch (error) {
    transportError = error instanceof Error ? error.message : String(error);
  }

  if (status === null) {
    return {
      target,
      reached: 'dns',
      done: false,
      detail: pointsAtVercel
        ? `In DNS and pointing at Vercel, but no response yet - the certificate is probably still being issued. Wait and re-run. (${transportError})`
        : `In DNS but not pointing at Vercel: ${records.join(', ')}. Check the record value.`,
    };
  }

  if (!pointsAtVercel) {
    return {
      target,
      reached: 'tls',
      done: false,
      detail: `Responding, but DNS points somewhere unexpected: ${records.join(', ')}`,
    };
  }

  /*
   * A 404 is the one status that means the domain reached Vercel but Vercel
   * did not recognise it - the record is right, the domain has not been added
   * to the project. Worth calling out separately: it is the commonest way to
   * get this half-done.
   */
  if (status === 404) {
    return {
      target,
      reached: 'tls',
      done: false,
      detail: `Reaching Vercel but it returned 404 - the hostname is probably not added to the ${target.project} project yet.`,
    };
  }

  return {
    target,
    reached: 'routing',
    done: true,
    detail:
      status >= 500
        ? `HTTP ${status}. The domain is working - this is the application erroring, which is expected while the database is down.`
        : `HTTP ${status}. Working.`,
  };
}

const TICK = { null: '·', dns: '◐', tls: '◑', routing: '●' } as const;

async function main() {
  console.log('\nDomain check\n');

  const results = await Promise.all(TARGETS.map(check));

  for (const result of results) {
    const mark = TICK[String(result.reached) as keyof typeof TICK];
    console.log(`  ${mark}  ${result.target.host}`);
    console.log(`     ${result.target.what} -> ${result.target.project}`);
    console.log(`     ${result.detail}\n`);
  }

  const done = results.filter((result) => result.done).length;
  console.log(`  ${done} of ${results.length} hostnames are serving.\n`);

  if (done < results.length) {
    console.log('  Legend: · not in DNS   ◐ in DNS   ◑ responding   ● serving the app\n');
  }

  /*
   * Exit 0 regardless. This is a progress report run by a person waiting for
   * DNS, not a test - a non-zero exit would make it look like something is
   * broken when the honest answer is "not finished yet".
   */
}

main().catch((error) => {
  console.error('Could not complete the check:', error);
  process.exit(1);
});
