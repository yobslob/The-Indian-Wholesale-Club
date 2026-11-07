import Link from 'next/link';

import { formatUsd, type Bill } from '@repo/shared/domain';

/** The wallet's little coin (D-192). */
export function CoinIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" className="text-caution inline-block align-[-2px]" role="img" aria-label="coins">
      <circle cx="8" cy="8" r="7" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function Row({ label, children, good = false }: { label: React.ReactNode; children: React.ReactNode; good?: boolean }): React.JSX.Element {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${good ? 'text-positive font-medium' : ''}`}>
      <dt className={good ? '' : 'text-ink-muted'}>{label}</dt>
      <dd className="m-0 whitespace-nowrap">{children}</dd>
    </div>
  );
}

const Was = ({ cents }: { cents: number }): React.JSX.Element => (
  <s className="text-ink-muted mr-1.5" aria-label={`was ${formatUsd(cents)}`}>
    {formatUsd(cents)}
  </s>
);

export const billTotalLabel = (bill: Bill | null): string => (bill && bill.taxCents !== null ? 'Total' : 'Bag total');

/**
 * D-192: the one bill, in the bag, at checkout and on the thank-you page. Top to bottom it adds up to the total: what is
 * taken off, what is paid, then the total; what was saved sits under the total, outside the sum. Sales tax joins once the
 * address is known, and until then the last line says "Bag total". Only free Shipping and the heavy-item discount are ever
 * struck through; every Retailer charge is paid (D-191).
 */
export function BillCard({
  bill,
  subtotalCents,
  updating = false,
  signInHref,
}: {
  bill: Bill | null;
  subtotalCents: number;
  updating?: boolean;
  /** A guest's way to the wallet, where signing in still helps. */
  signInHref?: string;
}): React.JSX.Element {
  return (
    <section aria-label="Bill" className="bg-paper border-line font-ui rounded-lg border p-4 text-sm">
      <dl className={`m-0 grid gap-2 transition-opacity ${updating ? 'opacity-60' : ''}`} aria-busy={updating || bill === null}>
        <Row label="Subtotal">{formatUsd(bill?.subtotalCents ?? subtotalCents)}</Row>
        {bill ? (
          <>
            {bill.couponCents > 0 ? (
              <Row good label={`Coupon (${bill.couponCode ?? ''})`}>
                −{formatUsd(bill.couponCents)}
              </Row>
            ) : null}
            {bill.bulkCents > 0 ? (
              <Row good label="Bulk saving">
                −{formatUsd(bill.bulkCents)}
              </Row>
            ) : null}
            {bill.coins > 0 ? (
              <Row
                good
                label={
                  <>
                    Wallet ({bill.coins} <CoinIcon />)
                  </>
                }
              >
                −{formatUsd(bill.coins)}
              </Row>
            ) : signInHref ? (
              <Row
                label={
                  <>
                    Wallet <CoinIcon />
                  </>
                }
              >
                <Link href={signInHref} className="text-ink font-medium underline underline-offset-[3px]">
                  Sign in
                </Link>
              </Row>
            ) : null}
            <Row label="Shipping">
              {bill.shippingCents > 0 ? (
                formatUsd(bill.shippingCents)
              ) : (
                <>
                  {bill.shippingWasCents > 0 ? <Was cents={bill.shippingWasCents} /> : null}
                  <span className="text-positive font-medium">Free</span>
                </>
              )}
            </Row>
            {bill.retailerCents > 0 ? <Row label="Retailer charges">{formatUsd(bill.retailerCents)}</Row> : null}
            {bill.heavyCents > 0 ? (
              <Row label="Heavy-item shipping">
                {bill.heavyWasCents > 0 ? <Was cents={bill.heavyWasCents} /> : null}
                {formatUsd(bill.heavyCents)}
              </Row>
            ) : null}
            {bill.taxCents !== null ? <Row label="Sales tax">{formatUsd(bill.taxCents)}</Row> : null}
            <div className="border-line text-ink mt-1 flex items-baseline justify-between gap-3 border-t pt-3 text-base font-bold">
              <dt>{billTotalLabel(bill)}</dt>
              <dd className="m-0">{formatUsd(bill.totalCents)}</dd>
            </div>
          </>
        ) : (
          <div aria-hidden="true" className="grid gap-2 pt-0.5">
            <div className="bg-land/70 h-3.5 w-full rounded motion-safe:animate-pulse" />
            <div className="bg-land/70 h-3.5 w-full rounded motion-safe:animate-pulse" />
          </div>
        )}
      </dl>
      {bill && bill.savingCents > 0 ? (
        <p className="bg-positive-soft text-positive m-0 mt-3 flex items-baseline justify-between gap-3 rounded-[10px] px-3 py-2 font-semibold">
          <span>You&apos;re saving</span>
          <span>{formatUsd(bill.savingCents)}</span>
        </p>
      ) : null}
    </section>
  );
}
