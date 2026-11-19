/**
 * The second food round (D-201, `tools/sourcing-runner/targets/food-more.csv`): every row uploads as a new target on
 * the four fast shops and Amazon and Flipkart, ₹1 – ₹600, and its Must match leaves out dairy, liquids, frozen food,
 * sacks of 10 kg and more, and meat except in a masala's name.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { checkCategory } from '../src/sourcing/category-check';
import { parseTargetsCsv, targetMatcher, type SourcingTarget, type TargetRow } from '../src/sourcing/auto';

const read = (file: string) =>
  parseTargetsCsv(readFileSync(new URL(`../../../tools/sourcing-runner/targets/${file}`, import.meta.url), 'utf8'));
const { rows, errors } = read('food-more.csv');

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
const fits = (name: string, title: string): boolean => {
  const row = rows.find((r) => r.name === `More: ${name}`);
  assert.ok(row, `no row ${name}`);
  return targetMatcher(target(row)).matches(title);
};

describe('the second food round', () => {
  it('uploads whole: food only, all states, six shops, ₹1 – ₹600, every Must match valid', () => {
    assert.deepEqual(errors, []);
    assert.equal(rows.length, 862);
    assert.equal(rows.reduce((s, r) => s + (r.listings ?? 0), 0), 24_055);
    for (const r of rows) {
      assert.equal(r.product_type, 'food', r.name);
      assert.equal(r.region, null, r.name);
      assert.deepEqual(r.shops, ['blinkit', 'bigbasket', 'zepto', 'instamart', 'amazon', 'flipkart'], r.name);
      assert.deepEqual([r.min_price_paise, r.max_price_paise], [100, 60_000], r.name);
      assert.ok(r.listings && r.listings <= 40, r.name);
      assert.ok(r.must_match && r.must_match.length <= 300, r.name);
      assert.doesNotThrow(() => new RegExp(r.must_match!, 'i'), r.name);
    }
  });

  it('adds new targets: no name is already a target of an earlier food list (D-150 would only widen it)', () => {
    const names = new Set(rows.map((r) => r.name.toLowerCase()));
    assert.equal(names.size, rows.length);
    for (const file of ['food-branded-200.csv', 'food-under-300.csv', 'food-by-state.csv', 'food-quick-shops.csv'])
      for (const r of read(file).rows) assert.ok(!names.has(r.name.toLowerCase()), `${file}: ${r.name}`);
  });

  it('files every row where its own name belongs', () => {
    for (const r of rows) {
      const fit = checkCategory(r.name.replace(/^More: /, ''), r.product_type, r.category);
      assert.ok(fit.kind !== 'not_type' && fit.kind !== 'move', `${r.name}: ${JSON.stringify(fit)}`);
    }
  });

  it('keeps what flies and leaves out dairy, liquids, sacks and meat', () => {
    assert.ok(fits("Haldiram's bhujia", "Haldiram's Bikaneri Bhujia 1 kg"));
    assert.ok(!fits("Haldiram's bhujia", 'Bikaji Bikaneri Bhujia 1 kg'));
    assert.ok(!fits("Haldiram's mixture", "Haldiram's Rasgulla Mix 1 kg"));
    assert.ok(fits('MDH fish curry masala', 'MDH Fish Curry Masala 100 g'));
    assert.ok(!fits("Mother's Recipe mixed pickle", "Mother's Recipe Chicken Mix Pickle 300 g"));
    assert.ok(fits("Mother's Recipe mixed pickle", "Mother's Recipe Mixed Pickle 500 g"));
    assert.ok(fits('Catch cardamom', 'Catch Green Cardamom Whole 50 g'));
    assert.ok(!fits('Catch cardamom', 'Catch Cardamom Powder 50 g'));
    assert.ok(!fits('Basmati rice (1 kg packs)', 'India Gate Basmati Rice 25 kg'));
    assert.ok(fits('Basmati rice (1 kg packs)', 'India Gate Basmati Rice 1 kg'));
    assert.ok(fits('Bru coffee', 'Bru Instant Coffee 100 g'));
    assert.ok(!fits('Bru coffee', 'Bru Cold Coffee 180 ml'));
    assert.ok(fits('Lijjat urad papad', 'Lijjat Urad Papad 200 g'));
  });
});
