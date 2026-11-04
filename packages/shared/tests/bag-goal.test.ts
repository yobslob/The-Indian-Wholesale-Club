import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bagGoal, bulkProgress } from '../src/domain';

const FREE = 4999;
const BULK_FROM = 9999;
const BULK = { pct: 10, capCents: 2500 };

const goal = (subtotal: number, free: number | null = FREE) =>
  bagGoal({ subtotalCents: subtotal, freeMinCents: free, bulk: bulkProgress(subtotal, BULK_FROM, BULK) });

describe('one goal for the bag (founder 2026-10-24: one bar; D-187: one line)', () => {
  it('under $49.99: the rest to free shipping, for any bag', () => {
    assert.deepEqual(goal(2000), { kind: 'free-gap', leftCents: 2999, share: 2000 / FREE });
    assert.deepEqual(goal(4998), { kind: 'free-gap', leftCents: 1, share: 4998 / FREE });
  });

  it('from $49.99: free, and the bulk part stays empty until $99.99', () => {
    const at = goal(4999);
    assert.equal(at.kind, 'free');
    if (at.kind !== 'free') return;
    assert.equal(at.share, 1);
    assert.equal(at.bulk.savingCents, 0);
    assert.equal(at.bulk.share, 0);
    const just = goal(9998);
    assert.ok(just.kind === 'free' && just.bulk.savingCents === 0);
  });

  it('from $99.99: the bulk part fills, as before', () => {
    const big = goal(12000);
    assert.ok(big.kind === 'free');
    if (big.kind !== 'free') return;
    assert.equal(big.bulk.savingCents, 200);
    assert.equal(big.bulk.capped, false);
    const capped = goal(50000);
    assert.ok(capped.kind === 'free' && capped.bulk.capped);
  });

  it('no line: no goal', () => {
    assert.deepEqual(goal(2000, null), { kind: 'none' });
    assert.deepEqual(goal(2000, 0), { kind: 'none' });
  });
});
