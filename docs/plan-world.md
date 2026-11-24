# Plan: Save 5% on every bag, the country on Profile, and IWC open in every country (handoff for the next agent)

*Written 2026-11-24 by Claude from the repo at `main` (ae05e9e) and the founder's message and answers of the same day.
Status: **nothing built.** Read all of it, then `CLAUDE.md`. Each phase ships alone and leaves the store working. The
founder's words are filed as **D-208** (`docs/decisions.md`); §2 is what they mean for the build. D-209 (the same day) answers its questions. Where this plan and
an older one disagree (`plan-send-home.md`, `plan-international.md`), this one holds.*

The founder, verbatim (2026-11-24):
> "The functioning changed:
> 1. We don't want to become a money transferring company, so what we will do is remove the coupons and we will show at
> checkout you are saving $x on this bag, then he will have two options either send that money to his loved ones or
> save it for himself(goes in wallet) it will be 5% of the order value. This is very confusing for me to explain, so I
> don't know how you're going to present but you have to present in a very simple straight manner, all the existing
> designs stay like how they are.
> 2. I need the country icon visible at all times on profile and the user should be able to change it by going to
> profile.
> 3. we are using shipglobal for logistics, so we are turning on iwc for all countries, and all the costs will be
> constant except for shipping, change it according to the country, round off the shipping charge to the nearest next
> 500. so scrape all the per kg charges from all countries from shipglobal."

His answers to Claude's questions the same day (each asked as a choice):
- Rates: read from his own ShipGlobal account (he signed in; Claude read the account's Rate Calculator, §5).
- Which shipping number follows the country: **only the price's freight** (the ₹2 a gram inside every price); the
  bag's Shipping line stays $18.62 a billed kg everywhere.
- The loved-ones choice: **IWC pays it by UPI** (the customer pays the normal price; IWC sends the 5%, its own money).
- The keep choice: **it goes into Coins** (1 coin = 1 cent).
- The US: **keep the US at ₹2,000 a kg** (US prices do not change).
- The service: **the cheapest** ShipGlobal service for each country, even when slower.
- 5% of what: **the goods** (the pieces after the bulk saving, before shipping and tax).
- Neither picked: **it goes to Coins**.

---

## 1. The idea in one paragraph

IWC stops taking a customer's money to send it anywhere. Instead every bag earns **5% of its goods back**, paid by IWC.
In the bag, the Send home card (same place, same look) says it plainly: **"You're saving $4.25 on this bag."** and asks
one thing: send it home, or keep it. Tap Maa, Papa, Didi or Someone else and IWC sends **₹391** to their UPI after the
order is paid, exactly as the India desk sends gifts today. Do nothing (or tap **Keep it**) and **425 Coins** land in the
customer's wallet for the next order. Coupons go. Separately, the store opens to **every country ShipGlobal serves**:
each country's prices carry its own ShipGlobal freight (rounded up to the next ₹500 a kg), and the visitor's flag sits
on the Profile icon everywhere, the US included, with the country switch on the Profile page.

## 2. The rules (binding once D-208 is filed)

**A. Save 5% (replaces coupons and the customer-paid gift)**
1. **The saving is 5% of the goods:** the bag's pieces after the bulk saving (D-155), before shipping, retailer charges,
   heavy-item shipping, Coins and tax: `saveCents = round(goodsCents × 0.05)`. The 5% lives in Settings
   (`save_pct`, 5; empty = the feature is off, D-047). Nothing in the bill changes: the customer pays the same total
   as without it.
2. **Two outcomes, one per order:** *send home* (IWC pays `saveCents × the day's rate` in rupees to a loved one's UPI,
   D-206's daily rate, to the rupee; no 3% kept: it is IWC's own money) or *keep* (`saveCents` Coins, 1 coin = 1 cent,
   D-191). **Keep is the default:** a first-timer who taps nothing keeps it; a returning sender starts on their last
   loved one (they can tap Keep it).
3. **When it is given:** recorded at payment by `create_order` (one row per order), *Coins* credited and *gifts* joining
   the desk's To send when the order is paid (D-206's hold rules stay for gifts). An order cancelled before delivery
   takes the saving back: unsent gift cancelled, Coins removed (never below 0). A sent gift is kept (Q-66's default).
4. **Coupons go** (`coupons.ts`, the bag's coupon card, checkout's coupon field, Admin → Coupons, the first-order 10%).
   Orders already placed keep their coupon lines; the tables stay for history (no data deleted). The struck "was"
   prices (D-190), the bulk saving and Coins stay.
5. **The customer never pays extra:** the old Send home amount chips ($4 / $9 / $19 / Other), the × that removed a
   gift, checkout's "Remove", and the bill's "Sent home" line go; the bill gains no line. The thank-you page, the order
   page and `/account/people` say what happened: "₹391 is on its way to Maa." or "425 Coins added."
6. **Words** (D-012 drafts, in `features/send-home/words.ts`, simple and straight as the founder asked):
   - Card: kicker **"Your 5%"**, headline **"You're saving $4.25 on this bag."**, one line **"Send it home as ₹391, or
     keep it for your next order."**, chips **Maa · Papa · Didi · Someone else · Keep it** (Keep it picked by default).
   - Picked a person: headline stays, line becomes **"₹391 goes to Maa's UPI after you pay."**
   - Checkout (above Pay): **"Your $4.25 saving goes to Maa"** or **"Your $4.25 saving goes to your Coins"**, with
     **Change**.
   - Never "cashback", "refund", "transfer", "remittance", "donation" (glossary).
7. **The look stays** (founder: "all the existing designs stay like how they are"): the bag card keeps D-205's light
   paper, wine border, stitched edge, gold arc and chip sizes; the sheet, the postcard and `/account/people` keep
   theirs. Only the words and the amount chips change. Home's bohni band and the navbar's first-order ads keep their designs and become
   the Maa–Behen ad for the 5% (D-209).
8. **US and abroad alike:** the saving works in every open country, shown in the visitor's currency (D-198 shows
   savings in $; Q-71 asks whether to keep that).

