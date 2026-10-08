import { expect, test } from '@playwright/test';

import { buyDemoProduct, openOrderAsGuest } from './buy';
import { stripeTestKeysPresent } from './env';

/**
 * Flow 1 (engineering.md §Testing): region → product → bag → checkout with the
 * Stripe test card → thank-you page → order page after the email check.
 */
test('a guest buys the demo product and tracks the order', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');

  const orderNumber = await buyDemoProduct(page);
  await openOrderAsGuest(page, orderNumber);
  await expect(page.getByText(/Estimated delivery/).first()).toBeVisible();
  await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible(); // the timeline (D-088)
});
