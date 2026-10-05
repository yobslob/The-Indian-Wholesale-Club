import { expect, type Page } from '@playwright/test';

import { DEMO_PRODUCT, E2E_CUSTOMER } from './env';

export const ORDER_NUMBER = /IWC-\d{6}-[0-9A-F]{10}/;

/** Region → product → bag → checkout with the Stripe test card. Returns the order number from the thank-you page. */
export async function buyDemoProduct(page: Page): Promise<string> {
  await page.goto(`/states/${DEMO_PRODUCT.region}`);
  await page
    .locator(`a[href="/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}"]`)
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}$`));
  await expect(page.getByText('Made in India').first()).toBeVisible();

  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole('link', { name: 'Checkout' }).click();

  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="line1"]').fill('1 Test Street');
  await page.locator('input[name="city"]').fill('Edison');
  await page.locator('select[name="state"]').selectOption('NJ');
  await page.locator('input[name="zipCode"]').fill('08817');
  await page.getByRole('button', { name: 'Continue to payment' }).click();

  // Server-priced summary with a delivery window (D-008) before any payment.
  await expect(page.getByText('Estimated delivery:')).toBeVisible();

  // Stripe's Payment Element: the visible iframe inside our page (Stripe's own dev-tools
  // iframe sits outside <main>). Newer Stripe versions list the methods collapsed, so pick
  // "Card" first when the card fields aren't open yet.
  const card = page
    .getByRole('main')
    .locator('iframe:not([aria-hidden="true"])')
    .first()
    .contentFrame();
  const number = card.locator('[name="number"]');
  const cardTab = card.getByRole('button', { name: 'Card', exact: true });
  await expect(number.or(cardTab).first()).toBeVisible({ timeout: 30_000 });
  if (!(await number.isVisible())) await cardTab.click();
  await number.fill('4242 4242 4242 4242');
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postal = card.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('08817');
  await page.getByRole('button', { name: /^Pay \$/ }).click();

  await expect(page).toHaveURL(/\/checkout\/success\?order=/, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  const orderNumber = (await page.locator('strong').filter({ hasText: ORDER_NUMBER }).textContent())?.trim() ?? '';
  expect(orderNumber).toMatch(ORDER_NUMBER);
  return orderNumber;
}

/** A guest sees the order only after confirming the checkout email. */
export async function openOrderAsGuest(page: Page, orderNumber: string): Promise<void> {
  await page.goto(`/orders/${orderNumber}`);
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.getByRole('button', { name: 'Find my order' }).click();
  await expect(page.getByText(`Order ${orderNumber}`)).toBeVisible();
}
