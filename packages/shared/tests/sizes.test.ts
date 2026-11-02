import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareSizes, optionAxes, sizeLabel, sortBySize } from '../src/domain';

const sorted = (values: string[]): string[] => sortBySize(values, (s) => s);

describe('size labels (launch QA B-3)', () => {
  it("writes kids' ages one way", () => {
    assert.equal(sizeLabel('0-6 M'), '0–6 months');
    assert.equal(sizeLabel('4-5 Y'), '4–5 years');
    assert.equal(sizeLabel('6-12 year'), '6–12 years');
    assert.equal(sizeLabel('1 - 2 year'), '1–2 years');
    assert.equal(sizeLabel('3-6M'), '3–6 months');
    assert.equal(sizeLabel('Age 2-3 Yrs'), '2–3 years');
    assert.equal(sizeLabel('1 Year'), '1 year');
    assert.equal(sizeLabel('18 months'), '18 months');
  });

  it('puts letter sizes in capitals and free size in one spelling; anything else as written', () => {
    assert.equal(sizeLabel('xl'), 'XL');
    assert.equal(sizeLabel(' xx l '), 'XXL');
    assert.equal(sizeLabel('s/m'), 'S/M');
    assert.equal(sizeLabel('FREE SIZE'), 'Free size');
    assert.equal(sizeLabel('Freesize'), 'Free size');
    assert.equal(sizeLabel('one size'), 'One size');
    assert.equal(sizeLabel('UK  7'), 'UK 7');
    assert.equal(sizeLabel('M'), 'M');
    assert.equal(sizeLabel('Blue'), 'Blue');
  });
});

describe('size order (launch QA B-3)', () => {
  it("sorts kids' ages by age, months before years, whatever the spelling", () => {
    assert.deepEqual(sorted(['4-5 Y', '0-6 M', '6-12 year', '1 - 2 year', '6-12 M', '2-3 Y', '0-3 M']), [
      '0-3 M',
      '0-6 M',
      '6-12 M',
      '1 - 2 year',
      '2-3 Y',
      '4-5 Y',
      '6-12 year',
    ]);
  });

  it('sorts adult letter sizes XS to 5XL, with XXL and 2XL in the same place', () => {
    assert.deepEqual(sorted(['5XL', 'L', 'XS', 'xl', 'M', '3XL', 'XXL', 'S', '4XL']), ['XS', 'S', 'M', 'L', 'xl', 'XXL', '3XL', '4XL', '5XL']);
    assert.equal(compareSizes('2XL', 'XXL'), 0);
  });

  it('sorts numeric sizes as numbers, prefixed ones together, weights by grams, free size last', () => {
    assert.deepEqual(sorted(['40', '28', '32', '30', '36']), ['28', '30', '32', '36', '40']);
    const values = ['XL', 'Free size', '1 kg', 'S', 'W30', 'US 9', '250 g', 'M', 'US 10', 'W28', '10-12 Y', '2-3 Y', 'XXL'];
    assert.deepEqual(sorted(values), ['S', 'M', 'XL', 'XXL', '2-3 Y', '10-12 Y', 'US 9', 'US 10', 'W28', 'W30', '250 g', '1 kg', 'Free size']);
  });

  it("keeps the shop's order for words it cannot rank, and items without a size at the end", () => {
    assert.deepEqual(sorted(['Regular', 'Petite', 'S']), ['S', 'Regular', 'Petite']);
    const items = [{ s: null }, { s: 'L' }, { s: 'S' }];
    assert.deepEqual(sortBySize(items, (i) => i.s).map((i) => i.s), ['S', 'L', null]);
  });

  it("orders the product page's size row (optionAxes), colours staying in variant order", () => {
    const v = (colour: string, size: string) => ({ options: { colour, size } });
    const axes = optionAxes([v('Red', 'XL'), v('Red', 'S'), v('Blue', 'M'), v('Blue', 'S')]);
    assert.deepEqual(axes.map((a) => [a.key, a.values]), [['colour', ['Red', 'Blue']], ['size', ['S', 'M', 'XL']]]);
  });
});
