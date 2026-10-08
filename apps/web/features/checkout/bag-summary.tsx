import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';

import type { SummaryLine } from './last-order';
import type { CheckoutQuote } from './types';

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }): React.JSX.Element {
  return (
    <div className={`flex justify-between ${strong ? 'border-line mt-1 border-t pt-2.5 text-base font-bold' : ''}`}>
      <dt className={strong ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}

/**
 * The bag beside the checkout steps (D-087) and on the thank-you page: photos, lines and the subtotal; shipping, tax,
 * the total and the estimated delivery window once the server has priced the bag (D-008, D-038).
 */
export function BagSummary({
  title,
  lines,
  subtotalCents,
  quote,
}: {
  title: string;
  lines: SummaryLine[];
  subtotalCents: number;
  quote: CheckoutQuote | null;
}): React.JSX.Element {
  const b = quote?.breakdown;
  return (
    <div className="bg-surface rounded-lg p-[22px]">
      <h3 className="font-heading m-0 mb-3.5 text-lg font-medium leading-none text-[#1D1A17]">{title}</h3>
      <ul className="m-0 list-none p-0">
        {lines.map((l) => (
          <li key={l.variantId} className="border-line font-ui grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5">
            <LinePhoto path={l.imagePath} className="w-14 rounded-[10px]" />
            <span className="min-w-0">
              <b className="block text-sm font-semibold leading-snug">{l.productName}</b>
              <small className="text-ink-muted text-[13px]">
                {l.variantLabel} · {l.regionName} · × {l.quantity}
              </small>
            </span>
            <span className="text-sm font-medium">{formatUsd(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="font-ui mt-3 grid gap-2 text-sm">
        <Row label="Subtotal" value={formatUsd(b?.subtotalCents ?? subtotalCents)} />
        {b ? (
          <>
            {b.discountCents > 0 ? <Row label={`Discount (${quote.promoCode})`} value={`−${formatUsd(b.discountCents)}`} /> : null}
            <Row
              label={quote.shippingMethod === 'express' ? 'Express shipping' : 'Shipping'}
              value={b.shippingCents === 0 ? 'Free' : formatUsd(b.shippingCents)}
            />
            <Row label="Sales tax" value={formatUsd(b.taxCents)} />
            <Row label="Total" value={formatUsd(b.totalCents)} strong />
          </>
        ) : (
          <Row label="Shipping and tax" value="after your details" />
        )}
      </dl>
      {quote?.promoRejected ? <p className="text-caution mt-3 text-sm">That promo code can&apos;t be used on this order.</p> : null}
      {quote ? (
        <p className="bg-paper font-body mt-3 rounded-xl px-3.5 py-3 text-sm font-medium">
          Estimated delivery: <b>{formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}</b>
        </p>
      ) : null}
    </div>
  );
}
