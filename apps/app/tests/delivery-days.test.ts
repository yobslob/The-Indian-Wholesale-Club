import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deliveryDaysLine } from '../features/shell/delivery-days';

describe('the delivery days as words (D-187)', () => {
  it('says one number when both ends match, a range when they differ', () => {
    assert.equal(deliveryDaysLine(7, 7), '7 delivery days');
    assert.equal(deliveryDaysLine(12, 16), '12 – 16 delivery days');
  });

  it('says nothing while Settings has no days', () => {
    assert.equal(deliveryDaysLine(null, 16), null);
    assert.equal(deliveryDaysLine(12, undefined), null);
  });
});
