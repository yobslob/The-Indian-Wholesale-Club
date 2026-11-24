import { expect, test, type Page } from '@playwright/test';

import { clickPay, ORDER_NUMBER } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-208, the 5% saving (Send home's card): Send home open for these tests only (Settings' switch and a fresh rate),
 * closed again after, so every other spec sees the store as it was. One worker runs the files one after another
 * (playwright.config.ts).
 */
test.beforeAll(async () => {
  const { error } = await serviceClient()
    .from('pricing_settings')
    .update({ send_home_open: 1, send_home_inr_per_usd: 92, send_home_rate_at: new Date().toISOString(), save_pct: 5 })
    .eq('id', 1);
  if (error) throw error;
});

test.afterAll(async () => {
  await serviceClient().from('pricing_settings').update({ send_home_open: null }).eq('id', 1);
});

async function bagWithSaree(page: Page): Promise<void> {
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await expect(page).toHaveURL(/\/cart$/);
}

async function delivery(page: Page): Promise<void> {
  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="zipCode"]').fill('08817');
  await expect(page.getByText('✓ Edison, NJ')).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  // pricing makes the payment with Stripe: the first one after a fresh server can take several seconds
  await expect(page.getByText('Estimated delivery:')).toBeVisible({ timeout: 20_000 });
}

async function payWithTestCard(page: Page): Promise<string> {
  const card = page.getByRole('main').locator('iframe:not([aria-hidden="true"])').first().contentFrame();
  const number = card.locator('[name="number"]');
  const cardTab = card.getByRole('button', { name: 'Card', exact: true });
  await expect(number.or(cardTab).first()).toBeVisible({ timeout: 30_000 });
  if (!(await number.isVisible())) await cardTab.click();
  await number.fill('4242 4242 4242 4242');
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postal = card.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('08817');
  await clickPay(page);
  await expect(page.locator('strong').filter({ hasText: ORDER_NUMBER })).toBeVisible({ timeout: 70_000 });
  return (await page.locator('strong').filter({ hasText: ORDER_NUMBER }).textContent())?.trim() ?? '';
}

test('a guest keeps the 5% by default: nothing joins the bill, Checkout goes straight on, the Coins wait', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bagWithSaree(page);
  const card = page.getByRole('region', { name: 'Your 5%' });
  await expect(card.getByRole('heading', { name: /^You're saving \$[\d.]+ on this bag\.$/ })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Keep it' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Bill' }).getByText(/^Sent home/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Checkout' }).first().click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('dialog', { name: "Who's it for?" })).toHaveCount(0);

  // Pricing and paying need Stripe's test keys (checkout answers 503 without them, as in CI)
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set: checkout cannot price or pay');
  await delivery(page);
  await expect(page.getByText(/^Your \$[\d.]+ saving goes to your Coins/)).toBeVisible();
  const orderNumber = await payWithTestCard(page);
  await expect(page.getByText(/Coins are waiting for you/)).toBeVisible();
  const { data: order } = await serviceClient()
    .from('orders')
    .select('subtotal_cents, total_cents, home_gift_cents, order_savings(outcome, save_cents)')
    .eq('order_number', orderNumber)
    .single();
  expect(order?.home_gift_cents).toBe(0);
  const saving = Array.isArray(order?.order_savings) ? order.order_savings[0] : order?.order_savings;
  expect(saving).toMatchObject({ outcome: 'coins', save_cents: Math.round(((order?.subtotal_cents ?? 0) * 5) / 100) });
});

test('Maa: the sheet names her, the 5% goes home by IWC, the customer pays the same', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bagWithSaree(page);
  const card = page.getByRole('region', { name: 'Your 5%' });
  const total = await page.getByRole('region', { name: 'Bill' }).getByText(/^\$[\d,.]+$/).last().textContent();
  await card.getByRole('button', { name: 'Maa' }).click();
  const sheet = page.getByRole('dialog', { name: "Who's it for?" });
  await expect(sheet.getByText('$')).toHaveCount(0); // rupees only on the sheet (the founder)
  await sheet.getByLabel('Their UPI ID or UPI number').fill('lakshmi.m@okhdfcbank');
  await expect(sheet.getByText('A valid UPI ID (Google Pay).')).toBeVisible();
  await sheet.getByRole('button', { name: /^Send ₹[\d,]+ to Maa$/ }).click();
  await expect(card.getByText(/^₹[\d,]+ goes to Maa's UPI after you pay\./)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bill' }).getByText(/^\$[\d,.]+$/).last()).toHaveText(total ?? '');

  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set: checkout cannot price or pay');
  await page.getByRole('link', { name: 'Checkout' }).first().click();
  await delivery(page);
  await expect(page.getByText(/^Your \$[\d.]+ saving goes to Maa/)).toBeVisible();
  const orderNumber = await payWithTestCard(page);
  await expect(page.getByRole('heading', { name: /^₹[\d,]+ is on its way to Maa\.$/ })).toBeVisible();
  const { data: order } = await serviceClient()
    .from('orders')
    .select('subtotal_cents, home_gift_cents, home_gifts(funded_by, keep_pct, usd_cents, inr_paise, upi)')
    .eq('order_number', orderNumber)
    .single();
  expect(order?.home_gift_cents).toBe(0);
  const gift = Array.isArray(order?.home_gifts) ? order.home_gifts[0] : order?.home_gifts;
  expect(gift).toMatchObject({ funded_by: 'iwc', keep_pct: 0, upi: 'lakshmi.m@okhdfcbank' });
  // the rupees: the saving's dollars × 92, to the rupee (D-208: IWC keeps nothing)
  expect(gift?.inr_paise).toBe(Math.round(((gift?.usd_cents ?? 0) / 100) * 92) * 100);
});
