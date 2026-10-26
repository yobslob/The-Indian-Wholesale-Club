/**
 * The Diwali home & gifts list (D-162, `tools/sourcing-runner/targets/diwali-home-gifts.csv`): every row uploads, and
 * its Must match keeps what can fly and leaves out what can't (lit and battery pieces, fireworks, camphor, cow dung,
 * feathers, loose colours, food and hampers, pure silver coins, prints sold as a state's craft).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parseTargetsCsv, targetMatcher, type SourcingTarget, type TargetRow } from '../src/sourcing/auto';

const csv = readFileSync(new URL('../../../tools/sourcing-runner/targets/diwali-home-gifts.csv', import.meta.url), 'utf8');
const { rows, errors } = parseTargetsCsv(csv);

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
  const row = rows.find((r) => r.name === name);
  assert.ok(row, `no row ${name}`);
  return targetMatcher(target(row)).matches(title);
};

describe('the Diwali home & gifts targets', () => {
  it('uploads whole: home only, names unique, every Must match a valid pattern under the limit', () => {
    assert.deepEqual(errors, []);
    assert.equal(rows.length, 100);
    assert.ok(rows.every((r) => r.product_type === 'home'));
    assert.equal(new Set(rows.map((r) => `${r.name.toLowerCase()}|${r.region}`)).size, rows.length);
    for (const r of rows) {
      assert.ok(r.must_match && r.must_match.length <= 300, r.name);
      assert.doesNotThrow(() => new RegExp(r.must_match!, 'i'), r.name);
    }
  });

  it('puts the 7-day rows on the four quick shops only, without a band', () => {
    const quick = rows.filter((r) => r.name.endsWith('(7-day)'));
    assert.equal(quick.length, 25);
    for (const r of quick) {
      assert.deepEqual(r.shops, ['blinkit', 'bigbasket', 'zepto', 'instamart'], r.name);
      assert.equal(r.min_price_paise, null);
      assert.equal(r.max_price_paise, null);
    }
    for (const r of rows.filter((r) => !r.name.endsWith('(7-day)'))) {
      assert.deepEqual(r.shops, ['amazon', 'flipkart'], r.name);
      assert.deepEqual([r.min_price_paise, r.max_price_paise], [100, 90_000], r.name);
    }
  });

  it('keeps what flies and leaves out what does not', () => {
    const diyas = 'Diwali: diya sets (7-day)';
    assert.ok(fits(diyas, 'Handpainted Clay Diya Set of 12 for Diwali'));
    assert.ok(!fits(diyas, 'LED Diya Electric Candle Lights Pack of 12'));
    assert.ok(!fits(diyas, 'Battery Operated Floating Diya'));
    assert.ok(!fits(diyas, 'Gobar Diya Cow Dung 21 pcs'));
    assert.ok(!fits(diyas, 'Diya with Bhimseni Camphor'));
    assert.ok(!fits(diyas, 'Anar Cracker Diya Shape Fireworks'));
    assert.ok(fits('Diwali: torans (7-day)', 'Beaded Toran for Main Door'));
    assert.ok(!fits('Diwali: torans (7-day)', 'Peacock Feather Toran'));
    const rangoli = 'Diwali: acrylic and kundan rangoli';
    assert.ok(fits(rangoli, 'Kundan Acrylic Rangoli Set Multicolour'));
    assert.ok(!fits(rangoli, 'Rangoli Colours 10 Shades'));
    assert.ok(!fits(rangoli, 'Acrylic Rangoli with Rangoli Powder'));
    const garland = 'Diwali: artificial marigold garlands (7-day)';
    assert.ok(fits(garland, 'Artificial Marigold Garland 5 ft'));
    assert.ok(!fits(garland, 'Fresh Marigold Flower Garland'));
    const thali = 'Diwali: pooja thali sets (7-day)';
    assert.ok(fits(thali, 'Brass Pooja Thali Set 7 pcs'));
    assert.ok(!fits(thali, 'Pooja Thali with Kumkum and Sindoor'));
    assert.ok(!fits(thali, 'Pooja Samagri Kit with Thali'));
    const gift = 'Diwali: gift boxes and bags (7-day)';
    assert.ok(fits(gift, 'Empty Gift Box for Diwali, Pack of 6'));
    assert.ok(!fits(gift, 'Diwali Gift Box with Chocolates'));
    assert.ok(!fits(gift, 'Dry Fruit Gift Box Hamper'));
    const box = 'Diwali: empty dry fruit boxes and trays';
    assert.ok(fits(box, 'Wooden Dry Fruit Box with 4 Compartments'));
    assert.ok(!fits(box, 'Dry Fruit Box Almonds Cashews 500 g'));
    const coin = 'Diwali: Lakshmi Ganesh coins (plated, not pure silver) (7-day)';
    assert.ok(fits(coin, 'Silver Plated Lakshmi Ganesh Coin'));
    assert.ok(!fits(coin, '999 Pure Silver Lakshmi Ganesh Coin 10 g'));
  });

  it('gives a state only to a handmade piece that names its craft', () => {
    const madhubani = 'Diwali: Madhubani paintings (handpainted, with or without frame)';
    assert.equal(rows.find((r) => r.name === madhubani)?.region, 'bihar');
    assert.ok(fits(madhubani, 'Handpainted Madhubani Painting on Canvas with Frame'));
    assert.ok(!fits(madhubani, 'Madhubani Style Digital Print Painting'));
    assert.ok(!fits(madhubani, 'Handmade Warli Painting'));
    assert.ok(fits('Diwali: Bidriware', 'Bidri Work Flower Vase'));
    assert.ok(!fits('Diwali: Moradabad brass diyas and decor', 'Brass Diya Set LED'));
  });
});
