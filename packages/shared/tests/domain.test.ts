import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABEL,
  attributesSchemaFor,
  choose,
  clothingAttributesSchema,
  contrastRatio,
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
  selectionOf,
  shippingAddressSchema,
  spiceAttributesSchema,
  suggestPrice,
  timelineIndex,
  variantLabel,
  worstContrast,
} from '../src/domain';

const settings = { fxInrPerUsd: 80, freightCentsPerKg: 1000, dutyPct: 10, marginPct: 50 };

describe('suggestPrice (flows.md §2, D-047)', () => {
  it('computes goods, freight, duty, landed and suggested price in cents', () => {
    // ₹2,000 = 200000 paise → $25.00; 500 g at $10/kg → $5.00; 10% duty on goods → $2.50
    const result = suggestPrice({ shopPricePaise: 200000, weightG: 500 }, settings);
    assert.deepEqual(result, {
      goodsCents: 2500,
      freightCents: 500,
      dutyCents: 250,
      landedCents: 3250,
      suggestedPriceCents: 4875,
    });
  });

  it('returns null instead of guessing when any setting is missing', () => {
    for (const key of ['fxInrPerUsd', 'freightCentsPerKg', 'dutyPct', 'marginPct'] as const) {
      assert.equal(
        suggestPrice({ shopPricePaise: 1000, weightG: 100 }, { ...settings, [key]: null }),
        null,
        key,
      );
    }
  });

  it('returns null when the weight is unknown (freight cannot be computed)', () => {
    assert.equal(suggestPrice({ shopPricePaise: 1000, weightG: null }, settings), null);
  });

  it('rejects impossible inputs', () => {
    assert.throws(() => suggestPrice({ shopPricePaise: -1, weightG: 100 }, settings), RangeError);
    assert.throws(() => suggestPrice({ shopPricePaise: 10.5, weightG: 100 }, settings), RangeError);
    assert.throws(() => suggestPrice({ shopPricePaise: 100, weightG: 0 }, settings), RangeError);
    assert.throws(
      () => suggestPrice({ shopPricePaise: 100, weightG: 100 }, { ...settings, fxInrPerUsd: 0 }),
      RangeError,
    );
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

  it('requires ingredients, allergens and shelf life for spices', () => {
    assert.ok(
      spiceAttributesSchema.safeParse({
        ingredients: 'Cardamom',
        allergens: [],
        shelf_life_days: 365,
      }).success,
    );
    assert.equal(
      spiceAttributesSchema.safeParse({ ingredients: 'Cardamom', allergens: [] }).success,
      false,
    );
  });

  it('picks the schema by product type', () => {
    assert.equal(attributesSchemaFor('spice'), spiceAttributesSchema);
    assert.equal(attributesSchemaFor('clothing'), clothingAttributesSchema);
  });
});

describe('checkout quote (flows.md §3, D-033, D-041)', () => {
  const shipping = { flatCents: 900, freeMinCents: 10000, expressCents: 800 };

  it('adds subtotal, flat shipping and the 8% tax estimate on (subtotal + shipping)', () => {
    const quote = quoteCheckout([{ unitPriceCents: 2500, quantity: 2 }], null, shipping);
    assert.deepEqual(quote, {
      subtotalCents: 5000,
      discountCents: 0,
      shippingCents: 900,
      taxCents: 472, // round(5900 × 8%)
      totalCents: 6372,
      promoApplied: false,
    });
  });

  it('ships free once the discounted subtotal reaches the threshold', () => {
    const quote = quoteCheckout([{ unitPriceCents: 10000, quantity: 1 }], null, shipping);
    assert.equal(quote?.shippingCents, 0);
    assert.equal(quote?.totalCents, 10800);
  });

  it('refuses to guess shipping when an option has no price (D-040)', () => {
    assert.equal(
      quoteCheckout([{ unitPriceCents: 100, quantity: 1 }], null, {
        flatCents: null,
        freeMinCents: null,
        expressCents: null,
      }),
      null,
    );
  });

  it('applies percentage and fixed promos, never below zero, only above the minimum', () => {
    const lines = [{ unitPriceCents: 4000, quantity: 1 }];
    const pct = quoteCheckout(
      lines,
      { discountType: 'percentage', discountValue: 25, minOrderCents: 0 },
      shipping,
    );
    assert.equal(pct?.discountCents, 1000);
    const fixed = quoteCheckout(
      lines,
      { discountType: 'fixed', discountValue: 9999, minOrderCents: 0 },
      shipping,
    );
    assert.equal(fixed?.discountCents, 4000);
    assert.equal(fixed?.totalCents, 900 + 72);
    const below = quoteCheckout(
      lines,
      { discountType: 'fixed', discountValue: 500, minOrderCents: 5000 },
      shipping,
    );
    assert.equal(below?.discountCents, 0);
    assert.equal(below?.promoApplied, false);
  });

  it('always balances: total = subtotal − discount + shipping + tax (orders CHECK)', () => {
    for (const unit of [1, 99, 1234, 55555]) {
      for (const qty of [1, 3]) {
        const q = quoteCheckout([{ unitPriceCents: unit, quantity: qty }], null, shipping);
        assert.ok(q);
        assert.equal(
          q.totalCents,
          q.subtotalCents - q.discountCents + q.shippingCents + q.taxCents,
        );
      }
    }
  });

  it('rejects impossible lines', () => {
    assert.throws(() => quoteCheckout([], null, shipping), RangeError);
    assert.throws(
      () => quoteCheckout([{ unitPriceCents: 10, quantity: 0 }], null, shipping),
      RangeError,
    );
    assert.throws(
      () => quoteCheckout([{ unitPriceCents: 1.5, quantity: 1 }], null, shipping),
      RangeError,
    );
  });

  it('D-041: standard is free, express costs $8 and never gets the free threshold', () => {
    const d041 = { flatCents: 0, freeMinCents: null, expressCents: 800 };
    const lines = [{ unitPriceCents: 20000, quantity: 1 }];
    assert.equal(quoteCheckout(lines, null, d041)?.shippingCents, 0);
    const express = quoteCheckout(lines, null, { ...d041, freeMinCents: 100 }, 'express');
    assert.equal(express?.shippingCents, 800);
    assert.equal(express?.taxCents, 1664); // 8% of 20800
    assert.equal(quoteCheckout(lines, null, { ...d041, expressCents: null }, 'express'), null);
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
      listingInputSchema.safeParse({ ...base, product_type: 'spice', attributes: { fibre_content: 'x', care: 'y' } }).success,
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
