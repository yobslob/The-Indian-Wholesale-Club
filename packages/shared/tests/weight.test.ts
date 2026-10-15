/**
 * D-129: the weight every price rests on. Read from the shop's own page (packed weight first), each with where it was
 * read; a page that names none gives none, never a guess.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatGrams, unusualWeight, weightState } from '../src/domain';
import { agreedWeight, bestWeight, packGrams, parseGrams, parseWeight, readWeights, type SourcedProduct } from '../src/sourcing';
import {
  buildListing,
  isSameItem,
  weightsFromOwnPage,
  weightsFromSimilar,
  type WeightPlanListing,
} from '../src/sourcing/auto';

describe('reading a weight from text (D-129)', () => {
  it('reads every unit the shops print', () => {
    assert.equal(parseWeight('500 g')?.grams, 500);
    assert.equal(parseWeight('250gm')?.grams, 250);
    assert.equal(parseWeight('1 kg')?.grams, 1000);
    assert.equal(parseWeight('0.45 Kilograms')?.grams, 450);
    assert.equal(parseWeight('500.0 gram')?.grams, 500);
    assert.equal(parseWeight('1 Pounds')?.grams, 454);
    assert.equal(parseWeight('16 oz')?.grams, 454);
    assert.deepEqual(parseWeight('Mustard oil 1 L'), { grams: 1000, liquid: true, multiplied: false });
  });
  it('reads thousands with a comma (it read "2,500 g" as 500 g)', () => {
    assert.equal(parseWeight('2,500 g')?.grams, 2500);
    assert.equal(parseGrams('Basmati rice 1,000 g'), 1000);
    assert.equal(packGrams('5,000 g'), 5000);
  });
  it('adds up packs of several (it priced "200 g (Pack of 2)" as 200 g)', () => {
    assert.deepEqual(parseWeight('2 x 500 g'), { grams: 1000, liquid: false, multiplied: true });
    assert.equal(parseWeight('200 g x 3')?.grams, 600);
    assert.equal(parseWeight("Haldiram's Aloo Bhujia 200g (Pack of 2)")?.grams, 400);
    assert.equal(parseWeight('Pack of 3 - Tea 250 g each')?.grams, 750);
    assert.equal(parseWeight('Bhujia 400 g total, pack of 2')?.grams, 400);
  });
  it('gives none for no weight, a count, nutrition or a combo of different weights', () => {
    assert.equal(parseWeight('Women Cotton Kurta Set with Dupatta'), null);
    assert.equal(parseWeight('1.0 count'), null);
    assert.equal(parseWeight('Sodium 20 mg'), null);
    assert.equal(parseWeight('Bhujia 400 g + Mixture 200 g'), null);
    assert.equal(parseWeight('5 large pieces'), null);
  });
});

describe("a shop page's weights, strongest first (D-129)", () => {
  const amazon = {
    title: 'Mother’s Recipe Mango Pickle 500 g',
    specs: [
      ['Net Quantity ‏', '‎ 500.0 gram'],
      ['Item Weight', '500 Grams'],
      ['Package Dimensions ‏', '‎ 12 x 10 x 10 cm; 780 g'],
      ['Brand', 'Mother’s Recipe'],
    ] as [string, string][],
  };
  it('takes the packed weight over the net weight: the courier weighs the jar', () => {
    const best = bestWeight(readWeights(amazon));
    assert.equal(best?.grams, 780);
    assert.equal(best?.kind, 'package');
    assert.match(best!.note, /^Package Dimensions: .*780 g$/);
    assert.equal(best?.differs, null, 'a jar of 780 g for 500 g of pickle is not a contradiction');
  });
  it('reads a kurta’s weight from Amazon’s dimensions line', () => {
    const best = bestWeight(
      readWeights({
        title: 'Women Rayon Kurta',
        specs: [['Product Dimensions', '30 x 25 x 3 cm; 280 g']],
      }),
    );
    assert.deepEqual([best?.grams, best?.kind], [280, 'item']);
  });
  it('falls back to the net quantity, then the title', () => {
    assert.equal(
      bestWeight(readWeights({ title: 'Masala', specs: [['Net Quantity', '100 g']] }))?.kind,
      'net',
    );
    assert.deepEqual(
      [bestWeight(readWeights({ title: 'MDH Kitchen King Masala, 500 g', specs: [] }))?.grams],
      [500],
    );
    assert.equal(bestWeight(readWeights({ title: 'Silk saree', specs: [] })), null);
  });
  it('flags a page that contradicts itself', () => {
    const best = bestWeight(
      readWeights({ title: 'Bhujia 1 kg', specs: [['Net Quantity', '200 g']] }),
    );
    assert.equal(best?.grams, 200);
    assert.match(best!.differs!.note, /^Title: Bhujia 1 kg/);
    const lighter = bestWeight(
      readWeights({
        title: 'Ghee',
        specs: [
          ['Item package weight', '0.5 Kilograms'],
          ['Net Quantity', '1 L'],
        ],
      }),
    );
    assert.ok(lighter?.differs, 'a packed weight lighter than its contents is a misread page');
  });
});

describe('weights from several pages and how far each is trusted (D-129)', () => {
  it('agrees when pages are within 30%, else none', () => {
    assert.equal(agreedWeight([300, 320, 280]), 300);
    assert.equal(agreedWeight([300]), 300);
    assert.equal(agreedWeight([300, 900]), null);
    assert.equal(agreedWeight([]), null);
  });
  it('tells confirmed, to check and missing apart', () => {
    assert.equal(weightState({ weight_g: null, weight_source: null }), 'missing');
    assert.equal(weightState({ weight_g: 450, weight_source: 'weighed' }), 'confirmed');
    assert.equal(weightState({ weight_g: 450, weight_source: 'shop' }), 'confirmed');
    assert.equal(weightState({ weight_g: 450, weight_source: 'similar' }), 'check');
    assert.equal(weightState({ weight_g: 450, weight_source: null }), 'check');
    assert.equal(weightState({ weight_g: 45, weight_source: 'shop' }, true), 'check');
  });
  it('finds clothing and home weights far from their category’s', () => {
    assert.equal(unusualWeight(45, 'clothing', 450), true);
    assert.equal(unusualWeight(5000, 'clothing', 450), true);
    assert.equal(unusualWeight(300, 'clothing', 450), false);
    assert.equal(unusualWeight(50, 'food', 600), false);
  });
  it('writes grams the way the admin reads them', () => {
    assert.equal(formatGrams(450), '450 g');
    assert.equal(formatGrams(1000), '1 kg');
    assert.equal(formatGrams(1250), '1.25 kg');
  });
});

describe('the runner’s weights (D-129)', () => {
  const kurta = (specs: [string, string][], title = 'Anouk Women Rayon Kurta'): SourcedProduct => ({
    url: 'https://www.amazon.in/dp/B0KURTA',
    site: 'amazon.in',
    title,
    brand: 'Anouk',
    description: '',
    bullets: [],
    specs,
    images: ['https://m.media-amazon.com/images/I/k.jpg'],
    pricePaise: 89900,
    mrpPaise: null,
    currency: 'INR',
    inStock: true,
    sizes: [],
    hints: [],
    variants: ['S', 'M'].map((size) => ({
      key: `B0K${size}`,
      url: `https://www.amazon.in/dp/B0K${size}`,
      label: size,
      options: { size },
      pricePaise: 89900,
      mrpPaise: null,
      inStock: true,
      weightG: null,
      image: null,
    })),
    deliveryText: 'FREE delivery Thursday',
  });
  const build = (product: SourcedProduct) =>
    buildListing({
      product,
      target: {
        id: '00000000-0000-4000-8000-000000000009',
        name: 'Rayon kurta',
        query: 'kurta',
        must_match: 'kurta',
        product_type: 'clothing',
        category: 'kurtas',
        region: null,
        tier: 1,
        sites: null,
        min_price_paise: null,
        max_price_paise: null,
        listings: null,
      },
      shop: { site: 'amazon.in', label: 'Amazon India', reader: 'amazon', product_types: ['clothing'], delivery_days: 3 },
      pageDays: 2,
      family: [],
      others: [],
      shops: [],
      maxDays: 3,
      now: new Date('2026-10-15T04:30:00Z'),
    });

  it('gives every size of a garment the weight its page states (clothing had none before)', () => {
    const draft = build(kurta([['Package Dimensions', '30 x 25 x 3 cm; 320 g']]));
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.deepEqual(
      draft.listing.variants.map((v) => [v.label, v.weight_g, v.weight_source]),
      [
        ['S', 320, 'shop'],
        ['M', 320, 'shop'],
      ],
    );
    assert.match(draft.listing.variants[0]!.weight_note!, /Package Dimensions/);
  });
  it('leaves a garment without a stated weight without one (never the title, never a guess)', () => {
    const draft = build(kurta([], 'Kurta with 2 kg of embroidery'));
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.deepEqual(draft.listing.variants.map((v) => v.weight_g), [null, null]);
  });

  const listing: WeightPlanListing = {
    product_id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Anouk Women Rayon Kurta',
    product_type: 'clothing',
    category_weight_g: 450,
    page_url: 'https://www.myntra.com/kurtas/anouk/1/buy',
    site: 'myntra.com',
    variants: [
      { id: '00000000-0000-4000-8000-0000000000b1', label: 'S', options: { size: 'S' }, weight_g: null, weight_source: null },
      { id: '00000000-0000-4000-8000-0000000000b2', label: 'M', options: { size: 'M' }, weight_g: 430, weight_source: 'weighed' },
    ],
    sources: [],
  };
  it('fills only the options still wanting a weight from the listing’s own page', () => {
    const writes = weightsFromOwnPage(listing, kurta([['Item Weight', '300 Grams']]));
    assert.deepEqual(
      writes.map((w) => [w.variant_id, w.weight_g, w.source]),
      [['00000000-0000-4000-8000-0000000000b1', 300, 'shop']],
    );
  });
  it('takes a matching item’s weight only when two pages agree', () => {
    const reading = (grams: number) => ({ grams, kind: 'item' as const, note: `${grams} g`, liquid: false });
    assert.deepEqual(weightsFromSimilar(listing, [{ site: 'amazon.in', title: 'x', reading: reading(310) }]), []);
    assert.deepEqual(
      weightsFromSimilar(listing, [
        { site: 'amazon.in', title: 'x', reading: reading(310) },
        { site: 'flipkart.com', title: 'y', reading: reading(290) },
      ]).map((w) => [w.variant_id, w.weight_g, w.source]),
      [['00000000-0000-4000-8000-0000000000b1', 290, 'similar']],
    );
    assert.deepEqual(
      weightsFromSimilar(listing, [
        { site: 'amazon.in', title: 'x', reading: reading(310) },
        { site: 'flipkart.com', title: 'y', reading: reading(900) },
      ]),
      [],
      'pages that disagree give nothing',
    );
  });
  it('tells the same item from another one', () => {
    assert.equal(isSameItem('Anouk Women Rayon Kurta', 'Anouk Women Rayon Printed Straight Kurta'), true);
    assert.equal(isSameItem('Anouk Women Rayon Kurta', 'Biba Cotton Saree'), false);
  });
});
