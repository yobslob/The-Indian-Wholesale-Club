import assert from 'node:assert/strict';
import Module from 'node:module';
import { before, describe, it } from 'node:test';

import { stockProblems } from '../features/checkout/stock';

import type { checkoutRequestSchema as RequestSchema, priceCart as PriceCart } from '../features/checkout/pricing';
import type { IwcClient } from '@repo/db';

const FOOD = '00000000-0000-4000-8000-00000000000f';
const KURTA = '00000000-0000-4000-8000-00000000000c';

const variant = (id: string, priceCents: number, available = 5, type: 'food' | 'clothing' = 'clothing') => ({
  variant_id: id,
  product_id: id,
  product_name: `Piece ${id.slice(-1)}`,
  product_slug: `piece-${id.slice(-1)}`,
  product_type: type,
  region_slug: 'kerala',
  region_name: 'Kerala',
  label: 'One size',
  price_cents: priceCents,
  available,
  image_path: null,
  tax_class: type === 'food' ? ('food' as const) : ('clothing' as const),
  // what the database still sends for the old website; the schema must drop it
  courier_cents: 0,
});
const stock = (id: string, available = 5, onSale = true) => ({
  variant_id: id,
  on_sale: onSale,
  available,
  product_name: `Piece ${id.slice(-1)}`,
  label: 'One size',
  image_path: 'p/1.jpg',
});
const WINDOW = { est_delivery_from: '2026-11-20', est_delivery_to: '2026-11-26' };
const FOOD_WINDOW = { est_delivery_from: '2026-11-13', est_delivery_to: '2026-11-13' };

type Variants = ReturnType<typeof variant>[];
const context = (variants: Variants, over: Record<string, unknown> = {}) => ({
  variants,
  stock: variants.map((v) => stock(v.variant_id, v.available)),
  promo: null,
  shipping: { flat_cents: 0, free_min_cents: 4999, bulk_saving_from_cents: 9999, min_order_cents: null },
  delivery: { ...WINDOW, order_by: null },
  food_delivery: FOOD_WINDOW,
  tax: null,
  us_delivery: null,
  quick_delivery: FOOD_WINDOW,
  express: null,
  ...over,
});
const charges = (over: Record<string, unknown> = {}) => ({
  free_min_cents: 4999,
  bulk_saving_from_cents: 9999,
  shipping_cents: 1862,
  past_line_cents: 0,
  retailer_cents: 99,
  retailer_pct: 1.5,
  bulk_saving_pct: 10,
  bulk_saving_cap_cents: 2500,
  shown_shipping_cents: null,
  heavy_cents: 0,
  heavy_line_off_pct: 20,
  heavy_ids: [],
  shipments: { days_min: 7, days_max: 7, food_cents: 0, food_only: false, split: false, outside: false, shipping_cents: 1862 },
  food_ids: [],
  dates: { food_from: FOOD_WINDOW.est_delivery_from, food_to: FOOD_WINDOW.est_delivery_to, standard_from: WINDOW.est_delivery_from, standard_to: WINDOW.est_delivery_to },
  ...over,
});

/** D-208: the saving's settings: 5%, Send home closed (so the saving is kept as Coins). */
const SEND_HOME = {
  save_pct: 5,
  rupees_per_usd: null,
  inr_per_usd: null,
  keep_pct: 0,
  month_cap_cents: null,
  month_used_cents: 0,
  loved_one: null,
  sender_first_name: null,
};

/** The database as priceCart reads it: its three functions, nothing else. */
function fakeClient(
  ctx: unknown,
  bag: unknown,
  sendHome: unknown = SEND_HOME,
  world: unknown = null,
): { client: IwcClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    rpc: (name: string) => {
      calls.push(name);
      const data =
        name === 'checkout_context' ? ctx : name === 'checkout_send_home' ? sendHome : name === 'store_country_prices' ? world : bag;
      return Promise.resolve({ data, error: null });
    },
  } as unknown as IwcClient;
  return { client, calls };
}

const body = (lines: { variantId: string; quantity: number }[], extra: Record<string, unknown> = {}) => ({
  email: 'a@example.com',
  address: { fullName: 'Meera Nair', line1: '1 Oak St', line2: null, city: 'Edison', state: 'NJ', zipCode: '08817', phone: null },
  lines,
  ...extra,
});

