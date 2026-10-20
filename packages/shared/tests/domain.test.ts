import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CUSTOMER_STATUSES,
  PRINT_SIZE,
  pictureGroups,
  samePicture,
  sharpest,
  type PhotoPrint,
  CUSTOMER_STATUS_LABEL,
  attributesSchemaFor,
  autoPrice,
  bulkProgress,
  bagChargesAt,
  bulkSavingCents,
  checkBag,
  SAMPLE_BAGS,
  choose,
  clothingAttributesSchema,
  contrastRatio,
  fallbackWeightG,
  formatUsPhone,
  usPhoneDigits,
  findVariant,
  formatDeliveryWindow,
  formatUsd,
  isAvailable,
  isWindowAtRisk,
  listingInputSchema,
  listingSlug,
  nextCycleStatus,
  optionAxes,
  orderEventLabel,
  quoteCheckout,
  copyFor,
  hasCopies,
  mediaPath,
  photoJpegUrl,
  photoSrcSet,
  photoUrl,
  storedPath,
  storeKeys,
  selectionOf,
  shippingAddressSchema,
  foodAttributesSchema,
  timelineIndex,
  trackingUrl,
  variantLabel,
  worstContrast,
} from '../src/domain';
import type { PricingSettings, ProductType } from '../src/domain';

const settings = { fxInrPerUsd: 80, freightCentsPerKg: 1000, dutyPct: 10, marginPct: 50 };

