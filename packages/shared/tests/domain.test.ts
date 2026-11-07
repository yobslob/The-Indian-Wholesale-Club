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
  bulkProgress,
  bagChargesAt,
  promoDiscountCents,
  bulkSavingCents,
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
  listingInputSchema,
  listingSlug,
  optionAxes,
  orderEventLabel,
  heavyShippingAt,
  quoteCheckout,
  copyFor,
  hasCopies,
  mediaPath,
  jpegWidth,
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
  bestCoupon,
  billOf,
  couponStanding,
  sortedCoupons,
  couponTerms,
  couponTitle,
  nextCoupon,
} from '../src/domain';

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
    const shipping = { flatCents: 0, freeMinCents: 4999, bulkFromCents: 14999, bulkSaving: bulk };
    const q = quoteCheckout([{ unitPriceCents: 20000, quantity: 1, taxable: true }], null, shipping, { ratePct: 10 })!;
    assert.equal(q.bulkSavingCents, 500);
    assert.equal(q.discountCents, 0);
    assert.equal(q.taxCents, 1950);
    assert.equal(q.totalCents, 20000 - 500 + 1950);
    const promo = quoteCheckout([{ unitPriceCents: 20000, quantity: 1 }], { discountType: 'fixed', discountValue: 4000, minOrderCents: 0 }, shipping)!;
    assert.deepEqual([promo.discountCents, promo.bulkSavingCents], [4000, 0], 'D-191: a coupon worth more replaces the saving');
    const small = quoteCheckout([{ unitPriceCents: 20000, quantity: 1 }], { discountType: 'fixed', discountValue: 300, minOrderCents: 0 }, shipping)!;
    assert.deepEqual([small.discountCents, small.bulkSavingCents, small.promoApplied, small.promoBeatenByBulk], [0, 500, false, true], 'one worth less stays off and the bag keeps the saving');
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

