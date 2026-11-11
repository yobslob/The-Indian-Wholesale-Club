# Plan: the store in Canada, Australia and New Zealand (handoff for the next agent)

Updated 2026-11-11 by Claude. Read this file, then `decisions.md` D-197 and D-198, then `CLAUDE.md`. Nothing else is
needed to pick this up.

## 1. Where it stands

| Part | State |
|---|---|
| Prices shown abroad in CA$, A$, NZ$ (D-197, D-198) | **verified 2026-11-11, on branch `prices-abroad` with its PR**; waits for merge and the Deploy workflow (§3) |
| Home dressed for Thanksgiving with the founder's poster (D-196) | verified and committed on the same branch |
| Taking orders abroad (address, payment, duties, shipping, catalogue rules) | **parked by the founder** ("I am not taking orders for now… I will update you later on the restrictions"); §6 lists it for when he comes back |

Both pieces, with the e2e stock fix, are three commits on branch `prices-abroad`, cut from `main` (9c17623), in one PR.

## 2. The founder's rules (binding)

1. **Display only.** Every price is still worked out in US dollars by the founder's rules (non-negotiable 5). Prices,
   charges, margins, courier rates and delivery days do not change by country. "All the extra charges are covered in
   margin."
2. **Prefixes:** Canada `CA$`, Australia `A$`, New Zealand `NZ$`; the US is just `$`.
3. **Converted:** every price. Shown price = US cents × the rate, to the cent.
4. **Not converted, written in `$` in every country:** the caps, the coupons and the savings. That covers the
   free-delivery line (hero button, delivery band, flight banner, free-delivery pill, bag goal line), "Host your
   Thanksgiving under $99." and "Shop under $99", "Under $5", the coupons card and sheet, the bulk-saving lines and
   "You're saving".
5. **Struck prices:** the same products are struck in every country, and the struck figure is the **shown** price × the
   type's factor (food 1.2, clothing 1.4, home & gifts 1.5; `wasCents`). A card, its product page and its buy bar
   strike the same figure.
6. **No permission prompt.** The country comes from the device's time zone, a `?market=` link or the footer switch.
7. **US dollars stay** for checkout and everything after it: the Pay amount, orders, emails, invoices, account order
   pages, the admin, the info pages' policy numbers, product structured data, and the Android app. Checkout abroad shows
   one line saying so. The address form still takes US addresses only, so no order can come from abroad.

## 3. Next steps, in order

1. **Done 2026-11-11:** `node scripts/check.mjs`, every step OK but e2e (103 passed, 2 skipped, 2 failed); the two failures were the
   test customer's "Too many requests" in `customer-choices.spec.ts`, which passed 3/3 alone (`status.md`).
2. **Done 2026-11-11:** three commits (Thanksgiving, prices abroad, e2e stock) on `prices-abroad` and one PR;
   the founder's 3 MB source picture of the poster (hero_updated.png in public/visuals, unused) stays out of git.
3. **The founder runs the Deploy workflow** for migration `20261114090000_market_rates.sql`. Until then the site works,
   but abroad it shows US dollars, because `store_policy().fx` is empty.
4. **Check on the live site:** `https://indianwholesaleclub.com/clothing?market=ca` should show CA$ on cards and the
   product page, `$49.99` on the hero, `$99` on the dusk, and a US-dollar checkout. `?market=us` (or the footer switch)
   goes back.

## 4. How it is built (file map)

| What | Where |
|---|---|
| Markets, prefixes, rates type, `formatMoney`, `formatWas`, `marketFromTimeZone`, `MARKET_SCRIPT` | `packages/shared/src/domain/markets.ts` (tests `packages/shared/tests/markets.test.ts`, 5) |
| Rates in Settings: `pricing_settings.fx_usd_cad / _aud / _nzd`, seeded 1.4130 / 1.4570 / 1.8060 (XE, 2026-11-06/07); `store_policy().fx` | `supabase/migrations/20261114090000_market_rates.sql`, `supabase/tests/market_rates.test.sql`, `packages/db` (types, `storePolicySchema.fx`, `getPricingSettings`), `apps/web/features/admin/settings-fields.ts` (Settings → Prices abroad) |
| Country before the first paint | `apps/web/app/layout.tsx` (inline `MARKET_SCRIPT` sets `<html data-market>`; `?market=` → `iwc_market` cookie → time zone) |
| Rates to the browser, `useMoney()`, `Money` (`from`, `whole`, `wasOf`), the footer switch, checkout's note | `apps/web/features/shell/market.tsx`; `MarketProvider` in `app/(store)/layout.tsx`; `MarketSwitch` in `features/shell/site-footer.tsx` |
| No US price flashes abroad | `globals.css`: `html[data-market=ca] .money:not([data-m=ca])` (and au, nz) is hidden until redrawn |
| Converted | `features/catalog/product-card.tsx`, `add-to-cart.tsx`, `buy-bar.tsx`, `option-picker.tsx` + `card-options.ts` (`chipLabel`'s formatter), `finishing-drawer.tsx`; `features/home/homecoming-windows.tsx` (arches' `cents`); `features/cart/bag-lines.tsx`, `bill-card.tsx` (all rows but "You're saving"; `usd` prop at checkout), `cart-view.tsx` (`TotalNow`); `packages/shared` `price-label.ts` (formatter parameter) |
| Kept in `$` on purpose (D-198) | `home-hero.tsx`, `delivery-band.tsx`, `app/(store)/page.tsx` (flight banner, "Under $5"), `homecoming-hooks.ts` (`WIDE`), `cart/coupon-card.tsx`, `bag-goal-line.tsx`, `free-delivery-bar.tsx`, `bill-card.tsx` ("You're saving") |
| Checkout in US dollars | `features/checkout/bag-summary.tsx`, `checkout-flow.tsx` (`<BillCard usd>`, `<CheckoutCurrencyNote />`) |
| End-to-end | `apps/web/e2e/market.spec.ts` (Toronto, Sydney, New York clocks; `?market=nz`; a cap stays `$`) |

