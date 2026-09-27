import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ALLOWED_ORDER_TRANSITIONS, canTransitionOrder } from '../src/utils';

describe('Order Lifecycle State Machine (Shared Source of Truth)', () => {
  it('allows valid progressive order status transitions', () => {
    assert.equal(canTransitionOrder('pending', 'confirmed'), true);
    assert.equal(canTransitionOrder('confirmed', 'processing'), true);
    assert.equal(canTransitionOrder('processing', 'shipped'), true);
    assert.equal(canTransitionOrder('shipped', 'in_transit'), true);
    assert.equal(canTransitionOrder('in_transit', 'out_for_delivery'), true);
    assert.equal(canTransitionOrder('out_for_delivery', 'delivered'), true);
    assert.equal(canTransitionOrder('delivered', 'refunded'), true);
  });

  it('rejects invalid backwards transitions', () => {
    assert.equal(canTransitionOrder('delivered', 'pending'), false);
    assert.equal(canTransitionOrder('delivered', 'processing'), false);
    assert.equal(canTransitionOrder('shipped', 'pending'), false);
    assert.equal(canTransitionOrder('out_for_delivery', 'shipped'), false);
  });

  it('identifies terminal states properly', () => {
    assert.deepEqual(ALLOWED_ORDER_TRANSITIONS.cancelled, []);
    assert.deepEqual(ALLOWED_ORDER_TRANSITIONS.refunded, []);
  });

  it('permits idempotent status transitions to same status', () => {
    assert.equal(canTransitionOrder('in_transit', 'in_transit'), true);
    assert.equal(canTransitionOrder('delivered', 'delivered'), true);
  });
});
