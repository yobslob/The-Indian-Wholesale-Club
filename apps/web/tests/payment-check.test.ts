import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { paymentMatchesCheckout } from '../features/checkout/payment-check';

const intent = { amount: 10692, currency: 'usd', livemode: false };

describe('payment matches the stored checkout (D-038)', () => {
  it('accepts a test payment on test keys, whatever NODE_ENV says', () => {
    assert.equal(paymentMatchesCheckout(intent, 10692, 'sk_test_abc'), true);
  });

  it('accepts a live payment on live keys', () => {
    assert.equal(paymentMatchesCheckout({ ...intent, livemode: true }, 10692, 'sk_live_abc'), true);
  });

  it('refuses a mode that does not match the server key', () => {
    assert.equal(paymentMatchesCheckout(intent, 10692, 'sk_live_abc'), false);
    assert.equal(
      paymentMatchesCheckout({ ...intent, livemode: true }, 10692, 'sk_test_abc'),
      false,
    );
  });

  it('refuses another amount or currency', () => {
    assert.equal(paymentMatchesCheckout(intent, 10691, 'sk_test_abc'), false);
    assert.equal(
      paymentMatchesCheckout({ ...intent, currency: 'inr' }, 10692, 'sk_test_abc'),
      false,
    );
  });
});
