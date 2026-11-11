import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatMoney, formatUsd, formatWas, MARKET_SCRIPT, marketFromTimeZone, wasCents, type Market, type MarketRates } from '../src/domain';

const RATES: MarketRates = { ca: 1.413, au: 1.457, nz: 1.806 };

/** Runs MARKET_SCRIPT as the browser would, with a fake document, address and clock. */
function runScript(opts: { zone?: string; search?: string; cookie?: string }): { market: string | null; cookie: string } {
  let market: string | null = null;
  const doc = {
    cookie: opts.cookie ?? '',
    documentElement: {
      setAttribute: (name: string, value: string) => {
        if (name === 'data-market') market = value;
      },
    },
  };
  const intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: opts.zone ?? 'America/New_York' }) }) };
  new Function('document', 'location', 'Intl', MARKET_SCRIPT)(doc, { search: opts.search ?? '' }, intl);
  return { market, cookie: doc.cookie };
}

describe('the currency abroad (D-197)', () => {
  it('formats the US exactly as before and the others with their prefix, to the cent', () => {
    for (const cents of [0, 1, 1999, 4999, 123456]) assert.equal(formatMoney(cents, 'us', RATES), formatUsd(cents));
    assert.equal(formatMoney(1999, 'ca', RATES), 'CA$28.25'); // 19.99 × 1.413 = 28.2459
    assert.equal(formatMoney(1999, 'au', RATES), 'A$29.13'); // × 1.457 = 29.1254
    assert.equal(formatMoney(1999, 'nz', RATES), 'NZ$36.10'); // × 1.806 = 36.1019
    assert.equal(formatMoney(123456, 'ca', RATES), 'CA$1,744.43');
    assert.equal(formatMoney(-500, 'au', RATES), '-A$7.29');
  });

  it('strikes the same figure in every currency: the shown price × the type\'s factor (D-198)', () => {
    for (const type of ['food', 'clothing', 'home'] as const) {
      assert.equal(formatWas(1999, type, 'us', RATES), formatUsd(wasCents(1999, type)));
    }
    // CA$28.25 shown → × 1.2 food, × 1.4 clothing, × 1.5 home & gifts, from the shown cents
    assert.equal(formatWas(1999, 'food', 'ca', RATES), 'CA$33.90');
    assert.equal(formatWas(1999, 'clothing', 'ca', RATES), 'CA$39.55');
    assert.equal(formatWas(1999, 'home', 'ca', RATES), 'CA$42.38');
    assert.equal(formatWas(1999, 'clothing', 'au', { ca: null, au: null, nz: null }), formatUsd(wasCents(1999, 'clothing')));
  });

  it('falls back to US dollars when a rate is not set or not usable', () => {
    assert.equal(formatMoney(1999, 'ca', { ca: null, au: null, nz: null }), '$19.99');
    assert.equal(formatMoney(1999, 'nz', { ca: 1, au: 1, nz: 0 }), '$19.99');
  });

  it('reads the country from the time zone, and the script agrees for every zone', () => {
    const cases: [string, Market][] = [
      ['America/Toronto', 'ca'],
      ['America/Vancouver', 'ca'],
      ['America/St_Johns', 'ca'],
      ['Canada/Eastern', 'ca'],
      ['Australia/Sydney', 'au'],
      ['Australia/Perth', 'au'],
      ['Pacific/Auckland', 'nz'],
      ['Pacific/Chatham', 'nz'],
      ['NZ', 'nz'],
      ['America/New_York', 'us'],
      ['America/Detroit', 'us'],
      ['Asia/Kolkata', 'us'],
      ['', 'us'],
    ];
    for (const [zone, market] of cases) {
      assert.equal(marketFromTimeZone(zone), market, zone);
      assert.equal(runScript({ zone }).market, market, `script: ${zone}`);
    }
  });

  it('lets a ?market= link win and keeps it in the cookie; the cookie beats the time zone', () => {
    const linked = runScript({ zone: 'America/New_York', search: '?q=1&market=au' });
    assert.equal(linked.market, 'au');
    assert.match(linked.cookie, /^iwc_market=au;/);
    assert.equal(runScript({ zone: 'Australia/Sydney', cookie: 'a=1; iwc_market=us' }).market, 'us');
    assert.equal(runScript({ zone: 'America/Toronto', search: '?market=xx' }).market, 'ca');
    // a guess is never stored
    assert.equal(runScript({ zone: 'America/Toronto' }).cookie, '');
  });
});
