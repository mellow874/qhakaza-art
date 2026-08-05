import { createHash } from 'node:crypto';

import { prisma } from '@qhakaza/shared-db';

import { expect, signIn, test, waitForFormHydration } from './fixtures';

/**
 * `/private/<token>` — the invite-only concierge area.
 *
 * Most of this file is adversarial. A private area is only as good as what it
 * refuses, so the ways in are tested more heavily than the way through.
 */

const HOUR = 60 * 60 * 1000;
const fingerprint = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

let issued: string[] = [];

async function issueToken(
  overrides: { expiresAt?: Date; status?: 'ISSUED' | 'REVOKED'; revokedAt?: Date } = {},
) {
  const token = `e2e-${process.pid}-${Math.random().toString(36).slice(2)}`;
  await prisma.memberInvitation.create({
    data: {
      email: `${token}@test.local`,
      tokenHash: fingerprint(token),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + HOUR),
      status: overrides.status ?? 'ISSUED',
      revokedAt: overrides.revokedAt ?? null,
    },
  });
  issued.push(token);
  return token;
}

test.afterEach(async () => {
  for (const token of issued) {
    await prisma.activationAttempt.deleteMany({ where: { tokenFingerprint: fingerprint(token) } });
    await prisma.memberInvitation.deleteMany({ where: { tokenHash: fingerprint(token) } });
  }
  issued = [];
});

test.describe('the door', () => {
  test('a forged token is refused and renders no member data', async ({ page }) => {
    await page.goto('/private/definitely-not-a-real-token', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /this link is not valid/i })).toBeVisible();

    // Nothing from behind the door leaks into the refusal.
    await expect(page.getByRole('link', { name: 'Discover' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toHaveCount(0);
  });

  test('an expired token is refused', async ({ page }) => {
    const token = await issueToken({ expiresAt: new Date(Date.now() - HOUR) });

    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /this link is not valid/i })).toBeVisible();
  });

  test('a revoked token is refused while still in date', async ({ page }) => {
    const token = await issueToken({ status: 'REVOKED', revokedAt: new Date() });

    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /this link is not valid/i })).toBeVisible();
  });

  test('every refusal looks identical, so the page is not an oracle', async ({ page }) => {
    // Forged, expired and revoked must be indistinguishable from outside, or
    // the refusal itself tells an attacker which guesses were close.
    const bodies: string[] = [];

    for (const path of [
      '/private/forged-token-value',
      `/private/${await issueToken({ expiresAt: new Date(Date.now() - HOUR) })}`,
      `/private/${await issueToken({ status: 'REVOKED', revokedAt: new Date() })}`,
    ]) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      bodies.push(((await page.locator('main').textContent()) ?? '').trim());
    }

    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[1]).toBe(bodies[2]);
  });

  test('a refused attempt is written to ActivationAttempt', async ({ page }) => {
    const token = 'probe-token-for-logging';
    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /this link is not valid/i })).toBeVisible();

    const attempt = await prisma.activationAttempt.findFirst({
      where: { tokenFingerprint: fingerprint(token) },
      orderBy: { createdAt: 'desc' },
    });

    expect(attempt?.outcome).toBe('INVALID_TOKEN');
    // The plaintext token is never stored, only its fingerprint.
    expect(attempt?.tokenFingerprint).not.toBe(token);

    await prisma.activationAttempt.deleteMany({ where: { tokenFingerprint: fingerprint(token) } });
  });

  test('a valid token still requires signing in', async ({ page }) => {
    const token = await issueToken();

    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });

    // A real invitee arriving from their email has no session yet; they are
    // sent to sign in and returned to the same URL, not refused.
    await expect(page).toHaveURL(new RegExp(`/login\\?callbackUrl=.*${token}`));
  });

  test('the private area is excluded from robots and the sitemap', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toMatch(/Disallow:\s*\/private\//);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/private');
    expect(sitemap).toContain('/collectors');
  });
});

test.describe('an invited member', () => {
  test('reaches the suite, browses and sends an enquiry', async ({ page, collector }) => {
    const token = await issueToken();

    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);

    await waitForFormHydration(page);
    await signIn(page, collector);

    await expect(page.getByRole('heading', { level: 1, name: /welcome back/i })).toBeVisible();

    await page.getByRole('link', { name: 'Enquiries' }).click();
    await waitForFormHydration(page);

    await page.getByLabel('Subject').fill('Viewing request');
    await page.getByLabel('Your enquiry').fill('I would like to see this work in person, please.');
    await page.getByRole('button', { name: /send enquiry/i }).click();

    await expect(page.getByRole('status')).toContainText(/has been sent/i);

    const note = await prisma.privateNoteSubmission.findFirst({
      where: { subject: 'Viewing request' },
      orderBy: { createdAt: 'desc' },
    });
    expect(note).not.toBeNull();

    await prisma.privateNoteSubmission.deleteMany({ where: { id: note!.id } });
  });

  test('the member area is marked noindex', async ({ page, collector }) => {
    const token = await issueToken();

    await page.goto(`/private/${token}`, { waitUntil: 'domcontentloaded' });
    await waitForFormHydration(page);
    await signIn(page, collector);
    await expect(page.getByRole('heading', { level: 1, name: /welcome back/i })).toBeVisible();

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});
