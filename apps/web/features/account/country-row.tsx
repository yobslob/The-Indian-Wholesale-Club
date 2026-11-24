'use client';

import { useId, useState } from 'react';

import { MARKET_NAME, MARKET_PREFIX, MARKETS, type Market } from '@repo/shared/domain';

import { setMarket, useMoney } from '@/features/shell/market';

/** The flag as the Profile icon draws it (a small SVG in public/flags, D-199), larger. */
function Flag({ m }: { m: Market }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="block h-3 w-6 shrink-0 rounded-[2px] bg-cover bg-center shadow-[0_0_0_1px_rgba(30,27,22,0.15)]"
      style={{ backgroundImage: `url(/flags/${m}.svg)` }}
    />
  );
}

/**
 * D-208: the visitor's country on Profile, always: its flag and name, and Change, which lists the countries IWC is open
 * in (a search field once the list is long, plan-world Phase 3). A pick writes the same cookie as the footer's switch
 * (setMarket), so every price and the Profile icon's flag follow at once. Signed in or not: no account is needed.
 */
export function CountryRow(): React.JSX.Element {
  const { market } = useMoney();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const id = useId();
  const list = MARKETS.filter((m) => MARKET_NAME[m].toLowerCase().includes(find.trim().toLowerCase()));
  return (
    <section aria-labelledby={`${id}-h`} className="bg-paper border-line mb-5 rounded-lg border p-3.5">
      <div className="font-ui flex items-center gap-3">
        <Flag m={market} />
        <span className="min-w-0 flex-1">
          <small id={`${id}-h`} className="text-ink-muted block text-[12px]">
            Country
          </small>
          <b className="block text-[15px] font-semibold">{MARKET_NAME[market]}</b>
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-ink min-h-11 px-1 text-sm font-semibold underline underline-offset-[3px]"
        >
          {open ? 'Close' : 'Change'}
        </button>
      </div>
      {open ? (
        <div className="mt-3 grid gap-1.5">
          {MARKETS.length > 8 ? (
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              className="border-line bg-paper h-11 rounded-[10px] border px-3 text-[15px]"
            />
          ) : null}
          <ul role="radiogroup" aria-label="Country" className="m-0 grid list-none gap-1.5 p-0">
            {list.map((m) => (
              <li key={m}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={m === market}
                  onClick={() => {
                    setMarket(m);
                    setOpen(false);
                  }}
                  className="border-line aria-checked:border-brand aria-checked:bg-canvas font-ui flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 text-left text-[15px]"
                >
                  <Flag m={m} />
                  <span className="flex-1">{MARKET_NAME[m]}</span>
                  <span className="text-ink-muted text-[13px]">{MARKET_PREFIX[m]}</span>
                  {m === market ? <span aria-hidden="true">✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
