import Link from 'next/link';

import { listMyOrders } from '@repo/db/store';
import { CUSTOMER_STATUS_LABEL, formatUsd } from '@repo/shared/domain';

import { requireCustomer } from '@/features/account/session';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your orders', robots: { index: false } };

const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default async function AccountOrdersPage(): Promise<React.JSX.Element> {
  const { client } = await requireCustomer('/account/orders');
  const orders = await listMyOrders(client);
  return (
    <div className="space-y-6">
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Your orders</h1>
      {orders.length === 0 ? (
        <p className="text-ink-muted">No orders yet.</p>
      ) : (
        <ul className="divide-line border-line divide-y border-y text-sm">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.order_number}`}
                className="flex flex-wrap justify-between gap-2 py-3 hover:underline"
              >
                <span>{o.order_number}</span>
                <span className="text-ink-muted">{date.format(new Date(o.created_at))}</span>
                <span>{CUSTOMER_STATUS_LABEL[o.customer_status]}</span>
                <span>{formatUsd(o.total_cents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
