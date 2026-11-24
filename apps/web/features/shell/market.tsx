'use client';

import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';

import {
  formatMoney,
  formatUsd,
  formatWas,
  wasCents,
  isMarket,
  marketPrefix,
  MARKET_COOKIE,
  NO_RATES,
  type Market,
  type MarketRates,
  type ProductType,
} from '@repo/shared/domain';

import { countryName, useCountries } from './countries';
import { countryCents, pricesVersion, subscribePrices, whenClosed, type PriceOf } from './country-prices';

/**
 * Prices in the visitor's country (D-197, D-208). The country is <html data-market>, set before the first paint by
 * MARKET_SCRIPT (app/layout.tsx); Canada's, Australia's and New Zealand's rates come once from the store layout (cached
 * Settings). Store pages are cached and the same for everyone, so they arrive with US prices; abroad each price asks for
 * its own (`of`, country-prices.ts) and stays hidden until it is drawn (`.money`, globals.css), so a US price never
 * shows abroad. Checkout passes `usd` and stays in US dollars.
 */
interface MarketState {
  market: Market;
  rates: MarketRates;
  /** Canada's, Australia's and New Zealand's rates have arrived (always, elsewhere). */
  ready: boolean;
  version: number;
}

const SERVER: MarketState = { market: 'us', rates: NO_RATES, ready: true, version: 0 };
let rates: MarketRates | null = null;
let current: MarketState = SERVER;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  const off = subscribePrices(on);
  return () => {
    listeners.delete(on);
    off();
  };
};

const needsRate = (m: Market): boolean => m === 'ca' || m === 'au' || m === 'nz';

function snapshot(): MarketState {
  const attr = document.documentElement.dataset.market;
  const market: Market = isMarket(attr) ? attr : 'us';
  const ready = !needsRate(market) || rates !== null;
  const r = rates ?? NO_RATES;
  const version = pricesVersion();
  if (current.market !== market || current.rates !== r || current.ready !== ready || current.version !== version)
    current = { market, rates: r, ready, version };
  return current;
}

const notify = (): void => {
  for (const on of listeners) on();
};

function show(market: Market): void {
  document.documentElement.dataset.market = market;
  document.documentElement.style.setProperty('--flag', `url(/flags/${market}.svg)`);
  notify();
}

/** A choice (Profile, the footer): kept a year in the cookie MARKET_SCRIPT reads. */
export function setMarket(market: Market): void {
  document.cookie = `${MARKET_COOKIE}=${market};path=/;max-age=31536000;samesite=lax`;
  try {
    sessionStorage.removeItem(IP_KEY);
  } catch {
    // nothing kept
  }
  show(market);
}

const IP_KEY = 'iwc_market_ip';
const hasCookie = (): boolean => new RegExp(`(?:^|; )${MARKET_COOKIE}=`).test(document.cookie);

/**
 * Hands Canada's, Australia's and New Zealand's rates over once, from the store layout. With no choice made, it asks once
 * a tab where the visitor is (/api/country, the IP's country when IWC sells there; D-208), kept for the tab only,
 * never in the cookie. A country IWC does not sell in (a stale cookie) falls back to the US.
 */
export function MarketProvider({ value }: { value: MarketRates }): null {
  useEffect(() => {
    rates = value;
    notify();
  }, [value]);
  useEffect(() => {
    whenClosed(() => setMarket('us'));
    let seen: string | null = null;
    try {
      seen = sessionStorage.getItem(IP_KEY);
    } catch {
      // storage blocked: asked each page
    }
    if (hasCookie()) return;
    if (seen !== null) {
      if (isMarket(seen) && seen !== document.documentElement.dataset.market) show(seen);
      return;
    }
    void fetch('/api/country')
      .then((r) => (r.ok ? (r.json() as Promise<{ country?: string | null }>) : null))
      .then((b) => {
        const country = b?.country ?? '';
        try {
          sessionStorage.setItem(IP_KEY, country);
        } catch {
          // storage blocked
        }
        if (isMarket(country) && !hasCookie() && country !== document.documentElement.dataset.market) show(country);
      })
      .catch(() => undefined);
  }, []);
  return null;
}

