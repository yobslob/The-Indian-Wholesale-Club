# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-108 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept), and get a one-line index entry when they are older than a month.

**By:** `founder` = binding · `approved` = Claude's proposal the founder approved · `proposed` = awaiting the founder.
To change a decision, add a new one (`Supersedes D-xxx`) and mark the old line `SUPERSEDED by D-yyy`.

## Index (full text in the archive)

- **D-001** 2026-09-27 · founder: Users, emotion, competition
- **D-002** 2026-09-27 · founder: Regions are the core concept, all 36 treated the same
- **D-003** 2026-09-27 · founder: No operations info on the customer side
- **D-004** 2026-09-27 · proposed: Honest origin labelling; the old "stealth origin" layer is removed forever
- **D-005** 2026-09-27 · founder: Order-first supply in cycles
- **D-006** 2026-09-27 · founder: Hidden admin on web and app
- **D-007** 2026-09-27 · founder: Two operators
- **D-008** 2026-09-27 · proposed: Delivery estimates come from cycle data and are honest
- **D-009** 2026-09-27 · founder: Brand
- **D-010** 2026-09-27 · founder: The app shares the web's backend
- **D-011** 2026-09-27 · founder: Speed and real tests are top requirements
- **D-012** 2026-09-27 · founder: The docs must stop the model from inventing things
- **D-013** 2026-09-27 · founder: Claude may reset the hosted Supabase dev DB
- **D-014** 2026-09-27 · founder: Git
- **D-015** 2026-09-27 · proposed: Keep the stack, rebuild how it's used
- **D-016** 2026-09-27 · proposed: In code, a state or UT is a `region`
- **D-017** 2026-09-27 · proposed: Customer reads only through `store_*` views/functions
- **D-018** 2026-09-27 · proposed: Shops never get logins. · SUPERSEDED by D-102
- **D-019** 2026-09-27 · proposed: Claude-drafted content is marked `draft`
- **D-020** 2026-09-27 · proposed: Squash the 13 old migrations into one new baseline
- **D-021** 2026-09-27 · proposed: Verification runs on the founder's machine
- **D-022** 2026-09-28 · founder: Couriers are also expensive
- **D-023** 2026-09-28 · founder: The docs and all `proposed` decisions are approved
- **D-024** 2026-09-28 · founder (was Q-1): Order-first only
- **D-025** 2026-09-28 · founder (was Q-2): Retail to consumers.
- **D-026** 2026-09-28 · founder (was Q-3, first half): No fixed lead times
- **D-027** 2026-09-28 · founder (was Q-4): The COO is a full admin
- **D-028** 2026-09-28 · founder (was Q-5, first half): No returns/exchanges flow in the restructure. SUPERSEDED by D-071
- **D-029** 2026-09-28 · founder (was Q-6): Payout records
- **D-030** 2026-09-28 · founder (was Q-7): Piece unavailable at pickup
- **D-031** 2026-09-28 · founder (was Q-8): Local Supabase via Docker
- **D-032** 2026-09-28 · founder (was Q-10, first half): Spice listings stay unpublished
- **D-033** SUPERSEDED by D-073 · 2026-09-28 · founder (was Q-11): Sales tax is a flat 8% estimate for now.
- **D-034** 2026-09-28 · founder (was Q-12): "Preparing your order"
- **D-035** 2026-09-28 · founder (was Q-13): The home page may show "Order by <date>"
- **D-036** 2026-09-28 · founder (was Q-14): USD only, no compare-at prices.
- **D-037** 2026-09-28 · approved: Keep `node:test` + `tsx` as the unit-test runner
- **D-038** 2026-09-28 · approved: The order is created from the checkout the server stored, never from the browser
- **D-039** 2026-09-28 · approved: `/admin` is not named in robots.txt
- **D-040** 2026-09-28 · approved: Shipping charge is a setting, empty until the founder decides (Q-16)
- **D-041** 2026-09-28 · founder (was Q-16): Standard shipping is free, express shipping is $8
- **D-042** 2026-09-28 · founder (was Q-17): Refunds
- **D-043** 2026-09-28 · Claude, proposed (R6): what the app does itself and what goes through the website's server
- **D-044** 2026-09-29 · Claude, proposed (R7): deploys are manual, CI is the gate
- **D-045** 2026-09-29 · founder (was Q-20): Cycles close and open on their own; the admin mirrors what happened physically
- **D-046** 2026-09-29 · founder (was Q-9, in part): Vercel until launch; domain and support email at the very end
- **D-047** 2026-09-29 · founder (was Q-15): Estimates for the pricing settings until the founder's own research
- **D-048** 2026-09-29 · founder (was Q-18): Express delivery takes 15–18 days
- **D-049** 2026-09-29 · founder: Design direction for the storefront · PARTLY SUPERSEDED by D-050
- **D-050** 2026-09-30 · founder: Direction A chosen, symmetric grid below the hero, fonts · fonts SUPERSEDED by D-079
- **D-051** 2026-09-30 · founder: Mockup v3 - map hover delay, headline options, Helvetica Neue, region and product page sections · Helvetica Neue SUPERSEDED by D-079
- **D-052** 2026-09-30 · founder (was Q-21, Q-24, Q-25; part of Q-23): Headline, photo hero, fonts fallback, album, reviews check · fonts fallback SUPERSEDED by D-079
- **D-053** 2026-09-30 · founder: Hero photo as the full background, only the name and the heading · phone fade SUPERSEDED by D-079
- **D-054** 2026-09-30 · founder: Wider hero photo, behind the nav bar too, no white space · nav on a dark fade SUPERSEDED by D-079
- **D-055** 2026-09-30 · founder (was Q-26): Hero crop and label; the hero image is AI-generated and IWC has the rights; C1 build starts · crop and label SUPERSEDED by D-079
- **D-056** 2026-09-30 · founder (part of Q-22, was Q-23): Curated for you, Leaving soon, reviews; region photos
- **D-057** 2026-09-30 · founder (was Q-27): Rights to the supplied photos; the kasavu product photos
- **D-058** 2026-09-30 · founder (was Q-22): Most wanted = most pieces ordered in the last 30 days
- **D-059** 2026-10-01 · founder: The six launch regions, the voice for drafted copy, the catalogue
- **D-060** 2026-10-01 · founder (was Q-28): Items loved in one state but made in another stay on that state's page
- **D-061** 2026-10-01 · founder (was Q-29): No brand names
- **D-062** 2026-10-01 · founder: Horizontal rows everywhere, "See all" opens the full list
- **D-063** 2026-10-03 · founder: The next cycle's dates come from a "days between cutoffs" setting
- **D-064** 2026-10-03 · founder: A piece that leaves earlier is first offered as discounted faster delivery
- **D-065** 2026-10-03 · founder: A payment that lands seconds after the cutoff still joins that cycle
- **D-066** 2026-10-03 · founder (narrows Q-3): Tracking links for USPS, UPS and FedEx while the carrier is undecided
- **D-067** 2026-10-06 · founder: Long lists load a page at a time
- **D-068** 2026-10-06 · Claude, under D-011 (speed is a feature), proposed: speed and concurrency rules from the audit
- **D-069** 2026-10-06 · founder: A pilot shipment first; Claude sets every number at the high end until the real costs are known
- **D-070** 2026-10-06 · founder (was Q-18, with D-048): Air only; standard goes through the US warehouse, express goes door to door
- **D-071** 2026-10-06 · founder (was Q-5): Returns: full refund for our mistakes, otherwise a deduction that grows with time
- **D-072** 2026-10-06 · founder (was Q-31): Cancel until the order leaves India; after that, customer care only, with a deduction, and the piece goes to a US clearance sale
- **D-073** 2026-10-06 · founder (was Q-19): Sales tax as the law sets it; the business is registered in New Jersey
- **D-074** 2026-10-06 · founder (was Q-10, Q-30): Spices compliance and the invoice details are in hand; placeholders until after deploy
- **D-075** 2026-10-06 · founder: Prices in dollars follow from the rupee price automatically, with live rates
- **D-076** 2026-10-06 · founder (was Q-33): A return is collected from the customer's door, the way it was delivered
- **D-077** 2026-10-07 · founder: The logo text: the I of "Indian" inside an outline of India; "Indian Wholesale Club"
- **D-078** 2026-10-07 · founder: The first cycle is a demo round on the placeholder catalogue, then cleared
- **D-079** 2026-10-08 · founder: The shell (header, banner, footer, app tab bar) and the Home hero, from the design pass; Cinzel and Karla · header colour, "no blur" and heading font amended by D-080
- **D-080** 2026-10-08 · founder: Home below the hero, the header on the photo as before, Syne for headings, stamp pages
- **D-081** 2026-10-08 · founder: The region page, from the design pass
- **D-082** 2026-10-08 · founder: The product page, from the design pass
- **D-083** 2026-10-08 · founder: The States page is Home's Pick your home; the app screens get their own pass after the website
- **D-084** 2026-10-08 · founder: Clothing and Spices (the See all page), from the design pass · pinned row's blur amended by D-098
- **D-085** 2026-10-08 · founder: The search page, from the design pass
- **D-086** 2026-10-08 · founder: The bag, from the design pass
- **D-087** 2026-10-08 · founder: Checkout as phone → delivery → payment, and the thank-you page, from the design pass
- **D-088** 2026-10-08 · founder: Order tracking, from the design pass
- **D-089** 2026-10-08 · founder: The profile (account) page, from the design pass
- **D-090** 2026-10-08 · founder: Writing a review, from the design pass
- **D-091** 2026-10-08 · founder: Signing in, from the design pass
- **D-092** 2026-10-08 · founder: The info pages as a glass panel on the same page, from the design pass
- **D-093** 2026-10-08 · founder: The not-found and error pages, from the design pass
- **D-094** 2026-10-08 · founder: The customer emails, from the design pass
- **D-095** 2026-10-08 · founder: The app's customer screens, from the design pass
- **D-096** 2026-10-08 · founder: The web admin, from the design pass
- **D-097** 2026-10-08 · founder: The app's admin mode, and building the whole design pass
- **D-098** 2026-10-08 · founder: No blur on the pinned state row; the ZIP lookup from our own list
- **D-099** 2026-10-09 · Claude, under D-011 (speed is a feature) and D-068, proposed: the second speed audit, after the design pass
- **D-100** 2026-10-10 · founder: Product photos: the close-up is the real photo; the details say the model photo is AI-generated
- **D-101** 2026-10-10 · Claude, proposed: The product photo pipeline runs on the founder's GPU, free models only
- **D-102** 2026-10-10 · founder (was Q-34): Vendors get their own sign-in; the photo pipeline is approved · Supersedes D-018
- **D-103** 2026-10-10 · Claude, proposed: How vendor accounts and the photo worker are built
- **D-104** 2026-10-10 · founder: The house models are the founder's own; two poses, two photos
- **D-105** 2026-10-10 · founder + Claude, proposed: The vendor integration as built; women_black chosen
- **D-106** 2026-10-11 · founder: A third product type, Home & gifts (amends D-002)
- **D-107** 2026-10-11 · founder: Spices are introduced on the store
- **D-108** 2026-10-11 · founder: The production inventory is replaced by the master catalogue, as placeholders · loader removed by D-110

