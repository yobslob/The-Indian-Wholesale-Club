import { expect, test } from '@playwright/test';

import { buyDemoProduct } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * D-114: a signed-in customer's first paid order saves its address (as the default), and the next checkout opens at
 * Delivery with that address and phone filled in.
 */
test('a signed-in order saves its address and the next checkout uses it', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const { data: user } = await serviceClient().from('profiles').select('id').eq('email', E2E_CUSTOMER.email).single();
  expect(user).not.toBeNull();
  await serviceClient().from('addresses').delete().eq('user_id', user!.id); // start with none

  await page.goto('/login?next=/account');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="password"]').fill(E2E_CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 15_000 }); // signed in

  await buyDemoProduct(page);
  const { data: saved } = await serviceClient()
    .from('addresses')
    .select('line1, zip_code, is_default, phone')
    .eq('user_id', user!.id);
  expect(saved).toEqual([{ line1: '1 Test Street', zip_code: '08817', is_default: true, phone: '+1 (732) 555-0142' }]);

  // The next checkout: phone done, the saved address picked and filled in.
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).click();
  await page.goto('/checkout');
  await expect(page.getByText('Your saved addresses')).toBeVisible();
  await expect(page.getByRole('radio', { name: /1 Test Street/ })).toBeChecked();
  await expect(page.locator('input[name="line1"]')).toHaveValue('1 Test Street');
  await expect(page.locator('input[name="email"]')).toHaveValue(E2E_CUSTOMER.email);
  await expect(page.getByText('+1 (732) 555-0142').first()).toBeVisible(); // the folded phone step

  // "A new address" empties the form.
  await page.getByRole('radio', { name: 'A new address' }).check();
  await expect(page.locator('input[name="line1"]')).toHaveValue('');
});
