# Pilot numbers: every variable, its placeholder and where to change it

> **Beta pricing today (D-127):** every automatic price = (shop ₹ × 1.10 + kg × ₹2,000) ÷ the day's rate, then food
> × 1.20, clothing ÷ 0.60, home & gifts ÷ 0.50, up to .29/.49/.69/.79/.99. Fixed in code; the numbers below are the
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
> - **No bag loses (D-125):** every piece carries its whole cost (food its whole flight again); Shipping below $149.99 is
>   at least $18.79 and more when a bag's pieces cannot pay for its parcel (~$34 for any parcel); free from the line up.
>   Bhujia 200 g $5.99, 400 g $11.29, 1 kg $27.49; footwear without a weight: 600 g (D-122).
> - **Small-food shelf (D-120, D-125):** food up to ₹200 and 250 g with its whole cost, rounded up to the next of
>   $1.99 / $2.99 / $3.99 (at most $3.99, at least the guard on its goods). ₹100 · 100 g $2.99, ₹100 · 200 g $3.99.
> - **Profit guard, every piece:** lifted only if the margin cannot pay US duty on the price (clothing 22%, food 16%,
>   home 13%) and the 2.9% card fee and leave $4 (clothing, home) and 8% (food: 4%, no dollar minimum).
> - Rate = the day's ₹ per $ less the 4% buffer; up to .29/.49/.69/.79/.99 (D-126). Below $149.99 a bag pays Shipping $18.79 and
>   Retailer charges $1.99; from $149.99 up they show struck through at $0.00 and 10% of the amount over the line comes
>   off as the bulk saving, up to $25.
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

## 6. Cycles and offers (Settings → Cycles and offers)
| Variable | Placeholder | Basis |
|---|---|---|
| Days between cutoffs | 21 | D-005: 20–23 days |
| Faster-delivery offer | $6.00 | Below the express fee (D-064) |
| Re-check shop quantities after | 14 days | Half a cycle |

## 7. Sales tax (database table `tax_rates`, D-073)
Charged only in states where IWC is registered, and only on the classes that state taxes. A category's tax class
(clothing, food, general) is set in `supabase/seed/categories.sql`.

| State | Rate | Taxed | Basis |
|---|---|---|---|
| New Jersey | 6.625% | general goods only | NJ exempts clothing, footwear and food. Accessories, fabrics and sweets count as general here, to be safe |
| Any other state | none | none | Add a row once IWC passes that state's threshold (often $100k or 200 orders a year). An accountant should confirm |

## 8. After the sale (Settings → After the sale, D-071, D-072)
| Variable | Placeholder | Basis |
|---|---|---|
| Customer cancel once we started preparing | 0% | D-072 names no fee while the order is in India |
| Customer-care cancel after it left India | 25% of goods kept | Freight, duty, broker and US handling ≈ 20% of a clothing price at these numbers |
| Damaged or wrong: report within | 7 days | D-071, checked against the courier's handover photos |
| Change of mind: within 7 / 14 / 30 days | 15% / 30% / 50% kept | D-071. Unworn, unaltered clothing; food is final sale; after 30 days no returns |
| US clearance price | 30% off what was paid | A returned or cancelled piece already in the US (D-072) |

A return is collected from the customer's door by courier, the way it was delivered (D-076).

## 9. Typical packed weight per category (used when a piece has no weight)
Change in the database (`categories.default_weight_g`) or ask Claude; listed in `supabase/seed/categories.sql`.

| Category | g | Category | g | Category | g |
|---|---|---|---|---|---|
| Lehengas | 2,500 | Fabrics | 1,200 | Jackets & Knitwear | 1,100 |
| Footwear | 1,000 | Sarees & Drapes | 900 | Suits & Sets | 900 |
| Shawls | 700 | Jeans & Trousers | 700 | Co-ords & Dresses | 600 |
| Dhotis & Mundus | 500 | Kurtas & Kurtis | 450 | Kids | 400 |
| Turbans & Headwear | 400 | Shirts, Tees & Tops | 350 | Dupattas & Stoles | 350 |
| Accessories | 300 | Rice, Flours & Staples | 1,100 | Pickles & Chutneys | 600 |
| Sweets | 600 | Snacks & Namkeen | 450 | Papad & Wadi | 400 |
| Tea & Drinks | 300 | Whole / Ground Spices, Masala Blends | 250 | | |

## 10. Business and compliance details (Settings → Business and compliance details, D-074)
All "TO FILL" until you save them: exporter name, address, IEC, GSTIN; importer of record name, address, EIN, customs
bond; customs broker; forwarder; Incoterm (placeholder "FCA Mumbai airport"); HS codes for clothing and for food; FDA
food facility registration, FDA US agent, FSVP importer, label maker; support email (Q-9); US return address. Food can
be published only after "Food is cleared" in Settings.

## What the placeholders produce (local catalogue, 2026-10-06)
Average automatic price per category: lehengas $381, sarees $166, suits $150, jackets $117, shawls $107, kurtas $71,
dupattas $70, shirts $54. Two lessons for the pilot:
- **Heavy staples don't work by air:** a 5 kg bag of rice or flour comes to about $128 (freight, customs and delivery
  follow the weight). Keep staples out of the pilot, or only in small packs.
- **Small pantry packets land around $27–30:** the fixed costs per piece (India pickup, US handling, the smallest US
  parcel) dominate a ₹150 food pack. Bundles or a minimum pantry order would bring that down.
