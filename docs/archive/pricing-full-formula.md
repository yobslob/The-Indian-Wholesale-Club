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
