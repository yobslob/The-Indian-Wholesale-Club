import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABEL,
  attributesSchemaFor,
  clothingAttributesSchema,
  formatDeliveryWindow,
  isWindowAtRisk,
  nextCycleStatus,
  orderEventLabel,
  spiceAttributesSchema,
  suggestPrice,
  timelineIndex,
} from '../src/domain';

const settings = { fxInrPerUsd: 80, freightCentsPerKg: 1000, dutyPct: 10, marginPct: 50 };

describe('suggestPrice (flows.md §2, Q-15)', () => {
  it('computes goods, freight, duty, landed and suggested price in cents', () => {
    // ₹2,000 = 200000 paise → $25.00; 500 g at $10/kg → $5.00; 10% duty on goods → $2.50
    const result = suggestPrice({ shopPricePaise: 200000, weightG: 500 }, settings);
    assert.deepEqual(result, {
      goodsCents: 2500,
      freightCents: 500,
      dutyCents: 250,
      landedCents: 3250,
      suggestedPriceCents: 4875,
    });
  });

  it('returns null instead of guessing when any setting is missing', () => {
    for (const key of ['fxInrPerUsd', 'freightCentsPerKg', 'dutyPct', 'marginPct'] as const) {
      assert.equal(suggestPrice({ shopPricePaise: 1000, weightG: 100 }, { ...settings, [key]: null }), null, key);
    }
  });

  it('returns null when the weight is unknown (freight cannot be computed)', () => {
    assert.equal(suggestPrice({ shopPricePaise: 1000, weightG: null }, settings), null);
  });

  it('rejects impossible inputs', () => {
    assert.throws(() => suggestPrice({ shopPricePaise: -1, weightG: 100 }, settings), RangeError);
    assert.throws(() => suggestPrice({ shopPricePaise: 10.5, weightG: 100 }, settings), RangeError);
    assert.throws(() => suggestPrice({ shopPricePaise: 100, weightG: 0 }, settings), RangeError);
    assert.throws(() => suggestPrice({ shopPricePaise: 100, weightG: 100 }, { ...settings, fxInrPerUsd: 0 }), RangeError);
  });
});

describe('delivery windows (D-008)', () => {
  it('formats YYYY-MM-DD dates as UTC calendar days (no off-by-one)', () => {
    assert.equal(formatDeliveryWindow('2026-10-30', '2026-11-04'), 'Oct 30 – Nov 4');
    assert.equal(formatDeliveryWindow('2026-12-31', '2027-01-02'), 'Dec 31 – Jan 2');
  });

  it('rejects non-date input', () => {
    assert.throws(() => formatDeliveryWindow('2026-10-30T00:00:00Z', '2026-11-04'), RangeError);
  });

  it('flags a window at risk when arrival + slowest domestic days passes the promise', () => {
    assert.equal(isWindowAtRisk({ promisedTo: '2026-11-04', estArrivalOn: '2026-10-28', domesticDaysMax: 7 }), false);
    assert.equal(isWindowAtRisk({ promisedTo: '2026-11-04', estArrivalOn: '2026-10-29', domesticDaysMax: 7 }), true);
  });
});

describe('customer-facing order status (D-034, D-003)', () => {
  it('has a label for every customer status', () => {
    for (const status of CUSTOMER_STATUSES) assert.ok(CUSTOMER_STATUS_LABEL[status], status);
    assert.equal(CUSTOMER_STATUS_LABEL.preparing, 'Preparing your order');
  });

  it('places statuses on the timeline', () => {
    assert.equal(timelineIndex('confirmed'), 0);
    assert.equal(timelineIndex('delivered'), 3);
    assert.equal(timelineIndex('cancelled'), -1);
  });

  it('never shows a raw internal event kind to customers', () => {
    assert.equal(orderEventLabel('order_confirmed'), 'Order confirmed');
    assert.equal(orderEventLabel('vendor_called_back'), 'Order updated');
  });
});

describe('product attributes are strict (D-003)', () => {
  it('accepts valid clothing attributes', () => {
    assert.ok(clothingAttributesSchema.safeParse({ fibre_content: '100% cotton', care: 'Dry clean', length_m: 5.5 }).success);
  });

  it('rejects unknown keys so vendor details can never be stored for customers', () => {
    const result = clothingAttributesSchema.safeParse({ fibre_content: 'Silk', care: 'Dry clean', vendor_id: 'x' });
    assert.equal(result.success, false);
  });

  it('requires fibre content and care for clothing (US textile labelling)', () => {
    assert.equal(clothingAttributesSchema.safeParse({ care: 'Dry clean' }).success, false);
  });

  it('requires ingredients, allergens and shelf life for spices', () => {
    assert.ok(spiceAttributesSchema.safeParse({ ingredients: 'Cardamom', allergens: [], shelf_life_days: 365 }).success);
    assert.equal(spiceAttributesSchema.safeParse({ ingredients: 'Cardamom', allergens: [] }).success, false);
  });

  it('picks the schema by product type', () => {
    assert.equal(attributesSchemaFor('spice'), spiceAttributesSchema);
    assert.equal(attributesSchemaFor('clothing'), clothingAttributesSchema);
  });
});

describe('cycle flow (flows.md §1)', () => {
  it('walks the statuses in order and stops at closed', () => {
    assert.equal(nextCycleStatus('open'), 'collecting');
    assert.equal(nextCycleStatus('fulfilling'), 'closed');
    assert.equal(nextCycleStatus('closed'), null);
  });
});
