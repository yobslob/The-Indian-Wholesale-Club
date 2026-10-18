import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getAdminOrder, getShopBill } from '@repo/db/admin';
import { BETA_PRICING, formatInr, formatUsd, paiseToCents, shopBillTotalPaise } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { orderMoney } from '@/features/admin/shop-bill/money';
import { InvoiceA } from '@/features/orders/invoice-a';
import { supportEmail } from '@/lib/env';
import { SITE_NAME } from '@/lib/site';

type Params = Promise<{ id: string; kind: string }>;

const KINDS = { a: 'A · Customer invoice', b: 'B · Our cost (landed)', c: 'C · Shop bill' } as const;
// the seller's own zone, so the date never depends on the server's clock
const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

/**
 * An order's three invoices to print or save as PDF (D-140, plan F4): A the customer's (what they paid), B our landed
 * cost (shop price ÷ 0.90 + weight × ₹2 a gram, × quantity; provisional until every piece is weighed at the hub), C
 * the shop bill as the India desk filled it in. B and C are admin only (D-003).
 */
export default async function OrderInvoicePage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id, kind } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !(kind in KINDS)) notFound();
  const k = kind as keyof typeof KINDS;
  const [order, bill] = await Promise.all([getAdminOrder(client, id), getShopBill(client, id)]);
  if (!order) notFound();
  const n = order.order_number;
  const money = orderMoney(order, bill);
  const active = order.items.filter((i) => i.status === 'active');

  return (
    <div className="space-y-6">
      <nav className="font-ui flex flex-wrap items-center gap-4 text-[13px] print:hidden" aria-label="Invoices">
        <Link href={`/admin/orders/${id}`} className="underline">
          ← Order {n}
        </Link>
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((x) => (
          <Link key={x} href={`/admin/orders/${id}/invoice/${x}`} aria-current={x === k ? 'page' : undefined} className={x === k ? 'font-bold' : 'underline'}>
            {KINDS[x]}
          </Link>
        ))}
        <span className="text-ink-muted">Print this page, or save it as PDF.</span>
      </nav>

      {k === 'a' ? (
        <InvoiceA
          data={{
            orderNumber: n,
            placedAt: order.created_at,
            email: order.email,
            address: order.shipping_address as Record<string, unknown>,
            express: order.shipping_method === 'express',
            items: order.items.map((i) => ({
              id: i.id,
              name: i.product_name,
              label: i.variant_label,
              region: i.region_name,
              quantity: i.quantity,
              unitCents: i.unit_price_cents,
              totalCents: i.total_price_cents,
              status: i.status,
            })),
            subtotalCents: order.subtotal_cents,
            discountCents: order.discount_cents,
            bulkSavingCents: order.bulk_saving_cents,
            shippingCents: order.shipping_cents,
            retailerCents: order.retailer_charge_cents,
            taxCents: order.tax_cents,
            totalCents: order.total_cents,
            refundedCents: order.refunded_cents,
            sellerName: SITE_NAME,
            supportEmail: supportEmail(),
          }}
        />
      ) : (
        <article className="font-body text-ink mx-auto max-w-[860px] text-[13px] leading-[1.45]">
          <header className="mb-5 flex items-start justify-between gap-6">
            <div>
              <p className="font-logo text-[20px]">{SITE_NAME}</p>
              <p className="text-ink-muted">Internal: not for customers</p>
            </div>
            <div className="text-right">
              <h1 className="font-heading text-[22px] font-semibold">{k === 'b' ? 'Landed cost' : 'Shop bill'}</h1>
              <p>
                No. <b>{k.toUpperCase()}-{n}</b>
              </p>
              <p>
                Order placed {date.format(new Date(order.created_at))}
                {k === 'b' ? ` · ${money.b.final ? 'final (every piece weighed)' : 'provisional (not every piece weighed at the hub yet)'}` : bill ? ` · ${bill.status}` : ' · not started'}
              </p>
            </div>
          </header>
          {k === 'b' ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-ink border-b text-[11px] uppercase tracking-[0.06em]">
                  <th className="py-1.5 font-semibold">Piece</th>
                  <th className="py-1.5 text-right font-semibold">Shop ₹</th>
                  <th className="py-1.5 text-right font-semibold">÷ 0.90</th>
                  <th className="py-1.5 text-right font-semibold">Weight</th>
                  <th className="py-1.5 text-right font-semibold">Shipping ₹</th>
                  <th className="py-1.5 text-right font-semibold">Qty</th>
                  <th className="py-1.5 text-right font-semibold">Line ₹</th>
                  <th className="py-1.5 text-right font-semibold">Sold for</th>
                </tr>
              </thead>
              <tbody>
                {active.map((i) => {
                  const shop = i.shop_price_paise ?? i.pickup?.shop_price_paise ?? null;
                  const g = i.pickup?.weighed_g ?? i.weight_g;
                  const piece = money.pieces.get(i.id);
                  return (
                    <tr key={i.id} className="border-line border-b align-top">
                      <td className="py-1.5">
                        {i.product_name}
                        <span className="text-ink-muted block text-[12px]">{i.variant_label}</span>
                      </td>
                      <td className="py-1.5 text-right">{formatInr(shop)}</td>
                      <td className="py-1.5 text-right">{shop === null ? '—' : formatInr(Math.round(shop / BETA_PRICING.shopDivisor))}</td>
                      <td className="py-1.5 text-right">
                        {g === null ? '—' : `${g} g`}
                        <span className="text-ink-muted block text-[11px]">{i.pickup?.weighed_g != null ? 'weighed' : (i.weight_source ?? '')}</span>
                      </td>
                      <td className="py-1.5 text-right">{g === null ? '—' : formatInr(g * BETA_PRICING.shipPaisePerGram)}</td>
                      <td className="py-1.5 text-right">{i.quantity}</td>
                      <td className="py-1.5 text-right font-semibold">{formatInr(piece?.costPaise ?? null)}</td>
                      <td className="py-1.5 text-right">
                        {formatUsd(i.total_price_cents)}
                        {piece?.marginPct != null ? <span className="text-ink-muted block text-[11px]">{piece.marginPct}% over cost</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : bill ? (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-ink border-b text-[11px] uppercase tracking-[0.06em]">
                  <th className="py-1.5 font-semibold">Row</th>
                  <th className="py-1.5 font-semibold">Shop</th>
                  <th className="py-1.5 font-semibold">Shop order no.</th>
                  <th className="py-1.5 text-right font-semibold">Qty</th>
                  <th className="py-1.5 text-right font-semibold">Each ₹</th>
                  <th className="py-1.5 text-right font-semibold">Amount ₹</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines
                  .slice()
                  .sort((x, y) => x.sort_order - y.sort_order)
                  .map((l) => (
                    <tr key={l.id} className="border-line border-b">
                      <td className="py-1.5">{l.label}</td>
                      <td className="py-1.5">{l.shop ?? ''}</td>
                      <td className="py-1.5">{l.shop_order_ref ?? ''}</td>
                      <td className="py-1.5 text-right">{l.quantity}</td>
                      <td className="py-1.5 text-right">{formatInr(l.unit_paise)}</td>
                      <td className="py-1.5 text-right">{formatInr(l.unit_paise * l.quantity)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="text-ink-muted">No shop bill yet: fill it in on the order page.</p>
          )}
          <dl className="ml-auto mt-3 grid w-[min(100%,360px)] gap-1 [&>div]:flex [&>div]:justify-between">
            {k === 'b' ? (
              <>
                <div className="border-ink border-t pt-1.5 text-[15px] font-bold">
                  <dt>Total</dt>
                  <dd>{formatInr(money.b.paise)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">In dollars (₹{active.find((i) => i.inr_per_usd)?.inr_per_usd ?? BETA_PRICING.inrPerUsd} a dollar)</dt>
                  <dd>{formatUsd(money.b.cents)}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Customer paid, less tax and refunds (A)</dt>
                  <dd>{formatUsd(money.revenueCents)}</dd>
                </div>
                <div className="font-semibold">
                  <dt>Margin A − B</dt>
                  <dd>
                    {money.marginB ? `${formatUsd(money.marginB.cents)}${money.marginB.pct !== null ? ` (${money.marginB.pct}%)` : ''}` : 'not known yet'}
                  </dd>
                </div>
                {money.b.missing ? <p className="text-caution">{money.b.missing} piece(s) without a shop price or weight are left out.</p> : null}
              </>
            ) : bill ? (
              <>
                <div className="border-ink border-t pt-1.5 text-[15px] font-bold">
                  <dt>Total</dt>
                  <dd>{formatInr(shopBillTotalPaise(bill.lines))}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">In dollars</dt>
                  <dd>{formatUsd(paiseToCents(shopBillTotalPaise(bill.lines), active.find((i) => i.inr_per_usd)?.inr_per_usd ?? null))}</dd>
                </div>
                {money.marginC ? (
                  <div className="font-semibold">
                    <dt>Margin A − C</dt>
                    <dd>
                      {formatUsd(money.marginC.cents)}
                      {money.marginC.pct !== null ? ` (${money.marginC.pct}%)` : ''}
                    </dd>
                  </div>
                ) : null}
                {bill.photos.length ? <p className="text-ink-muted">{bill.photos.length} photo(s) of the shop&apos;s bill kept with the order.</p> : null}
                {bill.note ? <p className="text-ink-muted">Note: {bill.note}</p> : null}
              </>
            ) : null}
          </dl>
        </article>
      )}
    </div>
  );
}
