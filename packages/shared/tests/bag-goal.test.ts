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
    assert.deepEqual(g, { kind: 'quick-free', share: 1, arrivesBy: 'Fri, Oct 30', arrivesByDay: '2026-10-30' });
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

  it('case 5: from $99.99 → free; the free part stays full and the bulk saving fills after it', () => {
    const at = goal(9999, ['kurta'], []);
    assert.ok(at.kind === 'free');
    assert.equal(at.share, 1);
    assert.equal(at.bulk.savingCents, 0);
    const past = goal(12555, ['kurta'], []);
    assert.ok(past.kind === 'free');
    assert.equal(past.bulk.savingCents, Math.round(((12555 - 9999) * 5) / 100));
    // founder 2026-10-30: the bar keeps its progress past the line; the saving is its own part (bulk.share)
    assert.equal(past.share, 1);
    assert.equal(past.bulk.share, past.bulk.savingCents / 2500);
    // a 7-day-only bag past $99.99 is a free bag like any other
    assert.equal(goal(15000, ['snack'], ['snack']).kind, 'free');
  });

  it('while the answer for this bag is on its way, the goal follows the bag as it is now (founder 2026-10-30)', () => {
    const known = { quickIds: ['snack', 'tea'], quickMinCents: QUICK_LINE, quickTo: '2026-10-30' };
    const small: SmallOrderCharges = { shippingCents: 1879, retailerCents: 99, quickFree: false };
    const at = (subtotal: number, ids: string[]) =>
      bagGoal({
        subtotalCents: subtotal,
        freeMinCents: LINE,
        at: bagChargesAt(subtotal, LINE, small),
        bulk: bulkProgress(subtotal, LINE, BULK),
        facts: null,
        variantIds: ids,
        known,
      });
    // the kurti set taken out: only 7-day pieces left, under the 7-day line → the 7-day goal at once
    assert.deepEqual(at(3000, ['snack', 'tea']), { kind: 'quick-gap', leftCents: QUICK_LINE - 3000, share: 3000 / QUICK_LINE });
    // over it → free 7-day delivery, not "add more for free delivery"
    assert.equal(at(6000, ['snack', 'tea']).kind, 'quick-free');
    // a normal piece in the bag → the free-delivery line
    assert.equal(at(6000, ['snack', 'kurta']).kind, 'free-gap');
    // nothing known yet about a piece → treated as a normal one
    assert.equal(bagGoal({ subtotalCents: 3000, freeMinCents: LINE, at: bagChargesAt(3000, LINE, small), bulk: bulkProgress(3000, LINE, BULK), facts: null, variantIds: ['snack'] }).kind, 'free-gap');
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
