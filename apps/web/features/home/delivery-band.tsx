import Link from 'next/link';

import { DUTIES_PAID, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { FestivalLine } from '@/features/seven-day/festival-line';

import type { HomeData, StorePolicy } from '@repo/db/store';

/**
 * A slim band on Home (D-140, plan L7): when an order placed today arrives, where delivery turns free and how long
 * returns stay open, so nobody has to scroll to the bottom to learn how buying from India works. D-161 (the homesick
 * plan's promises): the 7-day store's free line and "Duties paid. Nothing to pay at your door." too, and the festival
 * clock above them while a festival is near. Every number comes from the store's own data (store_home, store_policy;
 * D-008, D-012): a missing one is simply left out.
 */
export function DeliveryBand({
  delivery,
  band,
  policy,
}: {
  delivery: HomeData['delivery'];
  band: HomeData['band'];
  policy: StorePolicy;
}): React.JSX.Element | null {
  const quickFree = policy.quick_delivery_on && policy.quick_delivery_min_cents ? policy.quick_delivery_min_cents : null;
  const parts = [
    delivery ? `From India to your door ${formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to)}` : null,
    band?.free_min_cents ? `Free delivery from ${formatUsd(band.free_min_cents)}` : null,
    quickFree ? `Free 7-day delivery from ${formatUsd(quickFree)}` : null,
    DUTIES_PAID ? 'Duties paid, nothing to pay at your door' : null,
    band?.return_claim_days ? `Returns within ${band.return_claim_days} days` : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return (
    <aside aria-label="How buying works" className="border-line font-ui my-[clamp(8px,1.5vw,16px)] border-y py-3.5 text-[14px]">
      <FestivalLine className="text-brand mb-2.5 flex items-center gap-2 font-semibold" />
      <div className="promise-band flex flex-wrap items-center gap-x-6 gap-y-2">
        {parts.map((p) => (
          <span key={p} className="text-ink">
            {p}
          </span>
        ))}
        <Link href="/how-it-works" prefetch={false} className="text-ink-muted ml-auto underline underline-offset-4">
          How it works
        </Link>
      </div>
    </aside>
  );
}
