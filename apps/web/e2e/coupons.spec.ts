import { expect, test } from '@playwright/test';

import { buyDemoProduct } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-191: checkout's coupon box on a phone: the best coupon on top, "View all coupons" as a small tab rather than a page,
 * Apply reprices the payment, a guest is offered sign-in for the coins. The retailer charges are paid and never struck.
 */
test.use({ reducedMotion: 'reduce' });

test('the coupon box: best on top, all in a small tab, Apply takes it off the bill', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();

  const box = page.getByRole('region', { name: 'Coupons' });
  await expect(box.getByText('Best for your bag')).toBeVisible();
  await expect(box.getByText('WELCOME10')).toBeVisible();
  await expect(box.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/checkout');

  // a small tab, not a page: the address stays, and it closes with Escape
  await box.getByRole('button', { name: 'View all coupons' }).click();
  const tab = page.getByRole('dialog', { name: 'All coupons' });
  await expect(tab).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(tab.getByText('SAVE20')).toBeVisible();
  await expect(tab.getByText('On bags of $199 or more')).toBeVisible();
  const size = await tab.boundingBox();
  expect(size!.width).toBeLessThanOrEqual(375);
  await page.keyboard.press('Escape');
  await expect(tab).toHaveCount(0);

  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email.replace('@', `+coupon${Date.now()}@`));
  await page.locator('input[name="zipCode"]').fill('08817');
  await expect(page.getByText('✓ Edison, NJ')).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByText('Estimated delivery:').first()).toBeAttached();

  // the bill sits above Pay on a phone; the retailer charges are never struck through
  const bill = page.locator('dl', { hasText: 'Retailer charges' }).first();
  await expect(bill).toBeVisible();
  await expect(bill.locator('div', { hasText: 'Retailer charges' }).locator('s')).toHaveCount(0);
  const total = async (): Promise<string> => (await bill.locator('div', { hasText: /^Total/ }).innerText()).replace(/\s+/g, ' ');
  const before = await total();

  await box.getByRole('button', { name: 'Apply' }).click();
  await expect(box.getByText(/^Applied/)).toBeVisible();
  await expect(bill.getByText('Coupon (WELCOME10)')).toBeVisible();
  await expect.poll(total).not.toBe(before);

  await box.getByRole('button', { name: 'Remove' }).click();
  await expect(bill.getByText('Coupon (WELCOME10)')).toHaveCount(0);
  await expect.poll(total).toBe(before);
});

test("Home: no Gifts tile, and the founder's photos on the tiles", async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('#categories');
  await expect(tiles.getByText('Gifts', { exact: true })).toHaveCount(0);
  await expect(tiles.locator('img[src^="/visuals/"]').first()).toBeAttached();
});

test('a signed-in order uses the coins, shows them on the bill and refills the wallet by 1 to 8', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const db = serviceClient();
  const { data: user } = await db.from('profiles').select('id, coins').eq('email', E2E_CUSTOMER.email).single();
  expect(user).not.toBeNull();
  await db.from('addresses').delete().eq('user_id', user!.id); // the checkout's first step is the phone

  await page.goto('/login?next=/account');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="password"]').fill(E2E_CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 15_000 });

  const number = await buyDemoProduct(page);
  await expect(page.getByText(`${user!.coins} coins used`).first()).toBeVisible();
  const { data: order } = await db
    .from('orders')
    .select('coins_used, subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents')
    .eq('order_number', number)
    .single();
  expect(order!.coins_used).toBe(user!.coins);
  expect(order!.discount_cents).toBeGreaterThanOrEqual(user!.coins);
  expect(order!.total_cents).toBe(order!.subtotal_cents - order!.discount_cents + order!.shipping_cents + order!.tax_cents);
  const { data: after } = await db.from('profiles').select('coins').eq('id', user!.id).single();
  expect(after!.coins - user!.coins).toBeGreaterThanOrEqual(1);
  expect(after!.coins - user!.coins).toBeLessThanOrEqual(8);
});