describe('autoPrice (D-119): the same numbers as supabase/tests/pricing_engine.test.sql', () => {
  const guardOff = {
    dutyPct: { clothing: 0, food: 0, home: 0 },
    minProfitCents: { clothing: 0, food: 0, home: 0 },
    minProfitPct: 0,
    minProfitFoodPct: 0,
    guardCardFeePct: 0,
  };
  const simple: PricingSettings = {
    fxInrPerUsd: 100, fxBufferPct: 0, marginPct: 0, typeMarginPct: { clothing: 0 }, shopDivisor: 1, shipPaisePer100g: 10000,
    ...guardOff,
  };
  // The founder's numbers (D-119, the final tuner) at ₹96.30 to the dollar.
  const full: PricingSettings = {
    fxInrPerUsd: 96.3, fxBufferPct: 4, marginPct: 50, typeMarginPct: { clothing: 50, food: 25, home: 60 },
    shopDivisor: 0.9, shipPaisePer100g: 14600, minMarginPct: { clothing: 38, home: 45 },
    taperCents: { clothing: { from: 2000, to: 15000 }, home: { from: 1500, to: 10000 } },
    indiaHandlingPct: 10, foodFeePaise: 1500, foodParcelKg: 5, foodBilledPct: 140,
    courierFirstKgPaise: 224200, courierNextKgPaise: 67850, parcelFixedPaise: 105000,
    dutyPct: { clothing: 22, food: 16, home: 13 }, minProfitCents: { clothing: 400, food: 0, home: 400 },
    minProfitPct: 8, minProfitFoodPct: 4, guardCardFeePct: 2.9,
  };
  const price = (rupees: number, g: number, productType: ProductType, s = full) =>
    autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType }, s)?.priceCents;

  it('rounds up to the next .29, .49, .69, .79 or .99 (D-126)', () => {
    assert.equal(autoPrice({ shopPricePaise: 100000, weightG: 1000 }, simple)?.priceCents, 2029); // $20.00
    assert.equal(autoPrice({ shopPricePaise: 103000, weightG: 1000 }, simple)?.priceCents, 2049); // $20.30
    assert.equal(autoPrice({ shopPricePaise: 105000, weightG: 1000 }, simple)?.priceCents, 2069); // $20.50
    assert.equal(autoPrice({ shopPricePaise: 107000, weightG: 1000 }, simple)?.priceCents, 2079); // $20.70
    assert.equal(autoPrice({ shopPricePaise: 108000, weightG: 1000 }, simple)?.priceCents, 2099); // $20.80
    assert.equal(autoPrice({ shopPricePaise: 104900, weightG: 1000 }, simple)?.priceCents, 2049); // $20.49 stays
  });

  it('the founder\'s margin divides: cost ÷ (1 − 50%), shop ÷ 0.90', () => {
    const half = { ...simple, typeMarginPct: { clothing: 50 } };
    assert.equal(price(1000, 1000, 'clothing', half), 4029);
    assert.equal(price(900, 1000, 'clothing', { ...half, shopDivisor: 0.9 }), 4029);
  });

  it('the worked examples: clothing and home taper, food has the guard', () => {
    assert.equal(price(1299, 450, 'clothing'), 4529);
    assert.equal(price(7500, 900, 'clothing'), 18069);
    assert.equal(price(12000, 2500, 'clothing'), 29649);
    assert.equal(price(1800, 1200, 'home'), 9129);
    assert.equal(price(650, 400, 'home'), 3549);
    assert.equal(price(90, 100, 'food'), 399);
    assert.equal(price(150, 250, 'food'), 849);
    assert.equal(price(220, 400, 'food'), 1329);
  });

  it('says which rule set the price', () => {
    assert.equal(autoPrice({ shopPricePaise: 1200000, weightG: 2500, productType: 'clothing' }, full)?.rule, 'tapered');
    assert.equal(autoPrice({ shopPricePaise: 15000, weightG: 250, productType: 'food' }, full)?.rule, 'guard');
    assert.equal(price(150, 250, 'food', { ...full, ...guardOff }), 829);
    assert.equal(autoPrice({ shopPricePaise: 15000, weightG: 250, productType: 'food' }, { ...full, ...guardOff })?.rule, 'recipe');
  });

  it('the taper keeps a big piece from doubling', () => {
    const noTaper = { ...full, minMarginPct: {} };
    assert.ok(price(12000, 2500, 'clothing', noTaper)! > 34000);
    assert.equal(price(1299, 450, 'clothing', noTaper), 4549);
  });

  it('a type without its own margin uses the general one; with neither there is no price', () => {
    assert.equal(price(150, 250, 'food', { ...full, marginPct: 25, typeMarginPct: { ...full.typeMarginPct, food: null } }), 849);
    assert.equal(price(150, 250, 'food', { ...full, marginPct: null, typeMarginPct: { food: null } }), undefined);
  });

  it('returns null while a setting the recipe needs, the shop price or the weight is missing', () => {
    assert.equal(autoPrice({ shopPricePaise: 1000, weightG: null }, full), null);
    assert.equal(autoPrice({ shopPricePaise: null, weightG: 100 }, full), null);
    assert.equal(price(1299, 450, 'clothing', { ...full, shopDivisor: null }), undefined);
    assert.equal(price(90, 100, 'food', { ...full, shopDivisor: null }), 399);
    assert.equal(price(90, 100, 'food', { ...full, courierFirstKgPaise: null }), undefined);
    assert.ok(price(1299, 450, 'clothing', { ...full, minProfitPct: null }));
  });

  it('refuses impossible input', () => {
    assert.throws(() => autoPrice({ shopPricePaise: -1, weightG: 100 }, full), RangeError);
    assert.throws(() => autoPrice({ shopPricePaise: 100, weightG: 0 }, full), RangeError);
    assert.throws(() => autoPrice({ shopPricePaise: 100, weightG: 100 }, { ...full, fxInrPerUsd: 0 }), RangeError);
  });

  it('the profit check: every sample bag over the line makes money at the founder\'s numbers', () => {
    const charges = { freeMinCents: 14999, shippingCents: 1879, retailerCents: 199, bulk: { pct: 10, capCents: 2500 } };
    for (const bag of SAMPLE_BAGS) {
      const r = checkBag(bag, full, charges)!;
      assert.ok(r, bag.name);
      if (r.goodsCents >= 14999) assert.ok(r.profitCents > 0, `${bag.name} makes money`);
      assert.equal(r.paysCents, r.goodsCents + r.chargesCents - r.bulkSavingCents);
    }
    assert.equal(checkBag(SAMPLE_BAGS[0]!, { ...full, shopDivisor: null }, charges), null);
  });

  describe('the small-food shelf (D-120, D-125), as pricing_engine.test.sql', () => {
    const shelf: PricingSettings = {
      ...full,
      smallFoodMaxShopPaise: 20000, smallFoodMaxG: 250, smallFoodShipSharePct: 100,
      smallFoodFloorCents: 199, smallFoodCeilingCents: 399,
    };
    const rule = (rupees: number, g: number, s = shelf) =>
      autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: 'food' }, s)?.rule;

    it('rounds a light, cheap piece to its step, never under its whole cost', () => {
      assert.equal(price(20, 20, 'food', shelf), 199);
      assert.equal(price(90, 100, 'food', shelf), 399);
      assert.equal(price(50, 100, 'food', shelf), 349, 'its recipe is under the next step: the recipe');
      assert.equal(rule(90, 100), 'small');
    });

    it('D-125: a piece whose whole cost is above the top step keeps its recipe (was $3.99, under cost)', () => {
      assert.equal(price(150, 250, 'food', shelf), 849);
      assert.equal(price(55, 200, 'food', shelf), 599);
      assert.equal(rule(150, 250), 'guard');
      assert.equal(price(220, 400, 'food', shelf), 1329);
      assert.ok(price(90, 100, 'clothing', shelf)! > 399);
    });

    it('an empty number turns the shelf off', () => {
      assert.equal(price(90, 100, 'food', { ...shelf, smallFoodShipSharePct: null }), 399);
      assert.equal(rule(90, 100, { ...shelf, smallFoodCeilingCents: null }), 'guard');
    });

    it('D-122: a share below 100% takes part of the flight out of the price', () => {
      const d122 = { ...shelf, foodShipSharePct: 70 };
      assert.equal(price(100, 400, 'food', d122), 849);
      assert.equal(price(230, 1000, 'food', d122), 2049);
      assert.equal(price(100, 400, 'food', shelf), 1129, 'no share set: the whole flight (D-119, D-125)');
    });

    it('D-125: no sample bag loses, small or big, and Shipping makes up what a share below 100% leaves out', () => {
      const charges = { freeMinCents: 14999, shippingCents: 1879, retailerCents: 99, retailerPct: 1.5, bulk: { pct: 10, capCents: 2500 } };
      const one = (rupees: number, grams: number) => ({ name: 'one', note: '', pieces: [[rupees, grams, 'food']] as const });
      for (const s of [shelf, { ...shelf, foodShipSharePct: 30, smallFoodShipSharePct: 30 }]) {
        for (const bag of [...SAMPLE_BAGS, one(90, 100), one(100, 400), one(230, 1000)]) {
          const r = checkBag(bag, s, charges)!;
          assert.ok(r.profitCents >= 0, `${bag.name} at ${s.foodShipSharePct ?? 100}%: ${r.profitCents}`);
        }
      }
      const masala = checkBag(one(90, 100), shelf, charges)!;
      assert.ok(masala.chargesCents > 1879 + 99, 'one masala pays more than $18.79: a parcel costs about $34 to fly');
    });
  });
});

