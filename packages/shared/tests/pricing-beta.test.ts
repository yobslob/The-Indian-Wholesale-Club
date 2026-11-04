/**
 * D-128: prices by the founder's exact rules, fixed in code: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category's divisor
 * (food 0.80, clothing 0.60, home & gifts 0.50) ÷ ₹92, to the cent; the same numbers as pricing_engine.test.sql.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { autoPrice, betaDivisor, betaSubtotalInr, fallbackWeightG, pricingSettingsFrom } from '../src/domain';
import type { ProductType } from '../src/domain/product-types';

const price = (rupees: number, g: number, t: ProductType) => autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: t });

describe('prices by the founder\'s exact rules (D-128)', () => {
  it('prices the founder\'s example and table', () => {
    assert.equal(price(100, 100, 'food')?.priceCents, 423, '₹100 · 100 g food: ₹311.11 ÷ 0.80 ÷ 92 = $4.23');
    assert.equal(price(180, 500, 'food')?.priceCents, 1630, 'mango pickle: ₹1,200 ÷ 0.80 ÷ 92');
    assert.equal(price(90, 100, 'food')?.priceCents, 408);
    assert.equal(price(230, 1000, 'food')?.priceCents, 3065);
    assert.equal(price(699, 450, 'clothing')?.priceCents, 3037);
    assert.equal(price(350, 525, 'home')?.priceCents, 3128);
    assert.equal(price(1200, 1500, 'home')?.priceCents, 9420);
  });

  // D-187: taken before the paused formula went, from this code and from the database's _auto_price_cents() on the
  // migrated local schema; all thirty agreed. [shop paise, grams, clothing, food, home].
  const PINNED = [
    [1, 1, 4, 3, 4],
    [1250, 120, 460, 345, 552],
    [4999, 75, 372, 279, 447],
    [9900, 250, 1105, 829, 1326],
    [18000, 500, 2174, 1630, 2609],
    [35000, 525, 2607, 1955, 3128],
    [69900, 450, 3037, 2278, 3645],
    [100000, 1000, 5636, 4227, 6763],
    [123456, 333, 3692, 2769, 4430],
    [149900, 900, 6278, 4709, 7534],
  ] as const;

  it('no price moved when the paused formula went (D-187, Y-2)', () => {
    for (const [shop, g, clothing, food, home] of PINNED) {
      const at = (productType: ProductType) => autoPrice({ shopPricePaise: shop, weightG: g, productType })?.priceCents;
      assert.equal(at('clothing'), clothing, `clothing ${shop} paise, ${g} g`);
      assert.equal(at('food'), food, `food ${shop} paise, ${g} g`);
      assert.equal(at('home'), home, `home ${shop} paise, ${g} g`);
    }
  });

  it('works out the subtotal in rupees and the divisor by category', () => {
    assert.equal(betaSubtotalInr(18000, 500), 1200);
    assert.equal(betaDivisor('food'), 0.8);
    assert.equal(betaDivisor('clothing'), 0.6);
    assert.equal(betaDivisor('home'), 0.5);
  });

  it('keeps each category at its margin of the price (to the cent)', () => {
    for (const [r, g, t, want] of [
      [230, 1000, 'food', 0.2], [180, 500, 'food', 0.2], [1499, 900, 'clothing', 0.4], [1200, 1500, 'home', 0.5],
    ] as const) {
      const p = price(r, g, t)!;
      const m = 1 - (betaSubtotalInr(r * 100, g) * 100) / 92 / p.priceCents;
      assert.ok(Math.abs(m - want) < 0.001, `${t} ₹${r}: ${(m * 100).toFixed(2)}%`);
    }
  });

  it('a type it does not know prices as clothing; no shop price or weight, no price', () => {
    assert.equal(autoPrice({ shopPricePaise: 69900, weightG: 450 })?.priceCents, 3037);
    assert.equal(autoPrice({ shopPricePaise: 1000, weightG: null }), null);
    assert.equal(autoPrice({ shopPricePaise: null, weightG: 100 }), null);
  });

  it('refuses impossible input', () => {
    assert.throws(() => autoPrice({ shopPricePaise: -1, weightG: 100 }), RangeError);
    assert.throws(() => autoPrice({ shopPricePaise: 100, weightG: 0 }), RangeError);
  });

  it('home & gifts without a weight is estimated from its shop price (D-121)', () => {
    const s = pricingSettingsFrom({ home_est_g_per_rupee: 2, home_est_min_g: 100 });
    assert.equal(fallbackWeightG('home', 20000, 1500, s), 400);
    assert.equal(fallbackWeightG('home', 1000, 1500, s), 100);
    assert.equal(fallbackWeightG('home', 200000, 1500, s), 1500);
    assert.equal(fallbackWeightG('food', 20000, 300, s), 300);
    assert.equal(fallbackWeightG('home', 20000, 1500, pricingSettingsFrom({})), 1500);
  });
});