export interface MoneyApi {
  market: Market;
  ready: boolean;
  /** The price `of` (a piece, card or kit) in the visitor's country, in their currency; the figure as given without `of`. */
  format: (usdCents: number, of?: PriceOf) => string;
  /** The struck-through price beside that price (D-190, D-198). */
  formatWas: (usdCents: number, type: ProductType | null | undefined, of?: PriceOf) => string;
  /** That price in US cents (null while it is on its way abroad). */
  cents: (usdCents: number, of?: PriceOf) => number | null;
}

/** The visitor's country and a formatter; `usd` keeps US dollars (checkout, where the card is charged in them). */
export function useMoney(usd = false): MoneyApi {
  const s = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  if (usd)
    return {
      market: 'us',
      ready: true,
      format: formatUsd,
      formatWas: (cents, type) => formatUsd(wasCents(cents, type)),
      cents: (cents) => cents,
    };
  const at = (cents: number, of?: PriceOf): number | null => countryCents(s.market, cents, of);
  return {
    market: s.market,
    ready: s.ready,
    format: (cents, of) => formatMoney(at(cents, of) ?? cents, s.market, s.rates),
    formatWas: (cents, type, of) => formatWas(at(cents, of) ?? cents, type, s.market, s.rates),
    cents: at,
  };
}

/**
 * A price from US cents, in the visitor's country. `of`: which piece, card or kit it is (abroad its own price is asked
 * for; the US shows `cents`). `from`: "From …"; `whole`: no ".00"; `wasOf`: the struck-through price beside it instead.
 * `data-m` says which country it is drawn for; a price not yet drawn for the visitor's is hidden (globals.css).
 */
export function Money({
  cents,
  of,
  from = false,
  whole = false,
  wasOf,
}: {
  cents: number;
  of?: PriceOf;
  from?: boolean;
  whole?: boolean;
  wasOf?: ProductType | null;
}): React.JSX.Element {
  const { market, ready, format, formatWas: was, cents: at } = useMoney();
  const drawn = ready && at(cents, of) !== null;
  const shown = wasOf !== undefined ? was(cents, wasOf, of) : format(cents, of);
  const text = whole ? shown.replace(/\.00$/, '') : shown;
  return (
    <span className="money" data-m={drawn ? market : undefined}>
      {from ? `From ${text}` : text}
    </span>
  );
}

/** Checkout's one line abroad: the card is charged in US dollars. */
export function CheckoutCurrencyNote(): React.JSX.Element | null {
  const { market } = useMoney();
  if (market === 'us' || marketPrefix(market) === 'US$') return null;
  return (
    <p className="bg-paper border-line font-ui text-ink-muted mb-4 rounded-lg border px-4 py-3 text-sm">
      Checkout is in US dollars ($). Prices elsewhere on the site are shown in {marketPrefix(market)}.
    </p>
  );
}

/** D-199, D-208: the menu's first line, the flag and the country, in every country (changed on Profile). */
export function MenuMarket(): React.JSX.Element {
  return (
    <div className="site-panel-market">
      <span className="site-flag" aria-hidden="true" />
      <MarketSwitch light />
    </div>
  );
}

/** The footer's and the menu's country: its name and Change, which opens Profile's Country row (D-208). */
export function MarketSwitch({ light = false }: { light?: boolean }): React.JSX.Element {
  const { market } = useMoney();
  const countries = useCountries();
  return (
    <span className={`inline-flex items-center gap-2 ${light ? 'text-ink text-sm' : 'text-canvas text-xs'}`}>
      <span>
        {countryName(countries, market)} ({marketPrefix(market)})
      </span>
      <Link href="/account" className="underline underline-offset-[3px]">
        Change
      </Link>
    </span>
  );
}