describe('bulk saving (D-119)', () => {
  const bulk = { pct: 10, capCents: 2500 };
  it('grows with the amount over the line, then stops at the cap', () => {
    assert.equal(bulkSavingCents(14998, 14999, bulk), 0);
    assert.equal(bulkSavingCents(14999, 14999, bulk), 0);
    assert.equal(bulkSavingCents(19999, 14999, bulk), 500);
    assert.equal(bulkSavingCents(39999, 14999, bulk), 2500);
    assert.equal(bulkSavingCents(99999, 14999, bulk), 2500);
    assert.equal(bulkSavingCents(99999, null, bulk), 0);
    assert.equal(bulkSavingCents(99999, 14999, null), 0);
  });
  it('tells the pill how far it has come', () => {
    assert.deepEqual(bulkProgress(19999, 14999, bulk), { savingCents: 500, capped: false, capCents: 2500, perDollarCents: 1000, share: 0.2 });
    assert.equal(bulkProgress(50000, 14999, bulk).capped, true);
    assert.equal(bulkProgress(50000, 14999, bulk).perDollarCents, null);
  });
  it('checkout takes it off the goods, before tax, and keeps it apart from the promo', () => {
    const shipping = { flatCents: 0, freeMinCents: 14999, express: null, bulkSaving: bulk };
    const q = quoteCheckout([{ unitPriceCents: 20000, quantity: 1, taxable: true }], null, shipping, 'standard', { ratePct: 10 })!;
    assert.equal(q.bulkSavingCents, 500);
    assert.equal(q.discountCents, 0);
    assert.equal(q.taxCents, 1950);
    assert.equal(q.totalCents, 20000 - 500 + 1950);
    const promo = quoteCheckout([{ unitPriceCents: 20000, quantity: 1 }], { discountType: 'fixed', discountValue: 4000, minOrderCents: 0 }, shipping)!;
    assert.equal(promo.bulkSavingCents, 100, 'the saving counts from the discounted subtotal');
  });
});

describe('delivery windows (D-008)', () => {
  it('formats YYYY-MM-DD dates as UTC calendar days (no off-by-one)', () => {
    assert.equal(formatDeliveryWindow('2026-10-30', '2026-11-04'), 'Oct 30 – Nov 4');
    assert.equal(formatDeliveryWindow('2026-12-31', '2027-01-02'), 'Dec 31 – Jan 2');
  });

  it('rejects non-date input', () => {
    assert.throws(() => formatDeliveryWindow('2026-10-30T00:00:00Z', '2026-11-04'), RangeError);
  });

  it('flags a window at risk when arrival + slowest domestic days passes the promise', () => {
    assert.equal(
      isWindowAtRisk({ promisedTo: '2026-11-04', estArrivalOn: '2026-10-28', domesticDaysMax: 7 }),
      false,
    );
    assert.equal(
      isWindowAtRisk({ promisedTo: '2026-11-04', estArrivalOn: '2026-10-29', domesticDaysMax: 7 }),
      true,
    );
  });
});

