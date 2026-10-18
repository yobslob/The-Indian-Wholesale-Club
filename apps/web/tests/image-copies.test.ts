import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { copyFor, hasCopies } from '../lib/image-copies';

const base = 'https://x.supabase.co/storage/v1/object/public/product-media/products/p1';

describe('photos from their fixed copies (D-140)', () => {
  it('serves a photo in a c/ folder from the copy the width asks for', () => {
    assert.equal(hasCopies(`${base}/c/abc.jpg`), true);
    assert.equal(hasCopies(`${base}/abc.jpg`), false);
    assert.equal(copyFor(`${base}/c/abc.jpg`, 300), `${base}/c/abc.w320.webp`);
    assert.equal(copyFor(`${base}/c/abc.jpg`, 641), `${base}/c/abc.w1280.webp`);
    assert.equal(copyFor(`${base}/c/abc.jpg`, 3840), `${base}/c/abc.w1280.webp`);
  });

});
