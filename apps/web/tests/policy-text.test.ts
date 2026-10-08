import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cancelSentence, returnTiers, standardShipping, taxSentence } from '@repo/shared/info';

import type { StorePolicy } from '@repo/db/store';

const policy: StorePolicy = {
  shipping_flat_cents: 0,
  free_shipping_min_cents: null,
  express_days_min: 15,
  express_days_max: 18,
  us_delivery_days_min: 3,
  us_delivery_days_max: 7,
  cancel_fee_pct: 0,
  return_claim_days: 7,
  return_tiers: [
    { days: 7, kept_pct: 15 },
    { days: 14, kept_pct: 30 },
    { days: 30, kept_pct: 50 },
  ],
  tax: [{ state: 'NJ', rate_pct: 6.625, clothing: false, food: false, general: true }],
};

describe('policy text (Shipping & returns, FAQ)', () => {
  it('states the return windows in order, each from the day after the last', () => {
    assert.equal(returnTiers(policy), '15% within 7 days, 30% within 8 to 14 days, 50% within 15 to 30 days');
    assert.equal(returnTiers({ ...policy, return_tiers: [] }), null);
  });

  it('names the tax state and what it does not tax (D-073)', () => {
    assert.match(taxSentence(policy.tax), /New Jersey: 6\.625%, not on clothing or food and spices/);
    assert.equal(taxSentence([]), 'No sales tax is added to orders today.');
  });

  it('free shipping never says "free from" a threshold', () => {
    assert.equal(standardShipping({ ...policy, free_shipping_min_cents: 10000 }), 'free');
    assert.equal(standardShipping({ ...policy, shipping_flat_cents: 500, free_shipping_min_cents: 10000 }), '$5.00, free from $100.00');
  });

  it('mentions the cancel fee only when there is one (D-072)', () => {
    assert.doesNotMatch(cancelSentence(policy), /minus/);
    assert.match(cancelSentence({ ...policy, cancel_fee_pct: 5 }), /minus 5% of the items/);
  });
});
