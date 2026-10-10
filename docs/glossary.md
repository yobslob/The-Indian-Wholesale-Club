# Glossary: one word per concept, everywhere

Use these exact words in the DB, code, folders, routes, tests and docs. The "Don't use" column lists synonyms that cause
confusion. If you need a concept that isn't here, add it (and a decision if it's a business rule).

| Term | Meaning | In code / DB | Customer copy | Don't use |
|---|---|---|---|---|
| **region** | one of India's 28 states or 8 UTs, all treated the same (D-002) | `regions`, `region_id`, `/states/[region]` | the region's name; "state", "home" | `state` in code (clashes with React state and the US address field), province |
| **product** | a sellable item as customers see it ("Kasavu saree") | `products` | product name | item, listing |
| **variant** | one buyable option of a product (size/colour or weight), with its own SKU and stock | `product_variants` | size / weight picker | SKU as a synonym for variant |
| **product type** | `clothing` or `spice`. Decides which attributes and options apply | `product_type` | "Clothing", "Spices" | kind |
| **category** | a browse group inside a type (Sarees, Kurtas, Masalas…) | `categories` | category name | collection |
| **vendor** | a shop in India that supplies pieces. **Admin only** (D-003) | `vendors`, `vendor_id` | never shown | supplier, seller, merchant, shop (in code) |
| **vendor account** | the sign-in of a vendor's owner (D-102): uploads their own pieces, sees only their own | `profiles.role = 'vendor'`, `vendor_accounts`, `is_vendor()`, `vendor_*` functions, `/vendor` | never shown (vendor copy: "your shop") | retailer, partner, seller account |
| **house model** | one of the founder's 10 AI-generated, licensed models (6 women, 4 men) who wear the pieces in AI photos, each in two poses: front and back (D-101, D-104) | `house_models` | never named | mannequin, avatar |
| **photo job** | one queued run of the photo pipeline for one product view (D-103) | `photo_jobs` | never shown | task |
| **cycle** | one round: take orders → cutoff → collect from vendors → export → arrive in the US → deliver. One export every 20–23 days (D-005). **Admin only** | `cycles`, `cycle_id` | never shown. Customers only see dates | batch, shipment |
| **cutoff** | the last moment an order joins the current cycle | `cycles.cutoff_at` | "Order by <date>" (D-035) | deadline |
| **export** | the physical India → US consignment of a cycle (AWB, customs) | fields on `cycles` | never shown | shipment (reserved for the US parcel) |
| **pickup** | collecting one ordered piece from its vendor. **Admin only** | `pickups` | never shown | collection, sourcing |
| **payout** | a payment in INR to a vendor for collected pieces. **Admin only** | `vendor_payouts` | never shown | settlement |
| **shipment** | the US domestic parcel sent to a customer (with tracking number) | `orders.tracking_number`, status `shipped` | "Shipped" | export |
| **delivery window** | the from/to dates promised before payment (D-008) | `orders.est_delivery_from/_to` | "Arrives Oct 30 – Nov 4" | ETA (in customer copy) |
| **desk** | which side an admin works: `us` or `india` (D-007) | `profiles.desk` | never shown | team, side |
| **store view** | a DB view or function that exposes only customer-safe columns (D-017) | `store_*` | — | public table |
| **shop price** | what IWC pays the vendor per piece, in paise. **Admin only** | `*_paise` | never shown | cost (ambiguous) |
| **landed cost** | shop price × FX + share of freight and duty | pricing module | never shown | — |
| **draft content** | text drafted by Claude, awaiting founder approval (D-019) | `content_status = 'draft'` | hidden until approved | — |
| **placeholder** | fake dev/demo data, must never reach production | `is_placeholder = true` | — | mock, dummy |
| **founder / COO** | the two admins (D-007) | `role = 'admin'` + `desk` | never shown | staff, owner |
