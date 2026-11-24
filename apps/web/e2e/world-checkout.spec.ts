import { expect, test } from '@playwright/test';

import { clickPay, ORDER_NUMBER } from './buy';
import { DEMO_PRODUCT, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-208 Phase 4: an order from Germany. The visitor's country fills checkout's Country field, the address takes Germany's
 * fields and a phone with its country code, the bag is priced at Germany's prices with no US sales tax, and the order
 * keeps its country and those prices.
 */
test('an order from Germany: its address, its prices, no US tax', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set: checkout cannot price or pay');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}?market=de`);
  await expect(page.getByTestId('product-price')).toHaveText(/^US\$[\d,]+\.\d{2}$/);
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await page.getByRole('link', { name: 'Checkout' }).first().click();

  await page.locator('input[name="phone"]').fill('+49 30 1234 5678');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Country' })).toHaveValue('de');
  await page.locator('input[name="fullName"]').fill('Priya Iyer');
  await page.locator('input[name="email"]').fill('world-e2e@iwc.test');
  await page.locator('input[name="line1"]').fill('Hauptstrasse 5');
  await page.locator('input[name="city"]').fill('Berlin');
  await page.locator('input[name="zipCode"]').fill('10115');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByText('Estimated delivery:').first()).toBeVisible({ timeout: 20_000 });

  const card = page.getByRole('main').locator('iframe:not([aria-hidden="true"])').first().contentFrame();
  const number = card.locator('[name="number"]');
  const cardTab = card.getByRole('button', { name: 'Card', exact: true });
  await expect(number.or(cardTab).first()).toBeVisible({ timeout: 30_000 });
  if (!(await number.isVisible())) await cardTab.click();
  await number.fill('4242 4242 4242 4242');
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postal = card.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('10115');
  await clickPay(page);
  await expect(page.locator('strong').filter({ hasText: ORDER_NUMBER })).toBeVisible({ timeout: 70_000 });
  const orderNumber = (await page.locator('strong').filter({ hasText: ORDER_NUMBER }).textContent())?.trim() ?? '';

  const { data: order } = await serviceClient()
    .from('orders')
    .select('tax_cents, shipping_address, order_items(variant_id, unit_price_cents)')
    .eq('order_number', orderNumber)
    .single();
  expect((order?.shipping_address as { country?: string } | null)?.country).toBe('DE');
  expect(order?.tax_cents).toBe(0);
  const item = Array.isArray(order?.order_items) ? order.order_items[0] : null;
  const { data: us } = await serviceClient().from('store_variants').select('price_cents').eq('id', item?.variant_id ?? '').single();
  // Germany's freight (₹1,500 a kg) makes its price differ from the US's
  expect(item?.unit_price_cents).not.toBe(us?.price_cents);
});
