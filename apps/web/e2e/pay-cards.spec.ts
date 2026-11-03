import { test } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import {
  DECLINED_WORDS,
  happyPathFlow,
  NO_FUNDS_WORDS,
  refusedCardFlow,
  threeDSApprovedFlow,
  threeDSFailedFlow,
} from './flows';
import { CARDS } from './pay';
import { restoreDemoStock } from './stock';

/**
 * Launch QA plan §8 items 3 and 4 on a laptop screen (phone-flows.spec.ts runs the same flows at 375 × 812).
 * The card flows use Stripe's published test cards; Stripe's 3-D Secure test page is a plain Complete / Fail page.
 */

test.describe('paying (§8.3, §8.4)', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
    // each test buys the demo piece: top its stock up so a long run never sells it out
    await restoreDemoStock(request);
  });

  test('4242 pays: the number on the thank-you page, the bag empty, the email queued', async ({ page }) => {
    await happyPathFlow(page);
  });

  test('3-D Secure approved: the order number shows (A-4)', async ({ page }) => {
    test.setTimeout(150_000);
    await threeDSApprovedFlow(page);
  });

  test('3-D Secure failed: back on checkout with the bag and the message (A-4)', async ({ page }) => {
    test.setTimeout(150_000);
    await threeDSFailedFlow(page);
  });

  test('a declined card says so and keeps the bag (A-9)', async ({ page }) => {
    await refusedCardFlow(page, CARDS.declined, DECLINED_WORDS);
  });

  test('insufficient funds says so and keeps the bag (A-9)', async ({ page }) => {
    await refusedCardFlow(page, CARDS.insufficientFunds, NO_FUNDS_WORDS);
  });
});
