import Link from 'next/link';

import { countOrdersByStatus, listAdminOrders } from '@repo/db/admin';
import { dateRange, deskTime, ZONES, deskOrder } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import { ORDER_STATUS } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { OrdersTable, type OrderRow } from '@/features/admin/orders-table';
import { Pager } from '@/features/admin/pager/pager';
import { plainParams } from '@/features/admin/pager/paging';
import { readPaging } from '@/features/admin/pager/read-paging';
import { Empty, FilterChips, input, PageHead, secondaryButton } from '@/features/admin/ui';

import type { Enum } from '@repo/db';

/** The chips, in the order an order moves (D-096). Refunded orders are under All. */
const CHIPS: Enum<'order_status'>[] = ['pending_payment', 'confirmed', 'collecting', 'packed', 'in_transit', 'arrived', 'shipped', 'delivered', 'cancelled'];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Orders (D-096, admin.md, US desk): search, status chips with counts, ticked rows get a bulk bar, the pager (D-140). */
export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const params = plainParams(await searchParams);
  const status = CHIPS.concat('refunded').find((s) => s === params.status);
  const expressToSend = params.express === '1';
  const q = (params.q ?? '').slice(0, 80);
  const { page, size, offset } = await readPaging('orders', params);
  const [{ orders, total }, counts] = await Promise.all([
    listAdminOrders(client, { status, expressToSend, search: q, limit: size, offset }),
    countOrdersByStatus(client),
  ]);

  const href = (p: { status?: string; express?: boolean }): string => {
    const sp = new URLSearchParams();
    if (p.status) sp.set('status', p.status);
    if (p.express) sp.set('express', '1');
    if (q) sp.set('q', q);
    if (params.size) sp.set('size', params.size);
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
      // D-154: an order of two shipments is shipped one shipment at a time, from its page
      canShip:
        o.shipments.filter((sh) => sh.status === 'open').length <= 1 &&
        (o.status === 'arrived' || (o.shipping_method === 'express' && !o.cycle_id && ['confirmed', 'collecting'].includes(o.status))),
      quick: o.shipments.some((sh) => sh.kind === 'quick' && sh.status !== 'cancelled'),
    };
  });
  const [own, other] = deskOrder(desk).map((d) => ZONES[d].place);

  return (
    <>
      <PageHead
        title="Orders"
        sub={`${counts.all} order${counts.all === 1 ? '' : 's'} · times in ${own}, ${other} below`}
        actions={
          <form action="/admin/orders" className="flex gap-2" role="search">
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {params.size ? <input type="hidden" name="size" value={params.size} /> : null}
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
      {total > rows.length ? <Pager list="orders" path="/admin/orders" params={params} page={page} size={size} total={total} /> : null}
      {rows.length === 0 ? <Empty>No orders here.</Empty> : <OrdersTable rows={rows} />}
      <Pager list="orders" path="/admin/orders" params={params} page={page} size={size} total={total} keys />
    </>
  );
}
