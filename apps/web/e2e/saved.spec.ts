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

  // the product's own heart comes first; Similar items' cards have theirs (D-140)
  const save = page.getByRole('button', { name: 'Save for later' }).first();
  const wrote = page.waitForResponse((r) => r.url().includes('/rest/v1/wishlists') && r.request().method() !== 'GET');
  await save.click();
  const saved = page.getByRole('button', { name: 'Saved. Remove from saved' }).first();
  await expect(saved).toHaveAttribute('aria-pressed', 'true');
  await wrote; // D-140: the screen answers at once, the database a moment later

  await page.reload();
  await expect(saved).toBeVisible({ timeout: 15_000 }); // read back after the static page loads

  const removed = page.waitForResponse((r) => r.url().includes('/rest/v1/wishlists') && r.request().method() === 'DELETE');
  await saved.click();
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await removed;
  await page.reload();
  await expect(save).toBeVisible();
  await page.waitForTimeout(1_500); // the saved check runs after load: it must leave the heart empty
  await expect(save).toHaveAttribute('aria-pressed', 'false');
});

test('the heart fills before the network answers, and a signed-out save stays on the device (D-140, F6)', async ({ page }) => {
  // every database call is slowed down: the heart must not wait for any of them
  await page.route('**/rest/v1/**', async (route) => {
    await new Promise((r) => setTimeout(r, 3_000));
    await route.continue();
  });
  await page.goto('/clothing');
  const heart = page.getByRole('main').getByRole('button', { name: 'Save for later' }).first();
  await heart.click();
  await expect(page.getByRole('main').getByRole('button', { name: 'Saved. Remove from saved' }).first()).toHaveAttribute('aria-pressed', 'true', {
    timeout: 500,
  });
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('iwc-saved') ?? '[]').length)).toBe(1);
});
