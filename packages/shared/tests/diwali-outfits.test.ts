/**
 * The Diwali outfits list (D-167, `tools/sourcing-runner/targets/diwali-outfits.csv`): every row uploads with the
 * Myntra list's conventions (D-121, D-122), keeps each row to its wearer, and gives a state only to a handloom or
 * hand-made piece the title names (D-004).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parseTargetsCsv, targetMatcher, type SourcingTarget, type TargetRow } from '../src/sourcing/auto';

const read = (file: string) =>
  parseTargetsCsv(readFileSync(new URL(`../../../tools/sourcing-runner/targets/${file}`, import.meta.url), 'utf8'));
const { rows, errors } = read('diwali-outfits.csv');

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

describe('the Diwali outfits targets', () => {
  it('uploads whole: clothing only, names unique (also against the home list), patterns under the limit', () => {
    assert.deepEqual(errors, []);
    assert.equal(rows.length, 63);
    assert.ok(rows.every((r) => r.product_type === 'clothing' && r.name.startsWith('Diwali: ')));
    const home = read('diwali-home-gifts.csv').rows.map((r) => r.name.toLowerCase());
    const names = rows.map((r) => r.name.toLowerCase());
    assert.equal(new Set(names).size, rows.length);
    assert.ok(names.every((n) => !home.includes(n)));
    for (const r of rows) {
      assert.ok(r.must_match && r.must_match.length <= 300, r.name);
      assert.doesNotThrow(() => new RegExp(r.must_match!, 'i'), r.name);
    }
  });

  it('keeps the Myntra list\'s shop, bands and counts', () => {
    for (const r of rows) {
      assert.deepEqual(r.shops, ['myntra'], r.name);
      const band = r.category === 'footwear' ? [40_000, 90_000] : [60_000, 160_000];
      assert.deepEqual([r.min_price_paise, r.max_price_paise], band, r.name);
      assert.ok(r.listings! >= 10 && r.listings! <= 25, r.name);
    }
  });

  it('keeps each row to its wearer', () => {
    const women = "Diwali: women's festive kurta sets with dupatta";
    assert.ok(fits(women, 'Women Embroidered Kurta with Trousers & Dupatta'));
    assert.ok(!fits(women, 'Girls Embroidered Kurta with Trousers & Dupatta'));
    assert.ok(!fits(women, 'Women Unstitched Dress Material with Dupatta'));
    const men = "Diwali: men's festive kurta pyjama sets";
    assert.ok(fits(men, 'Men Woven Design Kurta with Pyjamas'));
    assert.ok(!fits(men, 'Boys Kurta with Pyjamas'));
    assert.ok(!fits(men, 'Men Kurta with Pyjamas & Nehru Jacket'));
    assert.ok(fits("Diwali: men's kurta sets with Nehru jacket", 'Men Kurta with Pyjamas & Nehru Jacket'));
    assert.ok(fits("Diwali: boys' kurta pyjama sets", 'Boys Kurta with Pyjamas'));
    assert.ok(!fits("Diwali: boys' kurta pyjama sets", 'Men Kurta with Pyjamas'));
    assert.ok(fits("Diwali: men's sherwanis (with kurta, churidar, dupatta or stole)", 'Men Sherwani Set with Kurta, Churidar & Stole'));
    assert.ok(fits('Diwali: festive silk sarees', 'Woven Design Zari Silk Blend Banarasi Saree'));
    assert.ok(fits("Diwali: women's embellished juttis and mojaris", 'Women Embellished Mojaris'));
  });

  it('gives a state only to a handloom or hand-made piece that names its craft', () => {
    const banarasi = 'Diwali: Banarasi handloom sarees';
    assert.equal(rows.find((r) => r.name === banarasi)?.region, 'uttar-pradesh');
    assert.ok(fits(banarasi, 'Banarasi Handloom Pure Silk Saree'));
    assert.ok(!fits(banarasi, 'Banarasi Silk Saree'));
    assert.ok(!fits(banarasi, 'Banarasi Style Art Silk Saree'));
    assert.ok(!fits(banarasi, 'Banarasi Handloom Look Printed Saree'));
    const chikan = 'Diwali: Lucknowi chikankari kurtas, hand-embroidered';
    assert.ok(fits(chikan, 'Women Lucknowi Chikankari Hand Embroidered Cotton Kurta'));
    assert.ok(!fits(chikan, 'Women Chikankari Embroidered Kurta'));
    assert.ok(!fits('Diwali: Bengal tant and jamdani handloom sarees', 'Dhakai Jamdani Handloom Saree'));
    assert.ok(fits('Diwali: Pochampally ikat handloom sarees', 'Pochampally Ikat Handloom Cotton Saree'));
    assert.ok(!fits('Diwali: Pochampally ikat handloom sarees', 'Pochampally Ikat Printed Saree'));
    assert.equal(rows.filter((r) => r.region !== null).length, 22);
  });
});
