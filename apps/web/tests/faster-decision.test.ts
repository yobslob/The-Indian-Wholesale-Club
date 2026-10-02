import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FASTER_KIND, fasterDecision } from '../features/orders/faster-decision';

const intent = {
  id: 'pi_1',
  status: 'succeeded',
  amount: 500,
  currency: 'usd',
  livemode: false,
  metadata: { kind: FASTER_KIND, move_id: 'move-1' },
};
const open = { offer_status: 'offered', offer_cents: 500, payment_intent_id: null };
const key = 'sk_test_abc';

describe('paying for the faster-delivery offer (D-064)', () => {
  it('accepts a payment of exactly the open offer', () => {
    assert.equal(fasterDecision(intent, open, key), 'accept');
  });

  it('is done when this payment was already accepted (browser and webhook both came)', () => {
    assert.equal(fasterDecision(intent, { ...open, offer_status: 'accepted', payment_intent_id: 'pi_1' }, key), 'done');
  });

  it('refunds a payment for an offer that closed or was taken with another payment', () => {
    assert.equal(fasterDecision(intent, { ...open, offer_status: 'lapsed' }, key), 'refund');
    assert.equal(fasterDecision(intent, { ...open, offer_status: 'accepted', payment_intent_id: 'pi_2' }, key), 'refund');
  });

  it('refunds a payment of a different amount or the wrong mode', () => {
    assert.equal(fasterDecision({ ...intent, amount: 400 }, open, key), 'refund');
    assert.equal(fasterDecision(intent, open, 'sk_live_abc'), 'refund');
  });

  it('waits for a payment still processing, and ignores payments that are not offers', () => {
    assert.equal(fasterDecision({ ...intent, status: 'processing' }, open, key), 'pending');
    assert.equal(fasterDecision({ ...intent, metadata: { source: 'iwc' } }, open, key), 'unknown');
    assert.equal(fasterDecision(intent, null, key), 'unknown');
  });
});
