import {
  attentionLines,
  foodWatch,
  getAttention,
  getTodaySummary,
  moneyAtRisk,
  pilotPipelineCounts,
  toOrderSummary,
} from '@repo/db/admin';
import { deskOrder, greeting, type Desk } from '@repo/shared/admin';

import { waitingCounts } from '@/features/admin/counts';
import { requireAdminPage } from '@/features/admin/guard';
import { LiveFeed } from '@/features/admin/live-feed';
import { Queue, type Job } from '@/features/admin/queue';
import { waited } from '@/features/admin/to-order/group';
import { PageHead, SectionTitle } from '@/features/admin/ui';

const DESK_NAME: Record<Desk, string> = { us: 'US desk', india: 'India desk' };

/**
 * Today (D-096, admin.md): what needs attention, then the admin's own desk as a work queue (count, the job, one button
 * to it; D-007: India buys and weighs, the US ships) and the other desk below. Live orders at the side. Every job links
 * to the screen that does it. D-140 (A2): the India desk orders each sold piece from its shop, marks it at the hub and
 * weighs it. D-154, D-187: the food shipments open, and those at risk, come first on the India desk.
 */
export default async function TodayPage(): Promise<React.JSX.Element> {
  const { client, desk } = await requireAdminPage();
  const [summary, counts, attention, toOrder, pipeline, food] = await Promise.all([
    getTodaySummary(client),
    waitingCounts(client),
    getAttention(client),
    toOrderSummary(client),
    pilotPipelineCounts(client),
    foodWatch(client),
  ]);
  const atRisk = food.not_bought + food.not_shipped;
  const alerts = attentionLines(attention);
  const atRiskMoney = moneyAtRisk(attention);
  const now = new Date();
  const status = (s: keyof typeof summary.ordersByStatus): number => summary.ordersByStatus[s] ?? 0;

  const jobs: Record<Desk, Job[]> = {
    us: [
      { n: status('arrived'), what: 'Orders in the US to send on', sub: 'Pack and ship to the customer', go: 'Pack & ship', href: '/admin/orders?status=arrived', urgent: true },
      { n: counts.returns, what: 'Returns to collect', go: 'Open returns', href: '/admin/returns' },
    ],
    india: [
      // D-154: food is bought within 2 hours and ships the next day; the 7 delivery days depend on it
      {
        n: food.open,
        what: 'Food shipments to send',
        sub: atRisk
          ? [food.not_bought ? `${food.not_bought} not bought within 2 hours` : '', food.not_shipped ? `${food.not_shipped} not shipped by the next day` : '']
              .filter(Boolean)
              .join(' · ')
          : food.open
            ? 'All on time'
            : undefined,
        go: 'Order them',
        href: '/admin/to-order',
        urgent: atRisk > 0,
      },
      // D-140 (F3): the India desk's first job
      {
        n: toOrder.count,
        what: 'Pieces to order from their shops',
        sub: toOrder.oldest ? `The oldest sold ${waited(toOrder.oldest)} ago` : undefined,
        go: 'Order them',
        href: '/admin/to-order',
        urgent: true,
      },
      { n: pipeline.ordered, what: 'Ordered, on the way to the hub', sub: 'Mark each at the hub when it arrives', go: 'Open', href: '/admin/to-order?view=ordered' },
      { n: pipeline.toWeigh, what: 'At the hub, to weigh', go: 'Weigh them', href: '/admin/to-order?view=weigh' },
      { n: pipeline.held, what: 'Prices held for you', sub: "A shop's price jumped; accept it or stop using that shop", go: 'Review', href: '/admin/import/auto' },
      { n: summary.draftProducts, what: 'Draft listings to review', go: 'Review drafts', href: '/admin/catalog?status=draft' },
      summary.staleVariants === null
        ? { n: null, what: 'Quantities to re-check with the shops', sub: 'Set "stale after" days in Settings to count them', go: 'Settings', href: '/admin/settings' }
        : { n: summary.staleVariants, what: 'Quantities to re-check with the shops', go: 'Re-check', href: '/admin/listings' },
    ],
  };
  const [own, other] = deskOrder(desk);

  return (
    <>
      <PageHead title={greeting(now, desk)} sub={desk ? `${DESK_NAME[own]} first; the ${DESK_NAME[other]} below.` : 'Both desks below.'} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          {atRiskMoney > 0 ? (
            // F-3: payments refused or unmatched and open disputes, in red until resolved
            <p role="status" className="border-danger/30 bg-danger/[0.08] text-danger rounded-xl border px-3.5 py-3 text-[14px] font-semibold">
              <span className="bg-danger mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[13px] text-white">
                {atRiskMoney}
              </span>
              {[
                attention.payments_to_check ? `${attention.payments_to_check} payment${attention.payments_to_check === 1 ? '' : 's'} to check` : '',
                attention.disputes_open ? `${attention.disputes_open} open dispute${attention.disputes_open === 1 ? '' : 's'}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
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
