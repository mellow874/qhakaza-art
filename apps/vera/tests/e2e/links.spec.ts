import { expect, test } from './fixtures';

/**
 * Every internal link the public site renders must resolve.
 *
 * The collector app has the same guard, written after its header shipped
 * pointing at pages that were never built. Vera needed it for the same reason:
 * every card on /briefings linked to /briefings/<slug>, which did not exist,
 * and four catalogue routes were placeholders. A dead link is invisible to a
 * component test and to a page test; only walking them catches it.
 */

const PUBLIC_PAGES = [
  '/',
  '/about',
  '/how-it-works',
  '/features',
  '/faq',
  '/contact',
  '/briefings',
  '/browse',
  '/artists',
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

test('every briefing on the index opens', async ({ page, request }) => {
  // The index is generated from content, so a new entry gets covered here
  // automatically rather than needing its own test.
  await page.goto('/briefings', { waitUntil: 'domcontentloaded' });

  const hrefs = [
    ...new Set(
      await page
        .locator('a[href^="/briefings/"]')
        .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!)),
    ),
  ];

  expect(hrefs.length, 'expected the index to list briefings').toBeGreaterThan(0);

  for (const href of hrefs) {
    expect((await request.get(href)).status(), `${href} does not open`).toBeLessThan(400);
  }
});