describe('customer-facing order status (D-034, D-003)', () => {
  it('has a label for every customer status', () => {
    for (const status of CUSTOMER_STATUSES) assert.ok(CUSTOMER_STATUS_LABEL[status], status);
    assert.equal(CUSTOMER_STATUS_LABEL.preparing, 'Preparing your order');
  });

  it('places statuses on the timeline', () => {
    assert.equal(timelineIndex('confirmed'), 0);
    assert.equal(timelineIndex('delivered'), 3);
    assert.equal(timelineIndex('cancelled'), -1);
  });

  it('never shows a raw internal event kind to customers', () => {
    assert.equal(orderEventLabel('order_confirmed'), 'Order confirmed');
    assert.equal(orderEventLabel('order_cancelled'), 'Order cancelled');
    assert.equal(orderEventLabel('vendor_called_back'), 'Order updated');
  });
});

describe('product attributes are strict (D-003)', () => {
  it('accepts valid clothing attributes', () => {
    assert.ok(
      clothingAttributesSchema.safeParse({
        fibre_content: '100% cotton',
        care: 'Dry clean',
        length_m: 5.5,
      }).success,
    );
  });

  it('rejects unknown keys so vendor details can never be stored for customers', () => {
    const result = clothingAttributesSchema.safeParse({
      fibre_content: 'Silk',
      care: 'Dry clean',
      vendor_id: 'x',
    });
    assert.equal(result.success, false);
  });

  it('requires fibre content and care for clothing (US textile labelling)', () => {
    assert.equal(clothingAttributesSchema.safeParse({ care: 'Dry clean' }).success, false);
  });

  it('requires ingredients, allergens and shelf life for food', () => {
    assert.ok(
      foodAttributesSchema.safeParse({
        ingredients: 'Cardamom',
        allergens: [],
        shelf_life_days: 365,
      }).success,
    );
    assert.equal(
      foodAttributesSchema.safeParse({ ingredients: 'Cardamom', allergens: [] }).success,
      false,
    );
  });

  it('picks the schema by product type', () => {
    assert.equal(attributesSchemaFor('food'), foodAttributesSchema);
    assert.equal(attributesSchemaFor('clothing'), clothingAttributesSchema);
  });
});

