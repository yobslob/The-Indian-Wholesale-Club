import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * D-197, D-198: Canada, Australia and New Zealand see every price in their own dollars, worked out from the US price at
 * the rate in Settings; the US sees "$" as always, and the caps (the free-delivery line, "under $99", coupons and
 * savings) stay in "$" everywhere. The country comes from the device's clock (no permission),
 * a ?market= link or the footer's switch. The local catalogue may hold only some product types, so the first See all
 * page with a card is used.
 */
async function firstCardPrice(page: Page, query = ''): Promise<Locator> {
  for (const path of ['/clothing', '/food', '/home-and-gifts']) {
    await page.goto(`${path}${query}`);
    const price = page.locator('.product-card .product-card-meta .money:not(s .money)').first();
    if ((await price.count()) > 0) return price;
  }
  throw new Error('no product card in the local catalogue');
}

test.describe('a Canadian clock', () => {
  test.use({ timezoneId: 'America/Toronto' });

  test('shows CA$ on cards and on the product page', async ({ page }) => {
    const price = await firstCardPrice(page);
    await expect(page.locator('html')).toHaveAttribute('data-market', 'ca');
    await expect(price).toHaveText(/^(From )?CA\$[\d,]+\.\d{2}$/);
    await expect(price).toBeVisible();
    await page.locator('.product-card a').first().click();
    await expect(page.getByTestId('product-price')).toHaveText(/^(From )?CA\$[\d,]+\.\d{2}$/);
    // a cap stays as written (D-198)
    await page.goto('/');
    await expect(page.locator('[data-home-hero]')).toContainText(/from \$49\.99/);
    await expect(page.getByRole('link', { name: 'Shop under $99' })).toBeVisible();
  });
});

test.describe('an Australian clock', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('shows A$, and the footer switch brings back US dollars for good', async ({ page }) => {
    const price = await firstCardPrice(page);
    await expect(price).toHaveText(/^(From )?A\$[\d,]+\.\d{2}$/);
    await page.locator('footer select').first().selectOption('us');
    await expect(price).toHaveText(/^(From )?\$[\d,]+\.\d{2}$/);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-market', 'us');
    await expect(page.locator('.product-card .product-card-meta .money:not(s .money)').first()).toHaveText(/^(From )?\$[\d,]+\.\d{2}$/);
  });
});

test.describe('a US clock', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('shows $ with no prefix, and a ?market=nz link shows NZ$', async ({ page }) => {
    const price = await firstCardPrice(page);
    await expect(page.locator('html')).toHaveAttribute('data-market', 'us');
    await expect(price).toHaveText(/^(From )?\$[\d,]+\.\d{2}$/);
    const nz = await firstCardPrice(page, '?market=nz');
    await expect(nz).toHaveText(/^(From )?NZ\$[\d,]+\.\d{2}$/);
  });
});
