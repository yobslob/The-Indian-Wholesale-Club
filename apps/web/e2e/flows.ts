import { expect, type Page } from '@playwright/test';

import { ORDER_NUMBER } from './buy';
import { DEMO_PRODUCT } from './env';
import {
  answerThreeDS,
  bagLineCount,
  CARDS,
  confirmationQueued,
  ordersFor,
  ownCaller,
  payButton,
  payWith,
  reachPayment,
  watchCheckoutStarts,
} from './pay';

/**
 * The customer flows of the launch QA plan (§8 items 1, 3 and 4), written once so the laptop specs and the phone spec
 * (375 × 812, item 10) run the same steps.
 */

const SUCCESS_URL = /\/checkout\/success\?(.*&)?(order|payment_intent)=/;
const EMPTY_BAG = 'Lighter than a tiffin.';

/** The order number on the thank-you page, once it shows. */
export async function orderNumberShown(page: Page, timeout = 45_000): Promise<string> {
  const strong = page.getByRole('main').locator('strong').filter({ hasText: ORDER_NUMBER }).first();
  await expect(strong).toBeVisible({ timeout });
  return ((await strong.textContent()) ?? '').trim();
}

/** The checkout's own error line (role=alert inside <main>; Next's route announcer sits outside it). */
export const checkoutAlert = (page: Page) => page.getByRole('main').getByRole('alert').filter({ hasText: /\S/ }).first();

/** Item 1: Home → state → product → add → bag → one more → remove → the empty bag's line. */
export async function browseFlow(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  const states = page.getByRole('banner').getByRole('link', { name: 'States', exact: true }).filter({ visible: true });
  if ((await states.count()) > 0) await states.first().click();
  else await page.goto('/states'); // phones: the header's links sit in its menu
  await expect(page).toHaveURL(/\/states$/);

  await page.locator(`a[href="/states/${DEMO_PRODUCT.region}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/states/${DEMO_PRODUCT.region}$`));
  await page.locator(`a[href="/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}$`));
  await expect(page.getByText('Made in India').first()).toBeVisible();

  // The demo saree has one option, so nothing needs choosing (a piece with several says "Choose a size" first).
  await page.getByRole('button', { name: 'Add to bag' }).filter({ visible: true }).first().click();
  await page.getByRole('link', { name: 'View bag' }).click();
  await expect(page).toHaveURL(/\/cart$/);

  const quantity = page.getByRole('group', { name: /^Quantity of / }).first();
  await quantity.getByRole('button', { name: 'One more' }).click();
  await expect(quantity.locator('output')).toHaveText('2');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('iwc-cart') ?? '{}').state?.lines?.[0]?.quantity)).toBe(2);
  await quantity.getByRole('button', { name: 'One fewer' }).click();
  await expect(quantity.locator('output')).toHaveText('1');

  await page.getByRole('button', { name: /^Remove / }).first().click();
  await expect(page.getByText(EMPTY_BAG)).toBeVisible();
  expect(await bagLineCount(page)).toBe(0);
}

/** Item 3: 4242 pays; the number shows on the thank-you page, the bag is empty, one order and its email in the outbox. */
export async function happyPathFlow(page: Page): Promise<void> {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  await payWith(page, CARDS.ok);

  await expect(page).toHaveURL(SUCCESS_URL, { timeout: 45_000 });
  const orderNumber = await orderNumberShown(page);
  expect(await bagLineCount(page)).toBe(0);
  await page.goto('/cart');
  await expect(page.getByText(EMPTY_BAG)).toBeVisible();

  const intent = starts.at(-1)?.paymentIntentId ?? '';
  expect(intent).toMatch(/^pi_/);
  expect((await ordersFor(intent)).map((o) => o.order_number)).toEqual([orderNumber]);
  await expect.poll(() => confirmationQueued(orderNumber)).toBe(true);
}

/** Item 4 (A-4): the 3-D Secure card, challenge completed → the order number. */
export async function threeDSApprovedFlow(page: Page): Promise<void> {
  await ownCaller(page);
  await reachPayment(page);
  await payWith(page, CARDS.threeDS);
  await answerThreeDS(page, 'complete');
  await expect(page).toHaveURL(SUCCESS_URL, { timeout: 45_000 });
  await orderNumberShown(page, 60_000);
  expect(await bagLineCount(page)).toBe(0);
}

/**
 * Item 4 (A-4): the 3-D Secure card, challenge failed → still on checkout with Stripe's message, the bag kept, Pay
 * ready again, no order. Then the redirect form of the same failure (Stripe's return to the thank-you page with
 * redirect_status=failed) goes back to checkout with the bag too.
 */
export async function threeDSFailedFlow(page: Page): Promise<void> {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  await payWith(page, CARDS.threeDS);
  await answerThreeDS(page, 'fail');

  await expect(checkoutAlert(page)).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(payButton(page)).toBeEnabled();
  expect(await bagLineCount(page)).toBe(1);
  const start = starts.at(-1);
  expect(start?.paymentIntentId).toMatch(/^pi_/);
  expect(await ordersFor(start!.paymentIntentId)).toHaveLength(0);

  const query = new URLSearchParams({
    payment_intent: start!.paymentIntentId,
    payment_intent_client_secret: start!.clientSecret,
    redirect_status: 'failed',
  });
  await page.goto(`/checkout/success?${query}`);
  await expect(page).toHaveURL(/\/checkout(\?.*)?$/, { timeout: 20_000 });
  await expect(page.getByText(EMPTY_BAG)).toHaveCount(0);
  expect(await bagLineCount(page)).toBe(1);
}

/** Item 4 (A-9): a refused card → its message in plain words, the bag kept, Pay ready again, no order. */
export async function refusedCardFlow(page: Page, card: string, words: RegExp): Promise<void> {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  await payWith(page, card);

  await expect(checkoutAlert(page)).toHaveText(words, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(payButton(page)).toBeEnabled();
  expect(await bagLineCount(page)).toBe(1);
  expect(await ordersFor(starts.at(-1)?.paymentIntentId ?? '')).toHaveLength(0);
}

export const DECLINED_WORDS = /declined|didn.t go through|not accepted/i;
export const NO_FUNDS_WORDS = /insufficient funds|not enough (money|funds)|enough funds/i;
