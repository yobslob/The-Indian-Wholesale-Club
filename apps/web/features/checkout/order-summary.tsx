import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { CheckoutQuote } from './types';

/** Server-priced totals and the delivery window, shown before payment (D-008). */
export function OrderSummary({ quote }: { quote: CheckoutQuote }): React.JSX.Element {
  const b = quote.breakdown;
  const row = (label: string, value: string) => (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
  return (
    <div className="border-line space-y-3 rounded-lg border p-5 text-sm">
      <ul className="space-y-1">
        {quote.lines.map((l) => (
          <li key={l.variantId} className="flex justify-between gap-4">
            <span>
              {l.productName} · {l.variantLabel} × {l.quantity}
            </span>
            <span>{formatUsd(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="border-line space-y-1 border-t pt-3">
        {row('Subtotal', formatUsd(b.subtotalCents))}
        {b.discountCents > 0
          ? row(`Discount (${quote.promoCode})`, `−${formatUsd(b.discountCents)}`)
          : null}
        {row(
          quote.shippingMethod === 'express' ? 'Express shipping' : 'Shipping',
          b.shippingCents === 0 ? 'Free' : formatUsd(b.shippingCents),
        )}
        {row('Sales tax', formatUsd(b.taxCents))}
        <div className="border-line flex justify-between border-t pt-2 font-medium">
          <dt>Total</dt>
          <dd>{formatUsd(b.totalCents)}</dd>
        </div>
      </dl>
      {quote.promoRejected ? (
        <p className="text-caution">That promo code can&apos;t be used on this order.</p>
      ) : null}
      <p className="text-ink">
        Estimated delivery:{' '}
        {formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}
      </p>
    </div>
  );
}
