import { expect, test } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { orderNumberShown } from './flows';
import {
  addDemoToBag,
  CARDS,
  continueToPayment,
  fillCard,
  fillCheckoutDetails,
  ordersFor,
  ownCaller,
  payButton,
  reachPayment,
  watchCheckoutStarts,
} from './pay';
import { restoreDemoStock } from './stock';

/**
 * One visit, one payment (launch QA plan A-5, §8 item 9): pricing the bag again updates the same PaymentIntent, and a
 * double click on Continue to payment or Pay makes one PaymentIntent and
 * one order. PaymentIntents are counted from what /api/checkout hands this page, which is what the browser pays.
 */

test.beforeEach(async ({ request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  // each test buys the demo piece: top its stock up so a long run never sells it out
  await restoreDemoStock(request);
});

test('editing the delivery and coming back three times: one PaymentIntent (A-5)', async ({ page }) => {
  test.setTimeout(150_000);
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Edit delivery' }).click();
    await continueToPayment(page).click();
    await expect(payButton(page)).toBeVisible({ timeout: 30_000 });
  }
  await expect.poll(() => starts.length).toBe(4); // Continue to payment + three more
  expect(new Set(starts.map((s) => s.paymentIntentId)).size).toBe(1);
});

test('a double click on Continue to payment prices the bag once (§8.9)', async ({ page }) => {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  let posts = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/checkout') && r.method() === 'POST') posts += 1;
  });
  await addDemoToBag(page);
  await fillCheckoutDetails(page);
  await continueToPayment(page).dblclick();
  await expect(payButton(page)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_500); // a second request, if one was sent, has had time to answer
  expect(posts).toBe(1);
  expect(new Set(starts.map((s) => s.paymentIntentId)).size).toBe(1);
});

test('a double click on Pay makes one order (§8.9)', async ({ page }) => {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  await fillCard(page, CARDS.ok);
  // As clickPay: centred, clear of Stripe's test-mode badge along the bottom, then two clicks in a row.
  const pay = payButton(page);
  await pay.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => ((await pay.boundingBox())?.y ?? 0) < (page.viewportSize()?.height ?? 720) - 160).toBe(true);
  await pay.dblclick();

  const orderNumber = await orderNumberShown(page);
  const intents = new Set(starts.map((s) => s.paymentIntentId));
  expect(intents.size).toBe(1);
  const orders = await ordersFor([...intents][0]!);
  expect(orders.map((o) => o.order_number)).toEqual([orderNumber]);
});
