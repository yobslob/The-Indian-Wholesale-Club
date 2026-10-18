import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chipLabel, coloursOf, showsPrices } from '../features/catalog/card-options';

const o = (label: string, options: Record<string, string>, price = 4900) => ({
  id: '00000000-0000-4000-8000-000000000001',
  label,
  options,
  price_cents: price,
  available: 2,
});

describe("the card's + picks an option (D-140, F9)", () => {
  it('reads clothing as its size, food as its pack with its own price', () => {
    assert.equal(chipLabel(o('Red · M', { colour: 'Red', size: 'M' }), 'clothing', false), 'M');
    assert.equal(chipLabel(o('200 g', { pack: '200 g' }, 429), 'food', true), '200 g · $4.29');
    assert.equal(chipLabel(o('Malai', { flavour: 'Malai' }, 299), 'food', true), 'Malai · $2.99');
  });
  it('asks for a colour first only when there are two or more', () => {
    assert.deepEqual(coloursOf([o('Red · M', { colour: 'Red', size: 'M' }), o('Blue · M', { colour: 'Blue', size: 'M' })]), ['Red', 'Blue']);
    assert.deepEqual(coloursOf([o('Red · M', { colour: 'Red', size: 'M' }), o('Red · L', { colour: 'Red', size: 'L' })]), []);
  });
  it('names prices for food and home, and for clothing whose sizes cost differently', () => {
    assert.equal(showsPrices([o('M', { size: 'M' }), o('L', { size: 'L' })], 'clothing'), false);
    assert.equal(showsPrices([o('M', { size: 'M' }), o('XXL', { size: 'XXL' }, 5200)], 'clothing'), true);
    assert.equal(showsPrices([o('200 g', { pack: '200 g' })], 'food'), true);
  });
});
