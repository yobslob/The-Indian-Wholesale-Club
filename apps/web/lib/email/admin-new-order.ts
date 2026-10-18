import { formatUsd } from '@repo/shared/domain';

import { button, escapeHtml, frame, paragraph, pieces, totals, type EmailContext } from './frame';

import type { OrderDetail } from '@repo/db/store';

/**
 * The admins' "new order" email (D-140, plan A1): sent to each address on the admin allowlist when an order is paid,
 * so nobody has to keep the panel open. Built from the same customer-safe order shape as the confirmation; the button
 * opens the order in the admin (it goes to admins only, never to a customer, D-006).
 */
export function adminNewOrderSubject(order: OrderDetail): string {
  const o = order.order;
  const n = order.items.reduce((s, i) => s + i.quantity, 0);
  return `New order ${o.order_number}: ${n} piece${n === 1 ? '' : 's'}, ${formatUsd(o.total_cents)}`;
}

export function adminNewOrderHtml(order: OrderDetail, ctx: EmailContext): string {
  const o = order.order;
  const a = o.shipping_address as Record<string, unknown>;
  const place = [a.city, a.state].filter((v) => typeof v === 'string' && v).join(', ');
  const body = [
    paragraph(
      `<strong>${escapeHtml(o.order_number)}</strong> was paid${place ? `, going to ${escapeHtml(place)}` : ''}${o.shipping_method === 'express' ? ', <strong>Express</strong>' : ''}.`,
    ),
    pieces(order.items, ctx),
    totals([['Total paid', formatUsd(o.total_cents)]]),
    button(`${ctx.siteUrl}/admin/orders?q=${encodeURIComponent(o.order_number)}`, 'Open it in the admin'),
  ].join('\n');
  return frame(ctx, { title: o.order_number, orderLine: `Order ${o.order_number}`, heading: 'New order', body });
}
