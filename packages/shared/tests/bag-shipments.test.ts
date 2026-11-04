import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrivalLine, bagGroups, bagShipmentState, parseBagShipments, type BagShipmentFacts } from '../src/domain';

const dates = { foodFrom: '2026-11-13', foodTo: '2026-11-13', standardFrom: '2026-11-20', standardTo: '2026-11-26' };
const facts = (over: Partial<BagShipmentFacts>): BagShipmentFacts => ({
  foodIds: ['snack'],
  foodCents: 3000,
  foodOnly: false,
  split: false,
  outside: false,
  dates,
  ...over,
});
const lines = [{ variantId: 'snack' }, { variantId: 'kurta' }];

describe('a bag\'s shipments (D-154, D-187)', () => {
  it('names the state: food alone, split, or one standard shipment', () => {
    assert.equal(bagShipmentState(null), 'none');
    assert.equal(bagShipmentState(facts({ foodOnly: true })), 'food');
    assert.equal(bagShipmentState(facts({ split: true })), 'split');
    assert.equal(bagShipmentState(facts({ foodIds: [], foodCents: 0 })), 'none');
    assert.equal(bagShipmentState(facts({ outside: true })), 'none', 'Alaska: one shipment, food too');
  });

  it('groups the lines: food first when the bag splits', () => {
    const two = bagGroups(lines, facts({ split: true }));
    assert.deepEqual(two.map((g) => [g.seq, g.kind, g.from, g.to, g.lines.map((l) => l.variantId)]), [
      [1, 'food', '2026-11-13', '2026-11-13', ['snack']],
      [2, 'standard', '2026-11-20', '2026-11-26', ['kurta']],
    ]);
  });

  it('one shipment: a food bag on its days, anything else on the standard days', () => {
    const food = bagGroups([{ variantId: 'snack' }], facts({ foodOnly: true }));
    assert.deepEqual([food.length, food[0]?.seq, food[0]?.kind, food[0]?.to], [1, null, 'food', '2026-11-13']);
    const outside = bagGroups(lines, facts({ outside: true }));
    assert.deepEqual([outside.length, outside[0]?.kind, outside[0]?.to, outside[0]?.lines.length], [1, 'standard', '2026-11-26', 2]);
    assert.deepEqual(bagGroups(lines, null).map((g) => [g.seq, g.kind, g.from]), [[null, 'standard', null]]);
  });

  it('says one day or a window', () => {
    assert.equal(arrivalLine('2026-11-13', '2026-11-13'), 'Arrives by Fri, Nov 13');
    assert.equal(arrivalLine('2026-11-20', '2026-11-26'), 'Arrives Nov 20 – Nov 26');
    assert.equal(arrivalLine(null, null), null);
  });

  it('reads the charges answer', () => {
    const f = parseBagShipments({
      shipments: { food_cents: 1500, food_only: false, split: true, outside: false, quick_cents: 1500 },
      food_ids: ['snack', 3],
      dates: { food_from: '2026-11-13', food_to: '2026-11-13', standard_from: '2026-11-20', standard_to: 'soon' },
    });
    assert.deepEqual(f, {
      foodIds: ['snack'],
      foodCents: 1500,
      foodOnly: false,
      split: true,
      outside: false,
      dates: { foodFrom: '2026-11-13', foodTo: '2026-11-13', standardFrom: '2026-11-20', standardTo: null },
    });
    assert.equal(parseBagShipments(null), null);
    assert.equal(parseBagShipments({ shipments: null }), null);
  });
});
