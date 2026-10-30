/**
 * Savana (D-171): its department list answer and a product page's data (fixtures saved from savana.com on 2026-10-31,
 * trimmed; one size marked sold out, one price lowered and one piece not for sale, to test them) read into offers and
 * products. Its pieces say "Country of Origin: PRC": listed as made in China, customers see "Imported". Its pages
 * have no wash care: it is given from the fabric where certain (D-172) and the rest is left out. And
 * `targets/savana.csv` walks every department's pages once.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildListing,
  parseTargetsCsv,
  savanaCollection,
  savanaHasNext,
  savanaIds,
  savanaListBody,
  savanaListOffers,
  savanaCare,
  savanaProduct,
  savanaProductUrl,
  type SourcingShop,
  type SourcingTarget,
} from '../src/sourcing/auto';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const URL_ = 'https://www.savana.com/details/co-ord-set-2111972';
const now = new Date('2026-10-31T06:00:00Z');

const shop: SourcingShop = {
  site: 'savana.com',
  label: 'Savana',
  reader: 'savana',
  product_types: ['clothing'],
  delivery_days: 10,
};
const target: SourcingTarget = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Savana co-ords (pages 1–2)',
  query: 'collection:12859 pages:1-2',
  must_match: null,
  product_type: 'clothing',
  category: 'co-ords-and-dresses',
  region: null,
  tier: 1,
  sites: ['savana.com'],
  min_price_paise: null,
  max_price_paise: null,
  listings: 40,
};

describe('Savana departments as targets', () => {
  it('reads "collection:<activity> pages:a-b"', () => {
    assert.deepEqual(savanaCollection('collection:12825 pages:4-6'), { activity: '12825', from: 4, to: 6 });
    assert.equal(savanaCollection('collection:dresses'), null);
    assert.deepEqual(savanaListBody('12825', 2, [1, 2]).visitedGoodsIdList, [1, 2]);
    assert.equal(savanaProductUrl('Ruffle Bodycon Dress', 2446392), 'https://www.savana.com/details/ruffle-bodycon-dress-2446392');
  });

  it('makes offers of a list answer: the selling price, the struck price as MRP, pieces not for sale out of stock', () => {
    const json = fixture('savana-list.json');
    const offers = savanaListOffers(json);
    assert.deepEqual(savanaIds(json), [2446392, 2441952, 2395742]);
    assert.equal(savanaHasNext(json), true);
    assert.deepEqual(
      offers.map((o) => [o.key, o.title, o.pricePaise, o.mrpPaise, o.inStock]),
      [
        ['2446392', "Women's Ruffle Bodycon Dress", 159_000, null, true],
        ['2441952', "Women's Gathered Cocktail Dress", 129_000, 149_000, true],
        ['2395742', "Women's Sheer Bodycon Dress", 229_000, null, false],
      ],
    );
    assert.equal(offers[0]!.url, 'https://www.savana.com/details/ruffle-bodycon-dress-2446392');
    assert.match(offers[0]!.image!, /^https:\/\/img201\.savana\.com\//);
    assert.deepEqual(savanaListOffers({ data: {} }), []);
    assert.equal(savanaHasNext({ data: { hasNextPage: false } }), false);
  });
});

describe('Savana product pages', () => {
  const p = savanaProduct(fixture('savana-product.json'), `${URL_}?spm=x`)!;

  it('reads one variant per colour and size, priced and stocked per size, and its photos', () => {
    assert.equal(p.url, URL_);
    assert.equal(p.title, "Women's Co-ord Set");
    assert.equal(p.images.length, 5);
    assert.equal(p.deliveryText, null);
    assert.deepEqual(
      p.variants.map((v) => [v.key, v.label, v.pricePaise, v.mrpPaise, v.inStock]),
      [
        ['1136347', 'Apricot · M', 160_600, 189_000, true],
        ['1136346', 'Apricot · S', 160_600, 189_000, true],
        ['1136349', 'Apricot · XL', 160_600, 189_000, false],
        ['1136348', 'Apricot · L', 160_600, 189_000, true],
      ],
    );
  });

  it('keeps its fabric and stated origin, never who imported it (D-003)', () => {
    const spec = (k: string) => p.specs.find(([key]) => key === k)?.[1];
    assert.equal(spec('Fabric'), 'Twill Woven');
    assert.equal(spec('Country of origin'), 'PRC');
    assert.ok(!p.specs.some(([k, v]) => /envogue|imported|marketed/i.test(`${k} ${v}`)));
  });

  it('is listed as made in China, complete with the care its fabric makes certain (D-172)', () => {
    const draft = buildListing({ product: p, target, shop, pageDays: null, family: [], others: [], shops: [shop], maxDays: 3, now });
    assert.ok('listing' in draft);
    assert.equal(draft.madeIn, 'China');
    assert.equal(draft.complete, true);
    assert.deepEqual(draft.listing.attributes, {
      fibre_content: 'Twill Woven',
      care: 'Hand wash cold. Do not bleach or wring. Dry in the shade.',
    });
    assert.ok(/^Women's /.test(draft.listing.name) && !/savana/i.test(draft.listing.name));
    // its 10 days pass Settings' 3 days only on its own shop
    const strict = buildListing({ product: p, target, shop: { ...shop, delivery_days: 3 }, pageDays: 10, family: [], others: [], shops: [shop], maxDays: 3, now });
    assert.deepEqual(strict, { skip: 'delivery takes 10 days' });
  });

  it('leaves out a piece whose care is not certain, instead of a draft', () => {
    const velvet = structuredClone(fixture('savana-product.json')) as {
      aboutProduct: { aboutProductDetail: { key: string; value: string }[] };
    };
    velvet.aboutProduct.aboutProductDetail[0]!.value = 'Velvet';
    const piece = savanaProduct(velvet, URL_)!;
    const draft = buildListing({ product: piece, target, shop, pageDays: null, family: [], others: [], shops: [shop], maxDays: 3, now });
    assert.deepEqual(draft, { skip: 'not sure of its care' });
  });

  it('reads nothing from a page without its data', () => {
    assert.equal(savanaProduct(null, URL_), null);
    assert.equal(savanaProduct({}, URL_), null);
  });
});

describe('targets/savana.csv', () => {
  const csv = readFileSync(
    new URL('../../../tools/sourcing-runner/targets/savana.csv', import.meta.url),
    'utf8',
  );
  const { rows, errors } = parseTargetsCsv(csv);

  it('uploads whole: Savana only, clothing, 40 listings each, no band', () => {
    assert.deepEqual(errors, []);
    for (const r of rows) {
      assert.deepEqual(r.shops, ['savana']);
      assert.equal(r.product_type, 'clothing');
      assert.equal(r.listings, 40);
      assert.equal(r.min_price_paise, null);
      assert.ok(savanaCollection(r.query), r.query);
    }
  });

  it('walks each department once, from page 1 with no gap', () => {
    const byActivity = new Map<string, { from: number; to: number }[]>();
    for (const r of rows) {
      const c = savanaCollection(r.query)!;
      byActivity.set(c.activity, [...(byActivity.get(c.activity) ?? []), c]);
    }
    for (const [activity, ranges] of byActivity) {
      let next = 1;
      for (const c of ranges) {
        assert.equal(c.from, next, activity);
        next = c.to + 1;
      }
    }
  });
});

describe('Savana care (D-172): given where the material leaves no doubt, never guessed', () => {
  const care = (name: string, ...rows: [string, string][]) => savanaCare(name, rows);
  it('clothing by its fabric', () => {
    assert.match(care('High Waist Wide Leg Jeans', ['Material', 'Cotton'], ['Fabric', 'Denim'])!, /^Machine wash cold, inside out/);
    assert.match(care('Pullover T-Shirt', ['Fabric', 'Flat Jersey'])!, /^Machine wash cold on a gentle cycle/);
    assert.match(care('Cable Knit Pullover', ['Fabric', 'Cable'])!, /^Hand wash cold\. Do not wring\. Dry flat/);
    assert.match(care('Sheer Bodycon Dress', ['Fabric', 'Mesh'])!, /^Hand wash cold\. Do not bleach or wring/);
    assert.match(care('Gym Legging', ['Material', 'Nylon'])!, /^Machine wash cold, inside out\. Do not bleach, iron/);
  });
  it('accessories by their material', () => {
    assert.match(care('Rhinestone Stud Earrings', ['Elements', 'Rhinestone'], ['Material', 'Alloy'])!, /^Keep dry/);
    assert.match(care('Metal Detail Shoulder Bag', ['Fabric', 'PU'], ['Material', 'Polyurethane'])!, /^Wipe clean/);
    assert.match(care('Retro Sunglasses', ['Material', 'Polycarbonate'])!, /lenses/);
    assert.match(care('Alphabet Baseball Cap', ['Fabric', 'Twill Woven'])!, /^Spot clean/);
  });
  it('nothing where it is not certain', () => {
    for (const [name, ...rows] of [
      ['Button Classic Blazer', ['Fabric', 'Twill Woven']],
      ['Pea Coat', ['Fabric', 'Faux Wool Blend']],
      ['Utility Jacket', ['Fabric', 'Suede']],
      ['Lounge Set', ['Fabric', 'Velvet']],
      ['Gathered Top', ['Design Detail', 'Metallic Decor'], ['Fabric', 'Textured']],
      ['Sports Legging'],
      ['False Fringe', ['Material', 'Synthetic fiber']],
      ['Leopard Totes Bag', ['Fabric', 'Faux fur']],
    ] as [string, ...[string, string][]][])
      assert.equal(care(name, ...rows), null, name);
  });
});
