/**
 * The Blinkit pantry list (D-203, plan §5.6, `tools/sourcing-runner/targets/recipe-pantry.csv`): one target per distinct
 * pantry item the 500 drafted recipes' kits and swaps need (D-204), on Blinkit only, a few listings each, and a Must match that leaves out
 * dairy, liquids, frozen food and meat (meat and dairy words allowed only where the item's own name says them, as in a
 * masala's name: D-200's rule).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  parseTargetsCsv,
  targetMatcher,
  type SourcingTarget,
  type TargetRow,
} from '../src/sourcing/auto';

const root = new URL('../../../', import.meta.url);
const { rows, errors } = parseTargetsCsv(
  readFileSync(new URL('tools/sourcing-runner/targets/recipe-pantry.csv', root), 'utf8'),
);

const target = (row: TargetRow): SourcingTarget => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: row.name,
  query: row.query,
  must_match: row.must_match,
  product_type: row.product_type,
  category: row.category,
  region: row.region,
  tier: row.tier,
  sites: row.shops,
  min_price_paise: row.min_price_paise,
  max_price_paise: row.max_price_paise,
  listings: row.listings,
});
const fits = (item: string, title: string): boolean => {
  const row = rows.find((r) => r.name.toLowerCase() === `pantry: ${item}`);
  assert.ok(row, `no row ${item}`);
  return targetMatcher(target(row)).matches(title);
};

const kitItems = new Set(
  Array.from({ length: 25 }, (_, i) => i + 1).flatMap((n) =>
    (
      JSON.parse(readFileSync(new URL(`catalogue/recipes-drafts-${n}.json`, root), 'utf8')) as {
        ingredients: { source: string; match_words?: string }[];
      }[]
    )
      .flatMap((d) => d.ingredients)
      .filter((l) => l.source === 'iwc')
      .map((l) => l.match_words!),
  ),
);

describe('the Blinkit pantry list (D-203)', () => {
  it('uploads whole: food, all states, Blinkit only, 3 – 5 listings, every Must match valid', () => {
    assert.deepEqual(errors, []);
    for (const r of rows) {
      assert.equal(r.product_type, 'food', r.name);
      assert.equal(r.region, null, r.name);
      assert.deepEqual(r.shops, ['blinkit'], r.name);
      assert.ok(r.listings! >= 3 && r.listings! <= 5, r.name);
      assert.ok(r.must_match && r.must_match.length <= 300, r.name);
      assert.doesNotThrow(() => new RegExp(r.must_match!, 'i'), r.name);
    }
  });

  it('one row per distinct pantry item the kits need, and no other', () => {
    assert.deepEqual(new Set(rows.map((r) => r.query)), kitItems);
    assert.equal(new Set(rows.map((r) => r.name.toLowerCase())).size, rows.length);
  });

  it('finds the item by its other names and leaves out liquids, dairy and meat', () => {
    assert.ok(fits('green cardamom', 'Catch Green Elaichi 50 g'));
    assert.ok(fits('kashmiri chilli powder', 'MDH Kashmiri Mirch Powder 100 g'));
    assert.ok(fits('tamarind', 'Tata Sampann Imli 200 g'));
    assert.ok(!fits('tamarind', 'Tamarind Juice 200 ml'));
    assert.ok(!fits('desiccated coconut', 'Coconut Oil 500 ml'));
    assert.ok(!fits('kasuri methi', 'Kasuri Methi Paneer Ready to Eat'));
    assert.ok(fits('chicken masala', 'MDH Chicken Masala 100 g'));
    assert.ok(!fits('chicken masala', 'Frozen Chicken Masala Curry'));
    assert.ok(!fits('saffron', 'Saffron Syrup 750 ml'));
    assert.ok(fits('coriander powder', 'Catch Dhania Powder 100 g'));
    assert.ok(fits('broken wheat', 'Aashirvaad Daliya 500 g'));
    assert.ok(fits('green moong', 'Tata Sampann Green Moong Whole 500 g'));
    assert.ok(!fits('green moong', 'Tata Sampann Moong Dal 500 g'));
    assert.ok(fits('curry leaves', 'Dried Curry Leaves 50 g'));
    assert.ok(fits('cloves', 'Catch Laung 50 g'));
    assert.ok(!fits('cloves', 'Peeled Garlic Cloves 100 g'));
    assert.ok(fits('ragi flour', 'Pro Nature Ragi Atta 500 g'));
    assert.ok(fits('masoor dal', 'Tata Sampann Masoor Dal 1 kg'));
    assert.ok(!fits('dried apricots', 'Apricot Jam 450 g'));
  });
});
