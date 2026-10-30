/**
 * NEWME (D-170, D-171): its collection and product pages' own data (fixtures saved from newme.asia on 2026-10-31,
 * trimmed) read into offers and products. Every piece is taken: one made in India is listed as made in India, one
 * whose page says PRC as made in China (customers see "Imported"), one whose page says nothing never. Every size in
 * stock counts, NEWME's 10 days to the hub apply. And `targets/newme.csv` uploads whole and reads every page once.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildListing,
  countryName,
  newmeCollection,
  newmeCollectionUrl,
  newmePieces,
  newmeProduct,
  newmeSearchOffers,
  parseTargetsCsv,
  pickCandidates,
  type SourcingShop,
  type SourcingTarget,
} from '../src/sourcing/auto';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const URL_ = 'https://newme.asia/product/black-cowl-neck-midi-dress-2';
const now = new Date('2026-10-31T06:00:00Z');

const shop: SourcingShop = {
  site: 'newme.asia',
  label: 'NEWME',
  reader: 'newme',
  product_types: ['clothing'],
  delivery_days: 10,
};
const target: SourcingTarget = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'NEWME dresses (pages 1–2)',
  query: 'collection:dresses pages:1-2',
  must_match: null,
  product_type: 'clothing',
  category: 'co-ords-and-dresses',
  region: null,
  tier: 1,
  sites: ['newme.asia'],
  min_price_paise: null,
  max_price_paise: null,
  listings: 40,
};

/** The fixture's product with some of its fields changed. */
function product(change: (p: Record<string, unknown>) => void = () => undefined) {
  const data = structuredClone(fixture('newme-product.json')) as {
    props: { pageProps: { productData: Record<string, unknown>[] } };
  };
  change(data.props.pageProps.productData[0]!);
  return newmeProduct(data, `${URL_}?utm_source=x`);
}

const listed = (p: NonNullable<ReturnType<typeof newmeProduct>>, on: SourcingShop = shop) =>
  buildListing({ product: p, target, shop: on, pageDays: null, family: [], others: [], shops: [on], maxDays: 3, now });

