/**
 * D-128: the beta by the founder's exact rules, fixed in code: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category's divisor
 * (food 0.80, clothing 0.60, home & gifts 0.50) ÷ ₹92, to the cent; the same numbers as pricing_engine.test.sql.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { autoPrice, betaDivisor, betaSubtotalInr, pricingSettingsFrom, type PricingSettings } from '../src/domain';
import type { ProductType } from '../src/domain/product-types';

const beta: PricingSettings = { betaPricing: true, fxInrPerUsd: 96.3, fxBufferPct: 4, marginPct: 50 };
const price = (rupees: number, g: number, t: ProductType, s = beta) =>
  autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: t }, s);

describe('beta pricing by the founder\'s exact rules (D-128)', () => {
  it('prices the founder\'s example and table', () => {
    assert.equal(price(100, 100, 'food')?.priceCents, 423, '₹100 · 100 g food: ₹311.11 ÷ 0.80 ÷ 92 = $4.23');
    assert.equal(price(180, 500, 'food')?.priceCents, 1630, 'mango pickle: ₹1,200 ÷ 0.80 ÷ 92');
    assert.equal(price(90, 100, 'food')?.priceCents, 408);
    assert.equal(price(230, 1000, 'food')?.priceCents, 3065);
    assert.equal(price(699, 450, 'clothing')?.priceCents, 3037);
    assert.equal(price(350, 525, 'home')?.priceCents, 3128);
    assert.equal(price(1200, 1500, 'home')?.priceCents, 9420);
    assert.equal(price(90, 100, 'food')?.rule, 'beta');
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

  it('converts at a fixed ₹92 and needs no setting; off, the full formula prices again', () => {
    assert.equal(price(90, 100, 'food', { ...beta, fxBufferPct: null })?.priceCents, 408);
    assert.equal(price(90, 100, 'food', { ...beta, fxInrPerUsd: null })?.priceCents, 408);
    assert.equal(price(90, 100, 'food', { ...beta, fxInrPerUsd: 80 })?.priceCents, 408, 'the day\'s rate does not move it');
    assert.equal(price(90, 100, 'food', { ...beta, betaPricing: false }), null, 'the full formula needs its settings');
    assert.equal(pricingSettingsFrom({ beta_pricing: true }).betaPricing, true);
    assert.equal(pricingSettingsFrom({}).betaPricing, false);
  });
});
