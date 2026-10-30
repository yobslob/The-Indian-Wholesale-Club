import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayName, doorDate, festivalBanner, festivalClock, weekStrip } from '../src/domain/homesick';

const week = { min: 7, max: 7 };
const standard = { min: 12, max: 16 };
const fest = [{ name: 'Diwali', day: '2026-11-08' }];

describe('the homesick lines (D-161)', () => {
  it('names the day and the door date', () => {
    assert.equal(dayName('2026-10-31'), 'Saturday');
    assert.equal(doorDate('2026-10-31', '2026-10-31'), 'Sat, Oct 31');
    assert.equal(doorDate('2026-11-07', '2026-11-11'), 'Nov 7 – Nov 11');
  });

  it('counts down to Diwali only while an order can arrive the day before', () => {
    // Oct 26: 7-day pieces by Oct 31 (they arrive Nov 7); the 16-day window has missed it
    const c = festivalClock(week, standard, new Date('2026-10-26T15:00:00Z'), fest);
    assert.deepEqual(c, { name: 'Diwali', date: 'Sun, Nov 8', quickBy: '2026-10-31', standardBy: null, lastDay: false });
    assert.deepEqual(festivalBanner(c, 'quick'), { words: 'For Diwali, order by Oct 31', quickOnly: false });
    // Home: only the 7-day store makes it, so the banner says so (and opens that store)
    assert.deepEqual(festivalBanner(c, 'any'), { words: 'For Diwali, order by Oct 31', quickOnly: true });
    assert.equal(festivalBanner(null, 'any'), null);
    assert.equal(festivalClock(week, standard, new Date('2026-11-01T01:00:00Z'), fest), null);
    // three weeks ahead the whole store still makes it
    const early = festivalClock(week, standard, new Date('2026-10-18T12:00:00Z'), fest);
    assert.deepEqual(festivalBanner(early, 'any'), { words: 'For Diwali, order by Oct 22', quickOnly: false });
    assert.deepEqual(festivalBanner(early, 'quick'), { words: 'For Diwali, order by Oct 31', quickOnly: false });
    assert.equal(festivalClock(week, standard, new Date('2026-10-01T12:00:00Z'), fest), null);
    assert.equal(festivalClock(null, null, new Date('2026-10-26T12:00:00Z'), fest), null);
  });

  it('draws the week strip for one arrival day', () => {
    const s = weekStrip('2026-11-02', '2026-11-02', new Date('2026-10-26T10:00:00Z'));
    assert.equal(s?.length, 8);
    assert.deepEqual(s?.[0], { day: '2026-10-26', short: 'Mon' });
    assert.deepEqual(s?.[7], { day: '2026-11-02', short: 'Mon' });
    assert.equal(weekStrip('2026-11-07', '2026-11-11', new Date('2026-10-26T10:00:00Z')), null);
  });
});
