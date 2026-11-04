import { expect, test } from '@playwright/test';

/**
 * D-182: customers on phones scrolled too far to reach anything they could tap. On an iPhone's visible area (and the
 * smallest phone) the store's four doors and the poster are all on the first screen, with no scrolling. D-183 – D-185:
 * the poster's words are live text on the picture, its button the free line. D-187: it opens Food, in delivery days.
 */
for (const [width, height] of [
  [390, 664],
  [320, 568],
] as const) {
  test(`Home's first screen opens the store at ${width} x ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const hero = page.locator('[data-home-hero]');
    await expect(hero.getByRole('heading', { level: 1, name: 'Indian Wholesale Club' })).toBeVisible();
    const links = [
      hero.getByRole('link', { name: 'Clothing', exact: true }),
      hero.getByRole('link', { name: 'Food', exact: true }),
      hero.getByRole('link', { name: 'Home & gifts', exact: true }),
      hero.getByRole('link', { name: 'States', exact: true }),
      hero.getByRole('link', { name: /Mithai/ }),
    ];
    for (const link of links) {
      const box = await link.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(40);
    }
    // D-185: the poster's button is the free line ("Free delivery from $…"), inside the first screen; the tap target
    // is the whole poster, measured above
    const cta = hero.getByText(/^Free delivery from \$/).first();
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).toBeTruthy();
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('the doors go where they say, and the header turns cream past the hero', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  const hero = page.locator('[data-home-hero]');
  const poster = hero.getByRole('link', { name: /Mithai/ });
  await expect(poster).toHaveAttribute('href', '/food');
  await expect(poster).toContainText(/Free delivery from \$49\.99/);
  await expect(poster).toContainText(/From India to your door in 7\s+delivery days \(on food\)/);
  // D-183: the old offer is gone from the hero (it stays in the Diwali night further down)
  await expect(hero.getByText(/under \$99/i)).toHaveCount(0);
  const color = (): Promise<string> => page.locator('.site-header').evaluate((el) => getComputedStyle(el).color);
  expect(await color()).toBe('rgb(255, 255, 255)');
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
  await expect(page.locator('html')).toHaveAttribute('data-hero-passed', '');
  await expect.poll(color).not.toBe('rgb(255, 255, 255)');
});

test("D-187: Home's sections in the founder's order, with no second store", async ({ page }) => {
  await page.goto('/');
  const order = [
    '[data-home-hero]',
    'section[aria-label="Shop for Diwali"]',
    '#categories',
    'section[aria-label="Diwali at IWC"]',
    '#most-ordered',
    '#under-5',
    '#just-listed',
    '#pick',
    'aside[aria-label="How buying works"]',
  ];
  // A part with nothing to show (the local catalogue can hold no food) is left out; the rest keep their places.
  const tops = await page.evaluate(
    (selectors) =>
      selectors.flatMap((s) => {
        const el = document.querySelector(s);
        return el ? [{ s, top: el.getBoundingClientRect().top + window.scrollY }] : [];
      }),
    order,
  );
  expect(tops.map((t) => t.s)).toEqual(expect.arrayContaining(['[data-home-hero]', '#just-listed', '#pick']));
  for (let i = 1; i < tops.length; i += 1) expect(tops[i]!.top, `${tops[i]!.s} after ${tops[i - 1]!.s}`).toBeGreaterThan(tops[i - 1]!.top);

  if (tops.some((t) => t.s === '#categories')) {
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.locator('#categories a').first()).toHaveAttribute('href', /^\/(food|home-and-gifts)\?category=/);
  }
  await expect(page.getByRole('link', { name: 'Shop under $99' })).toHaveAttribute('href', /max=99/);
  await expect(page.getByRole('navigation', { name: 'Store' })).toHaveCount(0);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/7-day/i);
  expect(text).not.toMatch(/order by/i);
  await expect(page.locator('#just-listed-food')).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--days-food'))).toContain('7 delivery days');
});
