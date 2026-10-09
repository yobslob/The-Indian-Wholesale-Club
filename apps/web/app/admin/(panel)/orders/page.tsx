import Link from 'next/link';

import { countOrdersByStatus, listAdminOrders } from '@repo/db/admin';
import { dateRange, deskTime, ZONES, deskOrder } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import { ORDER_STATUS } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { OrdersTable, type OrderRow } from '@/features/admin/orders-table';
import { Empty, FilterChips, input, PageHead, secondaryButton } from '@/features/admin/ui';

import type { Enum } from '@repo/db';

const PAGE = 50;
/** The chips, in the order an order moves (D-096). Refunded orders are under All. */
const CHIPS: Enum<'order_status'>[] = ['pending_payment', 'confirmed', 'collecting', 'packed', 'in_transit', 'arrived', 'shipped', 'delivered', 'cancelled'];

type SearchParams = Promise<{ status?: string; express?: string; q?: string; page?: string }>;

/** Orders (D-096, admin.md, US desk): search, status chips with counts, ticked rows get a bulk bar, pages of 50. */
export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const params = await searchParams;
  const status = CHIPS.concat('refunded').find((s) => s === params.status);
  const expressToSend = params.express === '1';
  const q = (params.q ?? '').slice(0, 80);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const [{ orders, total }, counts] = await Promise.all([
    listAdminOrders(client, { status, expressToSend, search: q, limit: PAGE, offset: (page - 1) * PAGE }),
    countOrdersByStatus(client),
  ]);

  const href = (p: { status?: string; express?: boolean; page?: number }): string => {
    const sp = new URLSearchParams();
    if (p.status) sp.set('status', p.status);
    if (p.express) sp.set('express', '1');
    if (q) sp.set('q', q);
    if (p.page && p.page > 1) sp.set('page', String(p.page));
    const s = sp.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  };
  const rows: OrderRow[] = orders.map((o) => {
    const address = o.shipping_address as { fullName?: string } | null;
    return {
      id: o.id,
      number: o.order_number,
      name: address?.fullName ?? '',
      email: o.email,
      placed: deskTime(o.created_at, desk),
      status: o.status,
      payment: o.payment_status,
      pieces: o.items.reduce((n, i) => n + i.quantity, 0),
      total: formatUsd(o.total_cents),
      window: dateRange(o.est_delivery_from, o.est_delivery_to),
      canShip:
        o.status === 'arrived' || (o.shipping_method === 'express' && !o.cycle_id && ['confirmed', 'collecting'].includes(o.status)),
    };
  });
  const filterName = expressToSend ? 'Express to send' : status ? ORDER_STATUS[status][0] : 'All';
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const [own, other] = deskOrder(desk).map((d) => ZONES[d].place);

  return (
    <>
      <PageHead
        title="Orders"
        sub={`${counts.all} order${counts.all === 1 ? '' : 's'} · times in ${own}, ${other} below`}
        actions={
          <form action="/admin/orders" className="flex gap-2" role="search">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {expressToSend ? <input type="hidden" name="express" value="1" /> : null}
            <input name="q" defaultValue={q} aria-label="Search orders" placeholder="Number, name or email" className={`${input} w-[min(340px,70vw)]`} />
            <button type="submit" className={secondaryButton}>
              Search
            </button>
          </form>
        }
      />
      <FilterChips
        items={[
          { href: href({}), label: 'All', count: counts.all, on: !status && !expressToSend },
          ...CHIPS.map((s) => ({ href: href({ status: s }), label: ORDER_STATUS[s][0], count: counts.byStatus[s] ?? 0, on: s === status })),
          { href: href({ express: true }), label: 'Express to send', count: counts.expressToSend, on: expressToSend },
        ]}
      />
      {q ? (
        <p className="text-ink-muted mb-3 text-[14px]">
          {total} found for “{q}” ·{' '}
          <Link href={href({ status, express: expressToSend })} className="text-ink underline">
            Clear the search
          </Link>
        </p>
      ) : null}
      {rows.length === 0 ? <Empty>No orders here.</Empty> : <OrdersTable rows={rows} />}
      <nav aria-label="Pages" className="text-ink-muted mt-3 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <span>
          {total === 0 ? 'None' : `Showing ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, total)} of ${total}`} · {filterName}
        </span>
        <span className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href({ status, express: expressToSend, page: page - 1 })} className={secondaryButton}>
              Newer
            </Link>
          ) : null}
          <span>
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={href({ status, express: expressToSend, page: page + 1 })} className={secondaryButton}>
              Older
            </Link>
          ) : null}
        </span>
      </nav>
    </>
  );
}
