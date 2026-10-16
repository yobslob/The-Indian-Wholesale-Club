/**
 * D-133: food is priced on its packed weight, the label's net quantity plus its pack, so the hub's scale confirms the
 * price instead of moving it. Real titles from the sourcing runner's log where there are some.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weightState } from '../src/domain';
import { parseComboParts, parseWeight, parseWeightParts, weightKindOf } from '../src/sourcing';
import { packedFoodVariants } from '../src/sourcing/auto';
import {
  foodNet,
  foodWrites,
  guessPack,
  noteReading,
  tareFactors,
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
    assert.equal(parseComboParts('Bhujia 400 g, makes a snack for 4'), null);
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

describe('what a food piece is packed in (D-133)', () => {
  const pack = (
    name: string,
    category = 'snacks-and-namkeen',
    extra: Partial<Parameters<typeof guessPack>[0]> = {},
  ) => guessPack({ name, labels: [], category, netGrams: 400, ...extra }).pack;
  it('takes the pack its name or page names', () => {
    assert.equal(pack("KARMA'S Recheado Masala 400Gms Jar", 'masala-blends'), 'plastic_jar'); // dry food
    assert.equal(pack('Homemade mango pickle 400 g jar', 'pickles-and-chutneys'), 'jar'); // glass or plastic
    assert.equal(
      pack('SARANZ Goan Recheado Masala 100 Grams-Bottle', 'masala-blends'),
      'plastic_bottle',
    );
    assert.equal(
      pack('Priya Avakaya Pickle in Glass Jar 300 g', 'pickles-and-chutneys'),
      'glass_jar',
    );
    assert.equal(pack('Amul Pure Ghee 1 L Tin', 'rice-flours-and-staples'), 'tin');
    assert.equal(
      pack('Mango pickle 500 g', 'pickles-and-chutneys', {
        specs: [
          ['Package Information', 'Jar'],
          ['Material', 'Glass'],
        ],
      }),
      'glass_jar',
    );
  });
  it('never takes a storage line for the pack', () => {
    assert.equal(
      pack('Kitchen King Masala 100 g', 'masala-blends', {
        description: 'Store in an airtight glass jar after opening.',
      }),
      'pouch',
    );
    assert.equal(
      pack('Mango pickle 500 g', 'pickles-and-chutneys', {
        description: 'Packed in a food-grade PET jar.',
      }),
      'plastic_jar',
    );
  });
  it('else the pack such a piece comes in, else its category', () => {
    assert.equal(pack('Haldiram Rasgulla 1 kg', 'sweets'), 'tin');
    assert.equal(pack('Gulab jamun mix 200 g', 'sweets'), 'pouch');
    assert.equal(pack('Kaju katli 500 g', 'sweets'), 'sweet_box');
    assert.equal(pack('Achar masala 100 g', 'masala-blends'), 'pouch');
    assert.equal(pack('Cold pressed mustard oil 1 L', 'rice-flours-and-staples'), 'bottle');
    assert.equal(pack('Bikaneri bhujia 400 g'), 'pouch');
    assert.equal(
      guessPack({
        name: 'Sona masoori rice 5 kg',
        labels: [],
        category: 'Rice, Flours & Staples',
        netGrams: 5000,
      }).pack,
      'sack',
    );
  });
});

describe('a food option’s packed weight (D-133)', () => {
  it('adds the pack to the net quantity', () => {
    const r = one(listing("KARMA'S Recheado Masala 400Gms Jar", [{}], 'masala-blends'));
    assert.equal(r.net?.label, '400 g');
    assert.equal(r.grams, 440); // 400 g + a plastic jar 39 g (a dry masala)
    assert.match(
      r.note,
      /^400 g net \(its name\) \+ plastic jar 39 g: its name says "jar" \(dry food: plastic\) \(D-133\)$/,
    );
  });
  it('a pickle in a jar that names no material is between glass and plastic, and marked to weigh', () => {
    const r = one(listing('Homemade mango pickle 500 g jar', [{}], 'pickles-and-chutneys'));
    assert.equal(r.grams, 665);
    assert.match(r.look ?? '', /glass or plastic/);
  });
  it('light units share one pack; "Pack of 100" counts, "box of 100 g" weighs', () => {
    const bars = one(
      listing(
        'Paper Boat Chikki Jar',
        [{ label: '16 g (Pack of 50)', options: { pack: '16 g (Pack of 50)' } }],
        'sweets',
      ),
    );
    assert.equal(bars.net?.label, '50 × 16 g');
    assert.equal(bars.grams, 865); // 800 g in one plastic jar (63 g), not fifty jars
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
  it('reads the net quantity matching items agreed on', () => {
    const r = one(
      listing('Haldiram Navratan Mixture', [
        {
          weight_g: 400,
          weight_source: 'similar',
          weight_note: 'Net quantity: 400 g (3 matching items on amazon.in, flipkart.com agree)',
        },
      ]),
    );
    assert.equal(r.grams, 420);
  });
  it('a glass jar of pickle ships far heavier than its label', () => {
    assert.equal(
      one(listing('Priya Avakaya Pickle in Glass Jar 300 g', [{}], 'pickles-and-chutneys')).grams,
      525,
    );
  });
  it('each unit of a pack has its own pack', () => {
    const r = one(
      listing(
        'SHREE SHYAM TILPATTI UDYOG Premium Cardamom Tilpatti, 500 Grams (Pack of 2)',
        [{}],
        'sweets',
      ),
    );
    assert.equal(r.net?.label, '2 × 500 g');
    assert.equal(r.grams, 1200);
    const p = one(
      listing('Haldiram Bhujia 400 g', [{ label: 'Pack of 2', options: { pack: 'Pack of 2' } }]),
    );
    assert.equal(p.net?.label, '2 × 400 g');
  });
  it('an option’s own pack comes before the name', () => {
    const [small, big] = weighFood(
      listing('Bikaneri bhujia 400 g', [
        { label: '200 g', options: { pack: '200 g' } },
        { label: '1 kg', options: { pack: '1 kg' } },
      ]),
    );
    assert.equal(small?.grams, 215);
    assert.equal(big?.grams, 1040);
  });
  it('liquids by their weight: a litre of ghee is 910 g', () => {
    const r = one(listing('Amul Pure Ghee 1 L Tin', [{}], 'rice-flours-and-staples'));
    assert.equal(r.net?.label, '1 L');
    assert.equal(r.grams, 1045);
  });
  it('a combo is each of its packs', () => {
    const r = one(
      listing('SARANZ Recheado 100 g + Galouti 100 g + Frankie 50 g', [{}], 'masala-blends'),
    );
    assert.equal(r.net?.label, '100 g + 100 g + 50 g');
    assert.equal(r.grams, 315); // three boxes, as masala blends come
  });
  it('reads the label from the description’s “Net weight” line', () => {
    assert.equal(
      one(listing('Homemade Mysore Pak', [{}], 'sweets', 'Fresh ghee sweet.\nNet Weight: 250 g'))
        .net?.label,
      '250 g',
    );
  });
  it('a shop’s believable packed weight is kept; one that is only the contents is not', () => {
    const page = one(
      listing('Haldiram Bhujia 400 g', [
        { weight_g: 450, weight_source: 'shop', weight_note: 'amazon.in: Item Weight: 450 g' },
      ]),
    );
    assert.equal(page.grams, 450);
    assert.match(page.note, /states it packed/);
    const net = one(
      listing('Haldiram Bhujia 400 g', [
        { weight_g: 400, weight_source: 'shop', weight_note: 'Item Weight: 400 g' },
      ]),
    );
    assert.equal(net.grams, 420);
  });
  it('never over the hub’s scale or an admin, but their net quantity is still shown', () => {
    const results = weighFood(
      listing('Haldiram Bhujia 400 g', [
        { weight_g: 433, weight_source: 'weighed' },
        { weight_g: 500, weight_source: 'admin' },
        { weight_g: 400, weight_source: 'shop', weight_note: 'Pack: 400 g' },
      ]),
    );
    assert.deepEqual(
      results.map((r) => r.grams),
      [null, null, 420],
    );
    const writes = foodWrites(results);
    assert.deepEqual(
      writes.map((w) => [w.weight_g, w.net_qty]),
      [
        [null, '400 g'],
        [null, '400 g'],
        [420, '400 g'],
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
  it('a packed weight is a confirmed weight', () => {
    assert.equal(weightState({ weight_g: 420, weight_source: 'packed' }), 'confirmed');
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
});

describe('the hub’s scale tunes the packs (D-133)', () => {
  const weighed = (grams: number) => ({
    name: 'Mango pickle in glass jar 500 g',
    category: 'Pickles & Chutneys',
    label: 'One size',
    options: {},
    weight_g: grams,
  });
  it('three weighings of a pack set its factor', () => {
    const f = tareFactors([weighed(700), weighed(690), weighed(720)]);
    assert.ok(f.glass_jar && Math.abs(f.glass_jar - 200 / 295) < 0.01);
    const tuned = weighFood(
      listing('Lime pickle in glass jar 500 g', [{}], 'pickles-and-chutneys'),
      { factors: f },
    )[0]!;
    assert.equal(tuned.grams, 700);
  });
  it('fewer than three, or a misread label, leave the table as it is', () => {
    assert.deepEqual(tareFactors([weighed(700), weighed(690)]), {});
    assert.deepEqual(tareFactors([weighed(400), weighed(5000), weighed(450)]), {});
  });
});

describe('the runner prices new food on its packed weight (D-133)', () => {
  it('uses the page’s spec rows for the pack', () => {
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
    assert.equal(v?.weight_source, 'packed');
    assert.equal(v?.net_qty, '500 g');
    assert.equal(v?.weight_g, 795);
  });
});

describe('a kept shop page weight stays on a second pass (D-133)', () => {
  it('does not flip to the table weight', () => {
    const l = listing('Haldiram Bhujia 400 g', [
      { weight_g: 450, weight_source: 'shop', weight_note: 'Item Weight: 450 g' },
    ]);
    const [w] = foodWrites(weighFood(l));
    assert.equal(w?.weight_g, 450);
    const again = {
      ...l,
      variants: [
        { ...l.variants[0]!, weight_source: 'packed', weight_note: w!.note, net_qty: w!.net_qty },
      ],
    };
    assert.equal(foodWrites(weighFood(again)).length, 0);
  });
});
