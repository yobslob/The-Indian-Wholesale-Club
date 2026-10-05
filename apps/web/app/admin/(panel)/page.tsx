import Link from 'next/link';

import { attentionLines, getAttention, getMyDesk, getOpenCycle, getTodaySummary } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { LiveFeed } from '@/features/admin/live-feed';
import { PageTitle, SectionTitle, utc } from '@/features/admin/ui';

/**
 * Today (admin.md): what needs doing now. Every item links to the screen that fixes it. The admin's own desk comes
 * first (D-007: India picks up, lists and pays shops; the US ships), the other desk's jobs below. Live orders at the top.
 */
export default async function TodayPage(): Promise<React.JSX.Element> {
  const { client, user } = await requireAdminPage();
  const [summary, cycle, desk, attention] = await Promise.all([
    getTodaySummary(client),
    getOpenCycle(client),
    getMyDesk(client, user.id),
    getAttention(client),
  ]);
  const alerts = attentionLines(attention);
  const count = (status: keyof typeof summary.ordersByStatus) =>
    summary.ordersByStatus[status] ?? 0;

  // [label, count, link, desk]
  const items: [string, number | string, string, 'us' | 'india'][] = [
    ['Orders confirmed in the open cycle', count('confirmed'), '/admin/orders?status=confirmed', 'us'],
    ['Pickups still pending', summary.pendingPickups, '/admin/cycles', 'india'],
    ['Picked pieces not yet paid to shops', summary.unpaidPickedPickups, '/admin/payouts', 'india'],
    ['Orders arrived in the US, to pack and ship', count('arrived'), '/admin/orders?status=arrived', 'us'],
    ['Draft listings to review', summary.draftProducts, '/admin/listings', 'india'],
    summary.staleVariants === null
      ? ['Quantities to re-check with the shops: set "stale after" days in Settings', '—', '/admin/settings', 'india']
      : ['Quantities to re-check with the shops', summary.staleVariants, '/admin/listings#recheck', 'india'],
  ];
  const mine = desk ? items.filter((i) => i[3] === desk) : items;
  const others = desk ? items.filter((i) => i[3] !== desk) : [];
  const list = (rows: typeof items): React.JSX.Element => (
    <ul className="space-y-2">
      {rows.map(([label, n, href]) => (
        <li key={label}>
          <Link href={href} className="border-line hover:border-ink flex justify-between rounded-md border p-3">
            <span>{label}</span>
            <strong>{n}</strong>
          </Link>
        </li>
      ))}
    </ul>
  );

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
      {alerts.length > 0 ? (
        <section className="border-caution space-y-1 rounded-md border p-4">
          <h2 className="text-caution font-medium">Needs attention</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {alerts.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <LiveFeed />
      {desk ? <SectionTitle>{desk === 'india' ? 'India desk' : 'US desk'}</SectionTitle> : null}
      {list(mine)}
      {others.length > 0 ? (
        <>
          <SectionTitle>{desk === 'india' ? 'US desk' : 'India desk'}</SectionTitle>
          {list(others)}
        </>
      ) : null}
    </div>
  );
}
