import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { openOrderAsGuest } from './buy';
import { DEMO_PRODUCT, E2E_ADMIN, E2E_CUSTOMER, E2E_SLUG_PREFIX, serviceClient, stripeTestKeysPresent } from './env';
import { orderNumberShown } from './flows';
import { CARDS, continueToPayment, ownCaller, payWith } from './pay';

/**
 * D-187: every food piece comes in 7 delivery days. A bag of food under and over $49.99, food with a saree (two
 * shipments, shown in the bag without dates and at checkout with them), an address outside the 48 states and DC (one
 * shipment), and the order page. A food fixture (placeholder, kept across runs and archived after each) is made for it.
 */
const SNACK = `${E2E_SLUG_PREFIX}food-snack`;

test.beforeAll(async () => {
  const service = serviceClient();
  const { data: category } = await service.from('categories').select('id').eq('product_type', 'food').limit(1).single();
  // One fixture kept across runs: its page may be in the build's page cache, so its option keeps its id.
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
      .insert({ product_id: productId, sku: `E2E-FOOD-${Date.now()}`, label: '200 g', qty_listed: 50, weight_g: 200 });
    if (variantError) throw variantError;
  }
  const { error: liveError } = await service.from('products').update({ status: 'live', price_cents: 1000 }).eq('id', productId);
  if (liveError) throw liveError;
});

test.afterAll(async () => {
  await serviceClient().from('products').update({ status: 'archived' }).eq('slug', SNACK);
});

/** The fixture was written straight to the database, so the store refreshes its pages as after an app admin's change (B-17). */
async function refreshStore(request: APIRequestContext): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  const { data, error } = await auth.auth.signInWithPassword(E2E_ADMIN);
  if (error || !data.session) throw error ?? new Error('no admin session');
  expect((await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${data.session.access_token}` } })).status()).toBe(200);
}

const addSnack = async (page: Page): Promise<void> => {
  await page.goto(`/states/india/${SNACK}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
};
const addSaree = async (page: Page): Promise<void> => {
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
};
async function details(page: Page, zip: string, place: string): Promise<void> {
  await page.goto('/checkout');
  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="zipCode"]').fill(zip);
  await expect(page.getByText(`✓ ${place}`)).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
}

const DATE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d/;

test('a food piece says 7 delivery days, with no date and nothing live', async ({ page, request }) => {
  await refreshStore(request);
  const sockets: string[] = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  await page.goto(`/states/india/${SNACK}`);
  await expect(page.getByText('7 delivery days').first()).toBeVisible();
  await expect(page.getByText('Duties paid. Nothing to pay at your door.')).toBeVisible();
  await expect(page.locator('.week-strip')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  // Y-3: no live connection on a product page (next dev's own socket excepted)
  expect(sockets.filter((u) => !u.includes('_next'))).toEqual([]);
});

test('food under and over $49.99, then a saree: one bar, two shipments, delivery days in the bag', async ({ page, request }) => {
  await refreshStore(request);
  await addSnack(page);
  await page.goto('/cart');
  const main = page.getByRole('main');
  // $10 of food: shipping is charged, one goal
  await expect(page.getByRole('heading', { name: /^Food · 7 delivery days/ })).toBeVisible();
  await expect(main.getByText('Add $39.99 more for free delivery')).toBeVisible();
  for (let i = 0; i < 4; i += 1) await page.getByRole('button', { name: 'One more' }).click();
  // $50: free
  await expect(main.getByText(/more for free delivery/)).toHaveCount(0);
  await expect(main.getByText("You're saving")).toBeVisible();

  await addSaree(page);
  await page.goto('/cart');
  const first = page.getByRole('heading', { name: /^Shipment 1 · Food · 7 delivery days/ });
  const second = page.getByRole('heading', { name: /^Shipment 2 · Clothing and home & gifts · 12 – 16 delivery days/ });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(page.getByRole('region', { name: 'Shipment 1' }).getByText('E2E banana chips')).toBeVisible();
  expect(await first.innerText()).not.toMatch(DATE);
  expect(await second.innerText()).not.toMatch(DATE);
});

test('a mixed bag at checkout: both shipments with their dates, then the order page shows them', async ({ page, request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  test.setTimeout(150_000);
  await refreshStore(request);
  await ownCaller(page);
  await addSnack(page);
  await addSaree(page);
  await details(page, '08817', 'Edison, NJ');
  await continueToPayment(page).click();
  await expect(page.getByText('Shipment 1 · Food').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Shipment 2 · Clothing and home & gifts').first()).toBeVisible();
  await expect(page.getByText(/^Estimated delivery:/).first()).toBeVisible();

  await payWith(page, CARDS.ok);
  const order = await orderNumberShown(page);
  await openOrderAsGuest(page, order);
  await expect(page.getByRole('region', { name: 'Shipment 1' }).getByText('E2E banana chips')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Shipment 1 · Food/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Shipment 2/ })).toBeVisible();
  await expect(page.getByText(/^Estimated delivery/).first()).toBeVisible();
});

test('outside the 48 states and DC everything is one shipment, and says why', async ({ page, request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  await refreshStore(request);
  await ownCaller(page);
  await addSnack(page);
  await addSaree(page);
  await details(page, '99501', 'Anchorage, AK');
  await continueToPayment(page).click();
  await expect(page.getByText(/everything here comes together in one shipment/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Shipment 1 · Food')).toHaveCount(0);
});
