import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fromLabel, optionPriceLabel, priceRange } from '../src/domain';

const o = (price_cents: number, available = 3) => ({ price_cents, available });

describe('the price a product shows (launch QA B-1)', () => {
  it('before a pick: "From" the lowest price in stock when the options differ', () => {
    // the poshak: $17.31 first, blue $16.30
    assert.equal(optionPriceLabel([o(1731), o(1630), o(1731)]), 'From $16.30');
  });

  it('a sold-out cheaper option does not lower "From"', () => {
    assert.equal(optionPriceLabel([o(1731), o(1499, 0), o(1899)]), 'From $17.31');
    // the only in-stock options share a price: their one price, no "From"
    assert.equal(optionPriceLabel([o(1731), o(1499, 0), o(1731)]), '$17.31');
  });

  it('the single price when every option costs the same', () => {
    assert.equal(optionPriceLabel([o(2273), o(2273)]), '$22.73');
    assert.equal(optionPriceLabel([o(999)]), '$9.99');
  });

  it('after a pick: exactly that option’s price, the one the bag line gets', () => {
    const options = [o(2454), o(2273)];
    assert.equal(optionPriceLabel(options, options[1]), '$22.73');
    assert.equal(optionPriceLabel(options, options[0]), '$24.54');
  });

  it('everything sold out: the range of all options; no options: nothing', () => {
    assert.deepEqual(priceRange([o(1200, 0), o(1500, 0)]), { fromCents: 1200, varies: true });
    assert.equal(priceRange([]), null);
    assert.equal(optionPriceLabel([]), '');
  });

  it('a card that kept only its lowest price and whether prices differ says the same', () => {
    assert.equal(fromLabel(1630, true), 'From $16.30');
    assert.equal(fromLabel(1630, false), '$16.30');
  });
});
