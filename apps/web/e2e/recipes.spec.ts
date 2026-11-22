import { expect, test, type Page } from '@playwright/test';

/**
 * D-203, Cook at home (docs/plan-recipes.md §6), on the local seed's placeholder recipes (supabase/seed/recipes.sql):
 * Pav Bhaji is pinned to Home with a kit of three pieces ($3.49 + $2.99 + $2.49 = $8.97, struck $10.76); Rajma Chawal's
 * rajma is sold out. Home's middle window is the widest and opens the recipe; every piece starts ticked; the totals agree
 * on Home, the shelf and the page; Add puts the ticked pieces in the bag once; abroad the kit is in CA$ and the free line
 * stays in $.
 */
const KIT = '$8.97';
const WAS = '$10.76';

const bagLines = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('iwc-cart') ?? '{"state":{"lines":[]}}') as { state: { lines: { productName: string; quantity: number }[] } }).state.lines);

for (const width of [390, 340, 1280]) {
  test(`Home's middle window is the main one at ${width} px and opens the recipe`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const arches = page.locator('.hc-arch');
    await expect(arches).toHaveCount(3);
    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await arches.nth(i).boundingBox())!));
    expect(boxes[1]!.width).toBeGreaterThan(boxes[0]!.width * 1.2);
    expect(boxes[1]!.height).toBeGreaterThan(boxes[0]!.height);
    const cook = page.getByRole('link', { name: /Cook pav bhaji at home: recipe and kit/ });
    await expect(cook).toHaveAttribute('href', '/recipes/pav-bhaji');
    await expect(cook).toContainText(KIT);
    await expect(cook).toContainText(WAS);
    await expect(arches.nth(0)).toHaveAttribute('href', '/clothing');
    await expect(arches.nth(2)).toHaveAttribute('href', /snacks-and-namkeen/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

test('the shelf filters by kind and its kit agrees with the page', async ({ page }) => {
  await page.goto('/recipes');
  const card = page.getByRole('link', { name: /Pav Bhaji/ }).first();
  await expect(card).toContainText(KIT);
  await expect(card).toContainText(WAS);
  await page.getByRole('button', { name: 'Dinner' }).click();
  await expect(page).toHaveURL(/kind=dinner/);
  await expect(page.getByRole('link', { name: /Pav Bhaji/ })).toBeHidden();
  await expect(page.getByRole('link', { name: /Rajma Chawal/ }).first()).toBeVisible();
});

test('every piece starts ticked; Add puts the ticked ones in the bag once', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/recipes/pav-bhaji');
  await page.evaluate(() => localStorage.removeItem('iwc-cart'));
  await page.reload();
  const kit = page.locator('#kit');
  const boxes = kit.getByRole('checkbox');
  await expect(boxes).toHaveCount(3);
  for (const b of await boxes.all()) await expect(b).toBeChecked();
  await expect(kit.getByTestId('kit-total')).toHaveText(`${WAS}${KIT}`);
  // Chromium has the Screen Wake Lock API, so Cook mode shows
  await expect(page.getByRole('switch', { name: /Cook mode/ })).toBeVisible();

  await kit.getByRole('checkbox', { name: /Kashmiri chilli powder/ }).uncheck();
  await expect(kit.getByRole('button', { name: 'Add 2 pieces to bag' })).toBeVisible();
  await kit.getByRole('button', { name: 'Add 2 pieces to bag' }).click();
  await expect(kit.getByText('In your bag. Happy cooking.')).toBeVisible();
  expect((await bagLines(page)).map((l) => [l.productName, l.quantity])).toEqual([
    ['Demo Pav Bhaji Masala', 1],
    ['Demo Kasuri Methi', 1],
  ]);
  // the pieces in the bag show − n + now; ticking the third adds only it
  await kit.getByRole('checkbox', { name: /Kashmiri chilli powder/ }).check();
  await kit.getByRole('button', { name: 'Add 1 piece to bag' }).click();
  expect((await bagLines(page)).map((l) => l.quantity)).toEqual([1, 1, 1]);
});

test('a sold-out piece is skipped and shows as not available', async ({ page }) => {
  await page.goto('/recipes/rajma-chawal');
  const kit = page.locator('#kit');
  await expect(kit.getByText('Not available right now')).toBeVisible();
  await expect(kit.getByRole('checkbox', { name: /Rajma in the kit/ })).toBeDisabled();
  await expect(kit.getByRole('button', { name: 'Add 1 piece to bag' })).toBeVisible();
});

test('abroad the kit is in CA$, the free line in $', async ({ page }) => {
  await page.goto('/recipes/pav-bhaji?market=ca');
  const kit = page.locator('#kit');
  await expect(kit.getByTestId('kit-total')).toContainText('CA$');
  await expect(kit.getByText(/^\$[\d.]+ more and delivery is free\.$/)).toBeVisible();
});
