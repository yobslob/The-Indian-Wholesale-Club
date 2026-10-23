import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { orderUpdateEmail } from '../lib/email/order-update';
import { isReservedAddress } from '../lib/email/reserved';

import type { EmailContext } from '../lib/email/frame';
import type { OrderDetail } from '@repo/db/store';

const base: OrderDetail = {
  order: {
    id: '00000000-0000-4000-8000-000000000001',
    order_number: 'IWC-261006-ABCDEF0123',
    email: 'asha@example.com',
    customer_status: 'preparing',
    est_delivery_from: '2026-11-10',
    est_delivery_to: '2026-11-14',
    subtotal_cents: 5000,
    discount_cents: 0,
    shipping_cents: 0,
    tax_cents: 400,
    total_cents: 5400,
    currency: 'USD',
    payment_status: 'paid',
    shipping_address: { fullName: 'Asha', line1: '1 Main St', city: 'Edison', state: 'NJ', zipCode: '08817' },
    tracking_number: null,
    carrier: null,
    created_at: '2026-10-06T10:00:00Z',
    shipping_method: 'standard',
    refunded_cents: 0,
  },
  items: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      order_id: '00000000-0000-4000-8000-000000000001',
      product_id: null,
      product_name: 'Kasavu <mundu>',
      variant_label: 'Free size',
      region_name: 'Kerala',
      quantity: 1,
      unit_price_cents: 5000,
      total_price_cents: 5000,
      status: 'unavailable',
    },
  ],
  events: [],
  shipments: [],
  offer: null,
  actions: { can_cancel: false, cancel_refund_cents: null, delay_open: true, delay_refund_cents: 5400, returns: [] },
};
const url = 'https://iwc.example/orders/IWC-261006-ABCDEF0123';
const ctx: EmailContext = {
  siteName: 'The Indian Wholesale Club',
  siteUrl: 'https://iwc.example',
  supportEmail: null,
  photo: (path) => `https://iwc.example/photo/${path}`,
};
const mail = (kind: string, order: OrderDetail = base) => orderUpdateEmail(kind, order, ctx);

const KINDS = [
  'preparing',
  'item_unavailable',
  'item_refunded',
  'order_cancelled',
  'delivery_window_changed',
  'faster_delivery_accepted',
  'arriving_sooner',
  'return_requested',
  'return_rejected',
  'shipped',
  'delivered',
];

describe('order update emails (B-20)', () => {
  it('every customer-visible update has an email that links to the order', () => {
    for (const kind of KINDS) {
      const email = mail(kind);
      assert.ok(email, kind);
      assert.ok(email.subject.includes('IWC-261006-ABCDEF0123'), kind);
      assert.ok(email.html.includes(url), kind);
    }
  });

  it('D-003: no email ever mentions shops, pickups, exports, cycles or vendors', () => {
    for (const kind of [...KINDS, 'faster_delivery_offer']) {
      const html =
        mail(kind, { ...base, offer: { price_cents: 500, est_delivery_from: '2026-11-01', est_delivery_to: '2026-11-04' } })
          ?.html ?? '';
      assert.doesNotMatch(html, /shop|pickup|export|cycle|vendor|forwarder|india desk/i, kind);
    }
  });

  it('escapes product names', () => {
    const html = mail('item_unavailable')?.html ?? '';
    assert.ok(html.includes('Kasavu &lt;mundu&gt;'));
    assert.ok(!html.includes('<mundu>'));
  });

  it('D-008: a delay offers the full refund or keeping the order', () => {
    const html = mail('delivery_window_changed')?.html ?? '';
    assert.ok(html.includes('$54.00'));
    assert.ok(html.includes('Keep it or cancel'));
  });

  it('D-094: the shipped email tracks on our order page, not the carrier site', () => {
    const html = mail('shipped', { ...base, order: { ...base.order, carrier: 'UPS', tracking_number: '1Z999AA10123456784' } })?.html ?? '';
    assert.ok(html.includes(`href="${url}"`));
    assert.ok(html.includes('Track your order'));
    assert.ok(!html.includes('ups.com'));
  });

  it('D-094: the unavailable piece is shown with its photo', () => {
    const html = mail('item_unavailable', {
      ...base,
      items: base.items.map((i) => ({ ...i, image_path: 'products/p1/mundu.jpg' })),
    })?.html ?? '';
    assert.ok(html.includes('https://iwc.example/photo/products/p1/mundu.jpg'));
  });

  it('no email for internal or unknown kinds, or an offer that is gone', () => {
    assert.equal(mail('note'), null);
    assert.equal(mail('faster_delivery_offer'), null);
  });
});

