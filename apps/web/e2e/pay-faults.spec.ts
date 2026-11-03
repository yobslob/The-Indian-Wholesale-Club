import { expect, test, type Page, type Route } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { checkoutAlert, orderNumberShown } from './flows';
import {
  addDemoToBag,
  CARDS,
  continueToPayment,
  fillCheckoutDetails,
  ordersFor,
  ownCaller,
  payWith,
  reachPayment,
  watchCheckoutStarts,
} from './pay';

/**
 * Launch QA plan §8 item 5 (A-2, A-3, A-4): when our own server misbehaves the customer is never stuck. A paid
 * customer always reaches the thank-you page (/checkout/success?payment_intent=…), which says the payment is being
 * confirmed and shows the order number once /api/orders answers, without a reload. A failed "Continue to payment"
 * shows an error and the button works again. The faults are browser-side route mocks: the server and Stripe behave.
 */

test.beforeEach(() => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
});

const GATEWAY_HTML = '<!doctype html><html><body><h1>504 Gateway Timeout</h1></body></html>';

type Fault = (route: Route) => Promise<void>;

const ORDER_FAULTS: Record<string, Fault> = {
  '500 with an error': (route) =>
    route.fulfill({ status: 500, json: { error: 'Your payment went through but we could not confirm the order yet.' } }),
  '504 HTML page': (route) => route.fulfill({ status: 504, contentType: 'text/html', body: GATEWAY_HTML }),
  'dropped connection': (route) => route.abort('connectionreset'),
};

/** POST /api/orders answers with `fault` until `heal()` (later requests go to the server as usual). */
async function breakOrders(page: Page, fault: Fault): Promise<{ heal: () => void }> {
  let broken = true;
  await page.route('**/api/orders', async (route) => {
    if (broken && route.request().method() === 'POST') await fault(route);
    else await route.fallback();
  });
  return { heal: () => (broken = false) };
}

for (const [name, fault] of Object.entries(ORDER_FAULTS)) {
  test(`/api/orders ${name}: the paid customer reaches the thank-you page and then the number (A-2, A-4)`, async ({ page }) => {
    test.setTimeout(180_000);
    await ownCaller(page);
    const starts = watchCheckoutStarts(page);
    await reachPayment(page);
    const orders = await breakOrders(page, fault);
    await payWith(page, CARDS.ok);

    await expect(page).toHaveURL(/\/checkout\/success\?(.*&)?payment_intent=pi_/, { timeout: 30_000 });
    await expect(page.getByText(/confirming your payment/i).first()).toBeVisible();
    expect(await ordersFor(starts.at(-1)?.paymentIntentId ?? '')).toHaveLength(0);

    // /api/orders recovers: the page's own retries (2, 4, 8, 16, 30 s) bring the number, no reload.
    orders.heal();
    await orderNumberShown(page, 75_000);
    expect(await ordersFor(starts.at(-1)?.paymentIntentId ?? '')).toHaveLength(1);
  });
}

test('/api/orders answering after 30 s: the paid customer is not left on "Paying…" (A-2)', async ({ page }) => {
  test.setTimeout(180_000);
  await ownCaller(page);
  await reachPayment(page);
  await page.route(
    '**/api/orders',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      await route.fallback().catch(() => undefined); // the page may have given up on it already
    },
    { times: 1 },
  );
  await payWith(page, CARDS.ok);

  // Either the page stops waiting and goes to the thank-you page, or the slow answer arrives: both end on it.
  await expect(page).toHaveURL(/\/checkout\/success\?/, { timeout: 45_000 });
  await orderNumberShown(page, 75_000);
});

const CHECKOUT_FAULTS: Record<string, Fault> = {
  '504 HTML page': (route) => route.fulfill({ status: 504, contentType: 'text/html', body: GATEWAY_HTML }),
  'offline': (route) => route.abort('internetdisconnected'),
  '429 too many': (route) =>
    route.fulfill({ status: 429, headers: { 'retry-after': '1' }, json: { error: 'Too many requests. Please wait a moment and try again.' } }),
};

for (const [name, fault] of Object.entries(CHECKOUT_FAULTS)) {
  test(`/api/checkout ${name}: an error shows and Continue to payment works again (A-3)`, async ({ page }) => {
    await ownCaller(page);
    await addDemoToBag(page);
    await fillCheckoutDetails(page);
    await page.route('**/api/checkout', fault, { times: 1 });

    await continueToPayment(page).click();
    await expect(checkoutAlert(page)).toBeVisible({ timeout: 25_000 });
    await expect(continueToPayment(page)).toBeEnabled();

    await continueToPayment(page).click();
    await expect(page.getByText('Estimated delivery:').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^Pay \$/ })).toBeVisible({ timeout: 30_000 });
  });
}
