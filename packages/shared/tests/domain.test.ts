import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABEL,
  attributesSchemaFor,
  autoPrice,
  choose,
  clothingAttributesSchema,
  contrastRatio,
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
  resizedPhotoUrl,
  resizerWidth,
  selectionOf,
  shippingAddressSchema,
  spiceAttributesSchema,
  timelineIndex,
  trackingUrl,
  variantLabel,
  worstContrast,
} from '../src/domain';

const settings = { fxInrPerUsd: 80, freightCentsPerKg: 1000, dutyPct: 10, marginPct: 50 };

describe('autoPrice (D-075): the same numbers as supabase/tests/pricing_engine.test.sql', () => {
  const simple = {
    fxInrPerUsd: 100, fxBufferPct: 0, indiaHandlingPaise: 0, freightCentsPerKg: 1000, volumetricPct: 100,
    brokerCentsPerShipment: 0, shipmentKg: 1, dutyPct: 0, usHandlingCents: 0, usLastMileCentsPerKg: 0,
    usLastMileMinCents: 0, returnsAllowancePct: 0, marginPct: 0, cardFeePct: 0, cardFeeFixedCents: 0,
  };
  const full = {
    fxInrPerUsd: 96, fxBufferPct: 4, indiaHandlingPaise: 25000, freightCentsPerKg: 700, volumetricPct: 130,
    brokerCentsPerShipment: 35000, shipmentKg: 30, dutyPct: 26.5, usHandlingCents: 500, usLastMileCentsPerKg: 1000,
    usLastMileMinCents: 500, returnsAllowancePct: 5, marginPct: 100, cardFeePct: 3.5, cardFeeFixedCents: 30,
  };

  it('rounds up to the next $x.99', () => {
    assert.equal(autoPrice({ shopPricePaise: 100000, weightG: 1000 }, simple)?.priceCents, 2099);
    assert.equal(autoPrice({ shopPricePaise: 99900, weightG: 1000 }, simple)?.priceCents, 1999);
  });

  it('every cost, the margin on the goods only, then the card fees', () => {
    assert.equal(autoPrice({ shopPricePaise: 250000, weightG: 800 }, full)?.priceCents, 10699);
  });

  it('returns null while a setting, the shop price or the weight is missing', () => {
    assert.equal(autoPrice({ shopPricePaise: 1000, weightG: null }, full), null);
    assert.equal(autoPrice({ shopPricePaise: null, weightG: 100 }, full), null);
    assert.equal(autoPrice({ shopPricePaise: 1000, weightG: 100 }, { ...full, marginPct: null }), null);
  });

  it('refuses impossible input', () => {
    assert.throws(() => autoPrice({ shopPricePaise: -1, weightG: 100 }, full), RangeError);
    assert.throws(() => autoPrice({ shopPricePaise: 100, weightG: 0 }, full), RangeError);
    assert.throws(() => autoPrice({ shopPricePaise: 100, weightG: 100 }, { ...full, fxInrPerUsd: 0 }), RangeError);
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

describe('checkout quote (flows.md §3, D-041, D-070, D-073)', () => {
  const shipping = { flatCents: 900, freeMinCents: 10000, express: { baseCents: 1500, minCourierCents: 2200 } };
  const nj = { ratePct: 6.625 };

  it('adds subtotal and flat shipping; no tax where IWC is not registered (D-073)', () => {
    const quote = quoteCheckout([{ unitPriceCents: 2500, quantity: 2 }], null, shipping);
    assert.deepEqual(quote, {
      subtotalCents: 5000,
      discountCents: 0,
      shippingCents: 900,
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

describe('resized photos for the app (engineering.md §App specifics)', () => {
  it('picks the smallest served width that covers the pixels drawn, never upscaling', () => {
    assert.equal(resizerWidth(492), 640); // a 164-point card on a 3x phone
    assert.equal(resizerWidth(384), 384);
    assert.equal(resizerWidth(385), 640);
    assert.equal(resizerWidth(1), 16);
    assert.equal(resizerWidth(9000), 3840); // the largest the resizer serves
  });

  it("asks the website's resizer for the photo at quality 75, the source encoded", () => {
    const source = 'https://abc.supabase.co/storage/v1/object/public/product-media/products/p 1/a.jpg';
    assert.equal(
      resizedPhotoUrl('https://shop.example/', source, 164, 3),
      `https://shop.example/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`,
    );
    assert.equal(resizedPhotoUrl('https://shop.example', source, 390, 2).includes('&w=828&'), true);
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
