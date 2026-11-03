import { expect, test, type Page } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { CARDS, confirmationQueued, ordersFor, ownCaller, payWith, reachPayment, watchCheckoutStarts } from './pay';
import { newEventId, sendSucceededEvent, stripeListenRun, webhookSecretPresent, writeClaim } from './webhook';

/**
 * Launch QA plan §8 items 6 and 7: the order is created when only the webhook reports the payment.
 *
 * Two ways to run them:
 * - Signed events (part of the normal run, no extra tool): the test signs `payment_intent.succeeded` with
 *   STRIPE_WEBHOOK_SECRET from apps/web/.env.local (any `whsec_…` test value; the server reads the same file) and posts
 *   it to the handler, so it can also leave a dead handler's claim behind first (F-1). Skipped without a `whsec_`
 *   secret. Don't leave `stripe listen` running during a normal run: its real events would make the order before
 *   these tests check that there is none.
 * - Real Stripe events (tagged @stripe-listen, skipped unless asked for): in another terminal run
 *     stripe listen --forward-to http://localhost:3101/api/webhooks/stripe
 *   put the `whsec_…` it prints into apps/web/.env.local as STRIPE_WEBHOOK_SECRET, build, then run
 *     pnpm --filter web exec playwright test --grep @stripe-listen
 */

test.beforeEach(() => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
});

/** Pays with the browser's own /api/orders call blocked, then closes the tab: only a webhook can make the order. */
async function payAndCloseTab(page: Page): Promise<string> {
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);
  await page.route('**/api/orders', (route) => route.abort('connectionreset'));
  const reported = page.waitForRequest((r) => r.url().endsWith('/api/orders') && r.method() === 'POST', { timeout: 45_000 });
  await payWith(page, CARDS.ok);
  await reported; // Stripe said "succeeded" and the page tried to report it
  const intent = starts.at(-1)?.paymentIntentId ?? '';
  await page.close();
  expect(intent).toMatch(/^pi_/);
  return intent;
}

test.describe('signed webhook events', () => {
  test.beforeEach(() => {
    test.skip(!webhookSecretPresent(), 'STRIPE_WEBHOOK_SECRET (whsec_…) is not set in apps/web/.env.local');
  });

  test('tab closed after paying: the webhook alone creates the order, once (§8.6)', async ({ page, request }) => {
    test.setTimeout(150_000);
    const intent = await payAndCloseTab(page);
    expect(await ordersFor(intent)).toHaveLength(0);

    const eventId = newEventId();
    const first = await sendSucceededEvent(request, eventId, intent);
    expect(first.status).toBe(200);
    const orders = await ordersFor(intent);
    expect(orders).toHaveLength(1);
    await expect.poll(() => confirmationQueued(orders[0]!.order_number)).toBe(true);

    // Stripe delivers an event at least once: the same event again changes nothing.
    const again = await sendSucceededEvent(request, eventId, intent);
    expect(again.status).toBe(200);
    expect(await ordersFor(intent)).toHaveLength(1);
  });

  test('a handler killed after its claim: the retry takes the stale claim and creates the order (F-1, §8.7)', async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const intent = await payAndCloseTab(page);

    // The first delivery claimed the event and died before finalizing (a timeout, as in INC-1).
    const eventId = newEventId();
    await writeClaim(eventId, 'processing', 3 * 60_000);
    const retry = await sendSucceededEvent(request, eventId, intent);
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate ?? false).toBe(false);
    expect(await ordersFor(intent)).toHaveLength(1);

    // A finished claim is never taken over: its retry is a duplicate.
    const doneId = newEventId();
    await writeClaim(doneId, 'done', 3 * 60_000);
    const doneRetry = await sendSucceededEvent(request, doneId, intent);
    expect(doneRetry.status).toBe(200);
    expect(doneRetry.body.duplicate).toBe(true);
    expect(await ordersFor(intent)).toHaveLength(1);
  });
});

test(
  'real Stripe events: tab closed after paying, `stripe listen` delivers and the order is created (§8.6)',
  { tag: '@stripe-listen' },
  async ({ page }) => {
    test.skip(!stripeListenRun(), 'Needs `stripe listen` and --grep @stripe-listen (see the comment at the top of webhook.spec.ts)');
    test.setTimeout(150_000);
    const intent = await payAndCloseTab(page);
    await expect
      .poll(async () => (await ordersFor(intent)).length, { timeout: 60_000, message: 'no order from the forwarded webhook' })
      .toBe(1);
  },
);
