'use client';

import { useEffect, useSyncExternalStore } from 'react';

import {
  formatMoney,
  formatUsd,
  formatWas,
  wasCents,
  isMarket,
  MARKET_COOKIE,
  MARKET_NAME,
  MARKET_PREFIX,
  MARKETS,
  NO_RATES,
  type Market,
  type MarketRates,
  type ProductType,
} from '@repo/shared/domain';

/**
 * Prices in the visitor's dollars (D-197). The market is <html data-market>, set before the first paint by
 * MARKET_SCRIPT (app/layout.tsx); the rates come once from the store layout (cached Settings), kept in a small store as
 * the days are (days.tsx). Store pages are cached and the same for everyone, so they arrive with US prices; until the
 * page's script has redrawn them, a non-US visitor's prices are hidden (`.money`, globals.css), so a US price never
 * shows to them. Checkout passes `usd` and stays in US dollars.
 */
interface MarketState {
  market: Market;
  rates: MarketRates;
  /** The rates have arrived (always, for the US): a non-US price may show. */
  ready: boolean;
}

const SERVER: MarketState = { market: 'us', rates: NO_RATES, ready: true };
let rates: MarketRates | null = null;
let current: MarketState = SERVER;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};

function snapshot(): MarketState {
  const attr = document.documentElement.dataset.market;
  const market: Market = isMarket(attr) ? attr : 'us';
  const ready = market === 'us' || rates !== null;
  const r = rates ?? NO_RATES;
  if (current.market !== market || current.rates !== r || current.ready !== ready) current = { market, rates: r, ready };
  return current;
}

const notify = (): void => {
  for (const on of listeners) on();
};

/** Hands the rates over once, from the store layout. */
export function MarketProvider({ value }: { value: MarketRates }): null {
  useEffect(() => {
    rates = value;
    notify();
  }, [value]);
  return null;
}

/** The footer's switch: a traveller, or someone shopping for family abroad, picks the currency; kept a year. */
export function setMarket(market: Market): void {
  document.cookie = `${MARKET_COOKIE}=${market};path=/;max-age=31536000;samesite=lax`;
  document.documentElement.dataset.market = market;
  notify();
}

export interface MoneyApi {
  market: Market;
  ready: boolean;
  format: (usdCents: number) => string;
  /** The struck-through price beside the price `usdCents` shows (D-190, D-198). */
  formatWas: (usdCents: number, type: ProductType | null | undefined) => string;
}

/** The visitor's market and a formatter; `usd` keeps US dollars (checkout, where the card is charged in them). */
export function useMoney(usd = false): MoneyApi {
  const s = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  if (usd) return { market: 'us', ready: true, format: formatUsd, formatWas: (cents, type) => formatUsd(wasCents(cents, type)) };
  return {
    market: s.market,
    ready: s.ready,
    format: (cents) => formatMoney(cents, s.market, s.rates),
    formatWas: (cents, type) => formatWas(cents, type, s.market, s.rates),
  };
}

/**
 * A price from US cents, in the visitor's dollars. `from`: "From …" (the options differ in price); `whole`: no ".00";
 * `wasOf`: instead, the struck-through price beside this price, by its product type's rule (D-198).
 * `data-m` says which market it is drawn for; a price drawn for another market is hidden (globals.css).
 */
export function Money({
  cents,
  from = false,
  whole = false,
  wasOf,
}: {
  cents: number;
  from?: boolean;
  whole?: boolean;
  wasOf?: ProductType | null;
}): React.JSX.Element {
  const { market, ready, format, formatWas: was } = useMoney();
  const shown = wasOf !== undefined ? was(cents, wasOf) : format(cents);
  const text = whole ? shown.replace(/\.00$/, '') : shown;
  return (
    <span className="money" data-m={ready ? market : undefined}>
      {from ? `From ${text}` : text}
    </span>
  );
}

/** Checkout's one line abroad: the card is charged in US dollars. */
export function CheckoutCurrencyNote(): React.JSX.Element | null {
  const { market } = useMoney();
  if (market === 'us') return null;
  return (
    <p className="bg-paper border-line font-ui text-ink-muted mb-4 rounded-lg border px-4 py-3 text-sm">
      Checkout is in US dollars ($). Prices elsewhere on the site are shown in {MARKET_PREFIX[market]}.
    </p>
  );
}

export function MarketSwitch(): React.JSX.Element {
  const { market } = useMoney();
  return (
    <label className="inline-flex items-center gap-2">
      <span>Prices in</span>
      <select
        value={market}
        onChange={(e) => {
          const next = e.target.value;
          if (isMarket(next)) setMarket(next);
        }}
        className="text-canvas rounded border border-[#3A332D] bg-transparent px-1.5 py-1 text-xs"
      >
        {MARKETS.map((m) => (
          <option key={m} value={m} className="text-ink">
            {MARKET_NAME[m]} ({MARKET_PREFIX[m]})
          </option>
        ))}
      </select>
    </label>
  );
}
