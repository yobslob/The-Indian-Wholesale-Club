import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { quickDaysLabel } from '../features/seven-day/days';

describe('the 7-day days as words (D-148)', () => {
  it('says one number when Settings has one day, a range otherwise', () => {
    assert.equal(quickDaysLabel(7, 7), '7');
    assert.equal(quickDaysLabel(6, 8), '6 – 8');
  });
});