describe('checkout quote (flows.md §3, D-041, D-070, D-073)', () => {
  const shipping = { flatCents: 900, freeMinCents: 10000, express: { baseCents: 1500, minCourierCents: 2200 } };
  const nj = { ratePct: 6.625 };

  it('D-111: a small order pays its charges; from the free line up they are waived and shown', () => {
    const smallOrder = { shippingCents: 1979, retailerCents: 199 };
    const settings = { flatCents: 0, freeMinCents: 14999, express: null, smallOrder };
    const small = quoteCheckout([{ unitPriceCents: 3929, quantity: 1 }], null, settings)!;
    assert.deepEqual([small.shippingCents, small.retailerCents, small.totalCents], [1979, 199, 3929 + 1979 + 199]);
    const big = quoteCheckout([{ unitPriceCents: 3929, quantity: 4 }], null, settings)!;
    assert.deepEqual([big.shippingCents, big.retailerCents, big.totalCents], [0, 0, 3929 * 4]);
    assert.deepEqual(big.waivedCents, { shipping: 1979, retailer: 199 });
    // Express has its own fee: no small-order charges.
    const express = { ...settings, express: { baseCents: 1500, minCourierCents: 2200 } };
    assert.equal(quoteCheckout([{ unitPriceCents: 3929, quantity: 1 }], null, express, 'express')!.retailerCents, 0);
    // A promo that takes the bag under the line brings the charges back.
    const promo = { discountType: 'percentage' as const, discountValue: 10, minOrderCents: 0 };
    assert.equal(quoteCheckout([{ unitPriceCents: 3929, quantity: 4 }], promo, settings)!.retailerCents, 199);
  });

  it('D-125: Shipping as the bag works it out; struck through and free from the line, unless the bag still needs it', () => {
    const smallOrder = { shippingCents: 3679, pastLineCents: 0, retailerCents: 99, retailerPct: 1.5 };
    const at = (goods: number, small = smallOrder) => bagChargesAt(goods, 14999, small);
    assert.deepEqual([at(399).shippingCents, at(399).retailerCents], [3679, 99], 'one masala: what its parcel needs');
    assert.deepEqual([at(10000).shippingCents, at(10000).retailerCents], [3679, 150]);
    const big = at(30000);
    assert.deepEqual(
      [big.shippingCents, big.waivedShippingCents, big.retailerCents, big.waivedRetailerCents],
      [0, 3679, 0, 450],
      'past the line: struck through and free',
    );
    const owes = at(30000, { ...smallOrder, pastLineCents: 1229 });
    assert.deepEqual([owes.shippingCents, owes.waivedShippingCents], [1229, 0], 'a bag that cannot pay its way past the line still pays it');
    const settings = { flatCents: 0, freeMinCents: 14999, express: null, smallOrder };
    const q = quoteCheckout([{ unitPriceCents: 30000, quantity: 1 }], null, settings)!;
    assert.deepEqual([q.shippingCents, q.retailerCents, q.totalCents], [0, 0, 30000]);
    assert.deepEqual(q.waivedCents, { shipping: 3679, retailer: 450 });
    const small = quoteCheckout([{ unitPriceCents: 399, quantity: 1 }], null, settings)!;
    assert.deepEqual([small.shippingCents, small.retailerCents, small.totalCents], [3679, 99, 399 + 3679 + 99]);
  });

  it('adds subtotal and flat shipping; no tax where IWC is not registered (D-073)', () => {
    const quote = quoteCheckout([{ unitPriceCents: 2500, quantity: 2 }], null, shipping);
    assert.deepEqual(quote, {
      subtotalCents: 5000,
      discountCents: 0,
      bulkSavingCents: 0,
      shippingCents: 900,
      retailerCents: 0,
      waivedCents: { shipping: 0, retailer: 0 },
      taxCents: 0,
      totalCents: 5900,
      promoApplied: false,
    });
  });

  it('taxes only the taxable lines in a registered state (NJ exempts clothing)', () => {
    const clothing = { unitPriceCents: 5000, quantity: 1, taxable: false };
    const accessory = { unitPriceCents: 5000, quantity: 1, taxable: true };
    assert.equal(quoteCheckout([clothing], null, shipping, 'standard', nj)?.taxCents, 0);
    // half the order is taxable: 6.625% of (10000 + free shipping) x 1/2 = 331.25, rounds to 331
    assert.equal(quoteCheckout([clothing, accessory], null, shipping, 'standard', nj)?.taxCents, 331);
  });

  it('ships free once the discounted subtotal reaches the threshold', () => {
    const quote = quoteCheckout([{ unitPriceCents: 10000, quantity: 1 }], null, shipping);
    assert.equal(quote?.shippingCents, 0);
    assert.equal(quote?.totalCents, 10000);
  });

  it('refuses to guess shipping when an option has no price (D-040)', () => {
    const none = { flatCents: null, freeMinCents: null, express: null };
    assert.equal(quoteCheckout([{ unitPriceCents: 100, quantity: 1 }], null, none), null);
    assert.equal(quoteCheckout([{ unitPriceCents: 100, quantity: 1 }], null, none, 'express'), null);
  });

  it('applies percentage and fixed promos, never below zero, only above the minimum', () => {
    const lines = [{ unitPriceCents: 4000, quantity: 1 }];
    const pct = quoteCheckout(lines, { discountType: 'percentage', discountValue: 25, minOrderCents: 0 }, shipping);
    assert.equal(pct?.discountCents, 1000);
    const fixed = quoteCheckout(lines, { discountType: 'fixed', discountValue: 9999, minOrderCents: 0 }, shipping);
    assert.equal(fixed?.discountCents, 4000);
    assert.equal(fixed?.totalCents, 900);
    const below = quoteCheckout(lines, { discountType: 'fixed', discountValue: 500, minOrderCents: 5000 }, shipping);
    assert.equal(below?.discountCents, 0);
    assert.equal(below?.promoApplied, false);
  });

  it('always balances: total = subtotal - discount + shipping + tax (orders CHECK)', () => {
    for (const unit of [1, 99, 1234, 55555]) {
      for (const qty of [1, 3]) {
        for (const method of ['standard', 'express'] as const) {
          const q = quoteCheckout(
            [{ unitPriceCents: unit, quantity: qty, taxable: true, courierCents: 900 }],
            null,
            shipping,
            method,
            nj,
          );
          assert.ok(q);
          assert.equal(q.totalCents, q.subtotalCents - q.discountCents + q.shippingCents + q.taxCents);
        }
      }
    }
  });

  it('rejects impossible lines', () => {
    assert.throws(() => quoteCheckout([], null, shipping), RangeError);
    assert.throws(() => quoteCheckout([{ unitPriceCents: 10, quantity: 0 }], null, shipping), RangeError);
    assert.throws(() => quoteCheckout([{ unitPriceCents: 1.5, quantity: 1 }], null, shipping), RangeError);
  });

  it('D-070: express = per order + the courier for every piece, never below the minimum, no free threshold', () => {
    const lines = [{ unitPriceCents: 20000, quantity: 2, courierCents: 1980 }];
    const express = quoteCheckout(lines, null, { ...shipping, freeMinCents: 100 }, 'express');
    assert.equal(express?.shippingCents, 1500 + 3960);
    const light = quoteCheckout([{ unitPriceCents: 2000, quantity: 1, courierCents: 550 }], null, shipping, 'express');
    assert.equal(light?.shippingCents, 1500 + 2200, 'the courier minimum applies');
  });

  it('formats cents as US dollars', () => {
    assert.equal(formatUsd(123456), '$1,234.56');
  });
});

