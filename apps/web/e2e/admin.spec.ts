import { expect, test, type Page } from '@playwright/test';

import { E2E_ADMIN, E2E_SLUG_PREFIX, serviceClient } from './env';

async function signIn(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ })).toBeVisible();
}

/**
 * Flow 2 (engineering.md §Testing): admin sign-in → a draft (made here: listings come from the importer and the runner,
 * D-187, Y-4) → publish on its page → the product is visible on the storefront.
 */
test('an admin publishes a draft to the store', async ({ page }) => {
  const stamp = Date.now().toString(36);
  const name = `E2E Test Mundu ${stamp}`;
  const slug = `${E2E_SLUG_PREFIX}mundu-${stamp}`;
  const service = serviceClient();
  const { data: region, error: regionError } = await service.from('regions').select('id').eq('slug', 'kerala').single();
  if (regionError) throw regionError;
  const { data: category, error: categoryError } = await service
    .from('categories')
    .select('id')
    .eq('product_type', 'clothing')
    .eq('is_active', true)
    .limit(1)
    .single();
  if (categoryError) throw categoryError;
  const { data: product, error: productError } = await service
    .from('products')
    .insert({
      name,
      slug,
      region_id: region.id,
      category_id: category.id,
      product_type: 'clothing',
      wears: 'men',
      attributes: { fibre_content: '100% cotton', care: 'Hand wash cold' },
      price_cents: 4900,
      price_auto: false,
      status: 'draft',
    })
    .select('id')
    .single();
  if (productError) throw productError;
  const { error: variantError } = await service.from('product_variants').insert({
    product_id: product.id,
    sku: slug.toUpperCase(),
    label: 'One size',
    qty_listed: 3,
    weight_g: 450,
    weight_source: 'admin',
    qty_confirmed_at: new Date().toISOString(),
  });
  if (variantError) throw variantError;

  await signIn(page);
  await page.goto(`/admin/catalog/${product.id}`);
  await expect(page.getByRole('cell', { name: 'One size' })).toBeVisible();

  await page.getByRole('button', { name: 'Publish' }).click();
  // The piece is live at once; the page takes about 29 s to say so under `next start` (measured 2026-11-04: the database
  // is idle meanwhile, and a reload shows it in 0.5 s). Open in docs/status.md.
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0, { timeout: 60_000 });

  // The storefront: search is uncached, and publishing refreshed the cached pages.
  await page.goto(`/search?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole('link', { name: new RegExp(name) }).first()).toBeVisible();
  await page.goto(`/states/kerala/${slug}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Made in India').first()).toBeVisible();
});

/** D-187: the admin's screens on the simple store's schema; nothing links to a page that went. */
test('the buying screens and Settings load, and the removed pages are gone', async ({ page }) => {
  await signIn(page);
  const sidebar = page.getByRole('navigation', { name: 'Admin' }).first();
  for (const label of ['Today', 'Orders', 'To order', 'Products', 'Import from shops', 'Settings']) {
    await expect(sidebar.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  for (const label of ['Cycle', 'Payouts', 'Vendors', 'Vendor pieces', 'House models']) {
    await expect(sidebar.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveCount(0);
  }

  await page.goto('/admin/to-order');
  await expect(page.getByRole('heading', { name: 'To order' })).toBeVisible();
  await expect(page.getByText('This page did not load')).toHaveCount(0);
  for (const view of ['ordered', 'weigh']) {
    await page.goto(`/admin/to-order?view=${view}`);
    await expect(page.getByText('This page did not load')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'To order' })).toBeVisible();
  }

  await page.goto('/admin/settings');
  await expect(page.getByLabel('Free shipping from ($)')).toHaveValue('49.99');
  await expect(page.getByLabel('Bulk saving and heavy-item discount from ($)')).toHaveValue('99.99');
  await expect(page.getByLabel('Food delivery days (business days): from')).toHaveValue('7');
  await expect(page.getByLabel('Clothing and home & gifts delivery days (business days): to')).toHaveValue('16');

  for (const path of ['/admin/insights', '/admin/orders', '/admin/catalog', '/admin/listings', '/admin/catalog/names']) {
    await page.goto(path);
    await expect(page.getByText('This page did not load'), path).toHaveCount(0);
  }

  for (const path of ['/admin/cycles', '/admin/payouts', '/admin/vendors', '/admin/vendor-pieces', '/admin/house-models', '/admin/settings/payment-test']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});