describe('priceCart (D-187)', () => {
  let priceCart: typeof PriceCart;
  let schema: typeof RequestSchema;

  before(async () => {
    // 'server-only' throws outside Next's server build: the test is the server.
    const M = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
    const load = M._load;
    M._load = (request, ...rest) => (request === 'server-only' ? {} : load(request, ...rest));
    const pricing = await import('../features/checkout/pricing');
    priceCart = pricing.priceCart;
    schema = pricing.checkoutRequestSchema;
  });

  const price = async (ctx: unknown, bag: unknown, lines: { variantId: string; quantity: number }[], extra = {}) =>
    priceCart(fakeClient(ctx, bag).client, schema.parse(body(lines, extra)));

  it('gives the bulk saving from bulk_saving_from_cents: it silently becomes 0 if bulkFromCents is not passed', async () => {
    const r = await price(context([variant(KURTA, 12000)]), charges(), [{ variantId: KURTA, quantity: 1 }]);
    assert.ok(r.ok);
    // 10% of what is over $99.99, on a $120 bag
    assert.equal(r.quote.breakdown.bulkSavingCents, 200);
    assert.equal(r.quote.breakdown.shippingCents, 0, 'free from $49.99');
    assert.equal(r.quote.breakdown.totalCents, 11800 + r.quote.breakdown.retailerCents, 'D-191: the retailer charges stay');
    assert.ok(r.quote.breakdown.retailerCents > 0);
  });

  it('takes 20% off Heavy-item shipping from $99.99, not from the free line', async () => {
    const heavy = charges({ heavy_cents: 1000, heavy_ids: [KURTA] });
    const over = await price(context([variant(KURTA, 12000)]), heavy, [{ variantId: KURTA, quantity: 1 }]);
    assert.ok(over.ok);
    assert.equal(over.quote.breakdown.heavyCents, 800);
    assert.equal(over.quote.breakdown.heavyShownCents, 1000);
    const under = await price(context([variant(KURTA, 6000)]), heavy, [{ variantId: KURTA, quantity: 1 }]);
    assert.ok(under.ok);
    assert.equal(under.quote.breakdown.heavyCents, 1000, 'over the free line but under $99.99');
    assert.equal(under.quote.breakdown.bulkSavingCents, 0);
    assert.equal(under.quote.breakdown.shippingCents, 0, 'shipping is free there');
  });

  it('charges shipping below $49.99 and frees it from there', async () => {
    const below = await price(context([variant(KURTA, 3000)]), charges(), [{ variantId: KURTA, quantity: 1 }]);
    assert.ok(below.ok);
    assert.equal(below.quote.breakdown.shippingCents, 1862);
    assert.ok(below.quote.breakdown.retailerCents > 0);
  });

  it('keeps answering the old Android app: express null (never missing), standard, its window', async () => {
    // TODO(D-187): drop when app <next version> is the minimum
    const r = await price(context([variant(KURTA, 3000)]), charges(), [{ variantId: KURTA, quantity: 1 }], { shippingMethod: 'express' });
    assert.ok(r.ok);
    const json = JSON.parse(JSON.stringify(r.quote)) as Record<string, never> & { options: Record<string, unknown> };
    assert.ok('express' in json.options, 'quote-summary.tsx destructures options');
    assert.equal(json.options.express, null);
    assert.equal(json.shippingMethod, 'standard', 'an old app asking for express gets standard');
    const standard = json.options.standard as { shippingCents: number; delivery: { est_delivery_from: string } };
    assert.equal(standard.shippingCents, r.quote.breakdown.shippingCents + r.quote.breakdown.retailerCents);
    assert.equal(standard.delivery.est_delivery_from, WINDOW.est_delivery_from);
    assert.equal(r.quote.delivery.est_delivery_from, WINDOW.est_delivery_from);
  });

  it('a food bag has the food window; a mixed bag two shipments; outside the 48 states one shipment', async () => {
    const foodOnly = charges({ food_ids: [FOOD], shipments: { days_min: 7, days_max: 7, food_cents: 3000, food_only: true, split: false, outside: false, shipping_cents: 1862 } });
    const a = await price(context([variant(FOOD, 3000, 5, 'food')]), foodOnly, [{ variantId: FOOD, quantity: 1 }]);
    assert.ok(a.ok);
    assert.equal(a.quote.delivery.est_delivery_from, FOOD_WINDOW.est_delivery_from);
    assert.equal(a.quote.shipments, null);

    const split = charges({ food_ids: [FOOD], shipments: { days_min: 7, days_max: 7, food_cents: 1500, food_only: false, split: true, outside: false, shipping_cents: 1862 } });
    const b = await price(context([variant(FOOD, 1500, 5, 'food'), variant(KURTA, 4000)]), split, [{ variantId: FOOD, quantity: 1 }, { variantId: KURTA, quantity: 1 }]);
    assert.ok(b.ok);
    assert.deepEqual(b.quote.shipments?.map((s) => [s.seq, s.kind, s.variantIds]), [[1, 'food', [FOOD]], [2, 'standard', [KURTA]]]);
    assert.equal(b.quote.delivery.est_delivery_from, WINDOW.est_delivery_from);

    const away = charges({ shipments: { days_min: 7, days_max: 7, food_cents: 1500, food_only: false, split: false, outside: true, shipping_cents: 1862 } });
    const c = await price(context([variant(FOOD, 1500, 5, 'food')]), away, [{ variantId: FOOD, quantity: 1 }]);
    assert.ok(c.ok);
    assert.equal(c.quote.shipments, null);
    assert.equal(c.quote.outside, true);
    assert.equal(c.quote.delivery.est_delivery_from, WINDOW.est_delivery_from);
  });

  it('Y-3: a stock problem stops before the bag is priced, line by line', async () => {
    const ctx = context([variant(KURTA, 3000, 2)], { stock: [stock(KURTA, 2), stock(FOOD, 0, false)] });
    const { client, calls } = fakeClient(ctx, charges());
    const r = await priceCart(client, schema.parse(body([{ variantId: KURTA, quantity: 3 }, { variantId: FOOD, quantity: 1 }])));
    assert.equal(r.ok, false);
    assert.deepEqual(calls.filter((c) => c !== 'checkout_send_home'), ['checkout_context'], 'no charges read, no payment');
    if (!r.ok && r.problem.kind === 'stock') {
      assert.deepEqual(
        r.problem.lines.map((l) => [l.variantId, l.quantity, l.available]),
        [[KURTA, 3, 2], [FOOD, 1, 0]],
      );
    } else assert.fail('expected a stock problem');
  });
});

