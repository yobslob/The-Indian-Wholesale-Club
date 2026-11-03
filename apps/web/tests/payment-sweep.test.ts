import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  inGroups,
  isUnknownToStripe,
  refundedCents,
  stepAfterFinalize,
  stepForPayment,
} from '../app/api/internal/payment-sweep/decide';

describe('the payment sweep: which checkouts get an order (F-2)', () => {
  it('creates the order only for a payment that succeeded', () => {
    assert.deepEqual(stepForPayment('succeeded'), { kind: 'finalize' });
  });

  it('never makes an order for a payment already refunded in Stripe (its status stays succeeded)', () => {
    assert.deepEqual(stepForPayment('succeeded', 500), { kind: 'stop', note: 'refunded in Stripe' });
    assert.equal(refundedCents({ id: 'ch_1', amount_refunded: 10692 }), 10692);
    assert.equal(refundedCents({ id: 'ch_1', amount_refunded: 0 }), 0);
    assert.equal(refundedCents('ch_1'), 0);
    assert.equal(refundedCents(null), 0);
  });

  it('stops looking at a cancelled payment', () => {
    assert.deepEqual(stepForPayment('canceled'), { kind: 'stop', note: 'payment cancelled' });
  });

  it('asks again later while the payment is not finished', () => {
    for (const status of ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'])
      assert.deepEqual(stepForPayment(status), { kind: 'wait' }, status);
  });

  it('after finalizing: done with the order number, or why it stopped', () => {
    assert.deepEqual(stepAfterFinalize({ ok: true, orderNumber: 'IWC-1001' }), {
      kind: 'done',
      orderNumber: 'IWC-1001',
    });
    assert.deepEqual(stepAfterFinalize({ ok: false, reason: 'payment_not_complete', detail: 'processing' }), {
      kind: 'wait',
    });
    assert.deepEqual(stepAfterFinalize({ ok: false, reason: 'order_refused', detail: 'insufficient_stock' }), {
      kind: 'stop',
      note: 'not finalized: order_refused (insufficient_stock)',
    });
    assert.deepEqual(stepAfterFinalize({ ok: false, reason: 'payment_mismatch' }), {
      kind: 'stop',
      note: 'not finalized: payment_mismatch',
    });
  });

  it("recognises Stripe's answer for a payment it does not have", () => {
    assert.equal(isUnknownToStripe({ code: 'resource_missing', type: 'StripeInvalidRequestError' }), true);
    assert.equal(isUnknownToStripe({ code: 'rate_limit' }), false);
    assert.equal(isUnknownToStripe(new Error('network')), false);
  });

  it('works through a batch a few at a time, in order', async () => {
    let running = 0;
    let most = 0;
    const out = await inGroups([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50, 60, 70]);
    assert.equal(most, 3);
  });
});
