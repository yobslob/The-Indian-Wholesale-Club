import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  arrivalLine,
  bagGroups,
  bagShipmentState,
  quickArrivesLine,
  quickDates,
  quickGapLine,
  quickMeter,
  shipmentNote,
  type BagShipmentFacts,
} from '../src/domain';

const dates = { quickFrom: '2026-10-30', quickTo: '2026-10-30', standardFrom: '2026-11-03', standardTo: '2026-11-07' };
const facts = (over: Partial<BagShipmentFacts>): BagShipmentFacts => ({
  quickIds: ['snack'],
  quickCents: 5000,
  minCents: 4999,
  quickOnly: false,
  split: false,
  gapCents: null,
  outside: false,
  dates,
  ...over,
});
const lines = [{ variantId: 'snack' }, { variantId: 'kurta' }];

describe('the bag shows its shipments (D-154)', () => {
  it('splits into Shipment 1 (the 7-day pieces) and Shipment 2 (the rest)', () => {
    const groups = bagGroups(lines, facts({ split: true }));
    assert.deepEqual(
      groups.map((g) => [g.seq, g.kind, g.to, g.lines.map((l) => l.variantId)]),
      [
        [1, 'quick', '2026-10-30', ['snack']],
        [2, 'standard', '2026-11-07', ['kurta']],
      ],
    );
  });

  it('a bag of only 7-day pieces from the line is one 7-day group; under the line one normal group', () => {
    assert.equal(bagGroups([lines[0]!], facts({ quickOnly: true }))[0]!.kind, 'quick');
    const under = facts({ quickCents: 3759, gapCents: 1240 });
    assert.equal(bagShipmentState(under), 'under');
    assert.deepEqual(bagGroups(lines, under).map((g) => [g.seq, g.kind]), [[null, 'standard']]);
    assert.equal(quickGapLine(under), 'Add $12.40 of 7-day pieces and they arrive by Fri, Oct 30');
    assert.equal(Math.round(quickMeter(under)!.share * 100), 75);
  });

  it('no 7-day pieces: no meter, one group', () => {
    const none = facts({ quickIds: [], quickCents: 0 });
    assert.equal(bagShipmentState(none), 'none');
    assert.equal(quickMeter(none), null);
  });

  it('says the date, not a count of days', () => {
    assert.equal(arrivalLine('2026-10-30', '2026-10-30'), 'Arrives by Fri, Oct 30');
    assert.equal(arrivalLine('2026-11-03', '2026-11-07'), 'Arrives Nov 3 – Nov 7');
  });
});

describe("the pill's three-second notes (D-154)", () => {
  const at = (f: BagShipmentFacts, shippingCents: number, shippingCharged: boolean) => ({ facts: f, shippingCents, shippingCharged, freeMinCents: 9999 });
  const under = facts({ quickCents: 3759, gapCents: 1240 });
  const quick = facts({ quickOnly: true });
  const split = facts({ split: true });

  it('crossing the 7-day line', () => {
    assert.deepEqual(shipmentNote(at(under, 1862, true), at(quick, 1862, false)), { text: 'Your 7-day pieces now arrive by Fri, Oct 30', undo: false });
  });

  it('a normal piece added to a free 7-day bag brings Shipping back, with Undo (case 35)', () => {
    assert.deepEqual(shipmentNote(at(quick, 3724, false), at(split, 4655, true)), { text: 'Shipping is now $46.55 until $99.99.', undo: true });
  });

  it('a normal piece added past the free line only opens a second shipment', () => {
    assert.deepEqual(shipmentNote(at(quick, 3724, false), at(split, 6517, false)), { text: 'That opened a second shipment: Nov 3 – Nov 7', undo: false });
  });

  it('falling under the line joins the rest (case 5); no note on the first answer or without a change', () => {
    assert.equal(shipmentNote(at(split, 4655, true), at(under, 2793, true))?.text, 'Your 7-day pieces now travel with the rest: Nov 3 – Nov 7');
    assert.equal(shipmentNote(null, at(split, 4655, true)), null);
    assert.equal(shipmentNote(at(split, 4655, true), at(split, 5000, true)), null);
  });
});

describe("the 7-day store's date (D-154 step 4)", () => {
  it('counts from the order on the database calendar, any hour', () => {
    assert.deepEqual(quickDates(7, 7, new Date('2026-10-23T23:59:00Z')), { from: '2026-10-30', to: '2026-10-30' });
    assert.deepEqual(quickDates(7, 7, new Date('2026-10-28T02:00:00Z')), { from: '2026-11-04', to: '2026-11-04' });
  });

  it('reads as the switch and the front page say it', () => {
    assert.equal(quickArrivesLine(7, 7, new Date('2026-10-23T12:00:00Z')), 'arrives by Fri, Oct 30');
    assert.equal(quickArrivesLine(6, 8, new Date('2026-10-23T12:00:00Z')), 'arrives Oct 29 – Oct 31');
  });
});
