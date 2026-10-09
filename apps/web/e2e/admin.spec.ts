import { expect, test } from '@playwright/test';

import { E2E_ADMIN, E2E_SLUG_PREFIX } from './env';

/**
 * Flow 2 (engineering.md §Testing): admin sign-in → new listing (draft) → variant
 * with stock → publish → the product is visible on the storefront.
 */
test('an admin lists a product and publishes it to the store', async ({ page }) => {
  const stamp = Date.now().toString(36);
  const name = `E2E Test Mundu ${stamp}`;
  const slug = `${E2E_SLUG_PREFIX}mundu-${stamp}`;

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ })).toBeVisible();

  await page.goto('/admin/listings');
  const shop = page.locator('select[name="vendorId"]');
  await shop.selectOption({
    label: await shop.locator('option', { hasText: 'Kerala' }).first().innerText(),
  });
  // Type is a Clothing / Spice toggle: Spice swaps the clothing fields for the spice ones, Clothing brings them back.
  await page.getByText('Spice', { exact: true }).click();
  await expect(page.locator('input[name="ingredients"]')).toBeVisible();
  await expect(page.locator('input[name="fibre"]')).toBeHidden();
  await page.getByText('Clothing', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Clothing' })).toBeChecked();
  await expect(page.locator('input[name="ingredients"]')).toBeHidden();
  const category = page.locator('select[name="categoryId"]');
  await category.selectOption({
    label: await category
      .locator('option', { hasText: /^clothing · / })
      .first()
      .innerText(),
  });
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="slug"]').fill(slug);
  await page.locator('input[name="shopPrice"]').fill('1200');
  await page.locator('input[name="price"]').fill('49.00');
  await page.locator('input[name="fibre"]').fill('100% cotton');
  await page.locator('input[name="care"]').fill('Hand wash cold');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page).toHaveURL(/\/admin\/catalog\/[0-9a-f-]{36}$/);

  await page.locator('input[name="label"]').fill('One size');
  await page.locator('input[name="sku"]').fill(`E2E-${stamp}`.toUpperCase());
  await page.locator('input[name="qty"]').last().fill('3');
  await page.getByRole('button', { name: 'Add variant' }).click();
  await expect(page.getByRole('cell', { name: 'One size' })).toBeVisible();

  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);

  // The storefront: search is uncached, and publishing refreshed the cached pages.
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  await page.goto(`/states/kerala/${slug}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Made in India').first()).toBeVisible();
});
