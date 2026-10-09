'use client';

import { autoPrice, formatUsd, type PricingSettings } from '@repo/shared/domain';

/** Rupees typed (6,200 or 6200.50) → paise; null when empty or not a number. */
export function toPaise(rupees: string): number | null {
  const v = rupees.replace(/[,\s₹]/g, '');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** The automatic price for a shop price and weight (D-075), the database's own formula; null until it can be worked out. */
export function livePrice(shopPaise: number | null, weightG: number | null, pricing: PricingSettings): number | null {
  if (shopPaise === null || !weightG || weightG <= 0) return null;
  try {
    return autoPrice({ shopPricePaise: shopPaise, weightG: Math.round(weightG) }, pricing)?.priceCents ?? null;
  } catch {
    return null;
  }
}

/** "Sells for $114.99", shown as the shop price is typed (D-096, D-075). */
export function SellsFor({ cents, why, compact = false }: { cents: number | null; why?: React.ReactNode; compact?: boolean }): React.JSX.Element {
  if (compact) return <span className="text-positive text-[14px] font-bold leading-[34px]">{cents === null ? '—' : formatUsd(cents)}</span>;
  return (
    <div className="border-positive/20 bg-positive/[0.08] rounded-[10px] border px-3 py-2.5" aria-live="polite">
      <small className="text-ink-muted block text-[11.5px] leading-[1.3]">Sells for</small>
      <b className="text-positive block text-[22px] font-bold leading-none">{cents === null ? '—' : formatUsd(cents)}</b>
      {why ? <small className="text-ink-muted mt-1 block text-[11.5px] leading-[1.3]">{why}</small> : null}
    </div>
  );
}