## Recent (full text)

**D-109 · 2026-10-11 · founder: The pilot price follows the shop's own price (Amazon → door)**
Recorded on 2026-10-12 from migration `supabase/migrations/20261011120000_pilot_pricing.sql`; the founder's words
were not filed when it was built, so the numbers below are the ones that migration saved as the founder's.
While the pilot runs, a piece is bought from an Indian online shop, repacked and sent to the customer by courier, so
its price is: India cost = shop price × (1 + India handling %); landed $ = India cost ÷ effective rate + packed kg ×
shipping allocation (₹/kg ÷ effective rate); price = (landed × (1 + margin %) + card fee per payment) ÷ (1 − card fee
%), rounded up to .29 / .49 / .79 / .99. The effective rate is the day's rate less the safety buffer (D-075).
Numbers: India handling 10%, shipping allocation ₹1,461/kg, margin 50%, buffer 4%, card fee 3.4% + $0.30;
shipping is free and the smallest order is $149.99. Replaces D-075's formula while the pilot runs; the retailer model (D-005) keeps
its settings.

**D-110 · 2026-10-12 · founder: Pilot listings come from Indian online shops; "spice" becomes "food"**
Founder, verbatim: "the final model of my website is retailer to customer(which you will find in the docs). Before
doing that I will be running some pilot shipments. Therefore, I will be putting such inventory on the website which
will be directly linked to products already on the web. For example a saree on myntra will be listed on my website
too so as soon as the us customer orders it, I will order it to my hub and as soon as it reaches my hub(1-10 days) I
will ship it to US by air(8-11 days), So now sort me some way in which I can put up all those products onto my
website(with their original photo, description and their current price on its website.)" · "Update spice with
food/edibles or whatever name because its not just spices its everything like mdh masale bhujiya and everything." ·
"clean the codebase in a formatted way and keep things how you want them to be."
What it means for the build:
- **Import from shops** (`/admin/import`, admin only): an "Add to IWC" bookmark reads a product page in the admin's
  own browser (Myntra, Amazon India, Flipkart, any shop with schema.org data); pasted links are read by the server
  where the shop allows it. The admin checks state, type, category, the details customers must see, photos and sizes,
  then saves. Photos are copied into our storage; the shop's price is the shop price (`shop_price_paise`) and the
  dollar price follows D-109. Importing the same page again updates that listing's price, sizes and check date.
