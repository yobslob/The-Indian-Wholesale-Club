import { expect, test } from '@playwright/test';

import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient } from './env';

/**
 * B-6: the heart on a (static) product page shows whether the signed-in customer already saved the piece, and a
 * second tap removes it. The saved state is read in the browser after the page loads.
 */
test('the heart remembers a saved piece and a second tap removes it', async ({ page }) => {
  const product = `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`;
  const { data: user } = await serviceClient()
    .from('profiles')
    .select('id')
    .eq('email', E2E_CUSTOMER.email)
    .single();
  if (user) await serviceClient().from('wishlists').delete().eq('user_id', user.id); // start unsaved

  await page.goto(`/login?next=${encodeURIComponent(product)}`);
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="password"]').fill(E2E_CUSTOMER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${product}$`));

  const save = page.getByRole('button', { name: 'Save for later' });
  await save.click();
  const saved = page.getByRole('button', { name: 'Saved. Remove from saved' });
  await expect(saved).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(saved).toBeVisible({ timeout: 15_000 }); // read back after the static page loads

  await saved.click();
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(save).toBeVisible();
  await page.waitForTimeout(1_500); // the saved check runs after load: it must leave the heart empty
  await expect(save).toHaveAttribute('aria-pressed', 'false');
});
