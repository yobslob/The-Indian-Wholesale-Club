import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bagLine, chipLabel, colourPhoto, coloursOf, optionPhoto, showsPrices } from '../features/catalog/card-options';

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
  it('puts the photo of the look on the bag line, or the main photo when the look has none (D-194)', () => {
    const product = { id: 'p', name: 'Kurta', slug: 'k', region_slug: 'punjab', region_name: 'Punjab', primary_image_path: 'main.jpg' };
    const option = o('Red · M', { colour: 'Red', size: 'M' });
    assert.equal(bagLine(product, { ...option, image_path: 'red.jpg' }).imagePath, 'red.jpg');
    assert.equal(bagLine(product, { ...option, image_path: null }).imagePath, 'main.jpg');
    assert.equal(bagLine(product, option).imagePath, 'main.jpg');
    assert.equal(optionPhoto({ image_path: null }), null);
  });
  it('finds the photo of a colour on any of its sizes (D-194)', () => {
    const list = [
      { ...o('Red · S', { colour: 'Red', size: 'S' }), image_path: null },
      { ...o('Red · M', { colour: 'Red', size: 'M' }), image_path: 'red.jpg' },
      { ...o('Blue · M', { colour: 'Blue', size: 'M' }), image_path: null },
    ];
    assert.equal(colourPhoto(list, 'Red'), 'red.jpg');
    assert.equal(colourPhoto(list, 'Blue'), null);
  });
  it('names prices for food and home, and for clothing whose sizes cost differently', () => {
    assert.equal(showsPrices([o('M', { size: 'M' }), o('L', { size: 'L' })], 'clothing'), false);
    assert.equal(showsPrices([o('M', { size: 'M' }), o('XXL', { size: 'XXL' }, 5200)], 'clothing'), true);
    assert.equal(showsPrices([o('200 g', { pack: '200 g' })], 'food'), true);
  });
});
