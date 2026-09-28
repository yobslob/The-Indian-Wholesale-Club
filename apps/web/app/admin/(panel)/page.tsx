import Link from 'next/link';

import { getOpenCycle, getTodaySummary } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { PageTitle, utc } from '@/features/admin/ui';

/** Today (admin.md): what needs doing now. Every item links to the screen that fixes it. */
export default async function TodayPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [summary, cycle] = await Promise.all([getTodaySummary(client), getOpenCycle(client)]);
  const count = (status: keyof typeof summary.ordersByStatus) =>
    summary.ordersByStatus[status] ?? 0;

  const items: [string, number, string][] = [
    ['Orders confirmed in the open cycle', count('confirmed'), '/admin/orders?status=confirmed'],
    ['Pickups still pending', summary.pendingPickups, '/admin/cycles'],
    ['Picked pieces not yet paid to shops', summary.unpaidPickedPickups, '/admin/payouts'],
    [
      'Orders arrived in the US, to pack and ship',
      count('arrived'),
      '/admin/orders?status=arrived',
    ],
    ['Draft listings to review', summary.draftProducts, '/admin/listings'],
  ];

  return (
    <div className="space-y-6">
      <PageTitle>Today</PageTitle>
      <section className="border-line rounded-md border p-4">
        {cycle ? (
          <p>
            Open cycle <strong>{cycle.code}</strong> · cutoff {utc(cycle.cutoff_at)} · est. arrival{' '}
            {cycle.est_arrival_on} ·{' '}
            <Link href={`/admin/cycles/${cycle.id}`} className="underline">
              open
            </Link>
          </p>
        ) : (
          <p className="text-caution">
            No open cycle: customers cannot check out.{' '}
            <Link href="/admin/cycles" className="underline">
              Create one
            </Link>
          </p>
        )}
      </section>
      <ul className="space-y-2">
        {items.map(([label, n, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="border-line hover:border-ink flex justify-between rounded-md border p-3"
            >
              <span>{label}</span>
              <strong>{n}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
