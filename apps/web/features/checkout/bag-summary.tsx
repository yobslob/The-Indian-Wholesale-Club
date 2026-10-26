import { arrivalLine, dayDate, DUTIES_PAID, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';
import { ChargeValue, PendingChargeRows, ReducedValue } from '@/features/cart/charge-lines';
import { PostmarkLine } from '@/features/cart/postmarks';

import type { SummaryLine } from './last-order';
import type { CheckoutQuote } from './types';

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }): React.JSX.Element {
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
                {[l.variantLabel, l.regionName].filter(Boolean).join(' · ')} · × {l.quantity}
              </small>
            </span>
            <span className="text-sm font-medium">{formatUsd(l.totalCents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <PostmarkLine names={lines.map((l) => l.regionName)} />
      </div>
      <dl className="font-ui mt-3 grid gap-2 text-sm">
        <Row label="Subtotal" value={formatUsd(b?.subtotalCents ?? subtotalCents)} />
        {b ? (
          <>
            {b.discountCents > 0 ? <Row label={`Discount (${quote.promoCode})`} value={`−${formatUsd(b.discountCents)}`} /> : null}
            {/* D-119: from the free-shipping line up, the bulk saving. */}
            {b.bulkSavingCents > 0 ? <Row label="Bulk saving" value={`−${formatUsd(b.bulkSavingCents)}`} /> : null}
            {quote.shippingMethod === 'express' ? (
              <Row label="Express shipping" value={formatUsd(b.shippingCents)} />
            ) : (
              <>
                {/* D-111, D-124: Shipping (the parcel + the food in the bag) and the retailer charges; struck through once free. */}
                <Row
                  label="Shipping"
                  value={<ChargeValue cents={b.shippingCents || (b.waivedCents?.shipping ?? 0)} free={b.shippingCents === 0} />}
                />
                {b.retailerCents > 0 || (b.waivedCents?.retailer ?? 0) > 0 ? (
                  <Row
                    label="Retailer charges"
                    value={<ChargeValue cents={b.retailerCents || (b.waivedCents?.retailer ?? 0)} free={b.retailerCents === 0} />}
                  />
                ) : null}
              </>
            )}
            {/* founder 2026-10-24: heavy cookware's other half, on standard and express alike */}
            {b.heavyCents > 0 ? (
              <Row label="Heavy-item shipping" value={<ReducedValue cents={b.heavyCents} shownCents={b.heavyShownCents} />} />
            ) : null}
            <Row label="Sales tax" value={formatUsd(b.taxCents)} />
            {/* D-140 (F5): what the free delivery line saved, above the total (a note; the total is exact) */}
            {quoteSaving(b) > 0 ? (
              <div className="text-brand flex justify-between font-semibold">
                <dt>You&apos;re saving</dt>
                <dd className="m-0">{formatUsd(quoteSaving(b))}</dd>
              </div>
            ) : null}
            <Row label="Total" value={formatUsd(b.totalCents)} strong />
            {/* D-161: the plan's quiet line under the total */}
            {DUTIES_PAID ? (
              <p className="text-ink-muted m-0 text-[13px]">That&rsquo;s everything. Duties are paid, nothing to pay at your door.</p>
            ) : null}
          </>
        ) : (
          <>
            <PendingChargeRows />
            <Row label="Sales tax" value="after your details" />
          </>
        )}
      </dl>
      {quote?.promoRejected ? <p className="text-caution mt-3 text-sm">That promo code can&apos;t be used on this order.</p> : null}
      {quote ? <QuoteDelivery quote={quote} lines={lines} /> : null}
    </div>
  );
}

/**
 * The dates, once the address is known (D-008, D-154): one window, or Shipment 1 and Shipment 2 with their pieces;
 * under the 7-day line how much more brings the 7-day pieces in 7 days (naming the promo code when it is the reason);
 * for an address outside the 48 states and DC, the line saying why everything comes together.
 */
function QuoteDelivery({ quote, lines }: { quote: CheckoutQuote; lines: SummaryLine[] }): React.JSX.Element {
  const names = (ids: string[]) =>
    lines
      .filter((l) => ids.includes(l.variantId))
      .map((l) => l.productName)
      .join(', ');
  const gap = !quote.quickOutside && quote.quickGapCents && quote.quickBy ? quote.quickGapCents : null;
  const byCode = gap !== null && quote.promoCode !== null && quote.breakdown.discountCents >= gap;
  return (
    <div className="bg-paper font-body mt-3 grid gap-2 rounded-xl px-3.5 py-3 text-sm font-medium">
      {quote.shipments && quote.shipments.length > 1 ? (
        quote.shipments.map((sh) => (
          <p key={sh.seq} className="m-0">
            <b className={sh.kind === 'quick' ? 'text-brand' : ''}>
              Shipment {sh.seq} · {arrivalLine(sh.delivery.est_delivery_from, sh.delivery.est_delivery_to)}
            </b>
            <small className="text-ink-muted block text-[13px] font-normal">{names(sh.variantIds)}</small>
          </p>
        ))
      ) : (
        <p className="m-0">
          Estimated delivery: <b>{formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}</b>
        </p>
      )}
      {gap !== null && quote.quickBy ? (
        <p className="text-brand m-0 text-[13px] font-semibold">
          {byCode
            ? `With the code ${quote.promoCode}, your 7-day pieces come to under the 7-day line, so they travel with the rest. Add ${formatUsd(gap)} of 7-day pieces and they arrive by ${dayDate(quote.quickBy)}.`
            : `Add ${formatUsd(gap)} of 7-day pieces and they arrive by ${dayDate(quote.quickBy)}`}
        </p>
      ) : null}
      {quote.quickOutside ? (
        <p className="text-ink-muted m-0 text-[13px] font-normal">
          7-day delivery reaches the 48 mainland states and DC, so everything here comes together in one shipment.
        </p>
      ) : null}
    </div>
  );
}

/** D-140 (F5): the struck charges, the line's part of Heavy-item shipping and the bulk saving of a priced bag. */
export function quoteSaving(b: {
  shippingCents: number;
  retailerCents: number;
  bulkSavingCents: number;
  waivedCents?: { shipping: number; retailer: number };
  heavyCents?: number;
  heavyShownCents?: number;
}): number {
  const shipping = b.shippingCents === 0 ? (b.waivedCents?.shipping ?? 0) : 0;
  const retailer = b.retailerCents === 0 ? (b.waivedCents?.retailer ?? 0) : 0;
  const heavy = b.heavyShownCents ? b.heavyShownCents - (b.heavyCents ?? 0) : 0;
  return shipping + retailer + heavy + b.bulkSavingCents;
}
