import { billOf, formatDeliveryWindow, formatUsd, type Bill } from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';
import { BillCard } from '@/features/cart/bill-card';

import type { SummaryLine } from './last-order';
import type { CheckoutQuote } from './types';

/** The bill of a bag the server has priced. */
export const billOfQuote = (quote: CheckoutQuote): Bill => billOf(quote.breakdown, quote.promoCode, true);

/**
 * The bag beside the checkout steps (D-087) and on the thank-you page: its pieces, the one bill (D-192), and the delivery
 * dates once the server has priced the bag (D-008, D-038).
 */
export function BagSummary({
  title,
  lines,
  subtotalCents,
  quote,
  bill,
  updating,
  signInHref,
  linesOnly = false,
}: {
  title: string;
  lines: SummaryLine[];
  subtotalCents: number;
  quote: CheckoutQuote | null;
  /** The bag's own bill while nothing is priced yet. */
  bill?: Bill | null;
  updating?: boolean;
  signInHref?: string;
  /** On a phone at Payment the shipments and bill are already above Pay. */
  linesOnly?: boolean;
}): React.JSX.Element {
  return (
    <div className="grid gap-3">
      <div className="bg-paper border-line rounded-lg border px-4 pt-4">
        <h3 className="font-heading m-0 mb-1.5 text-lg font-medium leading-none text-[#1D1A17]">{title}</h3>
        <ul className="m-0 list-none p-0">
          {lines.map((l) => (
            <li key={l.variantId} className="border-line font-ui grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-b-0">
              <LinePhoto path={l.imagePath} className="w-14 rounded-[10px]" />
              <span className="min-w-0">
                <b className="block text-sm font-semibold leading-snug">{l.productName}</b>
                <small className="text-ink-muted text-[13px]">
                  {[l.variantLabel, l.regionName].filter(Boolean).join(' · ')} · × {l.quantity}
                </small>
              </span>
              <span className="text-sm font-medium">{formatUsd(l.totalCents)}</span>
            </li>
          ))}
        </ul>
      </div>
      {quote && !linesOnly ? <QuoteDelivery quote={quote} lines={lines} /> : null}
      {linesOnly ? null : (
        <BillCard bill={quote ? billOfQuote(quote) : (bill ?? null)} subtotalCents={subtotalCents} updating={updating} signInHref={quote ? undefined : signInHref} />
      )}
    </div>
  );
}

/**
 * The dates, once the address is known (D-008, D-187): one card, or D-192 one card for each of Shipment 1 (food) and
 * Shipment 2 with their pieces; for an address outside the 48 states and DC, the line saying why everything comes together.
 */
export function QuoteDelivery({ quote, lines }: { quote: CheckoutQuote; lines: SummaryLine[] }): React.JSX.Element {
  const names = (ids: string[]) =>
    lines
      .filter((l) => ids.includes(l.variantId))
      .map((l) => l.productName)
      .join(', ');
  const card = 'bg-paper border-line font-body m-0 rounded-lg border px-4 py-3 text-sm font-medium';
  return (
    <div className="grid gap-3">
      {quote.shipments && quote.shipments.length > 1 ? (
        quote.shipments.map((sh) => (
          <p key={sh.seq} className={card}>
            <b className={sh.kind === 'food' ? 'text-brand' : ''}>
              Shipment {sh.seq} · {sh.kind === 'food' ? 'Food' : 'Clothing and home & gifts'}
            </b>
            <span className="block font-normal">
              Estimated delivery: <b className="font-semibold">{formatDeliveryWindow(sh.delivery.est_delivery_from, sh.delivery.est_delivery_to)}</b>
            </span>
            <small className="text-ink-muted block text-[13px] font-normal">{names(sh.variantIds)}</small>
          </p>
        ))
      ) : (
        <p className={card}>
          Estimated delivery: <b>{formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}</b>
          {quote.outside ? (
            <small className="text-ink-muted mt-1 block text-[13px] font-normal">
              Food comes on its own only to the 48 mainland states and DC, so everything here comes together in one shipment.
            </small>
          ) : null}
        </p>
      )}
    </div>
  );
}
