import Link from 'next/link';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { HomeData } from '@repo/db/store';

/**
 * A slim band on Home (D-140, plan L7): when an order placed today arrives, where delivery turns free and how long
 * returns stay open, so nobody has to scroll to the bottom to learn how buying from India works. Every number comes
 * from the store's own data in the one Home read (store_home: store_next_delivery, store_policy; D-008, D-012): a missing one is simply left out.
 */
export function DeliveryBand({ delivery, band }: { delivery: HomeData['delivery']; band: HomeData['band'] }): React.JSX.Element | null {
  const parts = [
    delivery ? `Order today, at your door ${formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to)}` : null,
    band?.free_min_cents ? `Free delivery from ${formatUsd(band.free_min_cents)}` : null,
    band?.return_claim_days ? `Returns within ${band.return_claim_days} days` : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length === 0) return null;
  return (
    <aside aria-label="How buying works" className="border-line font-ui my-[clamp(8px,1.5vw,16px)] flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3.5 text-[14px]">
      {parts.map((p) => (
        <span key={p} className="text-ink">
          {p}
        </span>
      ))}
      <Link href="/how-it-works" prefetch={false} className="text-ink-muted ml-auto underline underline-offset-4">
        How it works
      </Link>
    </aside>
  );
}
