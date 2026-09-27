import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getWishlistIdsAfterToggle } from '../lib/store/wishlist';

describe('mobile wishlist state', () => {
  it('adds and removes a product without duplicates', () => {
    assert.deepEqual(getWishlistIdsAfterToggle([], 'prod-1'), ['prod-1']);
    assert.deepEqual(getWishlistIdsAfterToggle(['prod-1'], 'prod-1'), []);
  });

  it('preserves other saved products', () => {
    assert.deepEqual(getWishlistIdsAfterToggle(['prod-1', 'prod-2'], 'prod-2'), ['prod-1']);
    assert.deepEqual(getWishlistIdsAfterToggle(['prod-1'], 'prod-2'), ['prod-1', 'prod-2']);
  });
});
