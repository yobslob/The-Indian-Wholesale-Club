/**
 * D-131: the weight estimator's rules. The model's answer is read part by part and added up here; a weight is sure
 * enough to price on only when its range is narrow, similar known items agree, and it is not below a stated net
 * weight; near-identical known items answer without the model.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estimateDisagrees, weightState } from '../src/domain';
import { wantsWeight } from '../src/sourcing/auto';
import {
  decide,
  estimatePrompt,
  neighbourWeight,
  readAnswer,
  readQuick,
  referenceItems,
  roundGrams,
  twinWeight,
  weightGroups,
  type EstimateListing,
  type ModelGuess,
  type Neighbour,
  type ReferenceItem,
  type WeightReferenceRow,
} from '../src/sourcing/estimate';

const id = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function listing(over: Partial<EstimateListing> = {}): EstimateListing {
  return {
    product_id: id(1),
    name: 'Women Cotton Kurta with Palazzo',
    product_type: 'clothing',
    category: 'Kurta sets',
    category_weight_g: 450,
    summary: null,
    description: null,
    attributes: { fibre_content: '100% cotton' },
    variants: [],
    ...over,
  };
}

const variant = (
  n: number,
  label: string,
  options: Record<string, string> = {},
  wanted = true,
) => ({
  id: id(n),
  label,
  options,
  weight_g: null,
  weight_source: null,
  weight_note: null,
  wanted,
});

const ref = (grams: number, source: ReferenceItem['source'] = 'weighed', n = 9): ReferenceItem => ({
  key: `k${n}-${grams}`,
  productId: id(100 + n),
  type: 'clothing',
  text: 'x',
  name: `Item ${n}`,
  category: 'Kurta sets',
  pack: null,
  grams,
  source,
});

const near = (pairs: [number, number, ReferenceItem['source']?][]): Neighbour[] =>
  pairs.map(([grams, sim, source], i) => ({ item: ref(grams, source ?? 'weighed', i), sim }));

const guess = (packedG: number, lowG: number, highG: number): ModelGuess => ({
  parts: [{ what: 'kurta', grams: packedG - 40 }],
  packagingG: 40,
  packedG,
  lowG,
  highG,
});

describe('what is weighed (D-131)', () => {
  it('weighs every size and colour of a piece once, and each pack on its own', () => {
    const groups = weightGroups(
      listing({
        product_type: 'food',
        name: 'Mango Pickle',
        variants: [
          variant(2, '250 g', { pack: '250 g' }),
          variant(3, '1 kg', { pack: '1 kg' }),
          variant(4, '500 g', { pack: '500 g' }, false),
        ],
      }),
    );
    assert.deepEqual(
      groups.map((g) => [g.key, g.statedNetG, g.variantIds.length]),
      [
        ['pack:250 g', 250, 1],
        ['pack:1 kg', 1000, 1],
      ],
    );
    const piece = weightGroups(
      listing({ variants: [variant(5, 'S'), variant(6, 'M'), variant(7, 'L')] }),
    );
    assert.equal(piece.length, 1);
    assert.equal(
      piece[0]!.label,
      'one piece (sold in 3 sizes and colours: weigh one, a middle size)',
    );
    assert.equal(piece[0]!.statedNetG, null, 'a garment never takes a weight from its name');
  });
  it('keeps one known weight per listing and pack, the best measured', () => {
    const row = (
      n: number,
      grams: number,
      source: WeightReferenceRow['weight_source'],
      pack?: string,
    ): WeightReferenceRow => ({
      variant_id: id(n),
      product_id: id(50),
      name: 'Ghee',
      product_type: 'food',
      category: 'Ghee',
      label: pack ?? 'One size',
      options: pack ? { pack } : {},
      weight_g: grams,
      weight_source: source,
      weight_estimate_g: null,
    });
    const items = referenceItems([
      row(1, 500, 'shop', '500 ml'),
      row(2, 640, 'weighed', '500 ml'),
      row(3, 1200, 'shop', '1 l'),
    ]);
    assert.deepEqual(
      items.map((i) => [i.pack, i.grams, i.source]),
      [
        ['500 ml', 640, 'weighed'],
        ['1 l', 1200, 'shop'],
      ],
    );
  });
});

describe("reading the model's answer (D-131)", () => {
  it('adds up the parts and the packing itself, and widens a range that misses the total', () => {
    const raw = JSON.stringify({
      options: [
        {
          option: 1,
          parts: [
            { what: 'kurta', grams: 210 },
            { what: 'palazzo', grams: 170 },
          ],
          packaging_g: 40,
          low_g: 300,
          high_g: 400,
        },
      ],
    });
    assert.deepEqual(readAnswer(raw, 1)[0], {
      parts: [
        { what: 'kurta', grams: 210 },
        { what: 'palazzo', grams: 170 },
      ],
      packagingG: 40,
      packedG: 420,
      lowG: 300,
      highG: 420,
    });
  });
  it('matches options by number and gives nothing for nonsense', () => {
    const raw = JSON.stringify({
      options: [
        {
          option: 2,
          parts: [{ what: 'oil', grams: 900 }],
          packaging_g: 60,
          low_g: 900,
          high_g: 1000,
        },
        { option: 1, parts: [], packaging_g: 0, low_g: 0, high_g: 0 },
      ],
    });
    const out = readAnswer(raw, 2);
    assert.equal(out[0], null, 'a total of 0 g is no answer');
    assert.equal(out[1]?.packedG, 960);
    assert.deepEqual(readAnswer('not json', 2), [null, null]);
    const echo = JSON.stringify({
      options: [
        {
          option: 1,
          parts: [
            { what: 'blouse', grams: 80 },
            { what: 'total low_g', grams: 110 },
            { what: 'packaging', grams: 40 },
          ],
          packaging_g: 30,
          low_g: 100,
          high_g: 140,
        },
      ],
    });
    assert.equal(
      readAnswer(echo, 1)[0]?.packedG,
      110,
      "the answer's own fields and packing listed as parts are dropped",
    );
    const onlyPacking = JSON.stringify({
      options: [{ option: 1, parts: [], packaging_g: 60, low_g: 60, high_g: 450 }],
    });
    assert.equal(readAnswer(onlyPacking, 1)[0], null, 'packing alone is no answer');
  });
  it('shows the model the details and the known weights most like the listing', () => {
    const prompt = estimatePrompt(
      listing({ variants: [variant(2, 'M')] }),
      weightGroups(listing({ variants: [variant(2, 'M')] })),
      [{ item: ref(430), sim: 0.9 }],
    );
    assert.match(prompt, /Fabric: 100% cotton/);
    assert.match(prompt, /1\. one piece\n/);
    assert.match(prompt, /"Item 9": 430 g \(weighed at the hub\)/);
  });
});

describe('deciding the weight (D-131)', () => {
  const base = { statedNetG: null, type: 'clothing' as const, categoryWeightG: 450 };
  it('is sure when the range is narrow and similar weighed items agree; it meets them halfway', () => {
    const d = decide({
      ...base,
      guess: guess(420, 380, 470),
      neighbours: near([
        [440, 0.9],
        [460, 0.85],
      ]),
    })!;
    assert.equal(d.sure, true);
    assert.equal(d.grams, 430);
    assert.match(
      d.note,
      /^Estimated 430 g packed \(380-470 g\); 2 similar known items ~440 g: kurta 380 \+ packing 40 g$/,
    );
  });
  it('is not sure when the model is unsure or similar items disagree', () => {
    assert.equal(decide({ ...base, guess: guess(420, 250, 700), neighbours: [] })!.sure, false);
    const off = decide({
      ...base,
      guess: guess(420, 380, 470),
      neighbours: near([
        [800, 0.9],
        [820, 0.88],
      ]),
    })!;
    assert.equal(off.sure, false);
    assert.equal(off.grams, 420, 'its own weight, as a suggestion');
    assert.match(off.note, /Check: 2 similar known items weigh about 800 g/);
  });
  it('takes a second look: agreeing, it counts a third; far off, the weight is to check', () => {
    const both = decide({ ...base, guess: guess(420, 380, 470), quick: 480, neighbours: [] })!;
    assert.equal(both.sure, true);
    assert.equal(both.grams, 440, '(2 x 420 + 480) / 3');
    const apart = decide({ ...base, guess: guess(1580, 1420, 1580), quick: 300, neighbours: [] })!;
    assert.equal(apart.sure, false, 'a narrow range does not make a guess sure');
    assert.match(apart.note, /a second look says about 300 g/);
    assert.deepEqual(readQuick('{"grams": [300, 0]}', 3), [300, null, null]);
  });
  it('is never below a stated net weight, nor far from its category', () => {
    const food = decide({
      guess: guess(400, 380, 420),
      neighbours: [],
      statedNetG: 500,
      type: 'food',
      categoryWeightG: null,
    })!;
    assert.equal(food.sure, false);
    assert.match(food.note, /below its stated 500 g/);
    assert.equal(decide({ ...base, guess: guess(2400, 2300, 2500), neighbours: [] })!.sure, false);
  });
  it('takes near-identical items without the model, when three agree', () => {
    const twins = near([
      [300, 0.97],
      [310, 0.96],
      [320, 0.95],
    ]);
    assert.deepEqual(twinWeight(twins), { grams: 310, count: 3, weighed: 3 });
    const d = decide({ ...base, guess: null, neighbours: twins })!;
    assert.equal(d.grams, 310);
    assert.equal(d.sure, true);
    assert.equal(
      twinWeight(
        near([
          [300, 0.97],
          [310, 0.96],
          [500, 0.95],
        ]),
      ),
      null,
      'not when one is far off',
    );
    assert.equal(decide({ ...base, guess: null, neighbours: near([[300, 0.97]]) }), null);
  });
  it('trusts weighed items over shop pages among the close ones, and needs two', () => {
    assert.equal(neighbourWeight(near([[300, 0.9]])), null);
    assert.equal(
      neighbourWeight(
        near([
          [300, 0.85, 'shop'],
          [500, 0.85, 'weighed'],
        ]),
      )?.grams,
      500,
    );
    assert.equal(
      neighbourWeight(
        near([
          [300, 0.85],
          [500, 0.5],
        ]),
      ),
      null,
      'a far item does not count',
    );
  });
  it('rounds as a scale shows grams', () => {
    assert.deepEqual([roundGrams(23), roundGrams(427), roundGrams(2433)], [25, 430, 2450]);
  });
});

describe('estimated weights on the admin screens (D-131)', () => {
  it('counts a sure estimate as a weight, and flags a shop weight the estimator disagrees with', () => {
    assert.equal(weightState({ weight_g: 420, weight_source: 'estimated' }), 'confirmed');
    assert.equal(
      estimateDisagrees({ weight_g: 1, weight_source: 'shop', weight_estimate_g: 25 }),
      true,
    );
    assert.equal(
      estimateDisagrees({ weight_g: 400, weight_source: 'shop', weight_estimate_g: 450 }),
      false,
    );
    assert.equal(
      estimateDisagrees({ weight_g: 400, weight_source: 'weighed', weight_estimate_g: 900 }),
      false,
    );
  });
  it('lets a shop page replace an estimate', () => {
    assert.equal(
      wantsWeight({
        id: id(1),
        label: 'M',
        options: {},
        weight_g: 420,
        weight_source: 'estimated',
      }),
      true,
    );
    assert.equal(
      wantsWeight({ id: id(1), label: 'M', options: {}, weight_g: 420, weight_source: 'weighed' }),
      false,
    );
  });
});