describe('checkout quote (flows.md §3, D-041, D-073)', () => {
  const shipping = { flatCents: 900, freeMinCents: 10000 };
  const nj = { ratePct: 6.625 };

  it('D-111, D-191: a small order pays its charges; from the free line up Shipping is waived and shown, the retailer charges stay', () => {
    const smallOrder = { shippingCents: 1979, retailerCents: 199 };
    const settings = { flatCents: 0, freeMinCents: 14999, smallOrder };
    const small = quoteCheckout([{ unitPriceCents: 3929, quantity: 1 }], null, settings)!;
    assert.deepEqual([small.shippingCents, small.retailerCents, small.totalCents], [1979, 199, 3929 + 1979 + 199]);
    const big = quoteCheckout([{ unitPriceCents: 3929, quantity: 4 }], null, settings)!;
    assert.deepEqual([big.shippingCents, big.retailerCents, big.totalCents], [0, 199, 3929 * 4 + 199]);
    assert.deepEqual(big.waivedCents, { shipping: 1979, retailer: 0 });
    // D-191: the free line reads the bag before a coupon, so a coupon cannot bring Shipping back.
    const promo = { discountType: 'percentage' as const, discountValue: 10, minOrderCents: 0 };
    const coupon = quoteCheckout([{ unitPriceCents: 3929, quantity: 4 }], promo, settings)!;
    assert.deepEqual([coupon.shippingCents, coupon.discountCents], [0, 1572]);
  });

  it('D-125: Shipping as the bag works it out; struck through and free from the line, unless the bag still needs it', () => {
    const smallOrder = { shippingCents: 3679, pastLineCents: 0, retailerCents: 99, retailerPct: 1.5 };
    const at = (goods: number, small = smallOrder) => bagChargesAt(goods, 14999, small);
    assert.deepEqual([at(399).shippingCents, at(399).retailerCents], [3679, 99], 'one masala: what its parcel needs');
    assert.deepEqual([at(10000).shippingCents, at(10000).retailerCents], [3679, 150]);
    const big = at(30000);
    assert.deepEqual(
      [big.shippingCents, big.waivedShippingCents, big.retailerCents],
      [0, 3679, 450],
      'past the line: Shipping struck through and free, the retailer charges paid (D-191)',
    );
    const owes = at(30000, { ...smallOrder, pastLineCents: 1229 });
    assert.deepEqual([owes.shippingCents, owes.waivedShippingCents], [1229, 0], 'a bag that cannot pay its way past the line still pays it');
    const settings = { flatCents: 0, freeMinCents: 14999, smallOrder };
    const q = quoteCheckout([{ unitPriceCents: 30000, quantity: 1 }], null, settings)!;
    assert.deepEqual([q.shippingCents, q.retailerCents, q.totalCents], [0, 450, 30450]);
    assert.deepEqual(q.waivedCents, { shipping: 3679, retailer: 0 });
    const small = quoteCheckout([{ unitPriceCents: 399, quantity: 1 }], null, settings)!;
    assert.deepEqual([small.shippingCents, small.retailerCents, small.totalCents], [3679, 99, 399 + 3679 + 99]);
  });

  it('adds subtotal and flat shipping; no tax where IWC is not registered (D-073)', () => {
    const quote = quoteCheckout([{ unitPriceCents: 2500, quantity: 2 }], null, shipping);
    assert.deepEqual(quote, {
      subtotalCents: 5000,
      discountCents: 0,
      bulkSavingCents: 0,
      coinsUsed: 0,
      shippingCents: 900,
      retailerCents: 0,
      waivedCents: { shipping: 0, retailer: 0 },
      heavyCents: 0,
      heavyShownCents: 0,
      taxCents: 0,
      totalCents: 5900,
      promoApplied: false,
      promoBeatenByBulk: false,
    });
  });

  it('taxes only the taxable lines in a registered state (NJ exempts clothing)', () => {
    const clothing = { unitPriceCents: 5000, quantity: 1, taxable: false };
    const accessory = { unitPriceCents: 5000, quantity: 1, taxable: true };
    assert.equal(quoteCheckout([clothing], null, shipping, nj)?.taxCents, 0);
    // half the order is taxable: 6.625% of (10000 + free shipping) x 1/2 = 331.25, rounds to 331
    assert.equal(quoteCheckout([clothing, accessory], null, shipping, nj)?.taxCents, 331);
  });

  it('ships free once the discounted subtotal reaches the threshold', () => {
    const quote = quoteCheckout([{ unitPriceCents: 10000, quantity: 1 }], null, shipping);
    assert.equal(quote?.shippingCents, 0);
    assert.equal(quote?.totalCents, 10000);
  });

  it('refuses to guess shipping when an option has no price (D-040)', () => {
    const none = { flatCents: null, freeMinCents: null };
    assert.equal(quoteCheckout([{ unitPriceCents: 100, quantity: 1 }], null, none), null);
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

describe('contrast (storefront.md §Accessibility, region accents in the admin form)', () => {
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
    source_url: 'https://www.myntra.com/field-kurta/1',
    source_site: 'myntra.com',
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

  it('D-187: the shop is its link and site, both optional; empty region = all India', () => {
    const attributes = { fibre_content: '100% cotton', care: 'Hand wash' };
    const { source_url: _url, source_site: _site, ...bare } = base;
    assert.equal(listingInputSchema.safeParse({ ...bare, product_type: 'clothing', attributes }).success, true);
    const parsed = listingInputSchema.parse({ ...base, region_id: null, product_type: 'clothing', attributes });
    assert.deepEqual([parsed.region_id, parsed.source_site], [null, 'myntra.com']);
    assert.equal(listingInputSchema.safeParse({ ...base, source_url: 'not a link', product_type: 'clothing', attributes }).success, false);
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
    // a phone's own pixel width snaps to one of the few made (a conversion each)
    assert.equal(photoJpegUrl(`${base}/s/abc.jpg`, 393), '/media/jpeg/product-media/products/p1/s/abc.w640.avif?w=480');
    assert.equal(photoJpegUrl(`${base}/s/abc.jpg`, 1100), '/media/jpeg/product-media/products/p1/s/abc.w1200.avif?w=1200');
    assert.deepEqual([1, 160, 161, 640, 641, 5000].map(jpegWidth), [160, 160, 320, 640, 960, 1200]);
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

describe('D-187: one free-shipping line for every bag, the bulk saving at its own', () => {
  const small = { shippingCents: 1862, retailerCents: 99, retailerPct: 1.5 };
  const settings = { flatCents: 0, freeMinCents: 4999, bulkFromCents: 9999, smallOrder: small, bulkSaving: { pct: 10, capCents: 2500 } };

  it('food $30: Shipping and Retailer charges are paid', () => {
    const q = quoteCheckout([{ unitPriceCents: 3000, quantity: 1 }], null, settings)!;
    assert.deepEqual([q.shippingCents, q.retailerCents, q.bulkSavingCents, q.totalCents], [1862, 99, 0, 3000 + 1862 + 99]);
  });

  it('food $50, or clothing $40 + food $15: Shipping free, the retailer charges paid, no saving yet', () => {
    for (const lines of [[{ unitPriceCents: 5000, quantity: 1 }], [{ unitPriceCents: 4000, quantity: 1 }, { unitPriceCents: 1500, quantity: 1 }]]) {
      const q = quoteCheckout(lines, null, settings)!;
      assert.equal(q.shippingCents, 0);
      assert.ok(q.retailerCents >= 99, 'D-191');
      assert.equal(q.bulkSavingCents, 0);
      assert.equal(q.waivedCents.shipping, 1862);
    }
  });

  it('clothing $30 + food $10: one parcel charged', () => {
    const q = quoteCheckout([{ unitPriceCents: 3000, quantity: 1 }, { unitPriceCents: 1000, quantity: 1 }], null, settings)!;
    assert.deepEqual([q.shippingCents, q.retailerCents], [1862, 99]);
  });

  it('a $120 bag: free, and the bulk saving counts from $99.99', () => {
    const q = quoteCheckout([{ unitPriceCents: 12000, quantity: 1 }], null, settings)!;
    assert.deepEqual([q.shippingCents, q.bulkSavingCents, q.retailerCents, q.totalCents], [0, 200, 180, 11980]);
  });

  it('D-191: a coupon never brings Shipping back: the line reads the bag before it', () => {
    const pct = { discountType: 'percentage' as const, discountValue: 10, minOrderCents: 0 };
    const q = quoteCheckout([{ unitPriceCents: 5000, quantity: 1 }], pct, settings)!;
    assert.deepEqual([q.discountCents, q.shippingCents, q.totalCents], [500, 0, 4500 + q.retailerCents]);
  });

  it("the promo's discount", () => {
    const pct = { discountType: 'percentage' as const, discountValue: 10, minOrderCents: 0 };
    assert.equal(promoDiscountCents(5000, pct), 500);
    assert.equal(promoDiscountCents(5000, { ...pct, discountType: 'fixed', discountValue: 700 }), 700);
    assert.equal(promoDiscountCents(5000, { ...pct, minOrderCents: 6000 }), 0);
    assert.equal(promoDiscountCents(5000, null), 0);
    assert.equal(promoDiscountCents(20000, { ...pct, maxDiscountCents: 900 }), 900, 'D-191: 10% up to $9');
  });
});

describe('D-191: coupons and coins', () => {
  const welcome = { code: 'WELCOME10', discountType: 'percentage' as const, discountValue: 10, minOrderCents: 0, maxDiscountCents: 900, newCustomersOnly: true };
  const fixed = (code: string, off: number, min: number) => ({ code, discountType: 'fixed' as const, discountValue: off, minOrderCents: min, maxDiscountCents: null, newCustomersOnly: false });
  const coupons = [welcome, fixed('SAVE7', 700, 9900), fixed('SAVE12', 1200, 15000), fixed('SAVE20', 2000, 19900)];
  const settings = { flatCents: 0, freeMinCents: 4999, bulkFromCents: 9999, smallOrder: { shippingCents: 1862, retailerCents: 99 }, bulkSaving: { pct: 10, capCents: 2500 } };
  const best = (cents: number, isNewCustomer: boolean, bulk = 0) => bestCoupon({ coupons, isNewCustomer }, cents, bulk)?.code ?? null;

  it('puts the coupon that takes the most off this bag on top', () => {
    assert.equal(best(3000, true), 'WELCOME10');
    assert.equal(best(3000, false), null);
    assert.equal(best(9900, true), 'WELCOME10', '$9 beats $7');
    assert.equal(best(9900, false), 'SAVE7');
    assert.equal(best(15000, true), 'SAVE12');
    assert.equal(best(19900, false), 'SAVE20');
  });

  it('never offers one the bulk saving beats, since the coupon would replace it', () => {
    assert.equal(best(35000, false, 2500), null, 'a $350 bag: the $25 saving beats $20');
    assert.equal(best(19900, false, 990), 'SAVE20');
  });

  it('says how far the next one is', () => {
    assert.deepEqual(nextCoupon({ coupons, isNewCustomer: false }, 9000), { coupon: coupons[1], moreCents: 900 });
    assert.equal(nextCoupon({ coupons, isNewCustomer: false }, 20000), null);
  });

  it('D-192: never promises a next coupon that would not be the best there', () => {
    assert.equal(nextCoupon({ coupons, isNewCustomer: true }, 6000)?.coupon.code, 'SAVE12', "at $99 the new customer's $9 still beats $7");
    assert.equal(nextCoupon({ coupons, isNewCustomer: false }, 9000, 800)?.coupon.code, 'SAVE12', '$7 would not beat the $8 saved now');
  });

  it('D-192: says where each coupon stands, usable ones first', () => {
    const offers = { coupons, isNewCustomer: false };
    assert.deepEqual(couponStanding(coupons[1]!, offers, 10000), { kind: 'usable', offCents: 700 });
    assert.deepEqual(couponStanding(coupons[2]!, offers, 10000), { kind: 'short', moreCents: 5000 });
    assert.deepEqual(couponStanding(welcome, offers, 10000), { kind: 'first-order' });
    assert.deepEqual(couponStanding(coupons[1]!, offers, 10000, 700), { kind: 'bulk-bigger' });
    assert.deepEqual(sortedCoupons(offers, 15000).map((c) => c.coupon.code), ['SAVE12', 'SAVE7', 'SAVE20', 'WELCOME10']);
  });

  it('D-192: the bill adds up top to bottom; the saving is apart; tax only once known', () => {
    const shipping = { ...settings, smallOrder: { shippingCents: 1862, retailerCents: 99, retailerPct: 1.5 } };
    const q = quoteCheckout([{ unitPriceCents: 12000, quantity: 1, taxable: true }], coupons[1]!, shipping, { ratePct: 10 }, 30)!;
    const priced = billOf(q, 'SAVE7', true);
    assert.equal(priced.retailerCents, 180, 'never waived, above the free line too');
    assert.equal(priced.bulkCents, 0, 'a coupon replaces the bulk saving');
    assert.equal(
      priced.subtotalCents - priced.couponCents - priced.bulkCents - priced.coins + priced.shippingCents + priced.retailerCents + priced.heavyCents + (priced.taxCents ?? 0),
      priced.totalCents,
    );
    assert.equal(priced.savingCents, priced.shippingWasCents + 700 + 30);
    const early = billOf(quoteCheckout([{ unitPriceCents: 12000, quantity: 1 }], coupons[1]!, shipping, null, 30)!, 'SAVE7', false);
    assert.equal(early.taxCents, null);
    assert.equal(early.totalCents, priced.totalCents - priced.taxCents!, "the bag's total is checkout's, less the tax");
  });

  it('words a coupon', () => {
    assert.equal(couponTitle(welcome), '10% off, up to $9');
    assert.equal(couponTerms(welcome), 'On your first order');
    assert.equal(couponTitle(coupons[1]!), '$7 off');
    assert.equal(couponTerms(coupons[1]!), 'On bags of $99 or more');
  });

  it('coins come off the goods after the coupon, one coin one cent, before tax', () => {
    const q = quoteCheckout([{ unitPriceCents: 3000, quantity: 1, taxable: true }], null, settings, { ratePct: 10 }, 85)!;
    assert.equal(q.coinsUsed, 85);
    assert.equal(q.taxCents, Math.round(((3000 - 85 + 1862 + 99) * 10) / 100));
    assert.equal(q.totalCents, 3000 - 85 + 1862 + 99 + q.taxCents);
  });

  it('a coupon and coins together; a coupon replaces the bulk saving; never below the charges', () => {
    const save20 = { discountType: 'fixed' as const, discountValue: 2000, minOrderCents: 19900 };
    const q = quoteCheckout([{ unitPriceCents: 19900, quantity: 1 }], save20, settings, null, 90)!;
    assert.deepEqual([q.discountCents, q.bulkSavingCents, q.coinsUsed, q.shippingCents, q.retailerCents], [2000, 0, 90, 0, 99]);
    assert.equal(q.totalCents, 19900 - 2000 - 90 + 99);
    const tiny = quoteCheckout([{ unitPriceCents: 50, quantity: 1 }], null, settings, null, 90)!;
    assert.deepEqual([tiny.coinsUsed, tiny.totalCents], [50, 1862 + 99], 'no more coins than the goods');
  });
});

// Founder, 2026-10-24: heavy cookware priced on half its weight, the other half added as Heavy-item shipping; from the
// line "dropped by 20% only (shown as struck-through)". D-187: the line for this is $99.99, not the free line.
describe('Heavy-item shipping', () => {
  const heavy = { cents: 6522, lineOffPct: 20 };
  const settings = { flatCents: 0, freeMinCents: 4999, bulkFromCents: 9999, smallOrder: { shippingCents: 1862, retailerCents: 99 } };

  it('below the line the whole charge is paid and nothing is struck through', () => {
    assert.deepEqual(heavyShippingAt(heavy, false), { cents: 6522, shownCents: 0 });
    const q = quoteCheckout([{ unitPriceCents: 4000, quantity: 1 }], null, { ...settings, heavy })!;
    assert.deepEqual([q.heavyCents, q.heavyShownCents, q.totalCents], [6522, 0, 4000 + 1862 + 99 + 6522]);
    const free = quoteCheckout([{ unitPriceCents: 6000, quantity: 1 }], null, { ...settings, heavy })!;
    assert.deepEqual([free.shippingCents, free.heavyCents, free.heavyShownCents], [0, 6522, 0], 'free shipping from $49.99 leaves it whole');
  });

  it('from $99.99 20% comes off, the whole struck through', () => {
    assert.deepEqual(heavyShippingAt(heavy, true), { cents: 5218, shownCents: 6522 });
    const q = quoteCheckout([{ unitPriceCents: 10000, quantity: 1 }], null, { ...settings, heavy })!;
    assert.deepEqual([q.shippingCents, q.heavyCents, q.heavyShownCents], [0, 5218, 6522]);
  });

  it('no heavy piece, no charge', () => {
    assert.deepEqual(heavyShippingAt(null, true), { cents: 0, shownCents: 0 });
  });

  it('is taxed like Shipping', () => {
    const q = quoteCheckout([{ unitPriceCents: 4000, quantity: 1, taxable: true }], null, { ...settings, heavy }, { ratePct: 10 })!;
    assert.equal(q.taxCents, Math.round((4000 + 1862 + 99 + 6522) * 0.1));
  });
});
