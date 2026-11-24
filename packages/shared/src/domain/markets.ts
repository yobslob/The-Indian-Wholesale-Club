import { formatUsd } from './checkout';
import { wasCents } from './pricing';

import type { ProductType } from './product-types';

/**
 * Where a visitor shops from (D-197, D-198): Canada, Australia and New Zealand see every price in their own dollars, at
 * the rate set in Settings; the US sees "$" as always. The store's caps and offers stay as written in US dollars ("$"):
 * the free-delivery line, "under $99", "Under $5", coupons and savings. Prices are still worked out in US dollars by the
 * founder's rules (non-negotiable 5): this only shows them in another currency. Checkout, orders, emails, invoices
 * and the admin stay in US dollars. No permission is asked: the country comes from the device's time zone, a
 * `?market=` link or the footer's switch (MARKET_SCRIPT below, run before the first paint).
 */
/**
 * D-208: the visitor's country, any country IWC sells in (a lower-case ISO 3166 code; the open list is the database's,
 * store_countries). The US is 'us'. Canada, Australia and New Zealand also have their own dollars (D-197); every other
 * country sees US dollars written US$. Its prices carry its own freight (store_country_prices).
 */
export type Market = string;
/** The countries with their own currency on the store (D-197), in the order the footer listed them. */
export const MARKETS = ['us', 'ca', 'au', 'nz'] as const;
export type AbroadMarket = 'ca' | 'au' | 'nz';

/** US dollars to each currency, from Settings; null when not set (that market's prices then show in US dollars). */
export type MarketRates = Record<AbroadMarket, number | null>;
export const NO_RATES: MarketRates = { ca: null, au: null, nz: null };

/** The founder's prefixes (2026-11-10): the US is just "$". */
export const MARKET_PREFIX: Record<(typeof MARKETS)[number], string> = { us: '$', ca: 'CA$', au: 'A$', nz: 'NZ$' };
export const MARKET_NAME: Record<(typeof MARKETS)[number], string> = {
  us: 'United States',
  ca: 'Canada',
  au: 'Australia',
  nz: 'New Zealand',
};

/** The cookie a choice is kept in (a `?market=` link or the footer's switch); a time-zone guess is never stored. */
export const MARKET_COOKIE = 'iwc_market';

/** A country code as the store keeps it (the database says which are open). */
export const isMarket = (value: unknown): value is Market => typeof value === 'string' && /^[a-z]{2}$/.test(value);

const hasOwnCurrency = (market: Market): market is AbroadMarket => market === 'ca' || market === 'au' || market === 'nz';

/** "$" in the US, CA$ / A$ / NZ$ where they have their own dollars, else US$ (D-208: "$" never reads as a local dollar). */
export function marketPrefix(market: Market): string {
  return market === 'us' ? '$' : hasOwnCurrency(market) ? MARKET_PREFIX[market] : 'US$';
}

/** The rate a market's prices use; null for the US, or when the rate is not set. */
export function marketRate(market: Market, rates: MarketRates): number | null {
  if (!hasOwnCurrency(market)) return null;
  const rate = rates[market];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** US cents × the rate, to the cent (half a cent away from zero, so a minus amount mirrors its plus one). */
const convert = (usdCents: number, rate: number): number => Math.sign(usdCents) * Math.round(Math.abs(usdCents) * rate);

const withPrefix = (cents: number, market: Market): string => formatUsd(cents).replace('$', marketPrefix(market));
/** US dollars as a country without its own currency sees them: "US$12.50" (the US and Canada… without a rate: "$"). */
const usdFor = (cents: number, market: Market): string => (market === 'us' || hasOwnCurrency(market) ? formatUsd(cents) : withPrefix(cents, market));

/** "$12.50" in the US (exactly formatUsd), "CA$17.66" in Canada: the US price × the rate, to the cent. */
export function formatMoney(usdCents: number, market: Market, rates: MarketRates): string {
  const rate = marketRate(market, rates);
  return rate === null ? usdFor(usdCents, market) : withPrefix(convert(usdCents, rate), market);
}

/**
 * The struck-through price beside a shown price (D-190, D-198): the same rule in every currency, applied to the price
 * as the visitor sees it (the shown price × the type's factor, wasCents), so a card, its product page and its buy bar
 * strike the same figure, and the US shows exactly what it always did.
 */
export function formatWas(usdCents: number, type: ProductType | null | undefined, market: Market, rates: MarketRates): string {
  const rate = marketRate(market, rates);
  return rate === null ? usdFor(wasCents(usdCents, type), market) : withPrefix(wasCents(convert(usdCents, rate), type), market);
}

/** Canada's IANA time zones (the `Canada/*` aliases are matched by their prefix). */
export const CANADA_ZONES: readonly string[] = [
  'America/St_Johns',
  'America/Halifax',
  'America/Glace_Bay',
  'America/Moncton',
  'America/Goose_Bay',
  'America/Blanc-Sablon',
  'America/Toronto',
  'America/Montreal',
  'America/Nipigon',
  'America/Thunder_Bay',
  'America/Iqaluit',
  'America/Pangnirtung',
  'America/Atikokan',
  'America/Coral_Harbour',
  'America/Winnipeg',
  'America/Rainy_River',
  'America/Resolute',
  'America/Rankin_Inlet',
  'America/Regina',
  'America/Swift_Current',
  'America/Edmonton',
  'America/Cambridge_Bay',
  'America/Yellowknife',
  'America/Inuvik',
  'America/Creston',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Whitehorse',
  'America/Dawson',
  'America/Vancouver',
];

const AU_ZONE = /^Australia\//;
const NZ_ZONE = /^(Pacific\/(Auckland|Chatham)|NZ(-CHAT)?)$/;
const CA_ZONE = /^Canada\//;

/** The market a device's time zone points to; anything else is the US. */
export function marketFromTimeZone(zone: string | null | undefined): Market {
  const z = zone ?? '';
  if (AU_ZONE.test(z)) return 'au';
  if (NZ_ZONE.test(z)) return 'nz';
  if (CA_ZONE.test(z) || CANADA_ZONES.includes(z)) return 'ca';
  return 'us';
}

/**
 * Inline in <head> (app/layout.tsx), before the first paint: sets <html data-market> and the flag (`--flag`, D-208). A `?market=` link wins and is
 * kept in the cookie, then the cookie, then the time zone. The same rules as marketFromTimeZone (markets.test.ts runs
 * this very script against it). No request, no permission prompt.
 */
export const MARKET_SCRIPT = `(function(){try{var d=document.documentElement,k=${JSON.stringify(MARKET_COOKIE)},m=null,q=/[?&]market=([a-z]{2})(?:&|$)/.exec(location.search);if(q){m=q[1];document.cookie=k+'='+m+';path=/;max-age=31536000;samesite=lax'}else{var c=new RegExp('(?:^|; )'+k+'=([a-z]{2})(?:;|$)').exec(document.cookie);if(c)m=c[1]}if(!m){try{var s=sessionStorage.getItem('iwc_market_ip');if(s&&/^[a-z]{2}$/.test(s))m=s}catch(e){}}if(!m){var z='';try{z=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}m=${AU_ZONE}.test(z)?'au':${NZ_ZONE}.test(z)?'nz':(${CA_ZONE}.test(z)||${JSON.stringify(CANADA_ZONES)}.indexOf(z)>=0)?'ca':'us'}d.setAttribute('data-market',m);d.style&&d.style.setProperty('--flag','url(/flags/'+m+'.svg)')}catch(e){}})();`;
