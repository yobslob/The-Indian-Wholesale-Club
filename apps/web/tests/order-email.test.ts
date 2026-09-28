import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  escapeHtml,
  orderConfirmationHtml,
  orderConfirmationSubject,
} from '../lib/email/order-confirmation';

import type { OrderDetail } from '@repo/db/store';

const order: OrderDetail = {
  order: {
    id: '00000000-0000-4000-8000-000000000001',
    order_number: 'IWC-260928-ABCDEF0123',
    email: 'asha@example.com',
    customer_status: 'confirmed',
    est_delivery_from: '2026-10-30',
    est_delivery_to: '2026-11-04',
    subtotal_cents: 5000,
    discount_cents: 500,
    shipping_cents: 900,
    tax_cents: 432,
    total_cents: 5832,
    currency: 'USD',
    payment_status: 'paid',
    shipping_address: {
      fullName: 'Asha <Rao>',
      line1: '1 Main St',
      city: 'Edison',
      state: 'NJ',
      zipCode: '08817',
    },
    tracking_number: null,
    carrier: null,
    created_at: '2026-09-28T10:00:00Z',
  },
  items: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      order_id: '00000000-0000-4000-8000-000000000001',
      product_id: null,
      product_name: 'Kasavu mundu',
      variant_label: 'Free size',
      region_name: 'Kerala',
      quantity: 1,
      unit_price_cents: 5000,
      total_price_cents: 5000,
      status: 'active',
    },
  ],
  events: [],
};

describe('order confirmation email (storefront.md §Emails)', () => {
  const html = orderConfirmationHtml(order, 'The Indian Wholesale Club', 'help@example.com');

  it('shows the order number, the delivery window from the order (D-008) and the totals', () => {
    assert.match(html, /IWC-260928-ABCDEF0123/);
    assert.match(html, /Oct 30 – Nov 4/);
    assert.match(html, /\$58\.32/);
    assert.match(html, /Kasavu mundu/);
    assert.match(html, /Kerala/);
  });

  it('escapes customer-entered text', () => {
    assert.match(html, /Asha &lt;Rao&gt;/);
    assert.doesNotMatch(html, /<Rao>/);
    assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
  });

  it('says nothing about operations (D-003)', () => {
    for (const word of ['vendor', 'shop', 'pickup', 'cycle', 'payout', 'export', 'COO']) {
      assert.doesNotMatch(html.toLowerCase(), new RegExp(`\\b${word.toLowerCase()}`), word);
    }
  });

  it('has a subject with the order number', () => {
    assert.equal(
      orderConfirmationSubject(order, 'The Indian Wholesale Club'),
      'Your The Indian Wholesale Club order IWC-260928-ABCDEF0123',
    );
  });
});