describe('stockProblems (Y-3)', () => {
  const q = (id: string, n: number) => new Map([[id, n]]);
  const v = [{ variant_id: KURTA }] as never;

  it('lists nothing when there is enough', () => {
    assert.deepEqual(stockProblems({ variants: v, stock: [stock(KURTA, 3)] }, q(KURTA, 3)), []);
  });
  it('fewer left: how many', () => {
    assert.equal(stockProblems({ variants: v, stock: [stock(KURTA, 2)] }, q(KURTA, 3))[0]?.available, 2);
  });
  it('sold out or off sale: none', () => {
    assert.equal(stockProblems({ variants: v, stock: [stock(KURTA, 0)] }, q(KURTA, 1))[0]?.available, 0);
    assert.equal(stockProblems({ variants: v, stock: [stock(KURTA, 4, false)] }, q(KURTA, 1))[0]?.available, 0);
  });
  it('a line the store no longer sells counts as off sale, whatever its stock says', () => {
    assert.equal(stockProblems({ variants: [] as never, stock: [stock(KURTA, 4)] }, q(KURTA, 1))[0]?.available, 0);
  });
  it('an option that no longer exists keeps nulls: the bag has its own words', () => {
    const line = stockProblems(
      { variants: [] as never, stock: [{ variant_id: KURTA, on_sale: false, available: 0, product_name: null, label: null, image_path: null }] },
      q(KURTA, 1),
    )[0];
    assert.equal(line?.productName, null);
  });
});