describe('shipping address (US only)', () => {
  it('normalises a valid address', () => {
    const parsed = shippingAddressSchema.parse({
      fullName: ' Asha Rao ',
      line1: '1 Main St',
      line2: '',
      city: 'Edison',
      state: 'nj',
      zipCode: '08817',
    });
    assert.deepEqual(parsed, {
      fullName: 'Asha Rao',
      line1: '1 Main St',
      line2: null,
      city: 'Edison',
      state: 'NJ',
      zipCode: '08817',
      phone: null,
    });
  });

  it('rejects non-US states and ZIPs', () => {
    const base = {
      fullName: 'Asha Rao',
      line1: '1 Main St',
      city: 'Edison',
      state: 'NJ',
      zipCode: '08817',
    };
    assert.equal(shippingAddressSchema.safeParse({ ...base, state: 'KA' }).success, false);
    assert.equal(shippingAddressSchema.safeParse({ ...base, zipCode: '560001x' }).success, false);
  });
});

describe('cycle flow (flows.md §1)', () => {
  it('walks the statuses in order and stops at closed', () => {
    assert.equal(nextCycleStatus('open'), 'collecting');
    assert.equal(nextCycleStatus('fulfilling'), 'closed');
    assert.equal(nextCycleStatus('closed'), null);
  });
});

describe('contrast (design.md §Accessibility, region accents in the admin form)', () => {
  it('matches the WCAG reference values', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
    assert.equal(contrastRatio('#777777', '#FFFFFF').toFixed(2), '4.48');
    assert.equal(contrastRatio('#FFFFFF', '#000000'), contrastRatio('#000000', '#FFFFFF'));
  });

  it('accepts an accent only when it meets AA on every background', () => {
    const backgrounds = ['#F4EFE6', '#EBE4D8', '#FBF8F3']; // canvas, surface, paper
    assert.equal(worstContrast('#2F5B3F', backgrounds).passes, true);
    const pale = worstContrast('#C9A24A', backgrounds); // kasavu gold: too light for text
    assert.equal(pale.passes, false);
    assert.ok(pale.ratio < 4.5);
  });

  it('refuses anything that is not #RRGGBB', () => {
    assert.throws(() => contrastRatio('red', '#FFFFFF'));
  });
});

describe('variant options (product page colour and size pickers)', () => {
  const v = (colour: string, size: string, stock = 5) => ({ id: `${colour}-${size}`, options: { colour, size }, stock });
  const grid = [v('Maroon', 'S'), v('Maroon', 'M', 0), v('Green', 'S', 0), v('Green', 'M')];
  const inStock = (x: { stock: number }) => x.stock > 0;

  it('shows an axis only when variants differ on it', () => {
    assert.deepEqual(
      optionAxes(grid).map((a) => [a.key, a.values]),
      [['colour', ['Maroon', 'Green']], ['size', ['S', 'M']]],
    );
    const sarees = [v('Red', 'Free size'), v('Green', 'Free size')];
    assert.deepEqual(optionAxes(sarees).map((a) => a.key), ['colour']);
  });

  it('gives no axes when they cannot tell every variant apart (fallback to one button per variant)', () => {
    assert.deepEqual(optionAxes([{ options: {} }, { options: {} }]), []);
    assert.deepEqual(optionAxes([v('Red', 'S'), v('Red', 'S')]), []);
  });

  it('keeps the other choice when the combination exists, else moves to a variant in stock', () => {
    const axes = optionAxes(grid);
    assert.equal(choose(grid, axes, { colour: 'Maroon', size: 'S' }, 'colour', 'Green', inStock)?.id, 'Green-S');
    const onlyGreen = [v('Maroon', 'S'), v('Green', 'M'), v('Green', 'L')];
    const axes2 = optionAxes(onlyGreen);
    assert.equal(choose(onlyGreen, axes2, { colour: 'Maroon', size: 'S' }, 'colour', 'Green', inStock)?.id, 'Green-M');
  });

  it('marks a value unavailable when that combination is sold out', () => {
    const axes = optionAxes(grid);
    assert.equal(isAvailable(grid, axes, { colour: 'Maroon', size: 'S' }, 'size', 'M', inStock), false);
    assert.equal(isAvailable(grid, axes, { colour: 'Maroon', size: 'S' }, 'colour', 'Green', inStock), false);
    assert.equal(isAvailable(grid, axes, { colour: 'Green', size: 'M' }, 'colour', 'Maroon', inStock), false);
    assert.equal(isAvailable(grid, axes, { colour: 'Maroon', size: 'S' }, 'size', 'S', inStock), true);
    assert.deepEqual(selectionOf(grid[3]!, axes), { colour: 'Green', size: 'M' });
    assert.equal(findVariant(grid, axes, { colour: 'Green', size: 'S' })?.id, 'Green-S');
  });
});

