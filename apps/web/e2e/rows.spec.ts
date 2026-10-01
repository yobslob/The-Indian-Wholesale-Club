import { expect, test } from '@playwright/test';

/**
 * Flow 5 (D-062): product lists are rows that scroll sideways, and See all opens the full list of that category.
 * Runs on the dev catalogue (supabase/seed/catalogue.sql, D-059), which gives Delhi a dozen new arrivals and a
 * kurtas row, and /clothing more than 48 pieces.
 */
test.use({ reducedMotion: 'reduce' });

test('a row scrolls sideways and See all opens that category for that state', async ({ page }) => {
  await page.goto('/states/delhi');
  const row = page.locator('#new-arrivals');
  const list = row.getByRole('list', { name: 'New arrivals' });
  const size = await list.evaluate((el) => ({ scroll: el.scrollWidth, box: el.clientWidth }));
  expect(size.scroll).toBeGreaterThan(size.box);
  await row.getByRole('button', { name: 'Scroll New arrivals on' }).click();
  await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);

  await page.locator('#c-kurtas').getByRole('link', { name: /See all/ }).click();
  await expect(page).toHaveURL(/\/clothing\?state=delhi&category=kurtas$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kurtas');
  const cards = page.locator('main article');
  expect(await cards.count()).toBeGreaterThan(0);
  for (const text of await cards.allInnerTexts()) expect(text).toContain('Delhi');
});

test('See all pages draw 24 cards at a time', async ({ page }) => {
  await page.goto('/clothing');
  const cards = page.locator('main article');
  await expect(cards).toHaveCount(24);
  await page.getByRole('link', { name: 'Show more' }).click();
  await expect(cards).toHaveCount(48);
});