// D-154: an order of two shipments, the 7-day snack apart from the kurta
const SNACK = '00000000-0000-4000-8000-000000000003';
const split: OrderDetail = {
  ...base,
  items: [
    { ...base.items[0]!, status: 'active' },
    { ...base.items[0]!, id: SNACK, product_name: 'Banana chips', variant_label: '200 g', status: 'active' },
  ],
  shipments: [
    { seq: 1, kind: 'quick', status: 'shipped', est_delivery_from: '2026-10-30', est_delivery_to: '2026-10-30', shipping_cents: 931,
      carrier: 'DHL', tracking_number: '1234567890', shipped_at: '2026-10-24T10:00:00Z', item_ids: [SNACK] },
    { seq: 2, kind: 'standard', status: 'open', est_delivery_from: '2026-11-03', est_delivery_to: '2026-11-07', shipping_cents: 1862,
      carrier: null, tracking_number: null, shipped_at: null, item_ids: [base.items[0]!.id] },
  ],
  actions: { can_cancel: false, cancel_refund_cents: null, delay_open: true, delay_refund_cents: 6862, delay_shipment: 2, returns: [] },
};

describe('two shipments (D-154)', () => {
  it('each shipped email names its shipment and shows only its pieces', () => {
    const first = orderUpdateEmail('shipped', split, ctx, 1);
    assert.ok(first);
    assert.ok(first.subject.startsWith('Shipment 1 of order'));
    assert.ok(first.html.includes('Banana chips'));
    assert.ok(!first.html.includes('Kasavu'));
    assert.ok(first.html.includes('The rest travels on its own'));
  });

  it("a delay names the shipment, its new dates and its share back; the rest keeps its date", () => {
    const html = orderUpdateEmail('delivery_window_changed', split, ctx, 2)?.html ?? '';
    assert.ok(html.includes('arrives Nov 3 – Nov 7'));
    assert.ok(html.includes('$68.62'));
    assert.ok(html.includes('The rest of your order keeps its date.'));
  });

  it('a cancelled shipment says the rest is still coming', () => {
    const email = orderUpdateEmail('shipment_cancelled', split, ctx, 2);
    assert.ok(email);
    assert.ok(email.subject.startsWith('Shipment 2 of order'));
    assert.ok(email.html.includes('still coming'));
  });

  it('an order of one shipment is spoken of as an order', () => {
    assert.ok(orderUpdateEmail('shipped', base, ctx, 1)?.subject.startsWith('Order '));
  });

  it('D-003: no shipment email mentions shops or weights', () => {
    for (const kind of ['shipped', 'delivered', 'delivery_window_changed', 'shipment_cancelled'])
      for (const seq of [1, 2])
        assert.doesNotMatch(
          (orderUpdateEmail(kind, split, ctx, seq)?.html ?? '').replace(/<style[\s\S]*?<\/style>|<[^>]+>/g, ' '),
          /shop|pickup|export|cycle|vendor|weigh|\bkg\b/i,
          kind,
        );
  });
});

describe('reserved test addresses are never sent to', () => {
  it('skips .test, .example, .invalid and example.com, sends real domains', () => {
    for (const a of ['e2e-customer@iwc.test', 'a@shop.example', 'x@foo.invalid', 'b@example.com']) assert.equal(isReservedAddress(a), true, a);
    for (const a of ['asha@gmail.com', 'founder@iwc.in']) assert.equal(isReservedAddress(a), false, a);
  });
});
