import { expect, test } from './fixtures';

/**
 * Every internal link the public site renders must resolve.
 *
 * Written after the header shipped with `Suite` and `Pricing` pointing at pages
 * that were never built — the site's own navigation 404'd. A dead link is
 * invisible to a component test and to a page test; only walking them catches
 * it.
 */

const PUBLIC_PAGES = [
  '/collectors',
  '/collectors/about',
  '/collectors/membership',
  '/collectors/methodology',
  '/collectors/apply',
];

test('no page in the public shell renders a link that 404s', async ({ page, request }) => {
  const checked = new Map<string, number>();
  const broken: string[] = [];

  for (const from of PUBLIC_PAGES) {
    await page.goto(from, { waitUntil: 'domcontentloaded' });

    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));

    for (const href of hrefs) {
      // An anchor is only as good as the page it hangs off; check the page.
      const path = href.split('#')[0] || from;
      if (checked.has(path)) continue;

      const status = (await request.get(path)).status();
      checked.set(path, status);

      if (status >= 400) broken.push(`${from} → ${href} (${status})`);
    }
  }

  expect(checked.size, 'expected to have walked some links').toBeGreaterThan(3);
  expect(broken, `broken links:\n  ${broken.join('\n  ')}`).toEqual([]);
});

test('every anchor target the footer points at actually exists', async ({ page }) => {
  await page.goto('/collectors', { waitUntil: 'domcontentloaded' });

  const anchors = await page
    .locator('a[href*="#"]')
    .evaluateAll((links) =>
      links.map((link) => link.getAttribute('href')!).filter((href) => href.includes('#')),
    );

  const ids = [...new Set(anchors.map((href) => href.split('#')[1]).filter(Boolean))];
  expect(ids.length, 'expected the footer to use section anchors').toBeGreaterThan(0);

  for (const id of ids) {
    // A link to #nowhere scrolls nowhere and looks broken without erroring.
    await expect(page.locator(`#${id}`), `#${id} has no target`).toHaveCount(1);
  }
});
