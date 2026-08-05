// MUST be first. Playwright does not load .env, and the shared client reads
// DATABASE_URL when its module body runs — static imports execute in source
// order, so this side-effect import has to precede @qhakaza/shared-db or the
// client is constructed against an unset connection string.
import 'dotenv/config';

import { expect, test as base, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';

import { PrismaClient } from '@prisma/client';

import { type Role } from '@qhakaza/shared-auth';

/**
 * Test fixtures connect as the database OWNER, not as the app role.
 *
 * Seeding is privileged work: creating an artist or an invitation is something
 * RLS correctly forbids an anonymous app connection from doing. The app under
 * test still runs constrained — that is the point — so this client exists only
 * to arrange and tear down the world around it.
 */
export const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
});

/**
 * Per-test accounts.
 *
 * E2E tests used to sign in as the same seeded artist, which meant any test
 * that wrote to that row could break a test reading it — fine serially, racy in
 * parallel. Each test now gets its own freshly created user, torn down
 * afterwards, so they are independent and can run at full concurrency.
 *
 * Uses the shared client: no app or test defines its own database connection.
 */

export const PASSWORD = 'password123';

export type Account = {
  id: string;
  email: string;
  password: string;
};

let counter = 0;

function uniqueEmail(role: Role) {
  counter += 1;
  return `e2e-${role.toLowerCase()}-${process.pid}-${counter}@test.local`;
}

async function createAccount(role: Role, withProfile: { displayName: string } | null = null) {
  const email = uniqueEmail(role);

  const user = await prisma.user.create({
    data: {
      name: withProfile?.displayName ?? `E2E ${role}`,
      email,
      role,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      ...(withProfile
        ? {
            artist: {
              create: {
                displayName: withProfile.displayName,
                slug: `e2e-${process.pid}-${counter}`,
                approved: true,
              },
            },
          }
        : {}),
    },
  });

  return { id: user.id, email, password: PASSWORD };
}

async function destroyAccount(account: Account) {
  // Cascades clear the artist profile and anything hanging off it.
  await prisma.user.deleteMany({ where: { id: account.id } });
}

export const test = base.extend<{
  artist: Account;
  artistWithProfile: Account;
  collector: Account;
}>({
  artist: async ({}, use) => {
    const account = await createAccount('ARTIST');
    await use(account);
    await destroyAccount(account);
  },

  artistWithProfile: async ({}, use) => {
    const account = await createAccount('ARTIST', { displayName: 'Thandi Mokoena' });
    await use(account);
    await destroyAccount(account);
  },

  collector: async ({}, use) => {
    const account = await createAccount('COLLECTOR');
    await use(account);
    await destroyAccount(account);
  },
});

export { expect } from '@playwright/test';

/**
 * On a narrow viewport the header's links live behind a menu toggle. Opening it
 * when present lets one test cover both layouts, rather than asserting only what
 * the desktop happens to show.
 */
export async function openNavIfCollapsed(page: Page) {
  const toggle = page.getByRole('button', { name: 'Open menu' });
  if (!(await toggle.isVisible())) return;

  /*
   * The header is a client component, and these tests navigate with
   * `domcontentloaded` rather than waiting for full load — so a click can land
   * before React has attached its handler and simply do nothing. Retry until
   * the menu is genuinely open rather than assuming the first click took.
   */
  await expect(async () => {
    if (await toggle.isVisible()) await toggle.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Waits until React has hydrated the form on the page.
 *
 * These tests navigate with `domcontentloaded`, so the server-rendered inputs
 * are present and fillable before React mounts. A **controlled** input filled in
 * that window is silently reset to its initial state the moment hydration runs —
 * the test then submits an empty field and fails somewhere far from the cause.
 *
 * Detected by the fiber React attaches to the DOM node on hydration. That is an
 * internal, but it is the only honest signal that the handlers are live; the
 * alternative is a sleep.
 */
export async function waitForFormHydration(page: Page) {
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return Boolean(form) && Object.keys(form!).some((key) => key.startsWith('__react'));
  });
}

export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
