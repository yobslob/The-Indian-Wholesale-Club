import { CUSTOMER_STATUS_LABEL, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { OrderDetail } from '@repo/db/store';

/**
 * Order confirmation email (storefront.md §Emails). Built ONLY from the
 * customer-safe order shape (guest_order_lookup / store_my_order), so it can
 * never contain operations data (D-003). Every dynamic value is escaped.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addressLines(address: Record<string, unknown>): string[] {
  const text = (key: string) => (typeof address[key] === 'string' ? (address[key] as string) : '');
  return [
    text('fullName'),
    text('line1'),
    text('line2'),
    [text('city'), [text('state'), text('zipCode')].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', '),
  ].filter(Boolean);
}

export function orderConfirmationSubject(order: OrderDetail, siteName: string): string {
  return `Your ${siteName} order ${order.order.order_number}`;
}

export function orderConfirmationHtml(
  order: OrderDetail,
  siteName: string,
  supportEmail: string | null,
): string {
  const o = order.order;
  const window =
    o.est_delivery_from && o.est_delivery_to
      ? formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)
      : null;
  const rows = order.items
    .map(
      (item) => `<tr>
  <td style="padding:8px 0">${escapeHtml(item.product_name)}<br><span style="color:#737373;font-size:12px">${escapeHtml(
    item.variant_label,
  )} · ${escapeHtml(item.region_name)}</span></td>
  <td style="padding:8px 0;text-align:center">${item.quantity}</td>
  <td style="padding:8px 0;text-align:right">${formatUsd(item.total_price_cents)}</td>
</tr>`,
    )
    .join('');
  const money = (label: string, cents: number, minus = false) =>
    `<tr><td colspan="2" style="padding:2px 0">${label}</td><td style="text-align:right">${minus ? '−' : ''}${formatUsd(cents)}</td></tr>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(o.order_number)}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#171717;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px">${escapeHtml(siteName)}</h1>
<p>Thank you. Your order <strong>${escapeHtml(o.order_number)}</strong> is ${escapeHtml(
    CUSTOMER_STATUS_LABEL[o.customer_status].toLowerCase(),
  )}.</p>
${window ? `<p>Estimated delivery: <strong>${escapeHtml(window)}</strong></p>` : ''}
<table style="width:100%;border-collapse:collapse;font-size:14px">
<thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
${money('Subtotal', o.subtotal_cents)}
${o.discount_cents > 0 ? money('Discount', o.discount_cents, true) : ''}
${money('Shipping', o.shipping_cents)}
${money('Sales tax', o.tax_cents)}
<tr><td colspan="2" style="padding-top:6px"><strong>Total</strong></td><td style="text-align:right"><strong>${formatUsd(
    o.total_cents,
  )}</strong></td></tr>
</tfoot></table>
<p style="font-size:13px;color:#525252">Shipping to:<br>${addressLines(o.shipping_address).map(escapeHtml).join('<br>')}</p>
${supportEmail ? `<p style="font-size:12px;color:#737373">Questions? ${escapeHtml(supportEmail)}</p>` : ''}
</body></html>`;
}
