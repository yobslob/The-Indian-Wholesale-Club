# The full pricing formula (D-119 – D-126), archived for after the beta

Archived on 2026-10-15 when the founder switched the store to the fixed beta formula (D-127): "Take all of this
complete logic and put it in archive so we can use it later." Nothing here is deleted from the code: the full formula
still lives in the database and in `packages/shared`, switched off by `pricing_settings.beta_pricing = true`. Its
settings stay in the table with the values below.

## How to bring it back
1. A new migration: `update public.pricing_settings set beta_pricing = false where id = 1;` (this reprices every
   automatic price at once, through `pricing_settings_reprice`).
2. Check the numbers in Settings (they are the D-126 values below unless someone changed them) and the profit check.
3. Update `docs/pilot-numbers.md`, `docs/plan/current.md` and a new D-entry.

## Where it lives
| What | Where |
|---|---|
| A piece's price | `_auto_price_cents(shop_paise, weight_g, type)`, latest full body in migration `20261015090000_courier_2000_food_band.sql`; the beta branch on top since `20261015120000_beta_pricing.sql` |
| Helpers | `_price_ending` (.29/.49/.69/.79/.99), `_tapered_margin`, `_band_price`, `_fallback_weight_g`, `_pricing_weight_g` |
| The bag's Shipping and retailer charges | `store_bag_charges(items)`, migration `20261014200000_parcel_pays_its_way.sql` (still live in the beta) |
| The same in TypeScript | `packages/shared/src/domain/pricing.ts` (`autoPrice` → the full formula when `betaPricing` is off), `profit-check.ts`, `checkout.ts` (`bagChargesAt`) |
| Tests | `supabase/tests/pricing_engine.test.sql`, `bag_charges.test.sql`; `packages/shared/tests/domain.test.ts`, `pricing-band.test.ts` |
| Decisions | D-109, D-111, D-112, D-119 – D-126 in `docs/decisions.md` |

## The formula, step by step
**Rate.** The day's ₹ per $ (ECB, fetched daily, D-075) less a 4% safety buffer: ₹96.30 → ₹92.45.

**Clothing and home & gifts (D-119, D-126).**
cost = (shop ₹ ÷ 0.90 + weight g ÷ 100 × ₹200) ÷ rate; price = cost ÷ (1 − margin), margin of the price.
The margin tapers on dear pieces: clothing 42% down to 35% as the cost goes from $20 to $150; home & gifts 50% down to
40% from $15 to $100. Home & gifts without a weight is priced at shop ₹ × 1.5 g (at least 200 g, at most the category's
weight, D-121); footwear at 600 g (D-122).

**Food (D-119, D-125, D-126).**
cost = (shop ₹ + ₹15 shop fee) × 1.10 India handling ÷ rate + billed kg (110% of the label) × the courier per kg ÷ rate.
With a band top set (D-126), the price is 17–20% on cost: the first ending at or above +17%; past +20% the ending nearer
the band (a tie goes up). Without a band top: cost × 1.25, then the guard and the small-food shelf.

**Courier (D-126).** ₹2,000 a kg, all in, billed by the half kg from 1 kg. Before: ₹2,242 first kg, ₹678.50 each further
kg, ₹1,050 per parcel (box and clearance); food spread that over a 5 kg parcel (about ₹1,201 a kg).

**Profit guard (D-119; not for food in its band).** After US duty (clothing 22%, food 16%, home 13%, on the price) and
the 2.9% card fee, a piece must leave its minimum profit: $4 and 8% (clothing, home), 4% (food). If not, the price is
lifted until it does.

**Small-food shelf (D-120, D-125; off while food has a band).** Food up to ₹200 and 250 g carrying its whole cost,
rounded up to $1.99 / $2.99 / $3.99, never under its cost.

**Ending.** Up to the next .29, .49, .69, .79 or .99 (D-126; before: .29/.49/.79/.99).

