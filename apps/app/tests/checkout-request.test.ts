import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_DETAILS, stateCode, toCheckoutRequest } from '../features/checkout/request';

import type { BagLine } from '../features/cart/store';

const line: BagLine = {
  variantId: '00000000-0000-4000-8000-000000000301',
  productId: '00000000-0000-4000-8000-000000000201',
  productName: 'Demo Kasavu Saree',
  productSlug: 'demo-kerala-kasavu-saree',
  regionSlug: 'kerala',
  regionName: 'Kerala',
  variantLabel: 'Free size',
  unitPriceCents: 12900,
  imagePath: null,
  quantity: 2,
};

const valid = {
  ...EMPTY_DETAILS,
  email: '  Priya@Example.com ',
  fullName: 'Priya Nair',
  line1: '1 Main Street',
  city: 'Edison',
  state: 'new jersey',
  zipCode: '08817',
};

describe('app checkout request (flows.md §3)', () => {
  it('sends only variant ids and quantities, never prices', () => {
    const result = toCheckoutRequest(valid, [line], 'standard');
    assert.ok('body' in result);
    assert.deepEqual(result.body.lines, [{ variantId: line.variantId, quantity: 2 }]);
    assert.equal(JSON.stringify(result.body).includes('12900'), false);
  });

  it('normalises email and state the way the server does', () => {
    const result = toCheckoutRequest(valid, [line], 'express');
    assert.ok('body' in result);
    assert.equal(result.body.email, 'priya@example.com');
    assert.equal(result.body.address.state, 'NJ');
    assert.equal(result.body.shippingMethod, 'express');
    assert.equal(result.body.address.line2, null);
    assert.equal(result.body.promoCode, null);
  });

  it('accepts a state code or name, in any case', () => {
    assert.equal(stateCode('nj'), 'NJ');
    assert.equal(stateCode('New Jersey'), 'NJ');
    assert.equal(stateCode('Narnia'), 'Narnia');
  });

  it('stops with a readable message before calling the server', () => {
    const noEmail = toCheckoutRequest({ ...valid, email: 'not-an-email' }, [line], 'standard');
    assert.deepEqual(noEmail, { error: 'Enter a valid email address' });
    const badZip = toCheckoutRequest({ ...valid, zipCode: '123' }, [line], 'standard');
    assert.ok('error' in badZip && /ZIP/.test(badZip.error));
    const badState = toCheckoutRequest({ ...valid, state: 'Narnia' }, [line], 'standard');
    assert.deepEqual(badState, { error: 'Choose a US state' });
  });
});
