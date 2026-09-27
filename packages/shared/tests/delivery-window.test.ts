import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  ORDER_STATUSES,
  SHIPPING_RATES,
} from '../src/constants';

describe('Delivery windows (SHIPPING_RATES — single source of truth, I2/M4)', () => {
  it('defines the standard and express windows used across web + mobile', () => {
    assert.deepEqual(SHIPPING_RATES.standard.windowDays, [5, 7]);
    assert.deepEqual(SHIPPING_RATES.express.windowDays, [2, 3]);
  });

  it('keeps windowLabel in sync with windowDays', () => {
    for (const rate of [SHIPPING_RATES.standard, SHIPPING_RATES.express]) {
      const [min, max] = rate.windowDays;
      assert.equal(rate.windowLabel, `${min}-${max} business days`);
      assert.ok(
        rate.label.includes(rate.windowLabel),
        `label "${rate.label}" must embed windowLabel "${rate.windowLabel}"`,
      );
    }
  });

  it('makes express strictly faster than standard', () => {
    assert.ok(
      SHIPPING_RATES.express.windowDays[1] < SHIPPING_RATES.standard.windowDays[0],
      'express max days must be below standard min days',
    );
  });

  it('keeps cent-denominated constants aligned with rate prices', () => {
    assert.equal(SHIPPING_RATES.standard.price * 100, DEFAULT_SHIPPING_CENTS);
    assert.equal(SHIPPING_RATES.freeThreshold * 100, FREE_SHIPPING_THRESHOLD_CENTS);
    assert.ok(SHIPPING_RATES.express.price > SHIPPING_RATES.standard.price);
  });
});

describe('ORDER_STATUSES', () => {
  it('no longer contains the removed "returned" status (I1)', () => {
    assert.ok(!('returned' in Object.fromEntries(ORDER_STATUSES.map((s) => [s, true]))));
    assert.equal(new Set(ORDER_STATUSES).size, ORDER_STATUSES.length, 'statuses must be unique');
  });

  it('excludes legacy statuses from the state machine', () => {
    for (const legacy of ['returned', 'pending_payment', 'shipped_out']) {
      assert.ok(
        !(ORDER_STATUSES as readonly string[]).includes(legacy),
        `unexpected legacy status: ${legacy}`,
      );
    }
  });
});
