/**
 * D-126: the courier at ₹2,000 a kg, clothing 42%, home & gifts 50%, food packed tighter and in a 17–20% band on its
 * cost; the same numbers as supabase/tests/pricing_engine.test.sql. No sample bag loses: Shipping brings what a food
 * piece in the band cannot (D-125).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { autoPrice, bandPrice, checkBag, SAMPLE_BAGS, type PricingSettings } from '../src/domain';
import type { ProductType } from '../src/domain/product-types';

const d126: PricingSettings = {
  fxInrPerUsd: 96.3, fxBufferPct: 4, marginPct: 50, typeMarginPct: { clothing: 42, food: 17, home: 50 },
  shopDivisor: 0.9, shipPaisePer100g: 20000, minMarginPct: { clothing: 35, home: 40 },
  taperCents: { clothing: { from: 2000, to: 15000 }, home: { from: 1500, to: 10000 } },
  indiaHandlingPct: 10, foodFeePaise: 1500, foodParcelKg: 5, foodBilledPct: 110, foodMarginMaxPct: 20,
  courierFirstKgPaise: 200000, courierNextKgPaise: 200000, parcelFixedPaise: 0,
  dutyPct: { clothing: 22, food: 16, home: 13 }, minProfitCents: { clothing: 400, food: 0, home: 400 },
  minProfitPct: 8, minProfitFoodPct: 4, guardCardFeePct: 2.9,
  smallFoodMaxShopPaise: 20000, smallFoodMaxG: 250, smallFoodShipSharePct: 100, smallFoodFloorCents: 199,
  smallFoodCeilingCents: 399,
};
const price = (rupees: number, g: number, t: ProductType, s = d126) =>
  autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: t }, s);

describe('the food margin band and the courier at ₹2,000 (D-126)', () => {
  it('prices the founder\'s table', () => {
    assert.equal(price(90, 100, 'food')?.priceCents, 429);
    assert.equal(price(230, 1000, 'food')?.priceCents, 3129);
    assert.equal(price(180, 250, 'food')?.priceCents, 969);
    assert.equal(price(40, 100, 'food')?.priceCents, 369);
    assert.equal(price(699, 450, 'clothing')?.priceCents, 3129);
    assert.equal(price(1499, 900, 'clothing')?.priceCents, 6369);
    assert.equal(price(350, 525, 'home')?.priceCents, 3129);
    assert.equal(price(90, 100, 'food')?.rule, 'band');
  });

  it('keeps food between 17% and 20% on its cost wherever an ending fits', () => {
    for (const [r, g] of [[50, 100], [90, 100], [55, 200], [100, 400], [230, 1000], [400, 250], [200, 400], [180, 500]]) {
      const p = price(r!, g!, 'food')!;
      const m = (p.priceCents - p.costCents) / p.costCents;
      assert.ok(m >= 0.165 && m <= 0.205, `₹${r} · ${g} g: ${(m * 100).toFixed(1)}%`);
    }
  });

  it('bandPrice: the first ending over the bottom; past the top, the nearer ending (a tie goes up)', () => {
    assert.equal(bandPrice(1000, 17, 20), 1179);
    assert.equal(bandPrice(303, 17, 20), 369);
    assert.equal(bandPrice(300, 17, 20), 349);
  });

  it('an empty band top brings back the guard and the shelf', () => {
    assert.notEqual(price(90, 100, 'food', { ...d126, foodMarginMaxPct: null })?.rule, 'band');
  });

  it('no sample bag loses: Shipping brings what the band leaves out', () => {
    const charges = { freeMinCents: 14999, shippingCents: 1879, retailerCents: 99, retailerPct: 1.5, bulk: { pct: 10, capCents: 2500 } };
    const one = (rupees: number, grams: number) => ({ name: `₹${rupees} · ${grams} g`, note: '', pieces: [[rupees, grams, 'food']] as const });
    for (const bag of [...SAMPLE_BAGS, one(90, 100), one(100, 400), one(230, 1000)]) {
      const r = checkBag(bag, d126, charges)!;
      assert.ok(r.profitCents >= 0, `${bag.name}: ${r.profitCents}`);
    }
  });
});