**B. The country on Profile**
9. **Always visible:** the Profile icon's flag (D-199) shows for **every** visitor, the US included; the phone menu's
   first line too. Pages stay one cached copy (CSS from `<html data-market>`, D-199).
10. **Changed from Profile:** `/account` (and its signed-out page) gets a **Country** row: the flag, the name and
    **Change**, opening a searchable list of the open countries. It writes the `iwc_market` cookie (and, signed in,
    `profiles.country`), reloads prices, and checkout's address starts in that country. The footer's switch stays.

**C. Every country, freight by country**
11. **The countries:** every destination in ShipGlobal's list (246 besides India, §5) **except** uninhabited places
    (Antarctica, Bouvet Island, Heard and McDonald Islands, French Southern Territories, South Georgia, US Minor
    Outlying Islands) and countries a US seller may not sell to (Cuba, Iran, North Korea, Syria; Russia and Belarus
    as the founder confirmed, D-209), and Pakistan (no ShipGlobal service). A country with no ShipGlobal rate is closed. Food is
    open wherever ShipGlobal takes it (D-209).
12. **Only the freight changes** (founder: "all the costs will be constant except for shipping"): the price formula
    (D-128) stays with the country's freight in place of ₹2 a gram:
    `price = (shop ₹ ÷ 0.90 + priced weight g × country ₹/kg ÷ 1000) ÷ divisor ÷ 92`. The US stays at **₹2,000 a kg**
    (founder); every other country uses its rate. Heavy items keep D-155's half weight in the price, and **Heavy-item
    shipping** uses the country rate too (it is freight). The bag's Shipping ($18.62 a billed kg), the free line
    ($49.99), the bulk line ($99.99), retailer charges, Coins and the 5% stay as they are in US dollars.
