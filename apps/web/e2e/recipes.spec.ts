import { expect, test, type Page } from '@playwright/test';

/**
 * D-203, Cook at home (docs/plan-recipes.md §6), on the local seed's placeholder recipes (supabase/seed/recipes.sql):
 * Pav Bhaji is pinned to Home with a kit of three pieces ($3.49 + $2.99 + $2.49 = $8.97, struck $10.76) and a coriander
 * powder swap; Rajma Chawal's rajma is sold out. Home's Cook at home row (D-204) leads with it; every piece starts ticked,
 * the swap unticked; the totals agree on Home, the shelf and the page; Add puts the ticked pieces in the bag once; abroad
 * the kit is in CA$ and the free line stays in $.
 */
const KIT = '$8.97';
const WAS = '$10.76';

const bagLines = (page: Page) =>
  page.evaluate(
    () =>
      (
        JSON.parse(localStorage.getItem('iwc-cart') ?? '{"state":{"lines":[]}}') as {
          state: { lines: { productName: string; quantity: number }[] };
        }
      ).state.lines,
  );

for (const width of [390, 1280]) {
  test(`Home's Cook at home row leads with the pinned recipe at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.hc-arch')).toHaveCount(0);
    const row = page.locator('#cook');
    await expect(row.getByRole('heading', { name: 'Cook at home' })).toBeVisible();
    const first = row.getByRole('link', { name: /Pav Bhaji/ }).first();
    await expect(first).toHaveAttribute('href', '/recipes/pav-bhaji');
    await expect(first).toContainText(KIT);
    await expect(first).toContainText(WAS);
    await expect(row.getByRole('link', { name: 'All recipes' })).toHaveAttribute(
      'href',
      '/recipes',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
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

test('every piece starts ticked, the swap unticked; Add puts the ticked ones in the bag once', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/recipes/pav-bhaji');
  await page.evaluate(() => localStorage.removeItem('iwc-cart'));
  await page.reload();
  const kit = page.locator('#kit');
  const boxes = kit.getByRole('checkbox');
  await expect(boxes).toHaveCount(4);
  for (const b of (await boxes.all()).slice(0, 3)) await expect(b).toBeChecked();
  // D-204: the dry swap for fresh coriander is offered, unticked and outside the total
  const swap = kit.getByRole('checkbox', { name: /Coriander powder in the kit/ });
  await expect(swap).not.toBeChecked();
  await expect(kit.getByText(/in place of coriander/)).toBeVisible();
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
