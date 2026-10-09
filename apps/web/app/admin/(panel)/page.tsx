import Link from 'next/link';

import {
  attentionLines,
  getAttention,
  getCycleTotals,
  getOpenCycle,
  getPickupCycle,
  getTodaySummary,
} from '@repo/db/admin';
import { bothPlaces, deskOrder, greeting, timeLeft, type Desk } from '@repo/shared/admin';

import { Chip } from '@/features/admin/chips';
import { waitingCounts } from '@/features/admin/counts';
import { CycleFlow } from '@/features/admin/cycle-flow';
import { requireAdminPage } from '@/features/admin/guard';
import { LiveFeed } from '@/features/admin/live-feed';
import { Queue, type Job } from '@/features/admin/queue';
import { PageHead, Panel, SectionTitle } from '@/features/admin/ui';

const DESK_NAME: Record<Desk, string> = { us: 'US desk', india: 'India desk' };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Today (D-096, admin.md): the open cycle's countdown with its totals, what needs attention, then the admin's own desk
 * as a work queue (count, the job, one button to it; D-007: India picks up, lists and pays shops, the US ships) and
 * the other desk below. Live orders at the side. Every job links to the screen that does it.
 */
export default async function TodayPage(): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const [summary, counts, cycle, attention, pickupCycle] = await Promise.all([
    getTodaySummary(client),
    waitingCounts(client),
    getOpenCycle(client),
    getAttention(client),
    getPickupCycle(client),
  ]);
  const totals = cycle ? await getCycleTotals(client, cycle.id) : null;
  const alerts = attentionLines(attention);
  const now = new Date();
  const status = (s: keyof typeof summary.ordersByStatus): number => summary.ordersByStatus[s] ?? 0;

  const jobs: Record<Desk, Job[]> = {
    us: [
      { n: status('arrived'), what: 'Orders arrived in the US, to pack and ship', go: 'Pack & ship', href: '/admin/orders?status=arrived', urgent: true },
      {
        n: status('confirmed'),
        what: 'Orders confirmed in the open cycle',
        sub: 'Nothing to do until cutoff; check for problems',
        go: 'See orders',
        href: '/admin/orders?status=confirmed',
      },
      { n: counts.returns, what: 'Returns to collect', go: 'Open returns', href: '/admin/returns' },
    ],
    india: [
      {
        n: summary.pendingPickups,
        what: 'Pickups still to do',
        sub: pickupCycle ? `In cycle ${pickupCycle.code}` : undefined,
        go: 'Start pickups',
        href: pickupCycle ? `/admin/cycles/${pickupCycle.id}` : '/admin/cycles',
        urgent: true,
      },
      { n: summary.expressToSend, what: 'Express orders to pick up and send by courier', go: 'Open orders', href: '/admin/orders?express=1', urgent: true },
      { n: summary.draftProducts, what: 'Draft listings to review', go: 'Review drafts', href: '/admin/catalog?status=draft' },
      {
        n: counts.shopsOwed,
        what: 'Shops owed for picked pieces',
        sub: `${summary.unpaidPickedPickups} picked piece${summary.unpaidPickedPickups === 1 ? '' : 's'} not paid yet`,
        go: 'Pay shops',
        href: '/admin/payouts',
      },
      summary.staleVariants === null
        ? { n: null, what: 'Quantities to re-check with the shops', sub: 'Set "stale after" days in Settings to count them', go: 'Settings', href: '/admin/settings' }
        : { n: summary.staleVariants, what: 'Quantities to re-check with the shops', go: 'Re-check', href: '/admin/listings?view=recheck' },
    ],
  };
  const [own, other] = deskOrder(desk);
  const left = cycle ? timeLeft(cycle.cutoff_at, now) : null;
  const places = cycle ? bothPlaces(cycle.cutoff_at, desk) : null;

  return (
    <>
      <PageHead title={greeting(now, desk)} sub={desk ? `${DESK_NAME[own]} first; the ${DESK_NAME[other]} below.` : 'Both desks below.'} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          {cycle && totals ? (
            <Panel>
              <div className="grid items-center gap-[18px] md:grid-cols-[1.1fr_1fr]">
                <div>
                  <p className="text-ink-muted mb-1.5 flex items-center gap-1.5 text-[12.5px]">
                    Open cycle{' '}
                    <Link href={`/admin/cycles/${cycle.id}`} className="text-ink font-bold">
                      {cycle.code}
                    </Link>{' '}
                    <Chip tone="blue">Open</Chip>
                  </p>
                  <p className="font-heading text-[28px] font-semibold leading-none tracking-[-0.01em] md:text-[34px]">
                    {left ?? 'Cutoff passed'}
                    <small className="font-ui text-ink-muted mt-1.5 block text-[14px] font-medium leading-[1.4]">
                      {left ? 'to cutoff · ' : 'it closes by itself shortly · '}
                      {places?.[0]} · {places?.[1]}
                    </small>
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    [totals.orders, 'orders'],
                    [totals.pieces, 'pieces'],
                    [totals.shops, 'shops'],
                    [dollars.format(Math.round(totals.salesCents / 100)), 'sales'],
                  ].map(([value, label]) => (
                    <div key={label} className="bg-canvas flex flex-col-reverse rounded-[10px] px-3 py-2.5">
                      <dt className="text-ink-muted text-[12px] font-medium">{label}</dt>
                      <dd className="text-[20px] font-bold leading-none">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <CycleFlow cycle={cycle} desk={desk} />
            </Panel>
          ) : (
            <div className="border-caution/25 bg-caution/[0.08] rounded-xl border px-3.5 py-3 text-[14px]">
              <b className="text-caution">No open cycle: customers cannot check out.</b>{' '}
              <Link href="/admin/cycles" className="underline">
                Open one
              </Link>
            </div>
          )}
          {alerts.length > 0 ? (
            <div className="border-caution/25 bg-caution/[0.08] flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[14px] leading-[1.45]">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="text-caution h-5 w-5 flex-none fill-none stroke-current stroke-[1.6]">
                <path d="M12 4l9 16H3z" />
                <path d="M12 10v4M12 17v.5" />
              </svg>
              <div>
                <b className="text-caution">Needs attention</b>
                <ul className="mt-0.5 list-disc pl-[18px]">
                  {alerts.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <SectionTitle>{desk ? `${DESK_NAME[own]} · yours` : DESK_NAME[own]}</SectionTitle>
          <Queue jobs={jobs[own]} />
          <div className="mt-2.5">
            <SectionTitle>{DESK_NAME[other]}</SectionTitle>
          </div>
          <Queue jobs={jobs[other]} />
        </div>
        <div className="lg:sticky lg:top-[78px]">
          <LiveFeed />
        </div>
      </div>
    </>
  );
}
