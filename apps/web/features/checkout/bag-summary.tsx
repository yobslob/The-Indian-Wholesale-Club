import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';
import { ChargeValue, PendingChargeRows, ReducedValue } from '@/features/cart/charge-lines';

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

/** D-191: the coins used on the left, the dollars they take off on the right. */
const CoinsRow = ({ coins }: { coins: number }): React.JSX.Element => (
  <div className="text-positive flex justify-between font-medium">
    <dt>{coins} {coins === 1 ? 'coin' : 'coins'} used</dt>
    <dd className="m-0">−{formatUsd(coins)}</dd>
  </div>
);

/** What the coupon box has put on a bag not priced yet (the server's figures replace it). */
export interface BillPreview {
  couponCode: string | null;
  couponCents: number;
  coins: number;
}

/** The bill of a priced bag: discounts, charges, tax and the total. Also above Pay on a phone, where the bag is folded. */
export function BillRows({ quote }: { quote: CheckoutQuote }): React.JSX.Element {
  const b = quote.breakdown;
  return (
    <>
      {b.discountCents > 0 ? <Row label={`Coupon (${quote.promoCode})`} value={`−${formatUsd(b.discountCents)}`} /> : null}
      {/* D-119, D-187: from its own line up, the bulk saving; none while a coupon is on (D-191). */}
      {b.bulkSavingCents > 0 ? <Row label="Bulk saving" value={`−${formatUsd(b.bulkSavingCents)}`} /> : null}
      {(b.coinsUsed ?? 0) > 0 ? <CoinsRow coins={b.coinsUsed} /> : null}
      {/* D-111, D-124: Shipping (the parcel + the food in the bag), struck through once free. */}
      <Row
        label="Shipping"
        value={<ChargeValue cents={b.shippingCents || (b.waivedCents?.shipping ?? 0)} free={b.shippingCents === 0} />}
      />
      {/* D-191: always paid, never struck through */}
      {b.retailerCents > 0 ? <Row label="Retailer charges" value={formatUsd(b.retailerCents)} /> : null}
      {/* founder 2026-10-24: heavy cookware's other half */}
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
    </>
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
  preview,
}: {
  title: string;
  lines: SummaryLine[];
  subtotalCents: number;
  quote: CheckoutQuote | null;
  preview?: BillPreview;
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
      <dl className="font-ui mt-3 grid gap-2 text-sm">
        <Row label="Subtotal" value={formatUsd(b?.subtotalCents ?? subtotalCents)} />
        {quote ? (
          <BillRows quote={quote} />
        ) : (
          <>
            {preview?.couponCode && preview.couponCents > 0 ? (
              <Row label={`Coupon (${preview.couponCode})`} value={`−${formatUsd(preview.couponCents)}`} />
            ) : null}
            {preview && preview.coins > 0 ? <CoinsRow coins={preview.coins} /> : null}
            <PendingChargeRows />
            <Row label="Sales tax" value="after your details" />
          </>
        )}
      </dl>
      {quote ? <QuoteDelivery quote={quote} lines={lines} /> : null}
    </div>
  );
}

/**
 * The dates, once the address is known (D-008, D-187): one window, or Shipment 1 (food) and Shipment 2 with their pieces;
 * for an address outside the 48 states and DC, the line saying why everything comes together.
 */
function QuoteDelivery({ quote, lines }: { quote: CheckoutQuote; lines: SummaryLine[] }): React.JSX.Element {
  const names = (ids: string[]) =>
    lines
      .filter((l) => ids.includes(l.variantId))
      .map((l) => l.productName)
      .join(', ');
  return (
    <div className="bg-paper font-body mt-3 grid gap-2 rounded-xl px-3.5 py-3 text-sm font-medium">
      {quote.shipments && quote.shipments.length > 1 ? (
        quote.shipments.map((sh) => (
          <p key={sh.seq} className="m-0">
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
        <p className="m-0">
          Estimated delivery: <b>{formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}</b>
        </p>
      )}
      {quote.outside ? (
        <p className="text-ink-muted m-0 text-[13px] font-normal">
          Food comes on its own only to the 48 mainland states and DC, so everything here comes together in one shipment.
        </p>
      ) : null}
    </div>
  );
}

/** D-140 (F5): the struck Shipping, the line's part of Heavy-item shipping and the bulk saving of a priced bag. */
export function quoteSaving(b: {
  shippingCents: number;
  bulkSavingCents: number;
  waivedCents?: { shipping: number };
  heavyCents?: number;
  heavyShownCents?: number;
}): number {
  const shipping = b.shippingCents === 0 ? (b.waivedCents?.shipping ?? 0) : 0;
  const heavy = b.heavyShownCents ? b.heavyShownCents - (b.heavyCents ?? 0) : 0;
  return shipping + heavy + b.bulkSavingCents;
}
