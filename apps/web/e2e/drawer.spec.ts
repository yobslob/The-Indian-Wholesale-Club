import { expect, test } from '@playwright/test';

/**
 * D-144 (plan F11): See all opens low to high; on Clothing the accessories and turbans leave the list for a drawer
 * after the second row of cards. Runs on the dev catalogue (supabase/seed/catalogue.sql: garlands, bangles, phetas).
 */
test.use({ reducedMotion: 'reduce' });

test('the drawer sits between the second and third rows, on a phone and a laptop', async ({ page }) => {
  for (const [width, columns] of [
    [375, 2],
    [1280, 3],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/clothing');
    await expect(page.getByLabel('Sort by')).toHaveValue('low');
    const cards = page.locator('[data-card-grid] > article');
    await expect(cards).toHaveCount(24);
    const drawer = page.locator('[data-drawer]');
    await expect(drawer).toHaveCount(1);
    await expect(drawer.getByRole('heading', { name: /Finishing touches/ })).toBeAttached();
    const row2 = await cards.nth(2 * columns - 1).boundingBox();
    const row3 = await cards.nth(2 * columns).boundingBox();
    const box = await drawer.boundingBox();
    expect(row2 && box && row3).toBeTruthy();
    expect(box!.y).toBeGreaterThan(row2!.y + row2!.height);
    expect(row3!.y).toBeGreaterThan(box!.y + box!.height);
    // no accessory or turban in the list itself
    for (const text of await cards.allInnerTexts()) expect(text).not.toMatch(/garland|bangles|pheta/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});

test("+ in the drawer adds to the bag, and its See all opens the accessories with no drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/clothing');
  const drawer = page.locator('[data-drawer]');
  const plus = drawer.getByRole('button', { name: /^(Choose (a size|one) of |Add .* to your bag$)/ }).first();
  await plus.scrollIntoViewIfNeeded();
  const label = (await plus.getAttribute('aria-label')) ?? '';
  const name = label.replace(/^Choose (a size|one) of /, '').replace(/^Add (.*) to your bag$/, '$1');
  await plus.click();
  const ribbon = page.getByRole('dialog', { name: `Choose for ${name}` });
  if (await ribbon.isVisible()) await ribbon.getByRole('button').first().click();
  await expect(drawer.getByRole('group', { name: `${name}: 1 in your bag` })).toBeVisible();

  await drawer.getByRole('link', { name: /See all/ }).click();
  await expect(page).toHaveURL(/\/clothing\?category=accessories$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Accessories');
  await expect(page.locator('[data-drawer]')).toHaveCount(0);
});

test('Newest is still a choice', async ({ page }) => {
  await page.goto('/clothing');
  await page.getByLabel('Sort by').selectOption('new');
  await expect(page).toHaveURL(/\/clothing\?sort=new$/);
  await expect(page.locator('[data-drawer]')).toHaveCount(0);
});
