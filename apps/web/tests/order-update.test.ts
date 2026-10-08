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

describe('reserved test addresses are never sent to', () => {
  it('skips .test, .example, .invalid and example.com, sends real domains', () => {
    for (const a of ['e2e-customer@iwc.test', 'a@shop.example', 'x@foo.invalid', 'b@example.com']) assert.equal(isReservedAddress(a), true, a);
    for (const a of ['asha@gmail.com', 'founder@iwc.in']) assert.equal(isReservedAddress(a), false, a);
  });
});
