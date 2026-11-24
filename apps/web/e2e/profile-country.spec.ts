import { expect, test } from '@playwright/test';

/** D-208 (plan-world Phase 2): the country is always on Profile, the US included, and it is changed from there. */
test('Profile shows the country and its flag, and Change switches it everywhere', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account');
  const row = page.getByRole('region', { name: 'Country' });
  await expect(row.getByText('United States')).toBeVisible();
  const flag = page.locator('.site-icon > .site-flag').first();
  await expect(flag).toBeVisible();
  expect(await flag.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('/flags/us.svg');

  await row.getByRole('button', { name: 'Change' }).click();
  await row.getByRole('radio', { name: /Canada/ }).click();
  await expect(row.getByText('Canada')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-market', 'ca');
  expect(await flag.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('/flags/ca.svg');
  expect((await page.context().cookies()).find((c) => c.name === 'iwc_market')?.value).toBe('ca');
});
