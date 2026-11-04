import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { centsToDecimal, productJsonLdText, productMetadata } from '../app/(store)/states/[region]/[product]/product-seo';

import type { ProductPage } from '@repo/db/store';

const BASE = 'https://indianwholesaleclub.com';
const P = '0b6a6c2e-1f3d-4c1a-9a51-2c7d1f7e9a01';
const variant = (id: string, price: number, available: number) => ({
  id,
  product_id: P,
  label: id.slice(0, 1),
  options: {},
  price_cents: price,
  available,
  sort_order: 0,
  heavy_cents: 0,
});

function page(over: Partial<ProductPage['product']> = {}, variants = [variant('a1b2c3d4-0000-4000-8000-000000000001', 1630, 2)]): ProductPage {
  return {
    product: {
      id: P,
      slug: 'kasavu-saree',
      name: 'kasavu cotton saree',
      product_type: 'clothing',
      region_slug: 'kerala',
      region_name: 'Kerala',
      category_slug: 'sarees',
      category_name: 'Sarees',
      price_cents: 1630,
      primary_image_path: 'products/p1/s/abc.jpg',
      region_id: null,
      category_id: P,
      summary: 'Handwoven cotton with a gold border.',
      description: null,
      story: null,
      craft: null,
      attributes: {},
      published_at: '2026-10-20T10:00:00Z',
      is_us_stock: false,
      made_in_india: true,
      ...over,
    },
    variants,
    media: [],
    similar: [],
    curated: [],
    ships_from_us: null,
    quick_delivery: null,
    reviews: { count: 0, average: null, histogram: {}, items: [] },
    delivery: null,
  } as ProductPage;
}

describe('product metadata and JSON-LD (E-2a, E-2b)', () => {
  it('gives the canonical, the title in title case, the summary and a JPEG share photo', () => {
    const m = productMetadata(page());
    assert.equal(m.title, 'Kasavu Cotton Saree');
    assert.equal(m.description, 'Handwoven cotton with a gold border.');
    assert.deepEqual(m.alternates, { canonical: '/states/kerala/kasavu-saree' });
    const og = JSON.stringify(m.openGraph);
    assert.ok(og.includes('/media/jpeg/product-media/products/p1/s/abc.w1200.avif?w=1200'));
    assert.ok(og.includes('$16.30'));
  });

  it('prices offers from integer cents with availability, and an aggregate when options differ', () => {
    assert.equal(centsToDecimal(1630), '16.30');
    assert.equal(centsToDecimal(5), '0.05');
    const one = JSON.parse(productJsonLdText(page(), BASE));
    const offer = one['@graph'][0].offers;
    assert.deepEqual([offer['@type'], offer.price, offer.priceCurrency, offer.availability], ['Offer', '16.30', 'USD', 'https://schema.org/InStock']);
    const two = JSON.parse(
      productJsonLdText(page({}, [variant('a1b2c3d4-0000-4000-8000-000000000001', 1630, 0), variant('a1b2c3d4-0000-4000-8000-000000000002', 2100, 0)]), BASE),
    );
    const agg = two['@graph'][0].offers;
    assert.deepEqual([agg['@type'], agg.lowPrice, agg.highPrice, agg.availability], ['AggregateOffer', '16.30', '21.00', 'https://schema.org/OutOfStock']);
  });

  it('says the origin only as the page does, and an all-India piece has no state in its breadcrumb', () => {
    const india = JSON.parse(productJsonLdText(page({ region_slug: null, region_name: null }), BASE));
    assert.equal(india['@graph'][1].itemListElement[1].item, `${BASE}/clothing`);
    assert.equal(india['@graph'][0].url, `${BASE}/states/india/kasavu-saree`);
    const imported = JSON.parse(productJsonLdText(page({ made_in_india: false }), BASE));
    assert.equal(imported['@graph'][0].countryOfOrigin, undefined);
  });

  it('carries no shop, source or brand field, and escapes < in product text', () => {
    const text = productJsonLdText(page({ summary: '</script><b>x' }), BASE);
    assert.ok(!text.includes('</script>'));
    assert.ok(!/brand|vendor|shop|source/i.test(text));
  });
});
