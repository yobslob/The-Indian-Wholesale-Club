import { expect, test } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { orderNumberShown } from './flows';
import {
  addDemoToBag,
  cardFrame,
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

/**
 * One visit, one payment (launch QA plan A-5, §8 item 9): switching the shipping method updates the same
 * PaymentIntent (the card typed stays), and a double click on Continue to payment or Pay makes one PaymentIntent and
 * one order. PaymentIntents are counted from what /api/checkout hands this page, which is what the browser pays.
 */

test.beforeEach(() => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
});

test('standard ↔ express five times: one PaymentIntent, the card details kept (A-5)', async ({ page }) => {
  test.setTimeout(150_000);
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  const express = page.getByRole('radio', { name: /^Express/ });
  const standard = page.getByRole('radio', { name: /^Standard/ });
  test.skip(!(await express.isVisible().catch(() => false)), 'Express is not offered on this database (no express settings)');

  await fillCard(page, CARDS.ok);
  for (let i = 0; i < 5; i += 1) {
    const target = i % 2 === 0 ? express : standard;
    const priced = page.waitForResponse((r) => r.url().endsWith('/api/checkout') && r.request().method() === 'POST');
    await target.check();
    expect((await priced).ok()).toBe(true);
    await expect(target).toBeChecked();
    await expect(target).toBeEnabled();
  }

  await expect.poll(() => starts.length).toBe(6); // Continue to payment + five switches
  expect(new Set(starts.map((s) => s.paymentIntentId)).size).toBe(1);
  await expect(cardFrame(page).locator('[name="number"]')).toHaveValue(CARDS.ok);
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
