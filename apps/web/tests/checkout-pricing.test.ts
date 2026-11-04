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

/** The database as priceCart reads it: its two functions, nothing else. */
function fakeClient(ctx: unknown, bag: unknown): { client: IwcClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    rpc: (name: string) => {
      calls.push(name);
      return Promise.resolve({ data: name === 'checkout_context' ? ctx : bag, error: null });
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
    assert.equal(r.quote.breakdown.totalCents, 11800);
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
    assert.deepEqual(calls, ['checkout_context'], 'no charges read, no payment');
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
