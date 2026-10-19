import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { INFO_LINKS, mediaUrl, safeNextPath } from '../lib/site';

describe('safeNextPath (no open redirects after sign-in)', () => {
  it('keeps same-site paths', () => {
    assert.equal(safeNextPath('/account/orders', '/account'), '/account/orders');
  });

  it('rejects other sites and protocol-relative URLs', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '',
      null,
    ]) {
      assert.equal(safeNextPath(bad, '/account'), '/account', String(bad));
    }
  });
});

describe('storefront links (D-006)', () => {
  it('never link to the admin', () => {
    assert.ok(INFO_LINKS.every((l) => !l.href.startsWith('/admin')));
  });
});

describe('mediaUrl', () => {
  it("builds the photo's address on the site (D-140) and encodes path segments", () => {
    assert.equal(mediaUrl('products/a b/1.jpg'), '/media/product-media/products/a%20b/1.jpg');
  });
});
