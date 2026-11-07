import { expect, test } from '@playwright/test';

const AD = 'button[aria-label^="10% off your first order"]';

/** D-193: the ad comes down three seconds after a page opens, wherever the page is scrolled to, and stays on the navbar. */
test('the first-order ad comes down after 3 seconds while scrolled, hangs from the navbar and moves nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/states');
  await page.evaluate(() => window.scrollTo(0, 400));
  const ad = page.locator(AD);
  await expect(ad).toHaveCount(0);
  const bar = page.locator('.site-top');
  const height = await bar.evaluate((e) => (e as HTMLElement).offsetHeight);
  await expect(ad).toBeVisible({ timeout: 8000 });
  expect(await bar.evaluate((e) => (e as HTMLElement).offsetHeight)).toBe(height);
  await page.waitForTimeout(800);
  const edge = (await bar.boundingBox())!;
  const box = (await ad.boundingBox())!;
  expect(Math.abs(box.y - (edge.y + edge.height))).toBeLessThan(2);
  expect(box.x + box.width).toBeGreaterThan(380);
});

/** D-193: a tap, or a drag in any direction that starts on the ad, sends it up. */
for (const [name, dx, dy] of [
  ['tap', 0, 0],
  ['left', -40, 0],
  ['right', 30, 0],
  ['up', 0, -40],
  ['down', 0, 40],
] as const) {
  test(`a ${name} on the ad sends it up and away`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('/food');
    const ad = page.locator(AD);
    await expect(ad).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(800);
    const box = (await ad.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 15;
    const scrolled = await page.evaluate(() => window.scrollY);
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps: 4 });
    await page.mouse.up();
    await expect(ad).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
  });
}

test('each type page has its own ad, none in the bag, none on a product page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  const drawings: string[] = [];
  for (const path of ['/', '/food', '/clothing', '/home-and-gifts']) {
    await page.goto(path);
    const ad = page.locator(AD);
    await expect(ad).toBeVisible({ timeout: 8000 });
    drawings.push(await ad.innerHTML());
  }
  expect(new Set(drawings).size).toBe(4);

  for (const path of ['/cart', '/states/kerala/demo-kerala-kasavu-saree']) {
    await page.goto(path);
    await page.waitForTimeout(3800);
    await expect(page.locator(AD)).toHaveCount(0);
  }
});
