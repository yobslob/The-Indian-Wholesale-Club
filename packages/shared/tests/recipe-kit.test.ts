import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kitPiecesToAdd, kitTotal, kitWasCents, recipeTime } from '../src/domain';

const masala = { variantId: 'm', priceCents: 399, available: true };
const dal = { variantId: 'd', priceCents: 250, available: true };
const gone = { variantId: 'g', priceCents: 500, available: false };
const unmapped = { variantId: null, priceCents: null, available: false };

describe('a recipe kit (D-203)', () => {
  it('adds up the available pieces; every kit is struck through at food’s factor', () => {
    const t = kitTotal([masala, dal, gone, unmapped]);
    assert.deepEqual(t, { cents: 649, wasCents: Math.round(649 * 1.2), count: 2 });
    assert.equal(kitWasCents(1000), 1200);
  });

  it('counts only the ticked pieces', () => {
    assert.deepEqual(kitTotal([masala, dal], new Set(['d'])), { cents: 250, wasCents: 300, count: 1 });
    assert.deepEqual(kitTotal([masala], new Set()), { cents: 0, wasCents: 0, count: 0 });
  });

  it('Add skips unavailable pieces and never doubles one already in the bag', () => {
    const ticked = new Set(['m', 'd', 'g']);
    assert.deepEqual(
      kitPiecesToAdd([masala, dal, gone, masala], ticked, new Set(['d'])).map((p) => p.variantId),
      ['m'],
    );
  });

  it('the time fact', () => {
    assert.equal(recipeTime(40), '40 min');
    assert.equal(recipeTime(75), '1 h 15 min');
    assert.equal(recipeTime(120, 8), '2 h + 8 h soak');
  });
});
