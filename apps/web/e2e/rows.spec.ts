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

test('filters and Show more change only the cards, never the page (D-136)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/clothing');
  await page.evaluate(() => ((window as unknown as { kept: boolean }).kept = true));
  const cards = page.locator('main article');
  const panel = page.getByRole('complementary', { name: 'Filters' });
  await panel.getByRole('link', { name: /^Kurtas/ }).click();
  await expect(page).toHaveURL(/\/clothing\?category=kurtas$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Kurtas');
  await panel.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page).toHaveURL(/category=kurtas&size=M$/);
  await page.getByLabel('Sort by').selectOption('price-asc');
  await expect(page).toHaveURL(/sort=price-asc/);
  await page.getByRole('link', { name: 'Clear all' }).click();
  await page.getByLabel('Sort by').selectOption('new');
  await expect(cards).toHaveCount(24);
  const more = page.getByRole('link', { name: 'Show more' });
  await more.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  await more.click();
  await expect(cards).toHaveCount(48);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(40);
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

test("Home's Just listed is a row per type, each with its own See all (D-140)", async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#just-listed');
  await expect(section.getByRole('tab')).toHaveCount(0);
  const clothing = section.getByRole('region', { name: 'Clothing' });
  await expect(clothing.getByRole('list', { name: 'Just listed: Clothing' })).toBeVisible();
  const seeAll = clothing.getByRole('link', { name: /See all/ });
  await expect(seeAll).toHaveAttribute('href', '/clothing');
  // by keyboard: the Home hero's scroll effects can move the row under a mouse pointer mid-click
  await seeAll.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/clothing$/);
});
