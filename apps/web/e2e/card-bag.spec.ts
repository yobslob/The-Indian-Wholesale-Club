import { expect, test } from '@playwright/test';

/**
 * D-140 (plan F8, F9): the card's + picks the size right on the card, a single choice is added at once, and a piece in
 * the bag shows − n + wherever its card appears. Runs on the dev catalogue (kurtas with colours and sizes, dupattas
 * with one option).
 */
test.use({ reducedMotion: 'reduce' });

test('+ on a kurta opens the ribbon, M adds M, and the card shows − 1 +', async ({ page }) => {
  await page.goto('/clothing?category=kurtas');
  const plus = page.getByRole('button', { name: /^Choose a size of / }).first();
  const name = ((await plus.getAttribute('aria-label')) ?? '').replace('Choose a size of ', '');
  await plus.click();
  const ribbon = page.getByRole('dialog', { name: `Choose for ${name}` });
  await expect(ribbon).toBeVisible();
  const colours = ribbon.getByRole('group', { name: 'Colour' });
  if (await colours.isVisible()) await colours.getByRole('button').first().click();
  await ribbon.getByRole('button', { name: /^M\b/ }).click();
  await expect(page.getByRole('group', { name: `${name}: 1 in your bag` })).toBeVisible();
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem('iwc-cart') ?? '{}').state.lines);
  expect(lines).toHaveLength(1);
  expect(lines[0].variantLabel).toMatch(/\bM$/);

  // the same piece elsewhere (a reload: the bag lives on the device) still shows its count; − takes it out
  await page.reload();
  const pill = page.getByRole('group', { name: `${name}: 1 in your bag` });
  await expect(pill).toBeVisible();
  await pill.getByRole('button', { name: `One less ${name}` }).click();
  await expect(page.getByRole('button', { name: `Choose a size of ${name}` })).toBeVisible();
});

test('+ on a piece with one choice adds it at once', async ({ page }) => {
  await page.goto('/clothing?category=dupattas-and-stoles');
  const plus = page.getByRole('button', { name: /^Add .* to your bag$/ }).first();
  const name = ((await plus.getAttribute('aria-label')) ?? '').replace(/^Add (.*) to your bag$/, '$1');
  await plus.click();
  await expect(page.getByRole('group', { name: `${name}: 1 in your bag` })).toBeVisible();
});

test('a product page chooses no size until the customer does (D-140, L3)', async ({ page }) => {
  await page.goto('/clothing?category=kurtas');
  const plus = page.getByRole('button', { name: /^Choose a size of / }).first();
  const name = ((await plus.getAttribute('aria-label')) ?? '').replace('Choose a size of ', '');
  await page.getByRole('link', { name, exact: true }).first().click();
  const add = page.getByRole('button', { name: 'Choose a size' }).first();
  await expect(add).toBeVisible();
  await add.click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('iwc-cart') ?? '{"state":{"lines":[]}}').state.lines.length)).toBe(0);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await expect(page.getByText('1 in your bag')).toBeVisible();
});
