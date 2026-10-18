import { formatUsd } from '@repo/shared/domain';

/**
 * Invoice A, the customer's (D-140, plan F4): what the customer paid, from the order only, so it can never show
 * operations data (D-003). Its number is "A-" and the order number. Refunds appear as credit notes under the total.
 * One component for the customer's order page (printed from it) and the admin's printable invoices.
 */
export interface InvoiceAData {
  orderNumber: string;
  placedAt: string;
  email: string;
  address: Record<string, unknown>;
  express: boolean;
  items: { id: string; name: string; label: string; region: string | null; quantity: number; unitCents: number; totalCents: number; status: string }[];
  subtotalCents: number;
  /** Promo discount, and the bulk saving when it is known apart (the admin's copy). */
  discountCents: number;
  bulkSavingCents?: number;
  shippingCents: number;
  /** Retailer charges when known apart; else they are inside shippingCents. */
  retailerCents?: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  sellerName: string;
  supportEmail: string | null;
}

// the seller's own zone, so the date never depends on the server's clock
const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
const text = (a: Record<string, unknown>, k: string): string => (typeof a[k] === 'string' ? (a[k] as string) : '');

export function InvoiceA({ data: d }: { data: InvoiceAData }): React.JSX.Element {
  const a = d.address;
  const lines: [string, string][] = [['Subtotal', formatUsd(d.subtotalCents)]];
  const promo = d.discountCents - (d.bulkSavingCents ?? 0);
  if (promo > 0) lines.push(['Discount', `−${formatUsd(promo)}`]);
  if ((d.bulkSavingCents ?? 0) > 0) lines.push(['Bulk saving', `−${formatUsd(d.bulkSavingCents!)}`]);
  if (d.retailerCents !== undefined) {
    lines.push([d.express ? 'Express shipping' : 'Shipping', d.shippingCents - d.retailerCents === 0 ? 'Free' : formatUsd(d.shippingCents - d.retailerCents)]);
    if (d.retailerCents > 0) lines.push(['Retailer charges', formatUsd(d.retailerCents)]);
  } else {
    lines.push([d.express ? 'Express shipping' : d.shippingCents > 0 ? 'Shipping & retailer charges' : 'Shipping', d.shippingCents === 0 ? 'Free' : formatUsd(d.shippingCents)]);
  }
  lines.push(['Sales tax', formatUsd(d.taxCents)]);

  return (
    <article className="font-body text-ink mx-auto max-w-[760px] text-[13px] leading-[1.45]" aria-label={`Invoice A-${d.orderNumber}`}>
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <p className="font-logo text-[20px]">{d.sellerName}</p>
          {d.supportEmail ? <p className="text-ink-muted">{d.supportEmail}</p> : null}
        </div>
        <div className="text-right">
          <h1 className="font-heading text-[22px] font-semibold">Invoice</h1>
          <p>
            No. <b>A-{d.orderNumber}</b>
          </p>
          <p>{date.format(new Date(d.placedAt))}</p>
        </div>
      </header>
      <section className="mb-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Billed and shipped to</p>
          <p>{text(a, 'fullName')}</p>
          <p>{[text(a, 'line1'), text(a, 'line2')].filter(Boolean).join(', ')}</p>
          <p>{[text(a, 'city'), [text(a, 'state'), text(a, 'zipCode')].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
          <p>{d.email}</p>
        </div>
        <div>
          <p className="text-ink-muted text-[11px] font-semibold uppercase tracking-[0.08em]">Order</p>
          <p>{d.orderNumber}</p>
          <p>{d.express ? 'Express delivery' : 'Standard delivery'}</p>
        </div>
      </section>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-ink border-b text-[11px] uppercase tracking-[0.06em]">
            <th className="py-1.5 font-semibold">Piece</th>
            <th className="py-1.5 text-right font-semibold">Qty</th>
            <th className="py-1.5 text-right font-semibold">Each</th>
            <th className="py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i) => (
            <tr key={i.id} className="border-line border-b align-top">
              <td className="py-1.5">
                {i.name}
                <span className="text-ink-muted block text-[12px]">
                  {[i.label, i.region ? `Made in India · ${i.region}` : 'Made in India'].filter(Boolean).join(' · ')}
                  {i.status !== 'active' ? ` · ${i.status === 'refunded' ? 'refunded' : 'not available, refunded'}` : ''}
                </span>
              </td>
              <td className="py-1.5 text-right">{i.quantity}</td>
              <td className="py-1.5 text-right">{formatUsd(i.unitCents)}</td>
              <td className="py-1.5 text-right">{formatUsd(i.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 grid w-[min(100%,320px)] gap-1 [&>div]:flex [&>div]:justify-between">
        {lines.map(([k, v]) => (
          <div key={k}>
            <dt className="text-ink-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div className="border-ink border-t pt-1.5 text-[15px] font-bold">
          <dt>Total paid</dt>
          <dd>{formatUsd(d.totalCents)}</dd>
        </div>
        {d.refundedCents > 0 ? (
          <div className="pt-1">
            <dt>Credit note CN-{d.orderNumber}: refunded</dt>
            <dd>−{formatUsd(d.refundedCents)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="text-ink-muted mt-8 text-[11.5px]">Amounts in US dollars. Thank you for shopping with us.</p>
    </article>
  );
}
