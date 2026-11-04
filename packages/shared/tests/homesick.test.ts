import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addBusinessDays } from '../src/domain/delivery';
import { datesIn, dayName, doorDate } from '../src/domain/homesick';

describe('the delivery day (D-187)', () => {
  // The same 20 cases as supabase/tests/simple_store.test.sql (_add_business_days).
  const cases: [string, number, string][] = [
    ['2026-11-02', 1, '2026-11-03'], // Mon
    ['2026-11-02', 4, '2026-11-06'],
    ['2026-11-02', 5, '2026-11-09'],
    ['2026-11-02', 7, '2026-11-11'],
    ['2026-11-03', 3, '2026-11-06'], // Tue
    ['2026-11-03', 4, '2026-11-09'],
    ['2026-11-04', 7, '2026-11-13'], // Wed
    ['2026-11-04', 12, '2026-11-20'],
    ['2026-11-04', 16, '2026-11-26'],
    ['2026-11-05', 1, '2026-11-06'], // Thu
    ['2026-11-05', 2, '2026-11-09'],
    ['2026-11-06', 1, '2026-11-09'], // Fri
    ['2026-11-06', 5, '2026-11-13'],
    ['2026-11-06', 7, '2026-11-17'], // the Tuesday after next
    ['2026-11-06', 12, '2026-11-24'],
    ['2026-11-06', 16, '2026-11-30'],
    ['2026-11-07', 1, '2026-11-09'], // Sat + 1 = Mon
    ['2026-11-07', 7, '2026-11-17'],
    ['2026-11-08', 1, '2026-11-09'], // Sun + 1 = Mon
    ['2026-11-08', 5, '2026-11-13'],
  ];
  for (const [from, days, want] of cases) {
    it(`${from} + ${days} = ${want}`, () => assert.equal(addBusinessDays(from, days), want));
  }

  it('no days is the day itself; a month and a year roll over', () => {
    assert.equal(addBusinessDays('2026-11-07', 0), '2026-11-07');
    assert.equal(addBusinessDays('2026-12-30', 3), '2027-01-04');
  });

  it('refuses what is not a date', () => {
    assert.throws(() => addBusinessDays('Nov 6', 1), RangeError);
  });
});

describe('the dates checkout and the order page show (D-187)', () => {
  it('names the day and the window', () => {
    assert.equal(dayName('2026-10-31'), 'Saturday');
    assert.equal(doorDate('2026-10-31', '2026-10-31'), 'Sat, Oct 31');
    assert.equal(doorDate('2026-11-07', '2026-11-11'), 'Nov 7 – Nov 11');
  });

  it('counts an order placed now in business days', () => {
    assert.deepEqual(datesIn(7, 7, new Date('2026-11-06T15:00:00Z')), { from: '2026-11-17', to: '2026-11-17' });
    assert.deepEqual(datesIn(12, 16, new Date('2026-11-04T23:59:00Z')), { from: '2026-11-20', to: '2026-11-26' });
  });
});