describe('the 5% saving at checkout (D-208)', () => {
  let priceCart: typeof PriceCart;
  let schema: typeof RequestSchema;
  before(async () => {
    const M = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
    const load = M._load;
    M._load = (request, ...rest) => (request === 'server-only' ? {} : load(request, ...rest));
    const pricing = await import('../features/checkout/pricing');
    priceCart = pricing.priceCart;
    schema = pricing.checkoutRequestSchema;
  });

  const OPEN = { ...SEND_HOME, rupees_per_usd: 92, inr_per_usd: 92 };
  const MAA = { relation: 'maa', callName: 'Maa', upi: '9847012345', note: 'Namaste' };
  const run = async (sendHome: unknown, extra: Record<string, unknown> = {}) =>
    priceCart(fakeClient(context([variant(KURTA, 8500)]), charges(), sendHome).client, schema.parse(body([{ variantId: KURTA, quantity: 1 }], extra)));

  it('is 5% of the goods, kept as Coins by default, and never in the total', async () => {
    const r = await run(SEND_HOME);
    const plain = await run({ ...SEND_HOME, save_pct: null });
    assert.ok(r.ok && plain.ok);
    assert.deepEqual(r.quote.saving, { cents: 425, to: 'coins', inrPaise: null, callName: null, relation: null });
    assert.deepEqual(r.saving, { cents: 425, pct: 5, gift: null });
    assert.equal(r.quote.breakdown.totalCents, plain.quote.breakdown.totalCents, 'the customer pays the same');
    assert.equal(plain.saving, null, 'no % set: no saving');
  });

  it("goes home in rupees at the day's rate when someone is named and Send home is open", async () => {
    const r = await run(OPEN, { gift: { lovedOne: MAA, save: false } });
    assert.ok(r.ok);
    assert.deepEqual(r.quote.saving, { cents: 425, to: 'home', inrPaise: 39100, callName: 'Maa', relation: 'maa' });
    assert.equal(r.saving?.gift?.upi, '9847012345');
  });

  it('is kept when Send home is closed, even with someone named', async () => {
    const r = await run(SEND_HOME, { gift: { lovedOne: MAA } });
    assert.ok(r.ok);
    assert.equal(r.quote.saving?.to, 'coins');
  });

  it('asks again for a UPI that is not one', async () => {
    const r = await run(OPEN, { gift: { lovedOne: { ...MAA, upi: 'nope' } } });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.problem.kind, 'gift');
  });
});

describe('checkout from another country (D-208)', () => {
  let priceCart: typeof PriceCart;
  let schema: typeof RequestSchema;
  before(async () => {
    const M = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
    const load = M._load;
    M._load = (request, ...rest) => (request === 'server-only' ? {} : load(request, ...rest));
    const pricing = await import('../features/checkout/pricing');
    priceCart = pricing.priceCart;
    schema = pricing.checkoutRequestSchema;
  });
  const UK = { line1: '1 High St', line2: null, city: 'London', state: '', zipCode: 'SW1A 1AA', country: 'GB', fullName: 'Priya Iyer', phone: null };

  it("prices each piece at the country's price and asks for no US tax", async () => {
    const world = { country: 'GB', variants: { [KURTA]: { price: 7200, heavy: 0 } }, products: {}, recipes: {} };
    const { client, calls } = fakeClient(context([variant(KURTA, 8500)]), charges(), SEND_HOME, world);
    const r = await priceCart(client, schema.parse({ ...body([{ variantId: KURTA, quantity: 2 }]), address: UK }));
    assert.ok(r.ok);
    assert.equal(r.quote.lines[0]!.unitPriceCents, 7200);
    assert.equal(r.quote.breakdown.subtotalCents, 14400);
    assert.equal(r.quote.breakdown.taxCents, 0);
    assert.ok(calls.includes('store_country_prices'));
  });

  it('refuses a country IWC does not sell in', async () => {
    const { client } = fakeClient(context([variant(KURTA, 8500)]), charges(), SEND_HOME, null);
    const r = await priceCart(client, schema.parse({ ...body([{ variantId: KURTA, quantity: 1 }]), address: { ...UK, country: 'RU' } }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.problem.kind, 'country');
  });

  it('leaves a US address exactly as it was (no country read)', async () => {
    const { client, calls } = fakeClient(context([variant(KURTA, 8500)]), charges());
    const r = await priceCart(client, schema.parse(body([{ variantId: KURTA, quantity: 1 }])));
    assert.ok(r.ok);
    assert.equal(r.quote.lines[0]!.unitPriceCents, 8500);
    assert.ok(!calls.includes('store_country_prices'));
  });
});
