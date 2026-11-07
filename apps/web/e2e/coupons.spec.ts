import { expect, test, type Locator, type Page } from '@playwright/test';

import { buyDemoProduct } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-192: on a phone, the coupons live in the bag: the best one in colour with Apply, all of them in a sheet, usable in colour
 * and the rest greyed with the reason. The bag's bill is the sum the server does, so checkout adds only the sales tax. The
 * retailer charges are paid and never struck through, at any step.
 */
test.use({ reducedMotion: 'reduce' });

const totalOf = async (bill: Locator): Promise<number> => {
  const words = await bill.locator('div', { hasText: /^(Bag total|Total)/ }).last().innerText();
  return Math.round(Number(/\$([\d,.]+)/.exec(words)![1]!.replace(',', '')) * 100);
};
const money = async (bill: Locator, label: string): Promise<number> => {
  const words = await bill.locator('div', { hasText: label }).last().innerText();
  return Math.round(Number(/\$([\d,.]+)/.exec(words)![1]!.replace(',', '')) * 100);
};

async function bagWithSaree(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await expect(page).toHaveURL(/\/cart$/);
}

async function details(page: Page, email: string): Promise<void> {
  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="zipCode"]').fill('08817');
  await expect(page.getByText('✓ Edison, NJ')).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
}

test('the coupons in the bag: colour with Apply, grey with the reason, and the bill moves at once', async ({ page }) => {
  await bagWithSaree(page);
  const box = page.getByRole('region', { name: 'Coupons' });
  const bill = page.getByRole('region', { name: 'Bill' });
  await expect(box.getByText('Best for your bag')).toBeVisible();
  await expect(box.getByText('WELCOME10')).toBeVisible();
  await expect(bill.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/cart');
  await expect(bill.getByText('Sales tax')).toHaveCount(0);
  await expect(bill.getByText('Bag total')).toBeVisible();
  await expect(page.getByText('shown at checkout')).toHaveCount(0);
  const before = await totalOf(bill);

  // a sheet, not a page: the address stays, and it closes with Escape
  await box.getByRole('button', { name: 'View all coupons' }).click();
  const sheet = page.getByRole('dialog', { name: 'All coupons' });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\/cart$/);
  const far = sheet.locator('li', { hasText: 'SAVE20' });
  await expect(far).toHaveAttribute('data-locked', '');
  await expect(far.getByRole('button', { name: 'Apply' })).toHaveCount(0);
  await expect(far.getByRole('link', { name: 'Back to shopping' })).toHaveAttribute('href', new RegExp(DEMO_PRODUCT.slug));
  await sheet.locator('li', { hasText: 'WELCOME10' }).getByRole('button', { name: 'Apply' }).click();
  await expect(sheet).toHaveCount(0);

  await expect(box.getByText(/Applied/)).toBeVisible();
  await expect(bill.getByText('Coupon (WELCOME10)')).toBeVisible();
  await expect.poll(() => totalOf(bill)).toBeLessThan(before);
  await box.getByRole('button', { name: 'Remove' }).click();
  await expect(bill.getByText('Coupon (WELCOME10)')).toHaveCount(0);
  await expect.poll(() => totalOf(bill)).toBe(before);
  await box.getByRole('button', { name: 'View all coupons' }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // the coupon work ends with the bag; the same figures carry over and nothing is struck on the charges
  await box.getByRole('button', { name: 'Apply' }).click();
  const withCoupon = await totalOf(bill);
  await page.getByRole('link', { name: 'Checkout' }).click();
  await expect(page.getByRole('region', { name: 'Coupons' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Bag \(1\)/ })).toContainText(`$${(withCoupon / 100).toFixed(2)}`);
  await page.getByRole('button', { name: /^Bag \(1\)/ }).click();
  const early = page.getByRole('region', { name: 'Bill' });
  await expect(early.getByText('Retailer charges')).toBeVisible();
  await expect(early.locator('div', { hasText: 'Retailer charges' }).locator('s')).toHaveCount(0);
  await page.getByRole('button', { name: /^Bag \(1\)/ }).click();

  // pricing starts a payment: what follows needs Stripe's test keys
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  await details(page, E2E_CUSTOMER.email.replace('@', `+coupon${Date.now()}@`));
  await expect(page.getByText('Estimated delivery:').first()).toBeVisible();
  const priced = page.getByRole('region', { name: 'Bill' });
  await expect(priced.getByText('Sales tax')).toBeVisible();
  await expect(priced.getByText('Coupon (WELCOME10)')).toBeVisible();
  await expect(priced.locator('div', { hasText: 'Retailer charges' }).locator('s')).toHaveCount(0);
  // the only line checkout adds is the tax
  expect(await totalOf(priced)).toBe(withCoupon + (await money(priced, 'Sales tax')));
});

test("Home: no Gifts tile, and the founder's photos on the tiles", async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('#categories');
  await expect(tiles.getByText('Gifts', { exact: true })).toHaveCount(0);
  await expect(tiles.locator('img[src^="/visuals/"]').first()).toBeAttached();
});

test('a signed-in order uses the wallet, shows it on the bill and refills it by 1 to 8', async ({ page }) => {
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
  await expect(page.locator('dt', { hasText: `Wallet (${user!.coins}` }).first()).toBeVisible();
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

test('a first-order coupon on a returning email comes off at checkout, says why and shows greyed in the bag', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  // the test above leaves this email with a paid order
  await bagWithSaree(page);
  const box = page.getByRole('region', { name: 'Coupons' });
  await expect(box.getByText('WELCOME10')).toBeVisible();
  await box.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  await details(page, E2E_CUSTOMER.email);

  await expect(page.getByText('WELCOME10 is for a first order, so it came off.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Bill' }).getByText('Coupon (WELCOME10)')).toHaveCount(0);
  await page.getByRole('link', { name: 'Choose another in your bag' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole('region', { name: 'Coupons' }).getByRole('button', { name: 'View all coupons' }).click();
  const welcome = page.getByRole('dialog', { name: 'All coupons' }).locator('li', { hasText: 'WELCOME10' });
  await expect(welcome).toHaveAttribute('data-locked', '');
  await expect(welcome.getByText('For a first order')).toBeVisible();
});
