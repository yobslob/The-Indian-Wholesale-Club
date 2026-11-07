'use client';

import { formatUsd, type BagGoal } from '@repo/shared/domain';

import { useDays } from '@/features/shell/days';

import { BackToShopping } from './back-to-shopping';
import { freeDelivery, useBagCharges } from './charges';
import { FreeMeter, useSurge } from './free-meter';
import { useCart } from './store';

/**
 * The bag's one goal, as the pill says it (bag-goal.ts; founder 2026-10-24: one bar, never two), in its own card above the
 * coupons, so the bill below it is nothing but a sum (D-192). Past the free line, how the bulk saving grows from its own line
 * ($99.99, D-187) and where it stops; while a coupon is on there is no bulk saving (D-191), so nothing to say about it.
 */
export function BagGoalLine({ couponOn, onShop }: { couponOn: boolean; onShop?: () => void }): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  const days = useDays();
  if (!charges) return null;
  const { goal, bulkFrom } = freeDelivery(lines, charges, days);
  const every = (b: { perDollarCents: number | null; capCents: number }): string =>
    `every ${formatUsd(b.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(b.capCents)}`;
  const bulkTalk = goal.kind === 'free' && goal.bulk.capCents > 0 && !couponOn;
  const capped = goal.kind === 'free' && goal.bulk.capped;
  const words =
    goal.kind === 'free-gap'
      ? `Add ${formatUsd(goal.leftCents)} more for free delivery`
      : goal.kind === 'free' && bulkTalk
        ? capped
          ? `You've unlocked the biggest bulk saving: ${formatUsd(goal.bulk.capCents)}`
          : goal.bulk.savingCents === 0 && bulkFrom !== null
            ? `From ${formatUsd(bulkFrom)}, ${every(goal.bulk)}`
            : `E${every(goal.bulk).slice(1)}`
        : null;
  if (!words || goal.kind === 'none') return null;
  return (
    <section aria-live="polite" className="bg-paper border-line font-ui grid gap-2 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        <p className="text-brand m-0 min-w-0 flex-1 basis-[140px] text-[13.5px] font-semibold">{words}</p>
        {capped ? null : <BackToShopping onShop={onShop} />}
      </div>
      <Meter goal={goal} />
    </section>
  );
}

/**
 * The free-delivery pill's bar, in brand on cream (D-116), flaring when the bag grows; past the line its free part stays
 * full and the bulk saving fills the part after it (founder 2026-10-30).
 */
function Meter({ goal }: { goal: Exclude<BagGoal, { kind: 'none' }> }): React.JSX.Element {
  const more = goal.kind === 'free' && goal.bulk.capCents > 0 ? goal.bulk.share : null;
  return <FreeMeter share={goal.share} more={more} surge={useSurge(goal.share + (more ?? 0))} tone="canvas" />;
}
