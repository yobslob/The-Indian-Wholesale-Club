'use client';

import { useId, useState } from 'react';

import { marketPrefix, type Market } from '@repo/shared/domain';

import { countryName, useCountries } from '@/features/shell/countries';
import { setMarket, useMoney } from '@/features/shell/market';

/** The flag as the Profile icon draws it (public/flags, D-199, D-208), larger. */
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
 * D-208: the visitor's country on Profile, always: its flag and name, and Change, which lists every country IWC sells in
 * (store_countries) with a search field. A pick writes the same cookie MARKET_SCRIPT reads (setMarket), so every price
 * and the Profile icon's flag follow at once. Signed in or not: no account is needed.
 */
export function CountryRow(): React.JSX.Element {
  const { market } = useMoney();
  const countries = useCountries();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const id = useId();
  const q = find.trim().toLowerCase();
  const list = q ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code === q) : countries;
  return (
    <section aria-labelledby={`${id}-h`} className="bg-paper border-line mb-5 rounded-lg border p-3.5">
      <div className="font-ui flex items-center gap-3">
        <Flag m={market} />
        <span className="min-w-0 flex-1">
          <small id={`${id}-h`} className="text-ink-muted block text-[12px]">
            Country
          </small>
          <b className="block text-[15px] font-semibold">{countryName(countries, market)}</b>
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
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Search countries"
            aria-label="Search countries"
            className="border-line bg-paper h-11 rounded-[10px] border px-3 text-[15px]"
          />
          <ul role="radiogroup" aria-label="Country" className="m-0 grid max-h-[50dvh] list-none gap-1.5 overflow-y-auto p-0">
            {list.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={c.code === market}
                  onClick={() => {
                    setMarket(c.code);
                    setOpen(false);
                    setFind('');
                  }}
                  className="border-line aria-checked:border-brand aria-checked:bg-canvas font-ui flex min-h-11 w-full items-center gap-3 rounded-[12px] border px-3 text-left text-[15px]"
                >
                  <Flag m={c.code} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-ink-muted text-[13px]">{marketPrefix(c.code)}</span>
                  {c.code === market ? <span aria-hidden="true">✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
