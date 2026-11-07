# Pilot numbers: every price and charge number, and where to change it

**Prices are never changed unasked (CLAUDE.md, D-128, D-140).** The paused full formula, its settings and the exchange-rate
refresh went with D-187 (plan §10 Y-2): their text is in `docs/archive/pricing-full-formula.md`.

## Prices: beta pricing (D-128, the founder's exact rules; fixed in code)
Every automatic price = (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category's divisor (food 0.80, clothing 0.60, home & gifts
0.50) ÷ ₹92 fixed, to the cent (no price ending). ₹100 · 100 g food $4.23.
- **Heavy cookware (D-155):** a piece ticked as a heavy item (every home piece named a cooker) is priced on half its
  weight; the other half is **Heavy-item shipping** in the bag (₹1,800 · 3 kg cooker: $108.70 + $65.21 = the $173.91 the
  rules give on 3 kg), 20% off from the $99.99 line (Settings → Bag charges).
- **A bottle or lunch box** without a weight in grams on its page is priced on 500 g or 700 g (the founder's ranges, 450 –
  550 g and 600 – 800 g), never on its litres.
- **Home & gifts without a weight (D-121):** priced at shop ₹ × 1.5 g (at least 200 g, at most the category's typical
  weight). Footwear without a weight: 600 g (D-122).
- Products → Download Excel gives name, Indian price, category, weight, US price and margin.
- **Struck-through prices (D-190):** Settings → Prices, 55% of the listings priced by the rules (0 = none; picked from the listing's id). The struck figure = price × 1.2 food, × 1.4 clothing, × 1.5 home & gifts, the price plus its margin. Display only: what is charged is the price.

## The bag's charges (Settings → Bag charges)
| Number | On production | Notes |
|---|---|---|
| **Free shipping from** | $49.99, every bag (D-187) | `free_shipping_min_cents`, on the bag before any coupon or coins (D-191). At and over it, Shipping shows struck through at $0.00 |
| **Shipping** below the line | $18.62 × the bag's billed kg (D-154, D-190) | its heaviest piece at least 1 kg, then by the half kg, and every other piece its own weight, food at 110% of its label, never under the whole bag by the half kg; one parcel for the whole bag even when it ships as two. One piece $18.62; 5 masalas of 100 g $26.81; 2 kurtas of 450 g $27.00; a 1 kg piece and a 100 g piece $27.93. The same figure shows struck through from the free line up |
| **Retailer charges** on every bag from India, never struck (D-191) | at least $0.99, or the retailer % of the goods | Settings. The % was 1.5 on the 5 Nov copy: $2.99 on a $199 bag; empty it for the fixed amount |
| **Bulk saving and heavy-item discount from** | $99.99 (D-187: "Keep them at $99.99") | `bulk_saving_from_cents`. Its own line since D-187, money unchanged |
| **Bulk saving** | 10% of the amount over that line, up to $25 (D-119) | a $120 bag saves $2.00. None while a coupon is on (D-191) |
| **Coupons** (D-191; Admin → Promotions turns one off) | WELCOME10 10% up to $9, no paid order yet; SAVE7 $7 from $99; SAVE12 $12 from $150; SAVE20 $20 from $199 | on the bag's subtotal. One replaces the bulk saving and is offered only when worth more |
| **Coins** (D-191, accounts only) | 30 – 90 to start, 1 coin = 1 cent; after a paid order the wallet holds what it held plus 1 – 8 | all used on every order, on top of a coupon, before tax. `profiles.coins` |
| **Heavy-item shipping** | 20% off from that line (D-155) | below it, paid in full |

## Delivery (Settings → Delivery; D-187, `flows.md` §1)
| Number | Value | Notes |
|---|---|---|
| Food delivery days | 7 – 7, business days | Monday to Friday, from the order day. Empty = checkout cannot quote a date |
| Clothing and home & gifts delivery days | 12 – 16, business days | the same |
| Already in the US: days to the door | Settings, **calendar days** | US clearance stays as it was (`domestic_days_*`); the only delivery number not in business days |


## Listings (Settings → Listings)
| Variable | Value | Notes |
|---|---|---|
| Re-check shop quantities after | 14 days (`stale_listing_days`) | Today always shows the count now; imported listings are re-checked by the runner |
| Leaving soon lists pieces with at most | 2 (D-056) | |

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
| Accessories | 300 | Noodles, Soups & Staples | 1,100 | Pickles & Chutneys | 600 |
| Sweets | 600 | Snacks & Namkeen, Bakery & Biscuits | 450 | Papad & Wadi | 400 |
| Tea & Drinks | 300 | Whole / Ground Spices, Masala Blends | 250 | | |

## 10. Business and compliance details (Settings → Business and compliance details, D-074)
All "TO FILL" until you save them: exporter name, address, IEC, GSTIN; importer of record name, address, EIN, customs
bond; customs broker; forwarder; Incoterm (placeholder "FCA Mumbai airport"); HS codes for clothing and for food; FDA
food facility registration, FDA US agent, FSVP importer, label maker; support email (Q-9); US return address. The packing
list and commercial invoice that printed them went with the Cycle pages (plan §7).

