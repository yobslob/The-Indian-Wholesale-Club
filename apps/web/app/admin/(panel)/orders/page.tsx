import Link from 'next/link';

import { listAdminOrders } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { Cell, Empty, PageTitle, Table, utc } from '@/features/admin/ui';

import type { Enum } from '@repo/db';

const STATUSES: Enum<'order_status'>[] = [
  'confirmed',
  'collecting',
  'packed',
  'in_transit',
  'arrived',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

type SearchParams = Promise<{ status?: string }>;

/** All orders with a status filter (admin.md: Orders, US desk). */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const requested = (await searchParams).status;
  const status = STATUSES.find((s) => s === requested);
  const orders = await listAdminOrders(client, { status, limit: 200 });

  return (
    <div className="space-y-4">
      <PageTitle>Orders</PageTitle>
      <nav className="flex flex-wrap gap-3">
        <Link href="/admin/orders" className={!status ? 'font-semibold underline' : 'underline'}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={s === status ? 'font-semibold underline' : 'underline'}
          >
            {s}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <Empty>No orders.</Empty>
      ) : (
        <Table head={['Order', 'Placed', 'Email', 'Status', 'Items', 'Total', 'Window']}>
          {orders.map((o) => (
            <tr key={o.id}>
              <Cell>
                <Link href={`/admin/orders/${o.id}`} className="underline">
                  {o.order_number}
                </Link>
              </Cell>
              <Cell>{utc(o.created_at)}</Cell>
              <Cell>{o.email}</Cell>
              <Cell>
                {o.status} / {o.payment_status}
              </Cell>
              <Cell>{o.items.length}</Cell>
              <Cell>{formatUsd(o.total_cents)}</Cell>
              <Cell>
                {o.est_delivery_from ?? '—'} → {o.est_delivery_to ?? '—'}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
