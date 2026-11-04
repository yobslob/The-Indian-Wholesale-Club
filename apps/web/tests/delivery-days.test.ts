import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { deliveryDaysLabel } from '../features/catalog/delivery-days';

describe('the words on store pages (D-187)', () => {
  it('says delivery days, one number or a window, and nothing without days', () => {
    assert.equal(deliveryDaysLabel(7, 7), '7 delivery days');
    assert.equal(deliveryDaysLabel(12, 16), '12 – 16 delivery days');
    assert.equal(deliveryDaysLabel(null, 16), null);
    assert.equal(deliveryDaysLabel(7, undefined), null);
  });
});
