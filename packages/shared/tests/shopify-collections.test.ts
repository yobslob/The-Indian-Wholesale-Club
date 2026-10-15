/**
 * A Shopify shop's whole collection as a target ("collection:kurtis"): Shopify's search stops at 10 results, its
 * collection JSON lists up to 250 (Nishorama's 211 kurtis, 2026-10-16). The collection is the target: every piece in
 * it matches.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  parseTargetsCsv,
  shopifyCollection,
  shopifySearchOffers,
  shopifySearchUrl,
  targetMatcher,
  type SourcingTarget,
} from '../src/sourcing/auto';

const target = (query: string, must_match: string | null = null): SourcingTarget => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Nishorama kurtis',
  query,
  must_match,
  product_type: 'clothing',
  category: 'kurtas',
  region: null,
  tier: 1,
  sites: ['nishorama.com'],
  min_price_paise: null,
  max_price_paise: null,
  listings: 40,
});

describe('Shopify collections as targets', () => {
  it('reads "collection:<handle>" as the collection, anything else as search words', () => {
    assert.equal(shopifyCollection('collection:Short-Kurti'), 'short-kurti');
    assert.equal(shopifyCollection('short kurti'), null);
    assert.equal(
      shopifySearchUrl('nishorama.com', 'collection:kurtis'),
      'https://nishorama.com/collections/kurtis/products.json?limit=250',
    );
    assert.match(shopifySearchUrl('nishorama.com', 'kurti'), /\/search\/suggest\.json\?q=kurti/);
  });

  it("makes an offer of each product: the cheapest size in stock, its first photo", () => {
    const offers = shopifySearchOffers(
      {
        products: [
          {
            handle: 'risa-kurti',
            title: 'Risa Bell Sleeves Kurti',
            vendor: 'Nishorama',
            variants: [
              { price: '1495.00', compare_at_price: '1995.00', available: true },
              { price: '1295.00', compare_at_price: null, available: false },
            ],
            images: [{ src: '//cdn.shopify.com/risa.jpg' }],
          },
          { handle: 'gone', title: 'Sold out kurti', variants: [{ price: '999.00', available: false }], images: [] },
        ],
      },
      'nishorama.com',
    );
    assert.equal(offers.length, 2);
    assert.deepEqual(
      [offers[0]!.url, offers[0]!.pricePaise, offers[0]!.mrpPaise, offers[0]!.inStock, offers[0]!.image],
      ['https://nishorama.com/products/risa-kurti', 149500, 199500, true, 'https://cdn.shopify.com/risa.jpg'],
    );
    assert.equal(offers[1]!.inStock, false);
  });

  it('takes every piece in the collection, even one whose name has another garment word', () => {
    const m = targetMatcher(target('collection:kurtis'));
    assert.equal(m.matches('Yug Long Kurta'), true, '"kurta" would be a different form for a kurti search');
    assert.equal(m.relevance('Anything'), 1);
    assert.equal(targetMatcher(target('collection:kurtis', 'kurti')).matches('Yug Long Kurta'), false);
  });

  it('reads the Nishorama target list', () => {
    const csv = readFileSync(new URL('../../../tools/sourcing-runner/targets/nishorama.csv', import.meta.url), 'utf8');
    const { rows, errors } = parseTargetsCsv(csv);
    assert.deepEqual(errors, []);
    assert.equal(rows.length, 18);
    assert.ok(rows.every((r) => r.shops.join() === 'nishorama' && r.query.startsWith('collection:') && r.listings === 40));
  });
});
