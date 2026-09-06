/**
 * Is the sending domain ready, and is the existing mail still safe?
 *
 *   npm run check:email                       (defaults to the sending domain)
 *   npm run check:email -- example.com        (any domain)
 *
 * TWO QUESTIONS, AND THE SECOND MATTERS MORE.
 *
 *  1. Are Resend's records in place, so the platform can send?
 *  2. Is the domain's EXISTING mail still intact?
 *
 * The second is the one worth automating. Adding a sending provider to a
 * domain that already carries a company's mail can break that mail - most
 * often by leaving two SPF records on the root, which is not "two rules" but a
 * permanent error: receivers stop evaluating SPF entirely and legitimate mail
 * starts failing. It is silent, it affects every message the business sends,
 * and nobody connects it to a DNS change made days earlier.
 *
 * So this checks for that first, and says plainly if it finds it.
 */

const DEFAULT_DOMAIN = 'qhakazaartcollective.co.za';

type Verdict = { ok: boolean; label: string; detail: string };

async function dns(name: string, type: 'TXT' | 'MX'): Promise<string[]> {
  try {
    const response = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) return [];
    const body = (await response.json()) as { Answer?: { data: string }[] };
    return (body.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ''));
  } catch {
    return [];
  }
}

/** An SPF record, as opposed to any other TXT record on the same name. */
const isSpf = (value: string) => value.toLowerCase().startsWith('v=spf1');

async function main() {
  const domain = process.argv[2]?.trim() || DEFAULT_DOMAIN;
  console.log(`\nEmail DNS for ${domain}\n`);

  const [rootTxt, rootMx, dkim, sendTxt, sendMx] = await Promise.all([
    dns(domain, 'TXT'),
    dns(domain, 'MX'),
    dns(`resend._domainkey.${domain}`, 'TXT'),
    dns(`send.${domain}`, 'TXT'),
    dns(`send.${domain}`, 'MX'),
  ]);

  const spf = rootTxt.filter(isSpf);
  const verdicts: Verdict[] = [];

  // --- The safety check, first ---------------------------------------------
  if (spf.length > 1) {
    verdicts.push({
      ok: false,
      label: 'EXISTING MAIL IS BROKEN',
      detail:
        `${spf.length} SPF records on the root. There must be exactly one - two is a ` +
        `permanent error and every message this domain sends will now fail SPF. ` +
        `Merge them into a single line, or delete the one that was added. Records: ${spf.join(' | ')}`,
    });
  } else if (spf.length === 1) {
    verdicts.push({
      ok: true,
      label: 'Existing mail intact',
      detail: `One SPF record, as there should be: ${spf[0]}`,
    });
  } else {
    verdicts.push({
      ok: true,
      label: 'No SPF on the root',
      detail: 'Nothing to conflict with. Unusual for a domain that sends mail, but not an error.',
    });
  }

  verdicts.push(
    rootMx.length > 0
      ? { ok: true, label: 'Mailbox still receiving', detail: rootMx.join(', ') }
      : {
          ok: false,
          label: 'No MX on the root',
          detail: 'This domain cannot receive mail. A reply-to here would bounce.',
        },
  );

  // --- Is Resend set up? ---------------------------------------------------
  verdicts.push(
    dkim.length > 0
      ? { ok: true, label: 'Resend signing key (DKIM)', detail: 'Present' }
      : {
          ok: false,
          label: 'Resend signing key (DKIM)',
          detail: `Missing at resend._domainkey.${domain}. Add the domain in Resend and copy its records in.`,
        },
  );

  const sendSpf = sendTxt.filter(isSpf);
  verdicts.push(
    sendSpf.length > 0 || sendTxt.length > 0
      ? { ok: true, label: 'Resend sending record', detail: `Present on send.${domain}` }
      : {
          ok: false,
          label: 'Resend sending record',
          detail: `Missing on send.${domain}`,
        },
  );

  verdicts.push(
    sendMx.length > 0
      ? { ok: true, label: 'Resend bounce handling', detail: `Present on send.${domain}` }
      : { ok: false, label: 'Resend bounce handling', detail: `Missing on send.${domain}` },
  );

  for (const v of verdicts) {
    console.log(`  ${v.ok ? '✓' : '✗'}  ${v.label}`);
    console.log(`     ${v.detail}\n`);
  }

  const ready = verdicts.slice(2).every((v) => v.ok);
  const safe = verdicts[0].ok;

  console.log(
    ready
      ? `  Ready. The platform can send as @${domain} once Resend shows it Verified.\n`
      : `  Not ready to send as @${domain} yet - see the crosses above.\n`,
  );

  if (!safe) {
    console.log('  ⚠ Fix the SPF problem first. It affects mail the business already sends.\n');
  }
}

main().catch((error) => {
  console.error('Could not complete the check:', error);
  process.exit(1);
});

/*
 * Marks this file as a module rather than a global script. Without it, two
 * standalone scripts that each define `main` collide at the type level even
 * though they never run together.
 */
export {};
