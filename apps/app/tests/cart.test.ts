import './storage-stub';

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { bagCount, bagSubtotalCents, MAX_QTY_PER_LINE, useBag } from '../features/cart/store';

import type { BagLine } from '../features/cart/store';

const saree: Omit<BagLine, 'quantity'> = {
  variantId: 'v-saree',
  productId: 'p-saree',
  productName: 'Saree',
  productSlug: 'saree',
  regionSlug: 'kerala',
  regionName: 'Kerala',
  variantLabel: 'Free size',
  unitPriceCents: 12900,
  imagePath: null,
};

describe('app bag', () => {
  beforeEach(() => useBag.getState().clear());

  it('adds, merges the same variant and caps a line at the server limit', () => {
    const bag = useBag.getState();
    bag.add(saree, 2);
    bag.add(saree, 3);
    assert.equal(useBag.getState().lines.length, 1);
    assert.equal(useBag.getState().lines[0]?.quantity, 5);
    bag.add(saree, 50);
    assert.equal(useBag.getState().lines[0]?.quantity, MAX_QTY_PER_LINE);
  });

  it('removes a line at quantity 0 and totals in integer cents', () => {
    const bag = useBag.getState();
    bag.add(saree, 2);
    bag.add({ ...saree, variantId: 'v-2', unitPriceCents: 499 }, 3);
    assert.equal(bagCount(useBag.getState().lines), 5);
    assert.equal(bagSubtotalCents(useBag.getState().lines), 2 * 12900 + 3 * 499);
    bag.setQuantity('v-saree', 0);
    assert.deepEqual(
      useBag.getState().lines.map((l) => l.variantId),
      ['v-2'],
    );
  });
});

describe('app bag across restarts (B-16)', () => {
  it('saves the lines on the device as they change', async () => {
    const { storedValues } = await import('./storage-stub');
    useBag.getState().clear();
    useBag.getState().add(saree, 2);
    await new Promise((r) => setTimeout(r, 10));
    const saved = JSON.parse(storedValues.get('iwc-bag') ?? '{}') as { state?: { lines?: BagLine[] } };
    assert.equal(saved.state?.lines?.[0]?.variantId, 'v-saree');
    assert.equal(saved.state?.lines?.[0]?.quantity, 2);
  });
});
