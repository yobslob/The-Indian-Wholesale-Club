import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bagChargesAt, bagGoal, bulkProgress, type BagShipmentFacts, type SmallOrderCharges } from '../src/domain';

const LINE = 9999;
const QUICK_LINE = 4999;
const dates = { quickFrom: '2026-10-30', quickTo: '2026-10-30', standardFrom: '2026-11-03', standardTo: '2026-11-07' };
const BULK = { pct: 5, capCents: 2500 };

/** A bag: its goods, which of its options are 7-day pieces, and what store_bag_charges() said. */
function goal(subtotal: number, ids: string[], quickIds: string[], over: Partial<BagShipmentFacts> = {}) {
  const quickCents = over.quickCents ?? (quickIds.length === ids.length ? subtotal : 2000);
  const quickOnly = quickIds.length > 0 && quickIds.length === ids.length && quickCents >= QUICK_LINE;
  const facts: BagShipmentFacts | null = quickIds.length
    ? {
        quickIds,
        quickCents,
        minCents: QUICK_LINE,
        quickOnly,
        split: !quickOnly && quickCents >= QUICK_LINE,
        gapCents: quickCents >= QUICK_LINE ? null : QUICK_LINE - quickCents,
        outside: false,
        dates,
        ...over,
      }
    : null;
  const small: SmallOrderCharges = { shippingCents: 1879, retailerCents: 99, retailerPct: 1.5, quickFree: quickOnly };
  return bagGoal({
    subtotalCents: subtotal,
    freeMinCents: LINE,
    at: bagChargesAt(subtotal, LINE, small),
    bulk: bulkProgress(subtotal, LINE, BULK),
    facts,
    variantIds: ids,
  });
}

describe('one goal for the bag (founder 2026-10-24: one bar, never two)', () => {
  it('case 1: only 7-day pieces under $49.99 → add the rest for free 7-day delivery, the bar on the 7-day line', () => {
    const g = goal(3759, ['snack'], ['snack']);
    assert.equal(g.kind, 'quick-gap');
    assert.ok(g.kind === 'quick-gap');
    assert.equal(g.leftCents, 4999 - 3759);
    assert.equal(Math.round(g.share * 100), 75);
  });

  it('case 4: only 7-day pieces from $49.99 → free 7-day delivery, the bar full, no "add more for free delivery"', () => {
    const g = goal(5200, ['snack', 'tea'], ['snack', 'tea']);
    assert.deepEqual(g, { kind: 'quick-free', share: 1, arrivesBy: 'Fri, Oct 30' });
  });

  it('case 2: normal pieces under $99.99 → add the rest for free delivery', () => {
    const g = goal(4185 * 2, ['kurta'], []);
    assert.deepEqual(g, { kind: 'free-gap', leftCents: 9999 - 8370, share: 8370 / 9999 });
  });

  it('case 3: 7-day + normal under $99.99 → free delivery is the one goal, even when the 7-day pieces are under their line', () => {
    assert.equal(goal(6000, ['snack', 'kurta'], ['snack'], { quickCents: 2000 }).kind, 'free-gap');
    // and when they are over it (two shipments), Shipping is still paid below $99.99
    assert.equal(goal(8000, ['snack', 'kurta'], ['snack'], { quickCents: 5500 }).kind, 'free-gap');
  });

  it('case 5: from $99.99 → free, then the bar refills with the bulk saving', () => {
    const at = goal(9999, ['kurta'], []);
    assert.ok(at.kind === 'free');
    assert.equal(at.share, 1);
    assert.equal(at.bulk.savingCents, 0);
    const past = goal(12555, ['kurta'], []);
    assert.ok(past.kind === 'free');
    assert.equal(past.bulk.savingCents, Math.round(((12555 - 9999) * 5) / 100));
    assert.equal(past.share, past.bulk.savingCents / 2500);
    // a 7-day-only bag past $99.99 is a free bag like any other
    assert.equal(goal(15000, ['snack'], ['snack']).kind, 'free');
  });

  it('no line (charges off) → no goal', () => {
    const small: SmallOrderCharges = { shippingCents: 0, retailerCents: 0 };
    assert.deepEqual(
      bagGoal({
        subtotalCents: 100,
        freeMinCents: null,
        at: bagChargesAt(100, null, small),
        bulk: bulkProgress(100, null, null),
        facts: null,
        variantIds: ['x'],
      }),
      { kind: 'none' },
    );
  });
});