Invariants to keep: a US visitor's HTML and text are exactly what they were; every converted price goes through
`Money`/`useMoney`, never `formatUsd` directly; caps never go through them; a struck price uses `wasOf`/`formatWas`,
never a converted US struck figure.

## 5. Small open points (ask the founder when convenient)

- **See all's price filters** (`features/catalog/browse-query.ts` `priceRanges` and the chip labels, `price-slider.tsx`)
  still read "Up to $25" in US dollars for everyone, and the address's `?min=`/`?max=` are US dollars. Convert the labels
  only, or leave them as caps? Not decided; left as they are.
- **Rates are Settings numbers, not live** (a live daily rate would rebuild every cached page every day). The founder
  updates them when he wants. A "live rate differs by more than 3 %" hint on Admin → Today is a possible later addition.
- **The app** shows US dollars everywhere; it reads `store_policy()` too, so it could follow with `expo-localization`.
- D-197/D-198's interpretations: the bill's coupon and bulk-saving rows convert so the bill adds up; the time-zone guess
  is never stored. Confirm with the founder.

## 6. Parked until the founder reopens it: taking orders abroad

The founder set these aside on 2026-11-10 ("whatever you have listed in 'What changes besides the exchange rate' ignore
those"). They matter only once orders open abroad; don't build any of them unasked.

1. Address and phone per country (postal codes, provinces and states, +61 / +64), checkout pricing and the Stripe
   PaymentIntent in the visitor's currency, order columns for currency, rate and amounts, refunds in that currency.
2. Shipping route: no hub abroad, so each order goes by courier from India, door to door; delivery days per country.
3. Duties and tax. Canada: courier imports from outside the US and Mexico get no duty or tax relief above CAD 20, so
   almost every order pays both. Australia and New Zealand: GST is ours to charge once sales pass A$75,000 / NZ$60,000
   in 12 months, and prices then show it included.
4. Biosecurity in Australia and New Zealand: seeds, whole spices, rice, pulses, dairy, egg, honey, nuts, dried flowers
   and untreated wood are refused or held. Needs a per-country list of what may be sent (`market_rules`) and "Not sent to
   …" on cards.
5. Consumer law: struck "was" prices must have been real prices (Australia's regulator, Canada since 2024), a fixed
   Retailer charge added at checkout counts as drip pricing in Canada, and Australia and New Zealand's consumer
   guarantees on faulty goods can't be limited by a returns policy.
6. Card fees: Stripe adds 1.5 % for non-US cards and 1 % for currency conversion.
7. Words and law: "the US" in 23 places, the flight's US map, seasons per country, privacy and terms per country.

Questions for then (Q-61): courier and price per kg per country; who is the importer of record; delivery days; which
country first (Canada recommended); the curated list for Australia and New Zealand; the app.

Sources for §6 (read 2026-11-10): [CBSA D8-2-16](https://publications.gc.ca/collections/collection_2025/asfc-cbsa/Rv55-8-8-2-16-2024-eng.pdf),
[ATO, low value goods](https://www.ato.gov.au/General/Other-languages/In-detail/Information-in-other-languages/Goods-and-services-tax-(GST)-when-you-sell-to-Australia/),
[IRD, low value goods](https://www.ird.govt.nz/gst/gst-for-overseas-businesses/gst-on-low-value-imported-goods/when-to-charge-gst-on-low-value-imported-goods),
[DAFF sellers' guide](https://agriculture.gov.au/sites/default/files/documents/online-sellers-guide-english.pdf),
[MPI, mail](https://www.mpi.govt.nz/bring-send-to-nz/clearance-of-personal-goods-and-mail-to-nz/clearing-overseas-mail),
[ACCC v Coles](https://www.maddocks.com.au/insights/down-down-coles-was-now-pricing-strategy-sunk-by-the-federal-court),
[Canada, Bill C-59](https://www.dwpv.com/insights/2024/further-changes-to-canada-competition-act),
[Stripe international fees](https://checkoutpage.com/blog/stripe-international-fees). Not legal or tax advice: a customs
broker and a lawyer confirm §6 before orders open abroad.
