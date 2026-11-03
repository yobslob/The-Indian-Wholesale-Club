import { expect, test } from '@playwright/test';

/**
 * D-182: customers on phones scrolled too far to reach anything they could tap. On an iPhone's visible area (and the
 * smallest phone) the store's four doors and the 7-day store's poster are all on the first screen, with no scrolling.
 * D-183 – D-185: the 7-day store is the poster (its words live text on the picture, its button the free line), no
 * longer a row under it.
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
      hero.getByRole('link', { name: /7-day store/i }),
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
  const poster = hero.getByRole('link', { name: /7-day store/i });
  await expect(poster).toHaveAttribute('href', '/7-day-delivery');
  await expect(poster).toContainText(/Free delivery from \$/);
  // D-183: the old offer is gone from the hero (it stays in the Diwali night further down)
  await expect(hero.getByText(/under \$99/i)).toHaveCount(0);
  const color = (): Promise<string> => page.locator('.site-header').evaluate((el) => getComputedStyle(el).color);
  expect(await color()).toBe('rgb(255, 255, 255)');
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
  await expect(page.locator('html')).toHaveAttribute('data-hero-passed', '');
  await expect.poll(color).not.toBe('rgb(255, 255, 255)');
});
