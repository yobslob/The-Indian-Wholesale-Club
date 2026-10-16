/**
 * D-133, D-135: food is priced on its real weight, the net quantity its label states, unit by unit, with no
 * packaging added. Real titles from the sourcing runner's log where there are some.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weightSourceLabel, weightState } from '../src/domain';
import { parseComboParts, parseWeight, parseWeightParts, weightKindOf } from '../src/sourcing';
import { packedFoodVariants } from '../src/sourcing/auto';
import {
  foodNet,
  foodWrites,
  noteReading,
  weighFood,
  type FoodListing,
} from '../src/sourcing/estimate';

let n = 0;
function listing(
  name: string,
  variants: Partial<FoodListing['variants'][number]>[] = [{}],
  category = 'snacks-and-namkeen',
  description: string | null = null,
): FoodListing {
  return {
    product_id: '00000000-0000-4000-8000-000000000000',
    name,
    category,
    description,
    variants: variants.map((v) => ({
      id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
      label: 'One size',
      options: {},
      weight_g: null,
      weight_source: null,
      weight_note: null,
      net_qty: null,
      ...v,
    })),
  };
}
const one = (l: FoodListing) => weighFood(l)[0]!;

describe('net quantities as units (D-133)', () => {
  it('keeps the units a pack holds', () => {
    assert.deepEqual(parseWeightParts('200 g (Pack of 2)'), {
      unitGrams: 200,
      count: 2,
      liquid: false,
    });
    assert.deepEqual(parseWeightParts('2 x 0.5 kg'), { unitGrams: 500, count: 2, liquid: false });
    assert.deepEqual(parseWeightParts('400 g total (pack of 2)'), {
      unitGrams: 200,
      count: 2,
      liquid: false,
    });
    assert.deepEqual(parseWeightParts('Amul ghee 1 L'), {
      unitGrams: 1000,
      count: 1,
      liquid: true,
    });
    assert.deepEqual(parseWeightParts('2 g (Pack of 100)'), {
      unitGrams: 2,
      count: 100,
      liquid: false,
    });
    assert.deepEqual(parseWeightParts('Kaju katli box of 100 g'), {
      unitGrams: 100,
      count: 1,
      liquid: false,
    });
  });
  it('totals as before', () => {
    assert.deepEqual(parseWeight('200 g (Pack of 2)'), {
      grams: 400,
      liquid: false,
      multiplied: true,
    });
    assert.equal(parseWeight('400 g + 200 g'), null);
  });
  it('reads a combo of different packs, and nothing else as one', () => {
    assert.deepEqual(
      parseComboParts('Recheado 100 g + Galouti 100 g + Frankie 50 g')?.map((p) => p.unitGrams),
      [100, 100, 50],
    );
    assert.equal(parseComboParts('Bhujia 400 g'), null);
  });
  it('rereads a kept weight note', () => {
    assert.deepEqual(noteReading('amazon.in: Net Quantity: 400.0 Grams'), {
      kind: 'net',
      text: ' 400.0 Grams',
    });
    assert.equal(noteReading('Item Weight: 450 g')?.kind, 'item');
    assert.equal(noteReading('Pack: 1 kg')?.kind, 'pack');
    assert.deepEqual(noteReading('blinkit.com item 200 g'), { kind: 'pack', text: '200 g' });
    assert.equal(weightKindOf('Package Dimensions'), 'package');
  });
});

describe('a food option’s real weight: its net quantity, no packaging (D-135)', () => {
  it('is the label’s net quantity, to the gram', () => {
    const r = one(listing("KARMA'S Recheado Masala 400Gms Jar", [{}], 'masala-blends'));
    assert.equal(r.net?.label, '400 g');
    assert.equal(r.grams, 400);
    assert.equal(r.note, '400 g net (its name) (D-135)');
  });
  it('a pickle in a glass jar weighs what its label says', () => {
    assert.equal(
      one(listing('Priya Avakaya Pickle in Glass Jar 300 g', [{}], 'pickles-and-chutneys')).grams,
      300,
    );
  });
  it('every unit of a pack counts', () => {
    const r = one(
      listing(
        'SHREE SHYAM TILPATTI UDYOG Premium Cardamom Tilpatti, 500 Grams (Pack of 2)',
        [{}],
        'sweets',
      ),
    );
    assert.equal(r.net?.label, '2 × 500 g');
    assert.equal(r.grams, 1000);
    const p = one(
      listing('Haldiram Bhujia 400 g', [{ label: 'Pack of 2', options: { pack: 'Pack of 2' } }]),
    );
    assert.deepEqual([p.net?.label, p.grams], ['2 × 400 g', 800]);
    const bars = one(
      listing(
        'Paper Boat Chikki Jar',
        [{ label: '16 g (Pack of 50)', options: { pack: '16 g (Pack of 50)' } }],
        'sweets',
      ),
    );
    assert.equal(bars.grams, 800);
  });
  it('an option’s own pack comes before the name', () => {
    const [small, big] = weighFood(
      listing('Bikaneri bhujia 400 g', [
        { label: '200 g', options: { pack: '200 g' } },
        { label: '1 kg', options: { pack: '1 kg' } },
      ]),
    );
    assert.deepEqual([small?.grams, big?.grams], [200, 1000]);
  });
  it('millilitres by density: a litre of ghee is 910 g', () => {
    const r = one(listing('Amul Pure Ghee 1 L Tin', [{}], 'rice-flours-and-staples'));
    assert.deepEqual([r.net?.label, r.grams], ['1 L', 910]);
  });
  it('a combo is each of its packs', () => {
    const r = one(
      listing('SARANZ Recheado 100 g + Galouti 100 g + Frankie 50 g', [{}], 'masala-blends'),
    );
    assert.deepEqual([r.net?.label, r.grams], ['100 g + 100 g + 50 g', 250]);
  });
  it('reads the description’s “Net weight” line and matching items’ agreed net quantity', () => {
    assert.equal(
      one(listing('Homemade Mysore Pak', [{}], 'sweets', 'Fresh ghee sweet.\nNet Weight: 250 g'))
        .grams,
      250,
    );
    const r = one(
      listing('Haldiram Navratan Mixture', [
        {
          weight_g: 400,
          weight_source: 'similar',
          weight_note: 'Net quantity: 400 g (3 matching items on amazon.in, flipkart.com agree)',
        },
      ]),
    );
    assert.equal(r.grams, 400);
  });
  it('D-133’s packed weights go back to the net quantity', () => {
    const r = one(
      listing('Haldiram Bhujia 400 g', [
        {
          weight_g: 420,
          weight_source: 'packed',
          weight_note: '400 g net (its name) + pouch 18 g: snacks usually come in a pouch (D-133)',
          net_qty: '400 g',
        },
      ]),
    );
    assert.equal(r.grams, 400);
    assert.deepEqual(
      foodWrites([r]).map((w) => w.weight_g),
      [400],
    );
  });
  it('never over the hub’s scale or an admin, but their net quantity is still shown', () => {
    const results = weighFood(
      listing('Haldiram Bhujia 400 g', [
        { weight_g: 433, weight_source: 'weighed' },
        { weight_g: 500, weight_source: 'admin' },
        { weight_g: 450, weight_source: 'shop', weight_note: 'Pack: 400 g' },
      ]),
    );
    assert.deepEqual(
      results.map((r) => r.grams),
      [null, null, 400],
    );
    assert.deepEqual(
      foodWrites(results).map((w) => [w.weight_g, w.net_qty]),
      [
        [null, '400 g'],
        [null, '400 g'],
        [400, '400 g'],
      ],
    );
  });
  it('nothing states its net quantity: it keeps what it has', () => {
    const r = one(
      listing('Homemade Mysore Pak', [{ weight_g: 300, weight_source: 'estimated' }], 'sweets'),
    );
    assert.equal(r.grams, null);
    assert.equal(foodWrites([r]).length, 0);
    assert.match(r.look ?? '', /weigh it at the hub/);
  });
  it('a re-run writes nothing new', () => {
    const l = listing('Haldiram Bhujia 400 g');
    const [w] = foodWrites(weighFood(l));
    const again = {
      ...l,
      variants: [
        {
          ...l.variants[0]!,
          weight_g: w!.weight_g,
          weight_source: 'packed',
          weight_note: w!.note,
          net_qty: w!.net_qty,
        },
      ],
    };
    assert.equal(foodWrites(weighFood(again)).length, 0);
  });
  it('a misread net quantity gives none', () => {
    assert.equal(
      foodNet(
        { name: 'Rice 5000 kg', description: null },
        { label: 'x', options: {}, weight_source: null, weight_note: null },
      ),
      null,
    );
  });
  it('admins read it as the label’s net weight, and it is confirmed', () => {
    assert.equal(weightState({ weight_g: 400, weight_source: 'packed' }), 'confirmed');
    assert.equal(weightSourceLabel('packed', 'food'), 'Net weight on its label (D-135)');
    assert.equal(weightSourceLabel('packed', 'home'), 'Its weight + its packing (D-134)');
  });
});

describe('the runner prices new food on its net weight (D-135)', () => {
  it('no packaging, whatever the page says it comes in', () => {
    const [v] = packedFoodVariants(
      [
        {
          item_key: 'a',
          item_url: 'https://www.amazon.in/dp/A',
          label: '500 g',
          options: { pack: '500 g' },
          price_paise: 25000,
          mrp_paise: null,
          in_stock: true,
          delivery_days: 2,
          weight_g: 500,
          weight_source: 'shop',
          weight_note: 'Pack: 500 g',
        },
      ],
      {
        name: 'Mango pickle',
        description: '',
        category: 'pickles-and-chutneys',
        specs: [
          ['Package Information', 'Jar'],
          ['Material', 'Glass'],
        ],
      },
    );
    assert.deepEqual([v?.weight_source, v?.net_qty, v?.weight_g], ['packed', '500 g', 500]);
  });
});
