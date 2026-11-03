import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sameBag } from '../features/checkout/checkout-session';
import {
  canReuseIntent,
  checkoutIdempotencyKey,
  intentIdFromSecret,
} from '../features/checkout/intent-key';
import { paymentErrorMessage } from '../features/checkout/payment-errors';

describe('declines in plain words (launch QA A-9)', () => {
  it('4000 0000 0000 0002 (generic decline) reads as a plain decline', () => {
    const m = paymentErrorMessage({
      type: 'card_error',
      code: 'card_declined',
      decline_code: 'generic_decline',
      message: 'Your card was declined.',
    });
    assert.match(m, /declined/);
    assert.match(m, /another card/);
  });

  it('…9995 (insufficient funds) says so', () => {
    const m = paymentErrorMessage({
      type: 'card_error',
      code: 'card_declined',
      decline_code: 'insufficient_funds',
    });
    assert.match(m, /insufficient funds/);
  });

  it('lost or stolen cards are not revealed', () => {
    const plain = paymentErrorMessage({
      type: 'card_error',
      code: 'card_declined',
      decline_code: 'generic_decline',
    });
    for (const reason of ['lost_card', 'stolen_card', 'fraudulent', 'pickup_card']) {
      assert.equal(
        paymentErrorMessage({ type: 'card_error', code: 'card_declined', decline_code: reason }),
        plain,
      );
    }
  });

  it('a wrong CVC, an expired card and a failed 3-D Secure check each have their words', () => {
    assert.match(paymentErrorMessage({ type: 'card_error', code: 'incorrect_cvc' }), /CVC/);
    assert.match(paymentErrorMessage({ type: 'card_error', code: 'expired_card' }), /expired/);
    assert.match(
      paymentErrorMessage({
        type: 'invalid_request_error',
        code: 'payment_intent_authentication_failure',
      }),
      /verify/,
    );
  });

  it("a form check keeps Stripe's own field message", () => {
    assert.equal(
      paymentErrorMessage({ type: 'validation_error', message: 'Your card number is incomplete.' }),
      'Your card number is incomplete.',
    );
  });
});

describe('one payment per checkout visit (launch QA A-5)', () => {
  const secret = 'pi_3Abc123_secret_XyZ789';
  const intent = {
    id: 'pi_3Abc123',
    client_secret: secret,
    status: 'requires_payment_method',
    metadata: { source: 'iwc' },
  };

  it('reads the payment id from its secret', () => {
    assert.equal(intentIdFromSecret(secret), 'pi_3Abc123');
    assert.equal(intentIdFromSecret('pi_3Abc123'), null);
    assert.equal(intentIdFromSecret('seti_1_secret_2'), null);
  });

  it('reuses only our own unpaid payment, for the holder of its secret', () => {
    assert.equal(canReuseIntent(intent, secret), true);
    assert.equal(canReuseIntent(intent, 'pi_3Abc123_secret_other'), false);
    for (const status of [
      'succeeded',
      'processing',
      'requires_action',
      'canceled',
      'requires_capture',
    ]) {
      assert.equal(canReuseIntent({ ...intent, status }, secret), false, status);
    }
    assert.equal(canReuseIntent({ ...intent, metadata: {} }, secret), false);
  });

  const input = {
    email: 'Asha@Example.com',
    userId: null,
    totalCents: 4599,
    shippingMethod: 'standard',
    promoCode: null,
    address: {
      fullName: 'Asha',
      line1: '1 Main St',
      line2: null,
      city: 'Edison',
      state: 'NJ',
      zipCode: '08817',
      phone: null,
    },
    lines: [
      { variantId: 'b', quantity: 1 },
      { variantId: 'a', quantity: 2 },
    ],
  };
  const now = new Date('2026-11-03T12:01:00Z');

  it('a double submit gets the same Idempotency-Key', () => {
    const again = { ...input, email: 'asha@example.com', lines: [...input.lines].reverse() };
    assert.equal(
      checkoutIdempotencyKey(input, now),
      checkoutIdempotencyKey(again, new Date('2026-11-03T12:05:00Z')),
    );
    assert.match(checkoutIdempotencyKey(input, now), /^iwc-checkout-[0-9a-f]{48}$/);
  });

  it('a different total, shipping, bag or later window is a different payment', () => {
    const key = checkoutIdempotencyKey(input, now);
    assert.notEqual(checkoutIdempotencyKey({ ...input, totalCents: 4600 }, now), key);
    assert.notEqual(checkoutIdempotencyKey({ ...input, shippingMethod: 'express' }, now), key);
    assert.notEqual(
      checkoutIdempotencyKey({ ...input, lines: [{ variantId: 'a', quantity: 3 }] }, now),
      key,
    );
    assert.notEqual(checkoutIdempotencyKey(input, new Date('2026-11-03T12:31:00Z')), key);
  });
});

describe('a refresh resumes only the same bag (launch QA A-8)', () => {
  it('compares pieces and quantities, not order', () => {
    const a = [
      { variantId: 'x', quantity: 1 },
      { variantId: 'y', quantity: 2 },
    ];
    assert.equal(sameBag(a, [...a].reverse()), true);
    assert.equal(sameBag(a, [{ variantId: 'x', quantity: 1 }]), false);
    assert.equal(
      sameBag(a, [
        { variantId: 'x', quantity: 1 },
        { variantId: 'y', quantity: 3 },
      ]),
      false,
    );
    assert.equal(sameBag([], []), false);
  });
});
