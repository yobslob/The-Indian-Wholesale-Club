import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SIZE_LIST_KEEP, SIZE_LIST_MAX, usefulSizes } from '../features/catalog/size-facet';

const sizes = (n: number) => Array.from({ length: n }, (_, i) => ({ value: `pack ${i}`, count: i % 7 === 0 ? 50 + i : 1 }));

describe('usefulSizes (See all Size / Pack list)', () => {
  it('leaves a list up to the limit as it is', () => {
    const page = { total: 3, sizes: sizes(SIZE_LIST_MAX) };
    assert.equal(usefulSizes(page), page);
  });

  it('keeps the sizes with the most pieces, in their own order', () => {
    const page = { total: 3, sizes: sizes(1500) };
    const out = usefulSizes(page).sizes;
    assert.equal(out.length, SIZE_LIST_KEEP);
    const smallestKept = Math.min(...out.map((s) => s.count));
    assert.ok(page.sizes.filter((s) => !out.includes(s)).every((s) => s.count <= smallestKept));
    const order = out.map((s) => page.sizes.indexOf(s));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.equal(page.sizes.length, 1500, 'the read itself is untouched');
  });

  it('always keeps the sizes the address chose', () => {
    const out = usefulSizes({ sizes: sizes(1500) }, ['pack 1', 'pack 2', 'no such pack']).sizes.map((s) => s.value);
    assert.ok(out.includes('pack 1') && out.includes('pack 2'));
    assert.ok(!out.includes('no such pack'));
    assert.equal(out.length, SIZE_LIST_KEEP + 2);
  });
});