- The source (`products.source_url`, `source_site`, `source_checked_at`, `source_in_stock`) and the online shop's
  vendor (`vendors.online_site`, one per shop and state) are admin-only (D-003). The cycle's pickup cards link to the
  page, so a sold piece is ordered there to the hub.
- The product type `spice` is renamed `food` (label "Food", page `/food`, `/spices` redirects); "Food is cleared"
  replaces "Spices are cleared" (D-074). Brand names on imported listings are kept as the shop shows them (this
  narrows D-061 to IWC's own listings).
- The codebase was cleaned for shorter sessions: history moved to `docs/archive/`, `docs/plan/current.md` is a short
  status, the failed 2,880-row master catalogue loader (D-108) is removed.
*Claude's choices in it (proposed, the founder confirms or changes):* the name "Food"; 5 pieces offered per size by
default (the shop's own stock is unknown, so this is only a cap until the next price check); the state is never
guessed silently (a pre-filled guess from well-known craft names, confirmed by the admin, D-004). The hub timings
(1–10 days to the hub, 8–11 days by air) are the founder's; customer delivery dates still come from cycle data (D-008).

**D-111 · 2026-10-12 · founder: Margins by product type; small orders pay their charges instead of a minimum; the free-delivery bar**
Founder, verbatim: "we also figured out some amazon types numbers, which consists of 10% safety buffer on Indian side
then a dynamic(50% on clothing, 25% on edibles and 60% on home and decor) profit margin which basically includes all the
taxes and costs and yet saves us some profit. We have to handle and figure this out in a dynamical solution. The package
side is clear as it will be around 5kg or more because the minimum shipment we have set is 149.99$ so the user has to
select 3-4 items. And don't do the "you can't order below 149.99", instead add charges and show it like shipping charges
and retailer charges and they both will cover the cost if a single package has to be ordered from india to usa just keep
the profit margin on below 149 orders low so they don't overprice. and strikethrough the shipping charges and retailer
charges as soon as cart goes above 149 but silently we are adding all those costs in the item itself. So basically keep
it profit productive in each case without getting too overpricy. On a little note I have added how a little popup should
look like once the user has added one item. this popup will keep showing dynamically how much the user needs to add for
free shipping" (with a screenshot of a bar: "Add ₹72 more to unlock FREE DELIVERY", a progress line, "CART 1 ITEM", the
item's photo and an arrow).
What it means for the build (migration `supabase/migrations/20261012120000_pilot_charges.sql`):
- The pilot price (D-109) takes the product type's margin: clothing 50%, food 25%, home & gifts 60% (Settings, one
  field each; `margin_pct` is the fallback). India handling stays the 10% buffer. Every automatic price follows.
- D-109's smallest order goes. Below the free-shipping line ($149.99) the bag, checkout and the order show
  **Shipping** (one courier parcel of the bag's weight at the founder's quoted rates, ₹2,242 for the first kg and
  ₹678.50 for each further kg incl. GST, less the shipping already inside the item prices) and **Retailer charges**
  (the shop's delivery to the hub and the packing of one parcel), both with a low small-order margin and card fees.
  From the line up both show struck through and "Free": the item prices carry the costs. `store_bag_charges()` works
  them out where the weights are (INV-1); checkout charges them on the server.
- The **free-delivery bar**: once a piece is in the bag, a card at the bottom of every store page (web) and above the
  tabs (app) says how much more unlocks free delivery, with a progress line, the bag count and the newest photo; it
  opens the bag. In the brand colour, not the screenshot's blue.
*Claude's choices in it (proposed, the founder confirms or changes in Settings):* the small-order margin 10% and the
retailer charges ₹150 per parcel (labelled estimates); the shipping allocation inside prices stays ₹1,461/kg (the
2 kg slab, D-109) although the founder expects parcels around 5 kg, so heavier parcels earn a little more; a promo that
takes a bag under the line brings the charges back; express (D-070) has its own fee and no small-order charges.


**D-112 · 2026-10-12 · founder: Card fees are inside the margins; the small-order charges are fixed and show $0.00 when waived**
Founder, verbatim (asked why prices came out high): "The prices are a bit off, I don't know what factor is affecting
that but Clothing is always off by 2 or 3 dollar and food products are expensive by 60 or 70 cents. Change something
so this fixes." Claude found the card fee (3.4% + $0.30, charged on every piece) added on top of the type margin and
asked whether the margins already cover card fees: "1. yes."
On checkout: "We don't have to make the shipping and retailer charges variable, they basically do not change. As soon
as 149.99 hits they both get strike through and instead of free show 0.00." Asked for the two amounts (today's
charges for one piece): "2. yes 18.79 and 1.99 works".
What it means for the build (migration `supabase/migrations/20261012140000_fixed_small_order_charges.sql`):
- The pilot price is landed × (1 + the type's margin), up to .29 / .49 / .79 / .99: no card fee on top. Every automatic
  price follows (the kurta of D-109 goes from $39.29 to $37.49, the 250 g food pack at 25% from $9.29 to $8.79).
  `card_fee_pct` and `card_fee_fixed_cents` stay as columns for the retailer model (D-005) and leave the pilot's
  Settings.
- Below the free-shipping line ($149.99) any bag with a piece from India pays **Shipping $18.79** and **Retailer
  charges $1.99**, whatever its weight (Settings, `small_order_shipping_cents`, `small_order_retailer_cents`). From the
  line up both are struck through with **$0.00** beside them, never "Free". D-111's courier rates, parcel handling and
  small-order margin go. Checkout's summary shows both charges from the first step (tax after the address).
- "$0.00" replaces "Free" wherever a shipping amount is shown (bag, checkout, shipping choice, orders, the email).
Supersedes D-111 in part (the charge formula and "Free"; its type margins and free-delivery bar stay).