describe('a new listing (flows.md §2, C3)', () => {
  const base = {
    vendor_id: '00000000-0000-4000-8000-000000000101',
    category_id: '00000000-0000-4000-8000-000000000201',
    name: 'Field kurta',
    slug: 'field-kurta-a1b2',
    price_cents: 4900,
    variants: [{ label: 'Red · M', options: { colour: 'Red', size: 'M' }, qty: 3 }],
  };

  it('labels a variant from its colour and size', () => {
    assert.equal(variantLabel({ colour: 'Red', size: 'M' }), 'Red · M');
    assert.equal(variantLabel({ size: ' M ' }), 'M');
    assert.equal(variantLabel({}), 'One size');
  });

  it('makes a URL slug with a suffix so listings with one name never clash', () => {
    assert.equal(listingSlug('Kasavu Saree (Onam) – gold', 'A1B2'), 'kasavu-saree-onam-gold-a1b2');
    assert.equal(listingSlug('बंधनी', 'x9'), 'listing-x9');
  });

  it('needs fibre content and care for clothing (US textile labelling), the shape of each type', () => {
    assert.equal(listingInputSchema.safeParse({ ...base, product_type: 'clothing', attributes: {} }).success, false);
    assert.equal(
      listingInputSchema.safeParse({ ...base, product_type: 'clothing', attributes: { fibre_content: '100% cotton', care: 'Hand wash' } })
        .success,
      true,
    );
    assert.equal(
      listingInputSchema.safeParse({ ...base, product_type: 'food', attributes: { fibre_content: 'x', care: 'y' } }).success,
      false,
    );
  });

  it('refuses money that is not whole cents and unknown variant options', () => {
    const clothing = { ...base, product_type: 'clothing', attributes: { fibre_content: 'Silk', care: 'Dry clean' } };
    assert.equal(listingInputSchema.safeParse({ ...clothing, price_cents: 49.5 }).success, false);
    assert.equal(
      listingInputSchema.safeParse({ ...clothing, variants: [{ label: 'X', options: { shop: 'secret' }, qty: 1 }] }).success,
      false,
    );
  });
});

