# Glossary: one word per concept, everywhere

Use these exact words in the DB, code, folders, routes, tests and docs. The "Don't use" column lists synonyms that cause
confusion. If you need a concept that isn't here, add it (and a decision if it's a business rule).

| Term | Meaning | In code / DB | Customer copy | Don't use |
|---|---|---|---|---|
| **region** | one of India's 28 states or 8 UTs, all treated the same (D-002) | `regions`, `region_id`, `/states/[region]` | the region's name; "state", "home" | `state` in code (clashes with React state and the US address field), province |
| **product** | a sellable item as customers see it ("Kasavu saree") | `products` | product name | item, listing |
| **variant** | one buyable option of a product (size/colour or weight), with its own SKU and stock | `product_variants` | size / weight picker | SKU as a synonym for variant |
| **product type** | `clothing`, `food` or `home` (D-106, D-110). Decides which attributes and options apply | `product_type` | "Clothing", "Food", "Home & gifts" | kind, spice (renamed food, D-110) |
| **category** | a browse group inside a type (Sarees, Kurtas, Masalas…) | `categories` | category name | collection |
| **vendor** | a shop in India that supplies pieces. **Admin only** (D-003) | `vendors`, `vendor_id` | never shown | supplier, seller, merchant, shop (in code) |
| **source** | the online shop's product page an imported pilot listing was copied from (D-110). **Admin only** | `products.source_url`, `source_site`, `source_checked_at` | never shown | link, origin (origin is the region, D-004) |
| **online vendor** | the vendor row that stands for an online shop in one state (D-110). **Admin only** | `vendors.online_site` | never shown | marketplace (in code) |
| **vendor account** | the sign-in of a vendor's owner (D-102): uploads their own pieces, sees only their own | `profiles.role = 'vendor'`, `vendor_accounts`, `is_vendor()`, `vendor_*` functions, `/vendor` | never shown (vendor copy: "your shop") | retailer, partner, seller account |
| **house model** | one of the founder's 10 AI-generated, licensed models (6 women, 4 men) who wear the pieces in AI photos, each in two poses: front and back (D-101, D-104) | `house_models` | never named | mannequin, avatar |
| **photo job** | one queued run of the photo pipeline for one product view (D-103) | `photo_jobs` | never shown | task |
| **cycle** | one round: take orders → cutoff → collect from vendors → export → arrive in the US → deliver. One export every 20–23 days (D-005). **Admin only** | `cycles`, `cycle_id` | never shown. Customers only see dates | batch, shipment |
| **cutoff** | the last moment an order joins the current cycle | `cycles.cutoff_at` | "Order by <date>" (D-035) | deadline |
| **export** | the physical India → US consignment of a cycle (AWB, customs) | fields on `cycles` | never shown | shipment (reserved for the US parcel) |
| **pickup** | collecting one ordered piece from its vendor. **Admin only** | `pickups` | never shown | collection, sourcing |
| **payout** | a payment in INR to a vendor for collected pieces. **Admin only** | `vendor_payouts` | never shown | settlement |
| **small-order charges** | below the free-shipping line, a bag's fixed **Shipping** and **Retailer charges** (Settings); struck through at $0.00 from the line up (D-111, D-112) | `store_bag_charges()`, `orders.retailer_charge_cents` | "Shipping", "Retailer charges" | small order fee, surcharge |
| **bulk saving** | from the free-shipping line up, a % of the amount over the line taken off the bag, up to a cap; after the cap, pieces add at full price (D-119) | `bulk_saving_pct`, `bulk_saving_cap_cents`, `orders.bulk_saving_cents` |
| **small-food shelf** | light, cheap food (up to ₹200 and 250 g by default) priced on whole-dollar steps, $1.99 – $3.99, carrying half its shipping share (D-120); not used while food has a margin band (D-126) | `small_food_*` in `pricing_settings`, rule `small` in `autoPrice` |
| **all-India listing** | a listing with no state (`products.region_id` null): the store names no state for it, it fills every state's page after the state's own pieces and lives at `/states/india/<slug>` (D-121) | `region_id is null`, `ALL_INDIA_SLUG`, `productPath()` |
| **pack** | a food piece's pack size on its card ("200 g"), from its option or its name (D-122) | `_store_pack()`, `pack` on cards |
| **food weight** | retired (D-125): the part of Shipping that carried food's flight when prices carried less of it (D-123, D-124) | unused `food_off_*` settings |
| **beta pricing** | the fixed formula during the beta, the founder's exact rules: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ 0.80 food / 0.60 clothing / 0.50 home & gifts ÷ ₹92, to the cent (D-127, D-128) | `pricing_settings.beta_pricing`, `BETA_PRICING`, rule `beta` in `autoPrice` |
| **food margin band** | food priced 17–20% on its cost, without the profit guard or the small-food shelf; the bag's Shipping covers a piece that cannot pay its duty (D-126) | `margin_food_pct` (bottom), `food_margin_max_pct` (top), `_band_price`, rule `band` in `autoPrice` |
| **weight source** | where an option's weight came from: weighed, admin (typed), shop (its own page), similar (a matching item or another size), estimated (the weight estimator, when sure, D-131), class (clothing by the founder's four classes, D-132), packed (food: its net quantity plus its pack, D-133; home: the piece's own weight plus its packing, D-134); a listing goes live only when every option has a weight (D-129) | `product_variants.weight_source`, `weight_note`, `WEIGHT_SOURCES` |
| **clothing class** | the founder's four clothing weights: light 350 g, medium 750 g, pants and footwear 800 g, heavy 1.5 kg (a kids' set medium); read from the listing's name, then its category (D-132) | `classifyClothing`, `CLASS_GRAMS`, `pnpm weights classes` |
| **net quantity / packed weight** | food's net quantity is what its label states ("400 g", "2 × 200 g"), shown to customers; its packed weight is the net quantity plus its pack (pouch, box, jar, tin, bottle), what the courier bills and the price uses (D-133) | `product_variants.net_qty`, `weighFood`, `PACK_TARE`, `pnpm weights food` |
| **weight estimator** | the laptop tool that gives listings a packed weight from a local model and the most similar known weights; a sure one becomes the weight, an unsure one a suggestion (D-131) | `tools/weight-estimator`, `pnpm weights`, `product_variants.weight_estimate_g` |
| **profit guard** | the floor under every automatic price: the margin must pay US duty and the card fee and still leave the type's minimum profit (D-119) | `duty_<type>_pct`, `min_profit_*`, `guard_card_fee_pct` |
| **shipment** | the US domestic parcel sent to a customer (with tracking number) | `orders.tracking_number`, status `shipped` | "Shipped" | export |
| **delivery window** | the from/to dates promised before payment (D-008) | `orders.est_delivery_from/_to` | "Arrives Oct 30 – Nov 4" | ETA (in customer copy) |
| **desk** | which side an admin works: `us` or `india` (D-007) | `profiles.desk` | never shown | team, side |
| **store view** | a DB view or function that exposes only customer-safe columns (D-017) | `store_*` | — | public table |
| **shop price** | what IWC pays the vendor per piece, in paise. **Admin only** | `*_paise` | never shown | cost (ambiguous) |
| **landed cost** | shop price × FX + share of freight and duty | pricing module | never shown | — |
| **draft content** | text drafted by Claude, awaiting founder approval (D-019) | `content_status = 'draft'` | hidden until approved | — |
| **placeholder** | fake dev/demo data, must never reach production | `is_placeholder = true` | — | mock, dummy |
| **founder / COO** | the two admins (D-007) | `role = 'admin'` + `desk` | never shown | staff, owner |
