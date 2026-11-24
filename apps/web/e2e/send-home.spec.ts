import { expect, test, type Page } from '@playwright/test';

import { clickPay, ORDER_NUMBER } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-205, D-206, Send home: open for these tests only (Settings' switch and a fresh rate), closed again after, so every
 * other spec sees the store as it was. One worker runs the files one after another (playwright.config.ts).
 */
test.beforeAll(async () => {
  const { error } = await serviceClient()
    .from('pricing_settings')
    .update({ send_home_open: 1, send_home_inr_per_usd: 92, send_home_rate_at: new Date().toISOString(), send_home_keep_pct: 3 })
    .eq('id', 1);
  if (error) throw error;
});

test.afterAll(async () => {
  await serviceClient().from('pricing_settings').update({ send_home_open: null }).eq('id', 1);
});

async function bagWithSaree(page: Page): Promise<void> {
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
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

test('a first-time guest: the bag opens with the round-up added, Checkout asks who, the postcard after paying', async ({ page }) => {
  await bagWithSaree(page);
  const card = page.getByRole('region', { name: 'Send home' });
  await expect(card.getByRole('heading', { name: /^Send \$[\d.]+ to your loved ones$/ })).toBeVisible();
  await expect(card.getByText(/round up to \$\d*9/)).toBeVisible();
  const bill = page.getByRole('region', { name: 'Bill' });
  await expect(bill.getByText(/^Sent home/)).toBeVisible();
  await expect(bill.getByText(/\$\d*9\.00$/).last()).toBeVisible();

  await page.getByRole('link', { name: 'Checkout' }).first().click();
  const sheet = page.getByRole('dialog', { name: "Who's it for?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('$')).toHaveCount(0); // rupees only on the sheet (the founder)
  await sheet.getByRole('radio', { name: 'Maa' }).click();
  await sheet.getByLabel('Their UPI ID or UPI number').fill('lakshmi.m@okhdfcbank');
  await expect(sheet.getByText('A valid UPI ID (Google Pay).')).toBeVisible();
  await sheet.getByRole('button', { name: /^Send ₹[\d,]+ to Maa$/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  // Pricing and paying need Stripe's test keys (checkout answers 503 without them, as in CI): the bag and the sheet above
  // are checked everywhere, the rest where the keys are set.
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set: checkout cannot price or pay');
  await delivery(page);
  await expect(page.getByRole('region', { name: 'Bill' }).getByText(/^Sent home · ₹[\d,]+ to Maa/).first()).toBeVisible();
  const card4242 = page.getByRole('main').locator('iframe:not([aria-hidden="true"])').first().contentFrame();
  const number = card4242.locator('[name="number"]');
  const cardTab = card4242.getByRole('button', { name: 'Card', exact: true });
  await expect(number.or(cardTab).first()).toBeVisible({ timeout: 30_000 });
  if (!(await number.isVisible())) await cardTab.click();
  await number.fill('4242 4242 4242 4242');
  await card4242.locator('[name="expiry"]').fill('12 / 34');
  await card4242.locator('[name="cvc"]').fill('123');
  const postal = card4242.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('08817');
  await clickPay(page);

  await expect(page.getByRole('heading', { name: /^₹[\d,]+ is on its way to Maa\.$/ })).toBeVisible({ timeout: 70_000 });
  const orderNumber = (await page.locator('strong').filter({ hasText: ORDER_NUMBER }).textContent())?.trim() ?? '';
  const { data: order } = await serviceClient()
    .from('orders')
    .select('id, total_cents, home_gift_cents, home_gifts(status, call_name, upi, inr_paise, keep_pct)')
    .eq('order_number', orderNumber)
    .single();
  expect(order?.home_gift_cents).toBeGreaterThan(0);
  const gift = Array.isArray(order?.home_gifts) ? order.home_gifts[0] : order?.home_gifts;
  expect(gift).toMatchObject({ call_name: 'Maa', upi: 'lakshmi.m@okhdfcbank', keep_pct: 3 });
  // the rupees promised: the gift's dollars × 92 × 0.97, to the rupee (D-206)
  expect(gift?.inr_paise).toBe(Math.round(((order?.home_gift_cents ?? 0) / 100) * 92 * 0.97) * 100);
});

test('× takes the gift off for this bag: Checkout goes straight on and the bill has no gift', async ({ page }) => {
  await bagWithSaree(page);
  const card = page.getByRole('region', { name: 'Send home' });
  await card.getByRole('button', { name: 'Remove the gift' }).click();
  await expect(card.getByRole('button', { name: /^Add \$[\d.]+$/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bill' }).getByText(/^Sent home/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Checkout' }).first().click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('dialog', { name: "Who's it for?" })).toHaveCount(0);
});