13. **The country rate** = the cheapest ShipGlobal service's 1 kg quote for that country (base + its fixed fee),
    **rounded up to the next ₹500** (₹4,813 + ₹240 = ₹5,053 → ₹5,500). Stored in a `ship_countries` table
    (`iso2`, `iso3`, `name`, `inr_per_kg`, `service`, `days_min`, `days_max`, `quoted_at`, `open`), seeded by the
    migration from `catalogue/shipglobal-rates-2026-11-24.csv`, editable in Admin → Settings → Countries.
14. **Prices are worked out where they are shown, never stored per country:** the database keeps the US price
    (`price_cents`, ₹2,000 a kg) and each listing gains its priced weight (`price_weight_g`, the grams its price used:
    heavy pieces half, fallbacks included) in the store views. A price abroad = `price_cents +
    round(price_weight_g × (country ₹/kg − 2000) ÷ 1000 ÷ divisor ÷ 92 × 100)`, in `packages/shared` (one function, unit
    tested against the formula on worked examples) and the same in SQL for checkout. A hand-set price takes the same
    freight difference.
15. **Currency:** Canada, Australia and New Zealand keep their own dollars (D-197); every other country sees US dollars
    written **US$** (so "$" never reads as a local dollar). Checkout, orders, emails and invoices stay in US dollars.
16. **Delivery days are the same everywhere** (D-209, non-negotiable 4): every country shows Settings' food (7 – 12)
    and standard (12 – 16) business days, as the US does. `ship_countries` keeps the service's days for the admin only.
17. **Duties paid everywhere** (D-209): "Duties paid. Nothing to pay at your door." (D-161) shows in every country,
    and IWC pays any duty or import tax ShipGlobal bills (its cheapest services mostly say "Duties may apply": a cost
    outside the prices; Insights shows duties paid by country). No sales tax is charged outside the US.
