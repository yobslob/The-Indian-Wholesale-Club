/**
 * The quick shops' food list (D-200, `tools/sourcing-runner/targets/food-quick-shops.csv`): every row uploads as a new
 * target on Blinkit, BigBasket, Zepto and Instamart, ₹1 – ₹500, and its Must match leaves out dairy, liquids and frozen
 * food, and meat except in a masala's name.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { checkCategory } from '../src/sourcing/category-check';
import { parseTargetsCsv, targetMatcher, type SourcingTarget, type TargetRow } from '../src/sourcing/auto';

const read = (file: string) =>
  parseTargetsCsv(readFileSync(new URL(`../../../tools/sourcing-runner/targets/${file}`, import.meta.url), 'utf8'));
const { rows, errors } = read('food-quick-shops.csv');

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
  const row = rows.find((r) => r.name === `Quick: ${name}`);
  assert.ok(row, `no row ${name}`);
  return targetMatcher(target(row)).matches(title);
};

describe('the quick shops food targets', () => {
  it('uploads whole: food only, all states, the four shops, ₹1 – ₹500, every Must match valid', () => {
    assert.deepEqual(errors, []);
    assert.equal(rows.length, 306);
    for (const r of rows) {
      assert.equal(r.product_type, 'food', r.name);
      assert.equal(r.region, null, r.name);
      assert.deepEqual(r.shops, ['blinkit', 'bigbasket', 'zepto', 'instamart'], r.name);
      assert.deepEqual([r.min_price_paise, r.max_price_paise], [100, 50_000], r.name);
      assert.ok(r.listings && r.listings <= 40, r.name);
      assert.ok(r.must_match && r.must_match.length <= 300, r.name);
      assert.doesNotThrow(() => new RegExp(r.must_match!, 'i'), r.name);
    }
  });

  it('adds new targets: no name is already a target of the earlier food lists (D-150 would only widen it)', () => {
    const names = new Set(rows.map((r) => r.name.toLowerCase()));
    assert.equal(names.size, rows.length);
    for (const file of ['food-branded-200.csv', 'food-under-300.csv', 'food-by-state.csv'])
      for (const r of read(file).rows) assert.ok(!names.has(r.name.toLowerCase()), `${file}: ${r.name}`);
  });

  it('files every row where its own name belongs', () => {
    for (const r of rows) {
      const fit = checkCategory(r.name.replace(/^Quick: /, ''), r.product_type, r.category);
      assert.ok(fit.kind !== 'not_type' && fit.kind !== 'move', `${r.name}: ${JSON.stringify(fit)}`);
    }
  });

  it('keeps what flies and leaves out dairy, liquids and meat', () => {
    assert.ok(fits("Haldiram's aloo bhujia and takatak", "Haldiram's Aloo Bhujia 400 g"));
    assert.ok(!fits('Flavoured makhana', 'Cheese Makhana with Paneer Seasoning'));
    assert.ok(fits('Flavoured makhana', 'Farmley Peri Peri Makhana 60 g'));
    assert.ok(fits('MDH chicken masala', 'MDH Chicken Masala 100 g'));
    assert.ok(!fits('MDH chicken masala', 'Everest Chicken Masala 100 g'));
    assert.ok(!fits('Andhra pickles (Telugu Foods, Ammas)', 'Andhra Chicken Pickle 250 g'));
    assert.ok(fits('Andhra pickles (Telugu Foods, Ammas)', 'Telugu Foods Gongura Pickle 300 g'));
    assert.ok(!fits('Thandai powder', 'Thandai Syrup 750 ml'));
    assert.ok(!fits('Rusk (elaichi, suji)', 'Ghee Rusk 300 g'));
    assert.ok(fits('Rusk (elaichi, suji)', 'Britannia Toastea Elaichi Rusk 273 g'));
    assert.ok(!fits('Kurkure puffcorn and Too Yumm', 'Frozen Corn Puffs'));
  });
});
