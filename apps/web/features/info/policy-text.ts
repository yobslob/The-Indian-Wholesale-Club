import { formatUsd, US_STATES } from '@repo/shared/domain';

import type { StorePolicy } from '@repo/db/store';

/**
 * The sentences the Shipping & returns page and the FAQ share, built from store_policy() (migration 27), so both
 * state the same numbers the rules apply. Pure; tested in tests/policy-text.test.ts.
 */

export const pct = (n: number): string => `${Number(n.toFixed(3))}%`;

export const dayRange = (from: number | null, to: number | null): string | null =>
  from !== null && to !== null ? (from === to ? `${from} days` : `${from} to ${to} days`) : null;

/** "free", "$5.00", plus the free-shipping threshold when there is one. */
export function standardShipping(p: StorePolicy): string {
  const base =
    p.shipping_flat_cents === 0 ? 'free' : p.shipping_flat_cents !== null ? formatUsd(p.shipping_flat_cents) : 'shown at checkout';
  return p.free_shipping_min_cents !== null && p.shipping_flat_cents !== 0
    ? `${base}, free from ${formatUsd(p.free_shipping_min_cents)}`
    : base;
}

export function taxSentence(rows: StorePolicy['tax']): string {
  if (rows.length === 0) return 'No sales tax is added to orders today.';
  const parts = rows.map((r) => {
    const name = US_STATES.find((s) => s.code === r.state)?.name ?? r.state;
    const exempt = [r.clothing ? null : 'clothing', r.food ? null : 'food and spices'].filter(Boolean);
    return `${name}: ${pct(r.rate_pct)}${exempt.length ? `, not on ${exempt.join(' or ')}` : ''}`;
  });
  return `Sales tax is added where we are registered to collect it (${parts.join('; ')}). Checkout shows it before you pay.`;
}

/** "15% within 7 days, 30% within 8 to 14 days, 50% within 15 to 30 days", or null without tiers. */
export function returnTiers(p: StorePolicy): string | null {
  if (p.return_tiers.length === 0) return null;
  return p.return_tiers
    .map((t, i) => {
      const from = i === 0 ? null : p.return_tiers[i - 1]!.days + 1;
      return `${pct(t.kept_pct)} within ${from === null ? '' : `${from} to `}${t.days} days`;
    })
    .join(', ');
}

export function cancelSentence(p: StorePolicy): string {
  return `You can cancel from your order page until your order leaves India, and get everything back${
    p.cancel_fee_pct ? `, minus ${pct(p.cancel_fee_pct)} of the items once we have started preparing it` : ''
  }. After that, reply to your order email and we will see what we can do.`;
}