describe('NEWME collections as targets', () => {
  it('reads "collection:<handle> pages:a-b", ten pages at most', () => {
    assert.deepEqual(newmeCollection('collection:dresses pages:3-4'), { handle: 'dresses', from: 3, to: 4 });
    assert.deepEqual(newmeCollection('collection:Tops'), { handle: 'tops', from: 1, to: 1 });
    assert.deepEqual(newmeCollection('collection:tops pages:1-40'), { handle: 'tops', from: 1, to: 10 });
    assert.equal(newmeCollection('women dresses'), null);
    assert.equal(
      newmeCollectionUrl('jumpsuits/bodysuits', 2),
      'https://newme.asia/womens-collection/jumpsuits%2Fbodysuits?p=2',
    );
  });

  it('makes an offer of every piece, made in India or not, priced from its sizes in stock', () => {
    const data = fixture('newme-collection.json');
    const offers = newmeSearchOffers(data);
    assert.equal(newmePieces(data), 3);
    assert.deepEqual(
      offers.map((o) => o.key),
      ['11593395', '6217920', '9668683'],
    );
    const [wine, blue] = offers;
    assert.equal(wine!.url, 'https://newme.asia/product/wine-floral-slit-midi-dress-4');
    assert.equal(wine!.title, "Women's Wine Floral Slit Midi Dress");
    assert.equal(wine!.pricePaise, 154_900);
    assert.equal(wine!.mrpPaise, 184_900);
    assert.equal(wine!.inStock, true);
    assert.equal(wine!.deliveryText, null);
    assert.equal(blue!.pricePaise, 54_900);
    assert.match(blue!.image!, /^https:\/\/assets\.newme\.asia\//);
  });

  it('NEWME pieces come in its 10 days, past Settings\' 3: they are candidates', () => {
    const offers = newmeSearchOffers(fixture('newme-collection.json'));
    const picked = pickCandidates(target, offers, [shop], { maxDays: 3, known: new Set(), now, limit: 40 });
    assert.equal(picked.length, 3);
    const late = pickCandidates(target, offers, [{ ...shop, delivery_days: 14 }], {
      maxDays: 3,
      known: new Set(),
      now,
      limit: 40,
    });
    assert.equal(late.length, 3, "a shop's own days are its limit");
  });

  it('reads nothing from a page without its data', () => {
    assert.deepEqual(newmeSearchOffers(null), []);
    assert.equal(newmePieces({ props: {} }), 0);
  });
});

describe('NEWME product pages', () => {
  it('reads one variant per size in stock, its colour, photos and the details customers need', () => {
    const p = product()!;
    assert.equal(p.url, URL_);
    assert.equal(p.title, "Women's Black Cowl Neck Midi Dress");
    assert.equal(p.images.length, 4);
    assert.equal(p.deliveryText, null);
    assert.deepEqual(
      p.variants.map((v) => [v.key, v.label, v.pricePaise, v.inStock]),
      [
        ['11577789', 'Black · XS', 119_900, true],
        ['11577790', 'Black · S', 119_900, true],
        // a size NEWME sends in 12 – 14 days to its pincode counts too: the founder's 10 days to the hub (D-171)
        ['11577791', 'Black · M', 119_900, true],
        ['11577792', 'Black · L', 119_900, true],
        ['11577793', 'Black · XL', 119_900, true],
      ],
    );
    const spec = (k: string) => p.specs.find(([key]) => key === k)?.[1];
    assert.equal(spec('Fabric'), 'Polyester');
    assert.equal(spec('Wash care'), 'Machine Wash');
    assert.equal(spec('Country of origin'), 'India');
    // "N/a" rows and who made or marketed it are never kept
    assert.ok(!p.specs.some(([, v]) => /n\/a|fraicheur|bangalore/i.test(v)));
  });

  it('lists a piece made in India as made in India, with its fabric and care', () => {
    const draft = listed(product()!);
    assert.ok('listing' in draft);
    assert.equal(draft.madeIn, 'India');
    assert.equal(draft.complete, true);
    assert.deepEqual(draft.listing.attributes, { fibre_content: 'Polyester', care: 'Machine Wash' });
    assert.equal(draft.listing.variants.length, 5);
    assert.ok(/^Women's /.test(draft.listing.name) && !/newme/i.test(draft.listing.name));
  });

  it('lists a piece made in China as imported (D-171), and never one whose page does not say', () => {
    const china = listed(product((p) => (p.country_of_origin = 'PRC'))!);
    assert.ok('listing' in china);
    assert.equal(china.madeIn, 'China');
    const unsaid = listed(product((p) => delete p.country_of_origin)!);
    assert.ok('skip' in unsaid && /not India/.test(unsaid.skip));
    // a shop not taken whole still lists only what is made in India (D-004)
    const myntra = listed(product((p) => (p.country_of_origin = 'PRC'))!, { ...shop, reader: 'myntra', site: 'myntra.com' });
    assert.deepEqual(myntra, { skip: 'made in PRC, not India' });
  });

  it('names countries as customs reads them', () => {
    assert.equal(countryName('PRC'), 'China');
    assert.equal(countryName("People's Republic of China"), 'China');
    assert.equal(countryName('Bangladesh'), 'Bangladesh');
    assert.equal(countryName('not stated'), '');
  });

  it('reads nothing from a page without its data', () => {
    assert.equal(newmeProduct({ props: { pageProps: {} } }, URL_), null);
  });
});

describe('targets/newme.csv', () => {
  const csv = readFileSync(
    new URL('../../../tools/sourcing-runner/targets/newme.csv', import.meta.url),
    'utf8',
  );
  const { rows, errors } = parseTargetsCsv(csv);

  it('uploads whole: NEWME only, clothing, 40 listings each, no band', () => {
    assert.deepEqual(errors, []);
    for (const r of rows) {
      assert.deepEqual(r.shops, ['newme']);
      assert.equal(r.product_type, 'clothing');
      assert.equal(r.listings, 40);
      assert.equal(r.min_price_paise, null);
      assert.equal(r.max_price_paise, null);
      assert.ok(newmeCollection(r.query), r.query);
    }
  });

  it('reads each page of a collection once, from page 1 with no gap', () => {
    const byHandle = new Map<string, { from: number; to: number }[]>();
    for (const r of rows.filter((r) => !r.must_match)) {
      const c = newmeCollection(r.query)!;
      byHandle.set(c.handle, [...(byHandle.get(c.handle) ?? []), c]);
    }
    assert.ok(byHandle.size >= 5);
    for (const [handle, ranges] of byHandle) {
      let next = 1;
      for (const c of ranges) {
        assert.equal(c.from, next, handle);
        next = c.to + 1;
      }
    }
  });
});
