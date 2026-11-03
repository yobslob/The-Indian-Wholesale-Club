import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { indexXml, partNames, productPart, STATIC_PATHS, urlsetXml } from '../app/sitemaps/sitemap-data';

describe('sitemap parts (E-2d)', () => {
  it('has one products part per 5,000 listings, and at least one', () => {
    assert.deepEqual(partNames(0), ['pages', 'products-0']);
    assert.deepEqual(partNames(5000), ['pages', 'products-0']);
    assert.deepEqual(partNames(8032), ['pages', 'products-0', 'products-1']);
  });

  it('reads only products-<n>.xml as a products part', () => {
    assert.equal(productPart('products-1.xml'), 1);
    for (const name of ['products-1', 'products-x.xml', 'pages.xml', '../products-1.xml', 'products-1234.xml']) {
      assert.equal(productPart(name), null, name);
    }
  });

  it('writes escaped XML with lastmod only when known, and never the admin', () => {
    const xml = urlsetXml([{ loc: 'https://x.test/a?b=1&c=2', lastmod: '2026-11-03' }, { loc: 'https://x.test/b' }]);
    assert.ok(xml.includes('<loc>https://x.test/a?b=1&amp;c=2</loc><lastmod>2026-11-03</lastmod>'));
    assert.ok(xml.includes('<url><loc>https://x.test/b</loc></url>'));
    assert.ok(indexXml([{ loc: 'https://x.test/sitemaps/pages.xml' }]).includes('<sitemapindex'));
    assert.ok(STATIC_PATHS.every((p) => !p.startsWith('/admin') && !p.startsWith('/search')));
  });
});
