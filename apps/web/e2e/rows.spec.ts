import { expect, test } from '@playwright/test';

/**
 * Flow 5 (D-062): product lists are rows that scroll sideways, and See all opens the full list of that category.
 * Runs on the dev catalogue (supabase/seed/catalogue.sql, D-059), which gives Delhi a dozen new arrivals and a
 * kurtas row, and /clothing more than 48 pieces.
 */
test.use({ reducedMotion: 'reduce' });

test('a row scrolls sideways; See all opens its list', async ({ page }) => {
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Just listed: Clothing' });
  const size = await list.evaluate((el) => ({ scroll: el.scrollWidth, box: el.clientWidth }));
  expect(size.scroll).toBeGreaterThan(size.box);
  await page.getByRole('button', { name: 'Scroll Just listed: Clothing on' }).click();
  await expect.poll(() => list.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

// D-157: a state's inventory is See all with the state fixed: its filters change the cards on the state's own address
test("a state's inventory has See all's filters and keeps the state's address", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/states/delhi');
  const filters = page.getByRole('complementary', { name: 'Filters' });
  await expect(filters.getByRole('heading', { name: 'State' })).toHaveCount(0);
  await filters.getByRole('link', { name: /^Kurtas/ }).click();
  await expect(page).toHaveURL(/\/states\/delhi\?category=kurtas$/);
  await expect(page.getByRole('heading', { level: 2, name: /Kurtas/ })).toBeVisible();
  const cards = page.locator('[data-card-grid] > article');
  await expect(cards.first()).toBeVisible();
  for (const text of await cards.allInnerTexts()) expect(text).toContain('Delhi');

  await page.getByRole('tab', { name: /^Food/ }).click();
  await expect(page).toHaveURL(/\/states\/delhi\?type=food$/);
  await expect(page.getByRole('tab', { name: /^Food/ })).toHaveAttribute('aria-selected', 'true');
  // the switch replaces the entry (a type starts without the other type's filters); Back returns to Clothing
  await page.goBack();
  await expect(page).toHaveURL(/\/states\/delhi$/);
  await expect(page.getByRole('tab', { name: /^Clothing/ })).toHaveAttribute('aria-selected', 'true');
});

test('See all pages draw 24 cards at a time', async ({ page }) => {
  await page.goto('/clothing');
  // the list's own cards, not the finishing-touches drawer's (D-144)
  const cards = page.locator('[data-card-grid] > article');
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
  // each row fits the page and scrolls inside it; See all sits on screen (a plain grid once made the rows 2,244 px
  // wide on a phone: the page bled sideways, the rows could not scroll and See all was off the page)
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const list = clothing.getByRole('list', { name: 'Just listed: Clothing' });
    const fit = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(fit).toBeLessThanOrEqual(0);
    const size = await list.evaluate((el) => ({ scroll: el.scrollWidth, box: el.clientWidth }));
    expect(size.box).toBeLessThanOrEqual(width);
    expect(size.scroll).toBeGreaterThan(size.box);
    const box = await seeAll.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(width);
  }
  // by keyboard: the Home hero's scroll effects can move the row under a mouse pointer mid-click
  await seeAll.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/clothing$/);
});
