import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dateRange, deskTime, isoToZoned, zonedToIso } from '../src/admin';

describe('admin times in the desk zone (D-096)', () => {
  // 2026-10-08 13:38 UTC = 9:38 AM in New Jersey (EDT) = 7:08 PM in India.
  const at = '2026-10-08T13:38:00Z';

  it('shows the US desk New Jersey first, India beside it', () => {
    assert.deepEqual(deskTime(at, 'us'), { main: 'Oct 8, 9:38 AM', other: '7:08 PM IST' });
  });

  it('shows the India desk India first, New Jersey beside it', () => {
    assert.deepEqual(deskTime(at, 'india'), { main: 'Oct 8, 7:08 PM', other: '9:38 AM ET' });
  });

  it('names the other day when the zones are on different dates', () => {
    assert.deepEqual(deskTime('2026-10-08T22:00:00Z', 'us'), { main: 'Oct 8, 6:00 PM', other: 'Oct 9, 3:30 AM IST' });
  });

  it('defaults to New Jersey for an admin without a desk', () => {
    assert.equal(deskTime(at, null).main, 'Oct 8, 9:38 AM');
  });

  it('turns a cutoff typed in the desk zone into the instant, and back', () => {
    assert.equal(zonedToIso('2026-10-10T23:59', 'us'), '2026-10-11T03:59:00.000Z'); // EDT, UTC-4
    assert.equal(zonedToIso('2026-12-10T23:59', 'us'), '2026-12-11T04:59:00.000Z'); // EST, UTC-5
    assert.equal(zonedToIso('2026-10-10T23:59', 'india'), '2026-10-10T18:29:00.000Z'); // IST, UTC+5:30
    assert.equal(isoToZoned('2026-10-11T03:59:00.000Z', 'us'), '2026-10-10T23:59');
    assert.equal(isoToZoned('2026-10-10T18:29:00.000Z', 'india'), '2026-10-10T23:59');
  });

  it('writes delivery windows as calendar days', () => {
    assert.equal(dateRange('2026-10-30', '2026-11-04'), 'Oct 30 – Nov 4');
    assert.equal(dateRange(null, null), '—');
  });
});
