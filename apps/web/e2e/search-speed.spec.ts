import { expect, test } from '@playwright/test';

/**
 * Launch QA plan D-1, §8 item 11: search answers fast and never shows the error page.
 * The words stand in for the 20 most searched (the founder's Insights list replaces them when it is known); locally the
 * demo catalogue answers them, most with pieces, some with none.
 */
const TOP_QUERIES = [
  'saree', 'kurti', 'kurta', 'masala', 'pickle', 'dupatta', 'lehenga', 'chai', 'ghee', 'kasavu',
  'silk', 'cotton', 'jhumka', 'bangles', 'sweets', 'snacks', 'spices', 'rice', 'banarasi', 'diwali',
];

const ERROR_HEADING = 'Something went wrong';

test('the top 20 searches answer 200 within 1 s each (D-1)', async ({ request }) => {
  test.setTimeout(120_000);
  await request.get('/search?q=warm'); // the first request starts the server's code paths
  const slow: string[] = [];
  for (const q of TOP_QUERIES) {
    const started = Date.now();
    const res = await request.get(`/search?q=${encodeURIComponent(q)}`);
    const ms = Date.now() - started;
    expect(res.status(), `/search?q=${q}`).toBe(200);
    expect(await res.text(), `/search?q=${q}`).not.toContain(ERROR_HEADING);
    if (ms >= 1_000) slow.push(`${q}: ${ms} ms`);
  }
  expect(slow, 'searches slower than 1 s').toEqual([]);
});

test('a failed search request shows results or a friendly line, never the error page (D-1)', async ({ page }) => {
  await page.goto('/clothing');
  // The header box's suggestions fail…
  await page.route('**/api/search/hints*', (route) => route.fulfill({ status: 503, body: '' }));
  // …and the in-app navigation to the results (the RSC request) answers 500 the first time.
  await page.route(
    (url) => url.pathname === '/search',
    async (route) => {
      if (route.request().headers()['rsc']) await route.fulfill({ status: 500, contentType: 'text/plain', body: 'timeout' });
      else await route.fallback();
    },
    { times: 1 },
  );
  const box = page.locator('.site-search input').first();
  await box.click();
  await box.fill('saree');
  await box.press('Enter');

  await expect(page).toHaveURL(/\/search\?q=saree/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: ERROR_HEADING })).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText(/saree|try a shorter search|try again/i);
});
