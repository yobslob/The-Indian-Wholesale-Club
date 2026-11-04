'use client';

import { displayOption, displayTitle } from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';

import { stockWords } from './stock';

import type { StockProblemLine } from './types';
import type { CartLine } from '@/features/cart/store';

const button = 'font-ui rounded-pill min-h-11 px-4 text-sm font-medium disabled:opacity-50';

/**
 * §10 Y-3, the founder: "show it at checkout and also show which product is unavailable and give a remove option": each
 * line of the bag that cannot go ahead, at the top of checkout: its photo, name and option, "Not available right now" (or
 * "Only 2 left") and Remove (or Keep 2). Payment stays locked until the list is empty (checkout-flow.tsx).
 */
export function StockProblems({
  problems,
  bag,
  busy,
  onFix,
}: {
  problems: StockProblemLine[];
  /** The device's own words and photo, for an option that no longer exists. */
  bag: CartLine[];
  busy: boolean;
  /** Keep this many of the line (0 removes it). */
  onFix: (line: StockProblemLine, keep: number) => void;
}): React.JSX.Element | null {
  if (problems.length === 0) return null;
  return (
    <section aria-label="Pieces to sort out" role="alert" className="bg-surface border-caution mb-4 rounded-lg border p-[18px]">
      <h2 className="font-heading m-0 text-lg font-medium leading-tight text-[#1D1A17]">
        {problems.length === 1 ? 'One piece in your bag changed' : `${problems.length} pieces in your bag changed`}
      </h2>
      <p className="text-ink-muted m-0 mt-1 text-sm">Sort {problems.length === 1 ? 'it' : 'them'} out and you can pay.</p>
      <ul className="m-0 mt-2 list-none p-0">
        {problems.map((p) => {
          const own = bag.find((l) => l.variantId === p.variantId);
          const name = p.productName ?? own?.productName ?? 'A piece in your bag';
          const option = p.variantLabel ?? own?.variantLabel ?? null;
          return (
            <li key={p.variantId} className="border-line font-ui grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 border-t py-3 first:border-t-0">
              <LinePhoto path={p.imagePath ?? own?.imagePath ?? null} className="w-14 rounded-[10px]" />
              <div className="min-w-0">
                <b className="block text-sm font-semibold leading-snug">{displayTitle(name)}</b>
                {option ? <small className="text-ink-muted block text-[13px]">{displayOption(option)}</small> : null}
                <span className="text-caution block text-[13px] font-medium">{stockWords(p)}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {p.available > 0 ? (
                    <button type="button" disabled={busy} onClick={() => onFix(p, p.available)} className={`${button} bg-ink text-paper`}>
                      Keep {p.available}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onFix(p, 0)}
                    aria-label={`Remove ${displayTitle(name)}`}
                    className={`${button} border-line border`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
