import { expect, test, type APIRequestContext } from '@playwright/test';

import { DEMO_PRODUCT, E2E_ADMIN, E2E_CUSTOMER, E2E_SLUG_PREFIX, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-154 step 3: the bag shows its shipments. 7-day pieces worth $49.99 come alone in 7 days; adding the demo saree
 * opens a second shipment; checkout, once the address is known, shows both with their dates. A local 7-day piece (a
 * Blinkit snack, placeholder, kept across runs and archived after each) is made for the test and food is cleared for it,
 * then put back.
 * The second test walks the store switch (step 4).
 * It stops before paying: Stripe's test page challenges an automated browser with a captcha (docs/status.md), and
 * create_order's two shipments are covered in SQL (shipment_admin.test.sql).
 */
const SNACK = `${E2E_SLUG_PREFIX}7day-snack`;
let foodCleared = false;

test.beforeAll(async () => {
  const service = serviceClient();
  const { data: settings } = await service.from('pricing_settings').select('food_cleared').eq('id', 1).single();
  foodCleared = settings?.food_cleared ?? false;
  await service.from('pricing_settings').update({ food_cleared: true }).eq('id', 1);
  const { data: category } = await service.from('categories').select('id').eq('product_type', 'food').limit(1).single();
  const { data: vendor } = await service.from('vendors').select('id').limit(1).single();
  // One fixture kept across runs (archived after each): its page may be in the build's page cache, so its option
  // keeps its id.
  const { data: existing } = await service.from('products').select('id').eq('slug', SNACK).maybeSingle();
  let productId = existing?.id;
  if (!productId) {
    const { data: product, error } = await service
      .from('products')
      .insert({
        slug: SNACK,
        name: 'E2E banana chips',
        product_type: 'food',
        region_id: null,
        category_id: category!.id,
        vendor_id: vendor!.id,
        price_cents: 1000,
        price_auto: false,
        status: 'live',
        published_at: new Date().toISOString(),
        source_site: 'blinkit.com',
        source_url: `https://blinkit.com/prn/e2e/prid/${Date.now()}`,
        is_placeholder: true,
        attributes: {},
      })
      .select('id')
      .single();
    if (error) throw error;
    productId = product.id;
    const { error: variantError } = await service
      .from('product_variants')
      .insert({ product_id: productId, sku: `E2E-7DAY-${Date.now()}`, label: '200 g', qty_listed: 50, weight_g: 200 });
    if (variantError) throw variantError;
  }
  const { error: liveError } = await service.from('products').update({ status: 'live' }).eq('id', productId);
  if (liveError) throw liveError;
  await service.from('products').update({ price_cents: 1000 }).eq('id', productId);
});

test.afterAll(async () => {
  const service = serviceClient();
  await service.from('products').update({ status: 'archived' }).eq('slug', SNACK);
  await service.from('pricing_settings').update({ food_cleared: foodCleared }).eq('id', 1);
});

/** The fixture was written straight to the database, so the store refreshes its pages as after an app admin's change (B-17). */
async function refreshStore(request: APIRequestContext): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  const { data, error } = await auth.auth.signInWithPassword(E2E_ADMIN);
  if (error || !data.session) throw error ?? new Error('no admin session');
  expect((await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${data.session.access_token}` } })).status()).toBe(200);
}

test('7-day pieces come alone; a saree opens a second shipment, shown in the bag and at checkout', async ({ page, request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  await refreshStore(request);

  await page.goto(`/states/india/${SNACK}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.goto('/cart');
  // $10 of 7-day pieces: under the line, one group in the normal window and one goal: free 7-day delivery (D-156)
  await expect(page.getByRole('main').getByText('Add $39.99 more for free 7-day delivery')).toBeVisible();
  await expect(page.getByRole('main').getByText(/for free delivery$/)).toHaveCount(0);
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'One more' }).click();
  // $50: one 7-day shipment, Shipping struck through
  await expect(page.getByRole('heading', { name: /^Arrives by \w{3}, \w{3} \d+/ })).toBeVisible();
  await expect(page.getByRole('main').getByText('Your 7-day pieces now arrive by', { exact: false })).toBeVisible();
  // the bag says it is free, as checkout does, and never asks for more for free delivery (D-156)
  await expect(page.getByRole('main').getByText(/^Free 7-day delivery: arrives by/)).toBeVisible();
  await expect(page.getByRole('main').getByText(/more for free delivery/)).toHaveCount(0);

  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /^Shipment 1 · Arrives by/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Shipment 2 · Arrives / })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shipment 1' }).getByText('E2E banana chips')).toBeVisible();

  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="zipCode"]').fill('08817');
  await expect(page.getByText('✓ Edison, NJ')).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  // After the address: both shipments with their dates, priced as one parcel
  await expect(page.getByText(/^Shipment 1 · Arrives by/).first()).toBeVisible();
  await expect(page.getByText(/^Shipment 2 · Arrives /).first()).toBeVisible();
});

// D-154 step 4: the store tabs open the 7-day store (its date, its search), and the IWC tab returns to the page left.
test('the store tabs open the 7-day store and its search; IWC returns to the page left', async ({ page, request }) => {
  await refreshStore(request);
  await page.goto('/clothing');
  const stores = page.getByRole('navigation', { name: 'Store' });
  await expect(stores.getByRole('link', { name: /IWC store/ })).toHaveAttribute('aria-current', 'page');
  await expect(stores.getByRole('link', { name: /7-day store/ })).toContainText(/arrives /);
  await stores.getByRole('link', { name: /7-day store/ }).click();
  await expect(page).toHaveURL(/\/7-day-delivery$/);
  await expect(stores.getByRole('link', { name: /7-day store/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText(/^Order today, arrives by \w{3}, \w{3} \d+\.$/)).toBeVisible();

  await page.goto('/7-day-delivery/search?q=banana');
  await expect(page.getByRole('main').getByText('E2E banana chips')).toBeVisible();
  await stores.getByRole('link', { name: /IWC store/ }).click();
  await expect(page).toHaveURL(/\/clothing$/);
});