## The bag (D-112, D-119, D-125; unchanged in the beta)
- **Shipping**, one number: below $149.99 at least $18.79, more when the bag's pieces cannot pay for its parcel
  (courier on the billed weight + 30¢ card fee − what the pieces leave after shop cost × 1.03 and fee, duty, 2.9% card fee
  and 2% returns, over 95.1%). From $149.99 up it is struck through and free, unless the bag still could not pay its way
  (then that remainder, `past_line_cents`).
- **Retailer charges:** 1.5% of the goods, at least $0.99; free from $149.99.
- **Bulk saving:** past $149.99, 10% of the amount over the line, at most $25, off the goods before tax.

## The settings at archive time (D-126)
| Setting | Value |
|---|---|
| fx buffer | 4% |
| shop divisor (clothing, home) | 0.90 |
| ship per 100 g (clothing, home) | ₹200 |
| clothing margin / lowest / taper | 42% / 35% / $20 – $150 |
| home margin / lowest / taper | 50% / 40% / $15 – $100 |
| food margin (band bottom) / band top | 17% / 20% |
| India handling (food) / food shop fee | 10% / ₹15 |
| food billed weight / food parcel | 110% / 5 kg |
| courier first kg / next kg / per parcel | ₹2,000 / ₹2,000 / ₹0 |
| duty clothing / food / home | 22% / 16% / 13% |
| minimum profit clothing, home / % / food % | $4 / 8% / 4% |
| guard card fee | 2.9% |
| small-food shelf | ₹200, 250 g, 100% share, $1.99 – $3.99 (unused with the band) |
| free-shipping line / least Shipping / retailer | $149.99 / $18.79 / 1.5%, at least $0.99 |
| bulk saving | 10% over the line, at most $25 |

## What it gave (₹96.30, D-126)
Garam masala ₹90 · 100 g $4.29 · bhujia 400 g $12.79, 1 kg $31.29 · ₹699 kurta $31.29 · ₹1,499 kurta set $63.69 ·
₹350 brass diya $31.29. Every sample bag in the profit check left a profit (the least: one masala, $1.92); food-heavy
bags past $149.99 paid some Shipping (14 × 1 kg bhujia $54.99).

---

## As pilot-numbers.md stated it until D-187 (plan §10 Y-2: the formula and its settings are gone)

# Pilot numbers: every variable, its placeholder and where to change it

