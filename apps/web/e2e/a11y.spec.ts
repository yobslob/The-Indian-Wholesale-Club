import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { DEMO_PRODUCT } from './env';
import { addDemoToBag } from './pay';

/**
 * Launch QA plan §8 item 12: axe finds no serious or critical WCAG 2.1 A/AA problem on Home, /food, a product, the bag
 * and checkout. Reduced motion, so nothing is caught half-way through an entrance. Stripe's card frame is Stripe's;
 * checkout is checked at its first step, before the frame loads.
 */
test.use({ reducedMotion: 'reduce' });

async function seriousProblems(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('iframe')
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}×, e.g. ${v.nodes[0]?.target.join(' ') ?? '?'})`);
}

const PAGES: [string, string][] = [
  ['Home', '/'],
  ['Food', '/food'],
  ['a product', `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`],
];

for (const [name, path] of PAGES) {
  test(`axe: ${name} has no serious or critical problems`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    expect(await seriousProblems(page)).toEqual([]);
  });
}

test('axe: the bag and checkout have no serious or critical problems', async ({ page }) => {
  await addDemoToBag(page);
  await page.goto('/cart');
  await expect(page.getByRole('link', { name: 'Checkout' })).toBeVisible();
  expect(await seriousProblems(page), '/cart').toEqual([]);

  await page.goto('/checkout');
  await expect(page.locator('input[name="phone"]')).toBeVisible();
  expect(await seriousProblems(page), '/checkout').toEqual([]);
});