18. **The country comes from** a choice (cookie, Profile, footer) or else the visitor's IP country (`x-vercel-ip-country`,
    read in the small fetch that already brings the flag, D-199), else the time zone (today's `MARKET_SCRIPT`), else the
    US. No permission is asked.
19. **Checkout's address is international:** country (the market, changeable: the bill reprices), address lines, city,
    region or state, postal code, phone, validated per country only where we know the format (US ZIP and state stay as
    today). The server prices by the address's country, never the cookie.
20. **No operations info** (non-negotiable 1): customers never see "ShipGlobal", the service, the ₹ rate or the
    country's freight figure: only prices and delivery days. The admin sees the service on the order.
21. **Speed and limits** (non-negotiable 6): no page-cache writes added (prices abroad are computed in the browser from
    the cached page, as D-197 does); the rates table is ~240 rows sent once with the flag (≈ 4 KB gzipped, cached a
    day); `price_weight_g` adds one small integer per card. Say so in the commits.
22. **Mobile web first** (D-190): design and test at 390 px; the app follows (Phase 5).

## 3. What the code already has (checked at ae05e9e)

| Fact | Where |
|---|---|
| Markets today: `us`, `ca`, `au`, `nz`; prices × the Settings rate; the time-zone guess and cookie | `packages/shared/src/domain/markets.ts`, `features/shell/market.tsx` (`useMoney`, `MARKET_SCRIPT`) |
| The flag on the Profile icon and in the phone menu, abroad only | D-199, `.site-flag` in `globals.css`, `public/flags/` |
| Beta pricing (₹2 a gram = `shipPaisePerGram: 200`) | `packages/shared/src/domain/pricing.ts`, SQL `_auto_price_cents()` |
| Coupons (domain, bag card, checkout, first-order band) | `domain/coupons.ts`, `features/cart/coupon-card.tsx`, `offers.ts`, `features/home/first-order.ts`, `shell/first-order-ad.tsx`, migration `20261111090000_coupons_coins.sql` |
| Coins (`profiles.coins`, all used on every order) | D-191, `domain/checkout.ts`, `bill.ts` |
| Send home: the card, sheet, postcard, desk, daily rate, `home_gifts`, `loved_ones` | `features/send-home/*`, `features/admin/send-home/*`, migration `20261126090000_send_home.sql`, D-205, D-206 |
| The bill and its sum | `domain/checkout.ts` (`quoteCheckout`), `domain/bill.ts`, `features/cart/bill-card.tsx` |
| Checkout's address (US only: ZIP list, states) | `features/checkout/delivery-step.tsx`, `zip-codes.json`, `pricing.ts` |
| Delivery days from Settings | `pricing_settings` food and standard days (D-187, D-207) |
| IDs | D-208 is this plan, D-209 its answers; Q-71 is open (§7); latest migration `20261127090000_food_7_to_12_days.sql` |

## 4. Design (words in §2 rule 6; the look is D-205's)

- **The bag card:** the same card in the same place. Top: kicker "Your 5%", headline "You're saving $4.25 on this bag."
  (Syne 600, 16 px), under it the trade on one line, **$4.25 → ₹391**, joined by the gold sewing arc (as today). Then
  the line "Send it home as ₹391, or keep it for your next order." and one row of chips: **Maa · Papa · Didi · Someone
  else · Keep it** (five chips: at 390 px two rows, Keep it alone on the second, full width, outlined; picked = the
  brand border on canvas, as today). No ×, no amount chips, no "round up". A person chip opens the existing "Who's it
  for?" sheet (its button now **"Send ₹391 to Maa"**, its last line **"Keep it instead"**).
- **Checkout:** one quiet line above Pay (no box): "Your $4.25 saving goes to Maa · Change".
- **Thank-you:** the postcard when sent home (as today); when kept, the same card size with "425 Coins added. They come
  off your next order."
- **Profile:** a row under the name: 16 × 8 flag, "United States", **Change** → a sheet with a search field and the
  country list (flag, name), the current one ticked.
- **The flag everywhere:** the Profile icon's flag for every country (240 small SVGs in `public/flags/`, ≈ 300 B each,
  loaded only for the visitor's own).

## 5. The ShipGlobal rates (read 2026-11-24)

Read from the founder's own ShipGlobal account (Rate Calculator, dead weight 1 kg, no size, no postcode) for all 246
destinations in its list besides India, through the page's own form. The cheapest service per country, its days, the
1 kg quote (base + fixed fee) and the rate rounded up to the next ₹500 are in
`catalogue/shipglobal-rates-2026-11-24.csv` (columns `iso3, name, service, days_min, days_max, inr_1kg, inr_per_kg`).
14 countries quoted the same as their neighbour in the list and were quoted again: the same each time.
What the rates say:
- **27 countries come out cheaper than the US's ₹2,000:** Singapore and Malaysia ₹500; the UK, UAE, Hong Kong and Macau
  ₹1,000; Canada, Australia, Japan, the Philippines, Taiwan, Brunei and most of the EU ₹1,500. Their prices will be
  *lower* than the US's (the founder's rule: only freight changes).
- **Most of Africa, Latin America and the islands are ₹3,500 – ₹4,000**, and a few ₹5,000 – ₹6,000 (Argentina, Jersey,
  Guernsey, the Isle of Man, Aland, Svalbard, the Vatican): a 1 kg food piece there costs $20 – $55 more than in the US.
- **The cheapest service is often FedEx (4 – 7 days)**, faster than ShipGlobal WorldWide (13 – 18 days) and cheaper at
  1 kg; ShipGlobal Direct (7 – 14 days) where it exists.
