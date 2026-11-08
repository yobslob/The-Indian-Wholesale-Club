import { expect, test } from '@playwright/test';

/** D-195: Home's Traditional wear tile opens Clothing with only the pieces from a state, each with its state's name. */
test('Traditional wear opens Clothing from every state, each card naming its state', async ({ page }) => {
  await page.goto('/');
  const tile = page.getByRole('link', { name: /^Traditional wear/ });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page).toHaveURL(/\/clothing\?state=any-state$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Traditional wear');
  const cards = page.locator('[data-card-grid] > article');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  expect(await cards.locator('.card-state').count()).toBe(n);
});
