import { expect, test, type Page } from '@playwright/test';

import { E2E_ADMIN, stripeTestKeysPresent } from './env';
import { CARDS, fillCard, intentRefund, payButton } from './pay';

/** The admin's $1 payment test (admin.md §Payment test): pay with the store's card form, read it back, refund it. */

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ }),
  ).toBeVisible();
}

test('a $1 test payment shows its card and refunds from the page', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  await signInAsAdmin(page);
  await page.goto('/admin/settings/payment-test');
  await expect(page.getByText('Test mode (no real money)')).toBeVisible();

  await page.getByRole('button', { name: 'Make a $1 test payment' }).click();
  await fillCard(page, CARDS.ok);
  // a short page: Pay sits low, so click its left end, clear of Stripe's test-mode badge (bottom right), once the
  // form has stopped growing (the ZIP row appears after the card)
  await payButton(page).scrollIntoViewIfNeeded();
  await payButton(page).click({ position: { x: 24, y: 12 } });

  await expect(page).toHaveURL(/payment_intent=pi_/, { timeout: 30_000 });
  const id = new URL(page.url()).searchParams.get('payment_intent')!;
  const result = page.locator('section').filter({ hasText: 'The test payment' });
  await expect(result.getByText('Paid', { exact: true })).toBeVisible();
  await expect(result.getByText(/visa •••• 4242/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make a $1 test payment' })).toBeVisible();

  await result.getByRole('button', { name: 'Refund this $1' }).click();
  await expect(result.getByRole('button', { name: 'Refund this $1' })).toBeHidden({
    timeout: 30_000,
  });
  await expect(result.getByText('$1.00', { exact: true })).toHaveCount(2); // Amount and Refunded
  await expect.poll(async () => (await intentRefund(id)).refunded, { timeout: 15_000 }).toBe(100);
});