- **Pakistan:** no service ("No Services Available"), so it is closed.
- Only 1 kg was read; heavier parcels may cost less a kg. Whether each service takes food is not shown (D-209: food open wherever ShipGlobal takes it). US example: ShipGlobal Direct Commercial, 7 – 10 days, ₹1,289 + ₹200 = ₹1,489 → ₹1,500 (not used: the US
stays at ₹2,000, founder). Quotes are a day's prices; Admin → Settings → Countries lets the founder change any row.
*Note:* the US "Direct Commercial" service warns "a tariff fee will be charged" (US tariffs on Indian goods): not part
of this change, the US keeps today's prices.

## 6. Phases (each ships alone; the store works after every one)

**Phase 0: file and ask.** D-208 and D-209 filed with `/record-answer`; Q-71 in `docs/questions.md`; glossary ("Your
5%", Coins); `docs/status.md`. *Done when* the docs audit passes.

**Phase 1: Save 5% (US, live store).** Migration: `order_savings` (`order_id` unique, `save_cents`, `outcome` `gift` |
`coins`, `loved_one_id`, `home_gift_id`, `coins`, timestamps; admin-only, customers read their own through
`store_*`); `home_gifts` gains `funded_by` (`customer` | `iwc`) so old gifts stay readable; `pricing_settings.save_pct`;
`create_order` writes the saving (gift or Coins) in the same transaction; cancel takes it back. Shared:
`saveCents(goods, pct)` (unit-tested), the old gift path removed from `quoteCheckout` (total = as before Send home).
Web: the card's new words and chips, the sheet's buttons, checkout's line, thank-you and order page, `/account/people`
history showing both outcomes, coupons removed from the bag, checkout and admin (the tables stay), the bohni band and
the navbar's ads as the Maa–Behen ad (D-209). *Done when* `node scripts/check.mjs` is green; a test order of $85 goods with Keep it adds 425 Coins and
charges exactly what it charged before; with Maa it charges the same and makes one `to_send` gift of ₹(4.25 × rate);
cancelling before sending removes either; no coupon field shows anywhere; e2e covers both at 390 px.

**Phase 2: the country on Profile.** The flag for every market, the Profile row and sheet, `profiles.country`, the
cookie. *Done when* a US visitor sees the US flag on the Profile icon, changes to Canada from Profile and every price
turns CA$; e2e at 390 px.

**Phase 3: every country, prices only (orders still US).** `ship_countries` and its seed; Admin → Settings →
Countries; `price_weight_g` in the store views; the shared price-abroad function and its SQL twin (tests: the US price
unchanged for every listing in the seed; a 1 kg food piece at ₹5,500 = US price + 1 kg × ₹3,500 ÷ 0.8 ÷ 92 = +$47.55);
markets widened from four to the open list (US$ for the rest); the IP country in the flag fetch; country delivery days
read by the pages. Abroad, checkout still says orders open soon (D-197). *Done when* checks are green, a German visitor
sees US$ prices with Germany's freight and Germany's days, the US sees exactly today's prices and pages (diff the HTML
of Home and a product page), and `/cart`'s first-load JS grows by ≤ 3 KB.

**Phase 4: orders from every country.** The international address step; the server prices by the address's country;
no sales tax outside the US; "Duties paid" abroad too (D-209); Stripe in USD; emails and invoices with the country; the
admin order shows the country, the ShipGlobal service and the rate used; the desk books ShipGlobal by hand. *Done
when* a test order to Germany pays the German price, gets German days, no tax, and shows correctly to the admin; a US
order is unchanged; e2e covers both.

**Phase 5: the app.** The same card, Profile country and prices abroad in `apps/app`.

## 7. Open questions (filed in `docs/questions.md`; Q-68, Q-69, Q-70 and Q-72 answered by D-209)

| # | Question | Until answered |
|---|---|---|
| Q-71 | **Savings abroad:** D-198 shows coupons and savings in $ abroad. Show "You're saving" in the visitor's currency (CA$6.01) or keep $? | the visitor's currency |
