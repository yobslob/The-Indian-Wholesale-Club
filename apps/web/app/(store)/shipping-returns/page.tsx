import { formatUsd, US_STATES } from '@repo/shared/domain';

import { getStorePolicyCached } from '@/features/catalog/data';
import { InfoPage } from '@/features/info/info-page';

import type { StorePolicy } from '@repo/db/store';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shipping & returns' };

const pct = (n: number): string => `${Number(n.toFixed(3))}%`;
const days = (from: number | null, to: number | null): string | null =>
  from !== null && to !== null ? (from === to ? `${from} days` : `${from} to ${to} days`) : null;

function taxLine(rows: StorePolicy['tax']): string {
  if (rows.length === 0) return 'No sales tax is added to orders today.';
  const parts = rows.map((r) => {
    const name = US_STATES.find((s) => s.code === r.state)?.name ?? r.state;
    const exempt = [r.clothing ? null : 'clothing', r.food ? null : 'food and spices'].filter(Boolean);
    return `${name}: ${pct(r.rate_pct)}${exempt.length ? `, not on ${exempt.join(' or ')}` : ''}`;
  });
  return `Sales tax is added where we are registered to collect it (${parts.join('; ')}). Checkout shows it before you pay.`;
}

/**
 * Shipping & returns. Every number comes from store_policy(), the same settings the rules apply (D-008: never a
 * hard-coded promise), so a change in the admin changes this page too.
 * TODO(founder): approve this draft (written by Claude from D-070 – D-073 and D-008; design.md voice). How a return
 * travels back is Q-33.
 */
export default async function Page(): Promise<React.JSX.Element> {
  const p = await getStorePolicyCached();
  const express = days(p.express_days_min, p.express_days_max);
  const usDays = days(p.us_delivery_days_min, p.us_delivery_days_max);
  const lastTier = p.return_tiers.at(-1);

  return (
    <InfoPage title="Shipping & returns">
      <h2 className="font-medium">Delivery</h2>
      <p>
        Every piece is made in India and comes to you from there. Before you pay, you see the estimated delivery window
        for your order, and we tell you if it changes.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Standard</strong>:{' '}
          {p.shipping_flat_cents === 0 ? 'free' : p.shipping_flat_cents !== null ? formatUsd(p.shipping_flat_cents) : 'shown at checkout'}
          {p.free_shipping_min_cents !== null ? `, free from ${formatUsd(p.free_shipping_min_cents)}` : ''}. The window is on
          every product page and at checkout.
        </li>
        {express ? (
          <li>
            <strong>Express</strong>: about {express} from your order, sent straight to your door. Its price depends on
            your bag and is shown at checkout.
          </li>
        ) : null}
        {usDays ? (
          <li>
            <strong>Already in the US</strong>: some pieces are marked so on their page. On their own they arrive in
            about {usDays}.
          </li>
        ) : null}
      </ul>
      <p>We deliver in the US only. {taxLine(p.tax)}</p>

      <h2 className="font-medium">If your delivery date moves</h2>
      <p>
        We email you the new window. You can keep your order with the new date, or cancel it and get everything back,
        from your order page.
      </p>

      <h2 className="font-medium">Cancelling</h2>
      <p>
        You can cancel from your order page until your order leaves India, and get everything back
        {p.cancel_fee_pct ? `, minus ${pct(p.cancel_fee_pct)} of the items once we have started preparing it` : ''}. After
        that, reply to your order email and we will see what we can do.
      </p>

      <h2 className="font-medium">Returns</h2>
      <ul className="list-disc space-y-1 pl-5">
        {p.return_claim_days !== null ? (
          <li>
            <strong>Damaged or not what you ordered</strong>: tell us from your order page within {p.return_claim_days}{' '}
            days of delivery and you get everything back, shipping included.
          </li>
        ) : null}
        {p.return_tiers.length > 0 ? (
          <li>
            <strong>Changed your mind</strong>: unworn, unaltered clothing can come back. We keep part of the price for
            bringing it back:{' '}
            {p.return_tiers
              .map((t, i) => `${pct(t.kept_pct)} within ${i === 0 ? '' : `${p.return_tiers[i - 1]!.days + 1} to `}${t.days} days`)
              .join(', ')}
            {lastTier ? ` of delivery. After ${lastTier.days} days, returns are closed.` : '.'}
          </li>
        ) : null}
        <li>
          <strong>Food and spices</strong> are final sale, unless they arrive damaged or are not what you ordered.
        </li>
      </ul>
      <p>
        Your order page shows what you would get back before you ask. We email you how to send the piece back, and the
        refund goes to your card once it reaches us. Banks usually take 5 to 10 days to show it.
      </p>
    </InfoPage>
  );
}
