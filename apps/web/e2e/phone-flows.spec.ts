import { expect, test, type Page } from '@playwright/test';

import { DEMO_PRODUCT, stripeTestKeysPresent } from './env';
import {
  browseFlow,
  DECLINED_WORDS,
  happyPathFlow,
  NO_FUNDS_WORDS,
  refusedCardFlow,
  threeDSApprovedFlow,
  threeDSFailedFlow,
} from './flows';
import { CARDS } from './pay';

/**
 * Launch QA plan §8 item 10: a phone (375 × 812, touch) runs browse, the happy path and the card outcomes, and the
 * product page's Add to bag is on the first screen and stays reachable while scrolling (B-2).
 */
test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

/**
 * The control that adds this piece: the page's own button or the phone bar standing in for it. Before an option is
 * picked the page's button reads "Choose a size" / "Choose one" (D-140), which is the same control.
 */
const addControl = (page: Page) =>
  page.getByRole('button', { name: /^(Add to bag|Choose (a size|one))$/ }).filter({ visible: true });

async function anyInViewport(page: Page): Promise<boolean> {
  const controls = addControl(page);
  const count = await controls.count();
  const height = page.viewportSize()?.height ?? 812;
  for (let i = 0; i < count; i += 1) {
    const box = await controls.nth(i).boundingBox();
    if (box && box.y >= 0 && box.y + box.height <= height) return true;
  }
  return false;
}

test('B-2: Add to bag is on the first screen and reachable while scrolling', async ({ page }) => {
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await expect(addControl(page).first()).toBeAttached();
  await expect.poll(() => anyInViewport(page), { message: 'no Add to bag inside 375 × 812 on load' }).toBe(true);

  for (const y of [400, 1200, 99_999]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await expect.poll(() => anyInViewport(page), { message: `no Add to bag in view after scrolling to ${y}` }).toBe(true);
  }
});

test('phone: browse to an empty bag (§8.1)', async ({ page }) => {
  await browseFlow(page);
});

test.describe('phone: paying (§8.3, §8.4)', () => {
  test.beforeEach(() => {
    test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  });

  test('4242 pays', async ({ page }) => {
    await happyPathFlow(page);
  });

  test('3-D Secure approved', async ({ page }) => {
    test.setTimeout(150_000);
    await threeDSApprovedFlow(page);
  });

  test('3-D Secure failed', async ({ page }) => {
    test.setTimeout(150_000);
    await threeDSFailedFlow(page);
  });

  test('declined', async ({ page }) => {
    await refusedCardFlow(page, CARDS.declined, DECLINED_WORDS);
  });

  test('insufficient funds', async ({ page }) => {
    await refusedCardFlow(page, CARDS.insufficientFunds, NO_FUNDS_WORDS);
  });
});
