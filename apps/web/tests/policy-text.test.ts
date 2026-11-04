import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cancelSentence, infoBlocks, returnTiers, standardShipping, taxSentence } from '@repo/shared/info';

import type { StorePolicy } from '@repo/db/store';

const policy: StorePolicy = {
  shipping_flat_cents: 0,
  free_shipping_min_cents: null,
  bulk_saving_from_cents: 9999,
  min_order_cents: null,
  delivery_days_min: 12,
  delivery_days_max: 16,
  food_delivery_days_min: 7,
  food_delivery_days_max: 7,
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
    assert.match(taxSentence(policy.tax), /New Jersey: 6\.625%, not on clothing or food/);
    assert.equal(taxSentence([]), 'No sales tax is added to orders today.');
  });

  it('free shipping says what a smaller order pays (D-111)', () => {
    assert.equal(standardShipping(policy), 'free');
    assert.equal(
      standardShipping({ ...policy, free_shipping_min_cents: 14999 }),
      "free on orders over $149.99; a smaller order pays its parcel's shipping and retailer charges, shown in your bag before checkout",
    );
    assert.equal(standardShipping({ ...policy, shipping_flat_cents: 500, free_shipping_min_cents: 10000 }), '$5.00, free from $100.00');
    assert.equal(
      standardShipping({ ...policy, min_order_cents: 14999 }),
      'free on orders over $149.99 (the smallest order we can send)',
    ); // D-109
  });

  it('D-187: the FAQ says the delivery days from Settings and what a delivery day is; no Express anywhere', () => {
    const live = { ...policy, free_shipping_min_cents: 4999 };
    const faq = JSON.stringify(infoBlocks('faq', { policy: live }));
    assert.match(faq, /Food arrives in 7 delivery days, clothing and home & gifts in 12 to 16, counted from your order/);
    assert.match(faq, /A bag with both comes in two parcels/);
    assert.match(faq, /What is a delivery day\?/);
    assert.match(faq, /A delivery day is a working day, Monday to Friday/);
    assert.match(faq, /free on orders over \$49\.99/);
    assert.ok(faq.indexOf('When will my order arrive?') < faq.indexOf('What is a delivery day?'));
    const shipping = JSON.stringify(infoBlocks('shipping-returns', { policy: live }));
    assert.match(shipping, /Food/);
    assert.match(shipping, /7 delivery days/);
    assert.match(shipping, /12 to 16 delivery days/);
    assert.match(shipping, /Already in the US/);
    assert.match(shipping, /A delivery day is a working day/);
    for (const text of [faq, shipping]) assert.doesNotMatch(text, /express|7-day|cycle/i);
    // other numbers in Settings change the words: nothing is typed in
    assert.match(JSON.stringify(infoBlocks('faq', { policy: { ...live, food_delivery_days_max: 9, food_delivery_days_min: 8 } })), /Food arrives in 8 to 9 delivery days/);
  });

  it('mentions the cancel fee only when there is one (D-072)', () => {
    assert.doesNotMatch(cancelSentence(policy), /minus/);
    assert.match(cancelSentence({ ...policy, cancel_fee_pct: 5 }), /minus 5% of the items/);
  });
});
