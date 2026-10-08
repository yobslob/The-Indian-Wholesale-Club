import { CUSTOMER_STATUS_LABEL, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { button, escapeHtml, frame, paragraph, pieces, small, totals, type EmailContext } from './frame';

import type { OrderDetail } from '@repo/db/store';

export { escapeHtml };

/**
 * Order confirmation email (storefront.md §Emails), in the D-094 frame with a photo of each piece. Built ONLY from the
 * customer-safe order shape (guest_order_lookup / store_my_order), so it can never contain operations data (D-003).
 * Every dynamic value is escaped.
 */
function addressLines(address: Record<string, unknown>): string[] {
  const text = (key: string) => (typeof address[key] === 'string' ? (address[key] as string) : '');
  return [
    text('fullName'),
    text('line1'),
    text('line2'),
    [text('city'), [text('state'), text('zipCode')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  ].filter(Boolean);
}

export function orderConfirmationSubject(order: OrderDetail, siteName: string): string {
  return `Your ${siteName} order ${order.order.order_number}`;
}

export function orderConfirmationHtml(order: OrderDetail, ctx: EmailContext): string {
  const o = order.order;
  const window = o.est_delivery_from && o.est_delivery_to ? formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to) : null;
  const rows: [string, string][] = [['Subtotal', formatUsd(o.subtotal_cents)]];
  if (o.discount_cents > 0) rows.push(['Discount', `−${formatUsd(o.discount_cents)}`]);
  rows.push(
    [o.shipping_method === 'express' ? 'Express shipping' : 'Shipping', o.shipping_cents === 0 ? 'Free' : formatUsd(o.shipping_cents)],
    ['Sales tax', formatUsd(o.tax_cents)],
    ['Total', formatUsd(o.total_cents)],
  );
  const body = [
    paragraph(
      `Thank you. Your order <strong>${escapeHtml(o.order_number)}</strong> is ${escapeHtml(CUSTOMER_STATUS_LABEL[o.customer_status].toLowerCase())}.`,
    ),
    window ? paragraph(`Estimated delivery: <strong>${escapeHtml(window)}</strong>`) : '',
    pieces(order.items, ctx),
    totals(rows),
    small(`Shipping to:<br>${addressLines(o.shipping_address).map(escapeHtml).join('<br>')}`),
    button(`${ctx.siteUrl}/orders/${encodeURIComponent(o.order_number)}`, 'See your order'),
  ].join('\n');
  return frame(ctx, { title: o.order_number, orderLine: `Order ${o.order_number}`, heading: 'Thank you', body });
}
