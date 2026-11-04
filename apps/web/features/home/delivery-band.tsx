import Link from 'next/link';

import { DUTIES_PAID, formatUsd } from '@repo/shared/domain';

import { deliveryDaysLabel } from '@/features/catalog/delivery-days';

import type { HomeData, StorePolicy } from '@repo/db/store';

/**
 * A slim band at the end of Home (D-140, plan L7): how long an order takes in delivery days (D-187, no date), where
 * delivery turns free and how long returns stay open, so nobody has to scroll to the bottom to learn how buying from
 * India works. Every number comes from the store's own data (store_home, store_policy; D-008, D-012): a missing one is
 * simply left out.
 */
export function DeliveryBand({
  band,
  policy,
}: {
  band: HomeData['band'];
  policy: StorePolicy;
}): React.JSX.Element | null {
  const food = deliveryDaysLabel(policy.food_delivery_days_min, policy.food_delivery_days_max);
  const rest = deliveryDaysLabel(policy.delivery_days_min, policy.delivery_days_max);
  const parts = [
    food ? `Food in ${food}` : null,
    rest ? `Clothing and home & gifts in ${rest}` : null,
    band?.free_min_cents ? `Free delivery from ${formatUsd(band.free_min_cents)}` : null,
    DUTIES_PAID ? 'Duties paid' : null,
    band?.return_claim_days ? `Returns within ${band.return_claim_days} days` : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return (
    <aside
      aria-label="How buying works"
      className="border-line font-ui my-[clamp(8px,1.5vw,16px)] border-y py-3.5 text-[14px]"
    >
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
