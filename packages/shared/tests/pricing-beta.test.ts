/**
 * D-127: the beta formula, fixed in code: (shop ₹ × 1.10 + kg × ₹2,000) ÷ the day's rate, food × 1.20, clothing ÷ 0.60,
 * home & gifts ÷ 0.50, to the cent (no ending); the same numbers as supabase/tests/pricing_engine.test.sql.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { autoPrice, pricingSettingsFrom, type PricingSettings } from '../src/domain';
import type { ProductType } from '../src/domain/product-types';

const beta: PricingSettings = { betaPricing: true, fxInrPerUsd: 96.3, fxBufferPct: 4, marginPct: 50 };
const price = (rupees: number, g: number, t: ProductType, s = beta) =>
  autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: t }, s);

describe('beta pricing (D-127)', () => {
  it('prices the founder\'s table', () => {
    assert.equal(price(90, 100, 'food')?.priceCents, 373);
    assert.equal(price(230, 1000, 'food')?.priceCents, 2807);
    assert.equal(price(699, 450, 'clothing')?.priceCents, 2888);
    assert.equal(price(350, 525, 'home')?.priceCents, 2980);
    assert.equal(price(90, 100, 'food')?.rule, 'beta');
  });

  it('keeps each type exactly at its margin (to the cent)', () => {
    for (const [r, g] of [[230, 1000], [180, 500], [400, 250]] as const) {
      const p = price(r, g, 'food')!;
      const m = (p.priceCents - p.costCents) / p.costCents;
      assert.ok(Math.abs(m - 0.2) < 0.001, `food ₹${r}: ${(m * 100).toFixed(2)}%`);
    }
    for (const [r, g, t, want] of [[1499, 900, 'clothing', 0.4], [1200, 1500, 'home', 0.5]] as const) {
      const p = price(r, g, t)!;
      assert.ok(Math.abs((p.priceCents - p.costCents) / p.priceCents - want) < 0.001, `${t} ₹${r}`);
    }
  });

  it('needs no buffer or other setting, only the rate; off, the full formula prices again', () => {
    assert.equal(price(90, 100, 'food', { ...beta, fxBufferPct: null })?.priceCents, 373);
    assert.equal(price(90, 100, 'food', { ...beta, fxInrPerUsd: null }), null);
    assert.equal(price(90, 100, 'food', { ...beta, betaPricing: false }), null, 'the full formula needs its settings');
    assert.equal(pricingSettingsFrom({ beta_pricing: true }).betaPricing, true);
    assert.equal(pricingSettingsFrom({}).betaPricing, false);
  });
});
