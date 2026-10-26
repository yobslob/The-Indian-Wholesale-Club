import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dayName, doorDate, festivalClock, festivalLine, indiaTime, weekendLine, weekStrip } from '../src/domain/homesick';

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
    assert.equal(festivalLine(c), 'Diwali is Sun, Nov 8. 7-day pieces ordered by Sat, Oct 31 get there in time.');
    assert.equal(
      festivalLine(festivalClock(week, standard, new Date('2026-10-31T23:00:00Z'), fest)),
      'Last day for Diwali: 7-day pieces ordered today get there in time.',
    );
    assert.equal(festivalClock(week, standard, new Date('2026-11-01T01:00:00Z'), fest), null);
    // three weeks ahead the whole store still makes it
    assert.equal(
      festivalLine(festivalClock(week, standard, new Date('2026-10-18T12:00:00Z'), fest)),
      'Diwali is Sun, Nov 8. Order by Thu, Oct 22 and it all gets there in time.',
    );
    assert.equal(festivalClock(week, standard, new Date('2026-10-01T12:00:00Z'), fest), null);
    assert.equal(festivalClock(null, null, new Date('2026-10-26T12:00:00Z'), fest), null);
  });

  it('says the weekend line only Friday to Sunday, for exactly 7 days', () => {
    assert.match(weekendLine(week, new Date('2026-10-30T12:00:00Z')) ?? '', /next weekend/);
    assert.match(weekendLine(week, new Date('2026-11-01T12:00:00Z')) ?? '', /next weekend/);
    assert.equal(weekendLine(week, new Date('2026-10-28T12:00:00Z')), null);
    assert.equal(weekendLine({ min: 6, max: 8 }, new Date('2026-10-30T12:00:00Z')), null);
  });

  it("tells India's hour", () => {
    assert.deepEqual(indiaTime(new Date('2026-10-26T16:10:00Z')), {
      time: '9:40 pm',
      line: 'Dinner, and the TV serial everyone pretends not to watch.',
    });
    assert.equal(indiaTime(new Date('2026-10-26T18:45:00Z')).line, 'Cricket highlights and one last chai.');
    assert.equal(indiaTime(new Date('2026-10-26T21:00:00Z')).line, "India's asleep. Even the street dogs.");
    assert.equal(indiaTime(new Date('2026-10-26T06:30:00Z')).time, '12:00 pm');
  });

  it('draws the week strip for one arrival day', () => {
    const s = weekStrip('2026-11-02', '2026-11-02', new Date('2026-10-26T10:00:00Z'));
    assert.equal(s?.length, 8);
    assert.deepEqual(s?.[0], { day: '2026-10-26', short: 'Mon' });
    assert.deepEqual(s?.[7], { day: '2026-11-02', short: 'Mon' });
    assert.equal(weekStrip('2026-11-07', '2026-11-11', new Date('2026-10-26T10:00:00Z')), null);
  });
});