> **Beta pricing today (D-128, the founder's exact rules):** every automatic price = (shop ₹ ÷ 0.90 + weight g × ₹2)
> ÷ the category's divisor (food 0.80, clothing 0.60, home & gifts 0.50) ÷ ₹92 fixed, to the cent (no price ending).
> ₹100 · 100 g food $4.23. **Heavy cookware (D-155):** a piece ticked as a heavy item (every home piece named a cooker)
> is priced on half its weight; the other half is **Heavy-item shipping** in the bag (₹1,800 · 3 kg cooker: $108.70
> + $65.21 = the $173.91 the rules give on 3 kg), 20% off from the free-shipping or 7-day line (Settings → Bag charges).
> A bottle or lunch box without a weight in grams on its page is priced on 500 g or 700 g (the founder's ranges,
> 450 – 550 g and 600 – 800 g), never on its litres.
> Products → Download Excel gives name, Indian price, category, weight, US price and margin. Fixed in code; the numbers below are the
> full formula's, archived in `docs/archive/pricing-full-formula.md` and unused for prices until the beta ends (the bag's
> charges still use the courier, duty and Shipping numbers).
>
> **The full formula (D-119, D-126), paused:** two recipes, every number in Settings.
> - **Courier (D-126):** ₹2,000 per kg, everything in, billed by the half kg from 1 kg (was ₹2,242 first kg, ₹678.50
>   each further kg and ₹1,050 per parcel).
> - **Clothing and home & gifts:** (shop ₹ ÷ 0.90 + g ÷ 100 × ₹200) ÷ rate, then ÷ (1 − margin). Margin of the price:
>   clothing 42% easing to 35% as the cost before margin goes from $20 to $150; home 50% easing to 40% from $15 to $100.
> - **Food (D-126):** cost = (shop ₹ + ₹15 fee) × 1.10 ÷ rate + billed kg (110% of the label) × ₹2,000 ÷ rate; the price
>   is 17–20% on that cost (the first ending at or above +17%), with no guard and no shelf: the bag's Shipping covers a
>   piece that cannot pay its duty and card fee (D-125). ₹90 masala $4.29, bhujia 400 g $12.79, 1 kg $31.29.
> - **Home & gifts without a weight (D-121):** priced at shop ₹ × 1.5 g (at least 200 g, at most the category's
>   typical weight) instead of the category's 1.5 – 2 kg: a ₹200 basket is $17.99, not $62.29.
> - **Shipping (D-154, replacing D-125's top-up):** $18.62 × the bag's billed kg (its packed weight, food at 110% of its
>   label, at least 1 kg, then by the half kg), one parcel for the whole bag even when it ships as two; struck through
>   at $0.00 (the figure growing with the bag) from the free line ($99.99 on production) and, for a bag of only 7-day
>   pieces, from the 7-day line ($49.99). 1 kg $18.62, 1.5 kg $27.93, 2.5 kg $46.55. Settings → Bag charges and
>   Standard delivery. Footwear without a weight: 600 g (D-122).
> - **Small-food shelf (D-120, D-125):** food up to ₹200 and 250 g with its whole cost, rounded up to the next of
>   $1.99 / $2.99 / $3.99 (at most $3.99, at least the guard on its goods). ₹100 · 100 g $2.99, ₹100 · 200 g $3.99.
> - **Profit guard, every piece:** lifted only if the margin cannot pay US duty on the price (clothing 22%, food 16%,
>   home 13%) and the 2.9% card fee and leave $4 (clothing, home) and 8% (food: 4%, no dollar minimum).
> - Rate = the day's ₹ per $ less the 4% buffer; up to .29/.49/.69/.79/.99 (D-126). Below the free line a bag pays
>   Shipping (above) and Retailer charges ($0.99 on production, Settings); from the line up both show struck through at
>   $0.00 and 10% of the amount over the line comes off as the bulk saving, up to $25. The docs' older $149.99 and $1.99
>   are Settings values; production has $99.99 and $0.99 (D-154).
> - Worked examples at ₹96.30 (the shelf off; on, the snack and the masala are $2.99 and $3.99): snack ₹90 · 100 g $3.99, masala ₹150 · 250 g $8.49, namkeen ₹220 · 400 g $13.29, kurta
>   ₹1,299 · 450 g $45.29, saree ₹7,500 · 900 g $180.79, lehenga ₹12,000 · 2.5 kg $296.49, brass ₹1,800 · 1.2 kg $91.29.
> - Estimates (labelled in Settings until a real bill replaces them): duty %, ₹1,050 per parcel, the food fee, parcel kg
>   and billed weight. The sections below describe the retailer model's formula (D-075).

The pilot shipment (D-069) runs on **high-end placeholders** chosen by Claude on 2026-10-06, so prices come out safe
while the real costs are unknown. Each placeholder carries an "estimate" label in the admin (Settings) until you save
your own number, which removes the label. `pnpm launch:check` lists every placeholder left.

**How a price is made (D-075).** You enter only the shop price in ₹ and a weight; the database works out the price in
$ and updates it whenever a number below or the exchange rate changes:

1. Rate = today's ₹ per $ × (1 − safety buffer). A weaker rupee than today's, to be safe.
2. Goods = shop price ÷ rate. India handling = handling ₹ ÷ rate.
3. Billed kg = weight × volume %. Freight = air $/kg × billed kg. Customs = broker per export ÷ export kg × billed kg.
4. Duty = (goods + India handling) × duty %.
5. US last mile = the larger of the minimum and $/kg × weight. US warehouse handling per piece.
6. Before fees = (goods × (1 + margin) + every cost above) × (1 + returns allowance).
7. Price = (before fees + card fee per payment) ÷ (1 − card fee %), rounded **up** to the next $x.99.

The margin applies to the goods only; shipping, customs and handling are recovered at cost. A piece without a weight
uses its category's typical packed weight (table below).

## 1. Exchange rate (Settings → Exchange rate)
| Variable | Placeholder | Basis | Notes |
|---|---|---|---|
| ₹ per $ | 96.30 | ECB reference rate 2026-10-05 (Frankfurter); open.er-api 96.38 | **Updates by itself every day** (D-075). A jump over 10% is refused and shows on Today |
| Safety buffer | 4% | The rupee fell about 9% in a year; 4% covers about five months | Lower it once you price more often |

## 2. India side (Settings → Costs per piece, India side)
| Variable | Placeholder | Basis |
|---|---|---|
| Pickup, local transport, packing per piece | ₹200 | High end of pickup + carton + labour in Mumbai |

## 3. Standard: air Mumbai → US airport → warehouse → customer (Settings → Standard)
| Variable | Placeholder | Basis |
|---|---|---|
| Air freight per billed kg | $7.50 | Forwarder rates $3.50–5.50/kg for 45–100 kg + 15–25% fuel + terminal handling |
| Billed weight as % of real | 130% | Airlines bill volume weight; folded clothing bills 20–40% over |
| Customs broker, fees, bond per export | $400 | Broker entry $150–300 + Merchandise Processing Fee (≥ $33) + single-entry bond $50–100 |
| Billed kg in one export | 40 kg | A small pilot export; a heavier export lowers every price |
| US duty | 26.5% | Normal duty on clothing up to 16.5% + India's 10% Section 301 tier since 2026-07-24 |
| US warehouse handling per piece | $3.00 | Receive, check, repack, label |
| US delivery per kg | $10.00 | USPS Ground Advantage, farthest zone, 1–2 lb ≈ $9–11 |
| US delivery, smallest parcel | $5.00 | The smallest parcel to the farthest zone |

## 4. Margin, risk and card fees (Settings → Margin, risk and card fees)
| Variable | Placeholder | Basis |
|---|---|---|
| Margin on the goods | 100% | Keystone (2× goods); direct online brands run 3–3.5× |
| Returns and damage allowance | 5% | Covers the deductions you don't recover (D-071) |
| Card fee | 3.4% | Stripe 2.9% + room for international and premium cards |
| Card fee per payment | $0.30 | Stripe |

## 5. Express: courier Mumbai → the customer's door (Settings → Express)
| Variable | Placeholder | Basis |
|---|---|---|
| Per express order | $15.00 | Courier pickup, export paperwork, duty-paid handling |
| Courier per kg | $22.00 | DHL / FedEx India→US ≈ ₹1,400–1,800/kg + 25% fuel |
| Courier minimum billed kg | 1 kg | Couriers bill at least 0.5–1 kg |
| Express days from the order | 15–18 | D-048, D-070 |

**7-day delivery** (Settings → Standard delivery and shipping, D-148): days from the order for a bag of only 7-day
pieces, 7 – 7 (the founder's "Exactly 7 days"); empty switches 7-day delivery off. No price or charge of its own.

## What the placeholders produce (local catalogue, 2026-10-06)
Average automatic price per category: lehengas $381, sarees $166, suits $150, jackets $117, shawls $107, kurtas $71,
dupattas $70, shirts $54. Two lessons for the pilot:
- **Heavy staples don't work by air:** a 5 kg bag of rice or flour comes to about $128 (freight, customs and delivery
  follow the weight). Keep staples out of the pilot, or only in small packs.
- **Small pantry packets land around $27–30:** the fixed costs per piece (India pickup, US handling, the smallest US
  parcel) dominate a ₹150 food pack. Bundles or a minimum pantry order would bring that down.
