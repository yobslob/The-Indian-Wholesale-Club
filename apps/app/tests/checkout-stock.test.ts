import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { stockProblemLines, stockRows } from '../features/checkout/stock';

import type { BagLine } from '../features/cart/store';

const bagLine: BagLine = {
  variantId: 'v1',
  productId: 'p1',
  productName: 'Kasavu Saree',
  productSlug: 'kasavu-saree',
  regionSlug: 'kerala',
  regionName: 'Kerala',
  variantLabel: 'Free size',
  unitPriceCents: 12900,
  imagePath: 'bag.jpg',
  quantity: 3,
};
const problem = { variantId: 'v1', productName: 'Saree', variantLabel: 'Red', imagePath: 'server.jpg', quantity: 3 };

describe('the stock problems at checkout (§10 Y-3)', () => {
  it('sold out or off sale: Not available right now, with Remove only', () => {
    const [row] = stockRows([{ ...problem, available: 0 }], [bagLine]);
    assert.equal(row?.note, 'Not available right now');
    assert.equal(row?.keep, null);
  });

  it('fewer left than the bag asks: Only 2 left, with Keep 2', () => {
    const [row] = stockRows([{ ...problem, available: 2 }], [bagLine]);
    assert.equal(row?.note, 'Only 2 left');
    assert.equal(row?.keep, 2);
    assert.equal(row?.name, 'Saree');
    assert.equal(row?.imagePath, 'server.jpg');
  });

  it("an option that no longer exists shows the bag's own words and photo", () => {
    const [row] = stockRows([{ variantId: 'v1', productName: null, variantLabel: null, imagePath: null, quantity: 3, available: 0 }], [bagLine]);
    assert.equal(row?.name, 'Kasavu Saree');
    assert.equal(row?.option, 'Free size');
    assert.equal(row?.imagePath, 'bag.jpg');
  });

  it('a line already lowered far enough is left out', () => {
    assert.deepEqual(stockRows([{ ...problem, quantity: 2, available: 2 }], [bagLine]), []);
  });

  it("reads the lines only from a refusal of kind 'stock'", () => {
    const lines = [{ ...problem, available: 0 }];
    assert.deepEqual(stockProblemLines({ kind: 'stock', lines }), lines);
    assert.deepEqual(stockProblemLines({ kind: 'closed' }), []);
    assert.deepEqual(stockProblemLines(undefined), []);
  });
});
