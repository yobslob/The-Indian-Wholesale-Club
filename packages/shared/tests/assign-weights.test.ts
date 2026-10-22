/**
 * D-146: Assign all: the house rules' weight where they read one (clothing by class, food by its label's net
 * quantity); everything else is left for the database's similar pieces. Never an option that has a weight.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assignWeights, weightPlanSchema, type WeightPlanListing } from '../src/sourcing/estimate';

let n = 0;
const uuid = (): string => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
function listing(
  product_type: WeightPlanListing['product_type'],
  name: string,
  category_slug: string,
  variants: Partial<WeightPlanListing['variants'][number]>[],
): WeightPlanListing {
  return {
    product_id: uuid(),
    name,
    product_type,
    category_slug,
    description: null,
    variants: variants.map((v) => ({
      id: uuid(),
      label: 'One size',
      options: {},
      weight_g: null,
      weight_source: null,
      weight_note: null,
      net_qty: null,
      is_active: true,
      ...v,
    })),
  };
}

describe('Assign all (D-146)', () => {
  it('weighs clothing by its class, a pack of 2 twice', () => {
    const [a, b] = assignWeights([
      listing('clothing', 'Embroidered Cotton Kurta with Pyjama', 'kurtas', [{ label: 'M' }, { label: 'Pack of 2', options: { pack: '2' } }]),
    ]);
    assert.equal(a!.source, 'class');
    assert.equal(a!.weight_g, 1500);
    assert.equal(b!.weight_g, 3000);
    assert.match(a!.note!, /\(D-132\)$/);
  });
  it('weighs food by the net quantity on its label, unit by unit', () => {
    const [a, b] = assignWeights([
      listing('food', "Haldiram's Aloo Bhujia", 'snacks-and-namkeen', [{ label: '200 g (Pack of 3)' }, { label: 'Classic' }]),
    ]);
    assert.deepEqual([a!.weight_g, a!.source, a!.net_qty], [600, 'packed', '3 × 200 g']);
    assert.deepEqual([b!.weight_g, b!.source], [null, undefined], 'no net quantity stated: similar pieces decide');
  });
  it('leaves home & gifts to similar pieces, and never an option that has a weight', () => {
    const out = assignWeights([
      listing('home', 'Brass Diya 500 g', 'pooja-and-spiritual', [{}, { weight_g: 420, weight_source: 'shop' }]),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.weight_g, null);
  });
  it("reads the database's plan", () => {
    const plan = weightPlanSchema.parse({ left: 1, rows: [{ ...listing('home', 'Toran', 'handicrafts-and-decor', [{}]), description: undefined }] });
    assert.equal(plan.rows[0]!.description, null);
  });
});
