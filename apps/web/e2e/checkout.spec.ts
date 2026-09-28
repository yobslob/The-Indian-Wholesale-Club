import { expect, test } from '@playwright/test';

import { DEMO_PRODUCT, E2E_CUSTOMER, stripeTestKeysPresent } from './env';

const ORDER_NUMBER = /IWC-\d{6}-[0-9A-F]{10}/;

/**
 * Flow 1 (engineering.md §Testing): region → product → bag → checkout with the
 * Stripe test card → thank-you page → order page after the email check.
 */
test('a guest buys the demo product and tracks the order', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');

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

  const card = page.frameLocator('iframe[title="Secure payment input frame"]').first();
  await card.locator('[name="number"]').fill('4242 4242 4242 4242');
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postal = card.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('08817');
  await page.getByRole('button', { name: /^Pay \$/ }).click();

  await expect(page).toHaveURL(/\/checkout\/success\?order=/, { timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible();
  const orderNumber = (
    await page.locator('strong').filter({ hasText: ORDER_NUMBER }).textContent()
  )?.trim();
  expect(orderNumber).toMatch(ORDER_NUMBER);

  // A guest sees the order only after confirming the checkout email.
  await page.goto(`/orders/${orderNumber}`);
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.getByRole('button', { name: 'Find my order' }).click();
  await expect(page.getByText(`Order ${orderNumber}`)).toBeVisible();
  await expect(page.getByText(/Estimated delivery/).first()).toBeVisible();
});