describe('tracking links (D-066)', () => {
  it('links USPS, UPS and FedEx, whatever the case or spaces', () => {
    assert.equal(trackingUrl('USPS', '9400 1000 0000 0000 0000 00'), 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000');
    assert.equal(trackingUrl('ups', '1Z999AA10123456784'), 'https://www.ups.com/track?tracknum=1Z999AA10123456784');
    assert.equal(trackingUrl(' FedEx ', '123456789012'), 'https://www.fedex.com/fedextrack/?trknbr=123456789012');
    assert.equal(trackingUrl('dhl', '1234567890'), 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=1234567890');
  });

  it('gives no link for other carriers or a number that is not one', () => {
    assert.equal(trackingUrl('OnTrac', '1234567890'), null);
    assert.equal(trackingUrl('USPS', 'abc'), null);
    assert.equal(trackingUrl('USPS', '123"><script>'), null);
    assert.equal(trackingUrl(null, '1234567890'), null);
  });
});

describe('photos from the photo store (D-140)', () => {
  const base = '/media/s/product-media/products/p1';

  it('draws a stored photo from the copy the width asks for, never larger than the largest', () => {
    assert.equal(hasCopies(`${base}/s/abc.jpg`), true);
    assert.equal(hasCopies('/media/product-media/products/p1/abc.jpg'), false);
    assert.equal(copyFor(`${base}/s/abc.jpg`, 300), `${base}/s/abc.w640.avif`);
    assert.equal(copyFor(`${base}/s/abc.jpg`, 492), `${base}/s/abc.w640.avif`); // a 164-point card on a 3x phone
    assert.equal(copyFor(`${base}/s/abc.jpg`, 641), `${base}/s/abc.w1200.avif`);
    assert.equal(copyFor(`${base}/s/abc.jpg`, 3840), `${base}/s/abc.w1200.avif`);
    assert.equal(photoSrcSet(`${base}/s/a.png`), `${base}/s/a.w640.avif 640w, ${base}/s/a.w1200.avif 1200w`);
  });

  it('shows a photo still in Supabase as it is, never through a resizer', () => {
    assert.equal(photoUrl('/media/product-media/products/p1/abc.jpg', 640), '/media/product-media/products/p1/abc.jpg');
    assert.equal(photoSrcSet('/media/product-media/products/p1/abc.jpg'), '');
  });

  it('names the site address by where the photo is, encoding each part', () => {
    assert.equal(mediaPath('product-media', 'products/a b/s/1.jpg'), '/media/s/product-media/products/a%20b/s/1.jpg');
    assert.equal(mediaPath('review-media', 'u1/r1/2.jpg'), '/media/review-media/u1/r1/2.jpg');
  });

  it('records a stored photo in its s/ folder, from a plain or a 2026-10-19 c/ path', () => {
    assert.equal(storedPath('products/p1/abc.jpg'), 'products/p1/s/abc.jpg');
    assert.equal(storedPath('products/p1/c/abc.jpg'), 'products/p1/s/abc.jpg');
    assert.equal(storedPath('products/p1/s/abc.jpg'), 'products/p1/s/abc.jpg');
    assert.deepEqual(storeKeys('product-media', 'products/p1/s/abc.jpg'), [
      'product-media/products/p1/s/abc.w640.avif',
      'product-media/products/p1/s/abc.w1200.avif',
    ]);
  });

  it('gives an email or an old browser the same copy as a JPEG, at a width the route accepts', () => {
    assert.equal(photoJpegUrl(`${base}/s/abc.jpg`, 160), '/media/jpeg/product-media/products/p1/s/abc.w640.avif?w=160');
    assert.equal(photoJpegUrl(`${base}/s/abc.jpg`, 4000), '/media/jpeg/product-media/products/p1/s/abc.w1200.avif?w=1200');
  });
});

describe('checkout phone (D-087)', () => {
  it('takes a US number in any common shape, with or without +1', () => {
    for (const t of ['7325550142', '(732) 555-0142', '+1 732 555 0142', '1-732-555-0142']) assert.equal(usPhoneDigits(t), '7325550142', t);
  });
  it('refuses short numbers and area codes starting with 0 or 1', () => {
    for (const t of ['12', '555-0142', '(132) 555-0142', '(032) 555-0142', '7325550142999']) assert.equal(usPhoneDigits(t), null, t);
  });
  it('formats ten digits as +1 (xxx) xxx-xxxx', () => {
    assert.equal(formatUsPhone('7325550142'), '+1 (732) 555-0142');
  });
});

describe('home & gifts without a weight (D-121), as all_india.test.sql', () => {
  const s = { fxInrPerUsd: 96.3, fxBufferPct: 4, marginPct: 50, homeEstGPerRupee: 1.5, homeEstMinG: 200 };
  it('is estimated from its shop price, between the minimum and the category\'s weight', () => {
    assert.equal(fallbackWeightG('home', 20000, 1500, s), 300);
    assert.equal(fallbackWeightG('home', 5000, 1500, s), 200);
    assert.equal(fallbackWeightG('home', 300000, 1500, s), 1500);
    assert.equal(fallbackWeightG('home', null, 1500, s), 1500);
    assert.equal(fallbackWeightG('clothing', 20000, 450, s), 450);
    assert.equal(fallbackWeightG('home', 20000, 1500, { ...s, homeEstGPerRupee: null }), 1500);
  });
});

describe('the same picture saved twice (D-142)', () => {
  const n = PRINT_SIZE * PRINT_SIZE * 3;
  /** A print of a pattern; `noise` adds what resizing and JPEG do to a copy (about ±noise per channel). */
  const print = (width: number, height: number, pattern: (i: number) => number, noise = 0): PhotoPrint => ({
    width,
    height,
    pixels: Uint8Array.from({ length: n }, (_, i) => Math.max(0, Math.min(255, pattern(i) + (noise ? ((i * 7919) % (2 * noise + 1)) - noise : 0)))),
  });
  const front = (i: number) => (Math.floor(i / 3 / PRINT_SIZE) * 2 + (i % 97)) % 256;
  const back = (i: number) => (Math.floor(i / 3) % PRINT_SIZE) * 3 % 256;

  it('finds a photo and its smaller copy, and nothing else', () => {
    const full = print(1500, 1500, front);
    assert.ok(samePicture(full, print(500, 500, front, 4)), 'a 500-pixel preview of the same photo');
    assert.ok(samePicture(full, print(1500, 1500, front)), 'the same bytes');
    assert.ok(!samePicture(full, print(500, 500, back)), 'another photo');
    assert.ok(!samePicture(full, print(500, 600, front)), 'another shape');
    assert.ok(!samePicture(full, print(500, 500, front, 40)), 'too far apart');
  });

  it('groups a listing’s photos by picture, never across variants, and keeps the full-size one', () => {
    const prints = [print(1500, 1500, front), print(500, 500, front, 3), print(2000, 2000, back), print(500, 500, back, 3), null, print(500, 500, front, 2)];
    assert.deepEqual(pictureGroups(prints), [[0, 1, 5], [2, 3], [4]]);
    assert.deepEqual(pictureGroups(prints, [null, null, null, null, null, 'red']), [[0, 1], [2, 3], [4], [5]]);
    assert.equal(sharpest([0, 1, 5], prints), 0);
    assert.equal(sharpest([3, 2], prints), 2);
    assert.equal(sharpest([1, 5], prints), 1, 'the earliest on a tie');
  });
});
