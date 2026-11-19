/**
 * D-202: food weights from where they are written: a pack's "Net Wt." words (labels, shop bullets, descriptions,
 * English and Hindi), the label reader's two readings of a photo, and the price check for estimates far off.
 * The label text is Deepak Jau Sattu's back panel (estimated 140 g; its label says 500 g).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { latinNumbers, readNet } from '../src/sourcing';
import { foodPageNet, weightsFromSimilar, type WeightPlanListing } from '../src/sourcing/auto';
import {
  agreed,
  checkPrices,
  decideLabel,
  foodNet,
  indexReferences,
  labelMatches,
  labelWrites,
  priceCheckWrites,
  priceReferences,
  snapToPack,
  type FoodPriceListing,
  type LabelListing,
  type PhotoReading,
} from '../src/sourcing/estimate';

const SATTU_BACK = `OUR OTHER PRODUCTS: GOLD ATTA • CHAKKI FRESH ATTA • BESAN • SOOJI • MAIDA
INGREDIENT:- JAU (BARLEY)
NUTRITIONAL INFORMATION (APPROX VALUE) Serving Per Package:- 20  Serving Size:- 25 g
Average Qty per 100 g  Per Serve 25 g
Energy kcal 360.00
NET WEIGHT : 500 g
M.R.P. Rs : ₹
USP Rs. Per g : ₹
PACKED ON :`;

const total = (parts: ReturnType<typeof readNet>): number | null =>
  parts ? parts.reduce((g, p) => g + p.unitGrams * p.count, 0) : null;

describe("a pack's net quantity words (D-202)", () => {
  it("reads the label's net weight, not its serving size or per 100 g", () => {
    assert.equal(total(readNet(SATTU_BACK)), 500);
    assert.equal(readNet('Serving Size:- 25 g  per 100 g'), null);
  });

  it('reads the spellings packs and shops use', () => {
    assert.equal(total(readNet('Net Wt. 200g')), 200);
    assert.equal(total(readNet('NET QTY: 1 KG')), 1000);
    assert.equal(total(readNet('Net Quantity - 2 x 200 g (400 g)')), 400);
    assert.equal(total(readNet('Net Contents: 400 ml')), 400);
    assert.equal(
      total(readNet('Net weight (g): 150')),
      null,
      'a number with no unit after it is no weight',
    );
    assert.equal(total(readNet('Net Wt 200g + 50g free')), 250);
    assert.equal(readNet('Cabinet weight 2 kg'), null, 'only the word net on its own');
  });

  it('reads Hindi labels and Devanagari digits', () => {
    assert.equal(latinNumbers('५०० ग्राम'), '500 g');
    assert.equal(total(readNet('नेट वजन : ५०० ग्राम')), 500);
    assert.equal(total(readNet('शुद्ध भार 1 कि.ग्रा.')), 1000);
  });

  it("a description's net line gives a food option its net quantity", () => {
    const net = foodNet(
      {
        name: 'Deepak Jau Sattu',
        description: 'Roasted barley flour. Net Wt: 500 g. Serving size 25 g.',
      },
      {
        label: 'One size',
        options: {},
        weight_source: 'estimated',
        weight_note: 'Estimated 140 g',
      },
    );
    assert.equal(net?.label, '500 g');
    assert.equal(net?.from, 'its description');
  });

  it("a food page's net quantity comes before its item weight, from its rows, bullets or description", () => {
    const base = {
      title: 'Deepak Jau Sattu',
      specs: [] as [string, string][],
      bullets: [] as string[],
      description: '',
    };
    assert.deepEqual(
      foodPageNet({
        ...base,
        specs: [
          ['Item Weight', '520 g'],
          ['Net Quantity', '500.0 gram'],
        ],
      })?.grams,
      500,
    );
    assert.equal(
      foodPageNet({ ...base, specs: [['Net Quantity', '1.00 count']] }),
      null,
      '"1 count" is no weight',
    );
    const fromBullet = foodPageNet({
      ...base,
      bullets: ['Pure roasted barley', 'Net Wt: 500g pouch'],
    });
    assert.equal(fromBullet?.grams, 500);
    assert.equal(fromBullet?.kind, 'net');
    assert.equal(fromBullet?.note, 'Net Quantity: 500 g');
  });

  it("matching items that agree on a net quantity replace a food estimate, never clothing's", () => {
    const listing: WeightPlanListing = {
      product_id: '00000000-0000-4000-8000-000000000001',
      name: 'Deepak Jau Sattu',
      product_type: 'food',
      category_weight_g: 200,
      page_url: null,
      site: null,
      variants: [
        {
          id: '00000000-0000-4000-8000-0000000000a1',
          label: 'One size',
          options: {},
          weight_g: 140,
          weight_source: 'estimated',
        },
      ],
      sources: [],
    };
    const found = ['amazon.in', 'flipkart.com'].map((site) => ({
      site,
      title: 'Deepak Jau Sattu 500 g',
      reading: { grams: 500, kind: 'net' as const, note: 'Net Quantity: 500 g', liquid: false },
    }));
    assert.equal(weightsFromSimilar(listing, found)[0]?.weight_g, 500);
    const kinds = found.map((f) => ({ ...f, reading: { ...f.reading, kind: 'item' as const } }));
    assert.equal(
      weightsFromSimilar(listing, kinds).length,
      0,
      'item weights (with the pack) only fill a missing one',
    );
  });
});

const VID = '00000000-0000-4000-8000-0000000000b1';
function labelListing(variants: Partial<LabelListing['variants'][number]>[] = [{}]): LabelListing {
  return {
    product_id: '00000000-0000-4000-8000-000000000002',
    name: 'Deepak Jau Sattu',
    category: 'masala-blends',
    shop_price_paise: 8700,
    variants: variants.map((v, i) => ({
      id: i === 0 ? VID : `00000000-0000-4000-8000-0000000000b${i + 2}`,
      label: 'One size',
      options: {},
      weight_g: 140,
      weight_source: 'estimated',
      net_qty: null,
      is_active: true,
      shop_price_paise: 8700,
      ...v,
    })),
    photos: [],
  };
}
const photo = (
  answer: string | null,
  transcript: string | null,
  variant_id: string | null = null,
): PhotoReading => ({
  path: 'products/p/s/a.jpg',
  variant_id,
  answer:
    answer === null
      ? { shows_net_quantity: false, net_quantity: null }
      : { shows_net_quantity: true, net_quantity: answer },
  transcript,
});

describe("the label reader's decision (D-202)", () => {
  it("writes the label's net weight when both readers agree", () => {
    const results = decideLabel(labelListing(), [
      photo(null, 'DEEPAK JAU SATTU'),
      photo('500 g', SATTU_BACK),
    ]);
    assert.equal(results[0]!.result, 'read');
    assert.deepEqual(labelWrites(results), [
      {
        variant_id: VID,
        weight_g: 500,
        note: 'Label photo: Net 500 g, both readers agree (D-202)',
        net_qty: '500 g',
      },
    ]);
  });

  it('writes nothing when only one reader found it, or they disagree', () => {
    assert.deepEqual(agreed(photo('500 g', 'no words here')), {
      why: 'only one reader found it (500 g)',
    });
    const disagree = decideLabel(labelListing(), [photo('25 g', SATTU_BACK)]);
    assert.match(disagree[0]!.result, /readers disagree \(25 g \/ 500 g\)/);
    assert.equal(labelWrites(disagree).length, 0);
  });

  it('leaves several sizes sharing a photo alone, but reads a photo tagged with its option', () => {
    const two = labelListing([{}, { label: '1 kg', options: { pack: '1 kg' } }]);
    assert.match(decideLabel(two, [photo('500 g', SATTU_BACK)])[0]!.result, /several options/);
    assert.equal(decideLabel(two, [photo('500 g', SATTU_BACK, VID)])[0]!.grams, 500);
  });

  it('counts an option "Pack of 3" of one pack\'s label three times; never over a read weight', () => {
    const three = labelListing([{ label: 'Pack of 3', options: { pack: 'Pack of 3' } }]);
    assert.equal(decideLabel(three, [photo('500 g', SATTU_BACK)])[0]!.grams, 1500);
    const known = labelListing([{ weight_g: 500, weight_source: 'packed', net_qty: '500 g' }]);
    assert.equal(labelWrites(decideLabel(known, [photo('500 g', SATTU_BACK)])).length, 0);
    const evalRun = decideLabel(known, [photo('500 g', SATTU_BACK)], { every: true });
    assert.equal(labelMatches(evalRun[0]!), 'same', 'the eval reads known ones and compares');
  });

  it('a weight the price check doubts goes on the sheet, not in the database', () => {
    const results = decideLabel(labelListing(), [photo('5 g', 'Net Wt. 5 g')], {
      doubt: () => '₹17,400 a kg',
    });
    assert.match(results[0]!.result, /price check doubts/);
    assert.equal(labelWrites(results).length, 0);
  });
});

function priced(
  name: string,
  category: string,
  rupees: number,
  grams: number | null,
  source: string | null,
  id: number,
): FoodPriceListing {
  const hex = id.toString(16).padStart(12, '0');
  return {
    product_id: `00000000-0000-4000-8000-${hex}`,
    name,
    category,
    variants: [
      {
        id: `00000000-0000-4000-9000-${hex}`,
        label: 'One size',
        weight_g: grams,
        weight_source: source,
        net_qty: null,
        is_active: true,
        shop_price_paise: rupees * 100,
      },
    ],
  };
}

describe('the price check (D-202)', () => {
  const labelled = [
    priced(
      'Mithila Foods Jau Sattu Roasted Barley Flour',
      'rice-flours-and-staples',
      90,
      500,
      'packed',
      1,
    ),
    priced('Bihari Jau Sattu Barley Flour', 'rice-flours-and-staples', 175, 1000, 'packed', 2),
    priced('Organic Jau Sattu Powder Barley', 'rice-flours-and-staples', 95, 500, 'weighed', 3),
    priced('Desi Jau Sattu Barley', 'masala-blends', 48, 250, 'packed', 4),
    priced('Everest Garam Masala', 'masala-blends', 80, 100, 'packed', 5),
  ];
  const index = indexReferences(priceReferences(labelled));

  it('rounds to pack sizes', () => {
    assert.equal(snapToPack(483), 500);
    assert.equal(snapToPack(137), 150);
    assert.equal(snapToPack(470), 500, 'a common size within a fifth');
    assert.equal(snapToPack(130), 125);
    assert.equal(snapToPack(9000), 5000);
  });

  it('corrects an estimate whose price makes a kilo cost far more than similar labelled items', () => {
    const rows = checkPrices(
      [priced('Deepak Jau Sattu Barley Flour', 'masala-blends', 87, 140, 'estimated', 9)],
      index,
    );
    assert.equal(rows[0]!.result, 'changed');
    assert.equal(rows[0]!.grams, 500);
    const writes = priceCheckWrites(rows);
    assert.equal(writes[0]!.weight_g, 500);
    assert.equal(writes[0]!.sure, true);
    assert.match(
      writes[0]!.note,
      /^Price check \(D-202\): ₹87 is ₹621 a kg; 4 similar labelled items ₹\d+ a kg → 500 g$/,
    );
  });

  it('keeps an estimate in line with similar items, and never touches a read weight', () => {
    assert.equal(
      checkPrices([priced('Deepak Jau Sattu Barley', 'x', 87, 450, 'estimated', 10)], index)[0]!
        .result,
      'kept',
    );
    assert.equal(
      checkPrices([priced('Deepak Jau Sattu Barley', 'x', 87, 140, 'packed', 11)], index).length,
      0,
    );
    assert.equal(
      checkPrices([priced('Deepak Jau Sattu Barley', 'x', 87, 140, 'shop', 12)], index).length,
      0,
    );
  });

  it('says nothing without three similar labelled items', () => {
    const rows = checkPrices(
      [priced('Haldiram Soan Papdi', 'sweets', 99, 100, 'estimated', 13)],
      index,
    );
    assert.equal(rows[0]!.result, 'no similar labelled items');
    assert.equal(priceCheckWrites(rows).length, 0);
  });
});
