import { expect, test } from '@playwright/test';

import { DEMO_PRODUCT, E2E_CUSTOMER } from './env';

/**
 * Flow 3 (engineering.md §Testing, D-003, D-006): the admin is invisible and
 * closed to customers, and customer pages carry no operations data.
 */
test.describe('hidden admin and customer-safe pages', () => {
  test('signed out: /admin goes to its own sign-in page, never indexed', async ({ page }) => {
    const response = await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(response?.headers()['x-robots-tag']).toContain('noindex');
  });

  test('a signed-in customer gets a plain 404 on /admin', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
    await page.locator('input[name="password"]').fill(E2E_CUSTOMER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/account/);

    for (const path of ['/admin', '/admin/login', '/admin/orders']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.locator('body')).not.toContainText(/admin/i);
      expect(await page.title(), path).not.toMatch(/admin/i);
    }
  });

  test('no link, robots entry or sitemap entry names the admin', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    for (const path of ['/robots.txt', '/sitemap.xml']) {
      const body = await (await request.get(path)).text();
      expect(body, path).not.toMatch(/\/admin/);
    }
  });

  test('customer pages and their data carry no vendor or cost fields', async ({ request }) => {
    const pages = [
      '/',
      `/states/${DEMO_PRODUCT.region}`,
      `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`,
      '/search?q=saree',
    ];
    for (const path of pages) {
      const html = await (await request.get(path)).text();
      // Page source includes the React payload sent to the browser.
      for (const forbidden of [
        'vendor_id',
        'shop_name',
        'shop_price',
        'Demo shop (',
        'cycle_id',
        'pickup',
      ]) {
        expect(html, `${path} contains "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });
});
