import { expect, test } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { CARDS, intentRefund, ordersFor, ownCaller, payWith, reachPayment, watchCheckoutStarts } from './pay';
import { restoreDemoStock, setDemoStock } from './stock';

/**
 * Launch QA plan §8 item 8: the last piece sells while the customer is on the card form. The payment goes through,
 * the order is refused, the whole payment is refunded at once and the customer reads why, wherever the page has got
 * to (checkout or the thank-you page): never "Confirming your order…" for ever. No order is created.
 */
test('sold out while paying: no order, a full refund and the right message', async ({ page, request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  test.setTimeout(150_000);
  await ownCaller(page);
  const starts = watchCheckoutStarts(page);
  await reachPayment(page);

  try {
    await setDemoStock(request, 0, 0); // someone else bought the last one
    await payWith(page, CARDS.ok);

    await expect(page.getByText(/sold out while you were paying/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/refunded in full/i).first()).toBeVisible();
    await expect(page.getByText(/Confirming your order/)).toHaveCount(0);

    const intent = starts.at(-1)?.paymentIntentId ?? '';
    expect(await ordersFor(intent)).toHaveLength(0);
    await expect
      .poll(async () => {
        const r = await intentRefund(intent);
        return r.refunded === r.amount && r.amount > 0;
      }, { timeout: 30_000, message: 'the payment was not refunded in full' })
      .toBe(true);
  } finally {
    await restoreDemoStock(request);
  }
});
