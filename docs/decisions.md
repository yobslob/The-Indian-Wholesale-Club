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
- **D-004** 2026-09-27 · proposed: Honest origin labelling; the old "stealth origin" layer is removed forever · the state is optional since D-121
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

**D-109 · 2026-10-11 · founder: The pilot price follows the shop's own price (Amazon → door)** · formula SUPERSEDED by D-119
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

**D-111 · 2026-10-12 · founder: Margins by product type; small orders pay their charges instead of a minimum; the free-delivery bar** · margins amended by D-119
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


**D-112 · 2026-10-12 · founder: Card fees are inside the margins; the small-order charges are fixed and show $0.00 when waived** · formula SUPERSEDED by D-119; charges amended by D-123
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

**D-113 · 2026-10-12 · founder: Home's moving album of all of India; the header's Search grows into a search bar**
Founder, verbatim: "On the home page, move just listed under the map section, in place of just listed will be replace
a moving global grid." Asked what the grid is: "by a moving global grid i mean the same as the individual states have
it." with this art direction: "Oversized artwork photography arranged like a contemporary gallery wall. Uneven spacing,
offset images, floating compositions, and intentional negative space. Lenis smooth scrolling with gentle vertical
parallax and velocity-based movement. Images reveal through subtle clipping and scale transitions. Minimal typography
with a sophisticated art-direction aesthetic."
And: "make the search button visible and bigger and minimalistic. (swap states and search button) as soon as the person
scrolls down the search button will animate into a long search bar."
What it means for the build (migration `supabase/migrations/20261012150000_home_album.sql`):
- Home (web): hero → the album → Pick your home → Just listed. The album is the region pages' drifting mosaic (D-051,
  D-052, `features/regions/region-album.tsx`) fed by `store_home().album`: the states' album photos first, one state
  at a time in turn, then the main photo of each state's newest pieces the same way, up to 30. It opens with the
  site's clip-and-scale reveal and floats with a gentle parallax (Lenis and both effects already ran site-wide, D-049).
- Header (web, tablet and desktop): Search · States · About us. Search is a 44 px pill with its icon and word; once the
  page is scrolled it grows into a long search bar (also on hover, focus and while typing); still on reduced motion.
*Claude's choices in it (proposed, the founder confirms or changes):* products fill the album while few state photos
exist (it stays not clickable, like the states' album); phones keep search in the menu; the app's Home keeps its order.

**D-114 · 2026-10-12 · founder: Checkout saves the address and offers the saved ones**
Founder, verbatim: "Also fix how once I Sign in and make one payment after going through those 3 steps it should be
saved as an address which can be used again and if there is already an address saved it can be used, look into this
part and how the functioning is broken."
What was there: checkout never read the saved addresses and never saved the one used; addresses lived only on Profile →
Addresses. Orders were linked to the account when signed in.
What it means for the build:
- Signed in, `/checkout` reads the customer's email and saved addresses on the server (`features/checkout/saved-details.ts`).
  The default (else the first) fills the delivery form and its phone fills step 1, so checkout opens at Delivery; the
  other saved addresses are radio cards above the form, and "A new address" empties it.
- A signed-in customer's paid order adds its address to their saved addresses unless the same street, unit and ZIP is
  there; the first one becomes the default (`rememberOrderAddress`, called once when the order is created; a failure
  is logged and never fails the order).
*Claude's choices in it (proposed):* the phone is saved with the address; the app's checkout is unchanged (its orders
save the address too, but it does not offer saved ones yet).

**D-115 · 2026-10-12 · founder: The pilot is made to order: no cycles, delivery 12 – 18 days from the order** · amends D-008
Founder, verbatim: "you have to know now there is no cutoff in pilot now because as soon as the user  orders I buy it
from the specific website and ship it to us so there is no cutoff or cycles, for now it should show delivery in 12-18
days. For now take all control over yourself dont ask me to do anything and fix checkout"
Why checkout stayed closed: it opens only with a delivery window, which came from an open cycle (D-008).
What it means for the build (migration `supabase/migrations/20261012160000_pilot_made_to_order.sql`):
- Settings → Standard delivery: "Pilot, made to order: delivery days from the order" 12 to 18 (`pilot_delivery_days_min`,
  `_max`). While both are set, every window the store shows (home stamps, product pages, checkout) is today + those
  days with no "order by", and a standard order needs no cycle: none on the order, its pieces on the pickup list at
  once (like express, D-070), to be ordered online (D-110). Emptying either day brings the cycle model back unchanged.
- Non-negotiable 4 now reads: delivery dates come from cycle data or, in the pilot, from its days in Settings; never
  hard-coded. Standard shipping is set to $0 where it was empty (D-041), which also kept checkout closed.
*Claude's choices in it (proposed):* the window counts calendar days from the order date; express keeps its own days.

**D-116 · 2026-10-12 · founder: A polish pass on every element before launch (website and app)**
Founder, verbatim: "Everything is live and working, now we have to design the exisiting frontend sleekly because we are
at the last step of going live now we have to design this website professionally and I am not talking about big
changes, I am talking about all the individual elements, their ergonomics, their usability and design, the minimilism,
their interactivity, for e.g. the free delivary bar card is too big, it should be like a pill and the filling bar
should be more creative like it should show a light glow filling up as soon as user adds something. This was just an
example, you have to find things yourself in website, webapp and phone app. also remember to keep these designs
flabbergasting and new such as we did in the grid(floating composition, lenis smooth scrolling with gentle vertical
parallax, velocity based movements, art direction aesthetic similarly find more of these and apply wherever applicable)
we don't necessarily have to make the website too much but we can find a lot of scope of designing in different parts
of the website."
What it means for the build: layouts stay as approved (D-079 – D-098); single elements get sharper, smaller and more
alive. Motion follows design.md's guard rails (CSS or the Web Animations API on the web, Reanimated in the app; nothing
for reduced motion; only transform and opacity in loops).
- **Free-delivery pill (web and app):** D-111's card becomes a 56 px pill: the newest photo in a circle with the count,
  one line of text, a chevron. The pill is the meter: a soft light fills it from the left with a glowing edge that
  breathes, flares each time the bag grows and gives way to one sheen at the line. The bag's summary shows the same
  meter as a slim line under "Add $x more for free delivery". Phones say "more for" instead of "more to unlock".
- **Adding to the bag:** the piece's photo flies in an arc to the header's bag, which bounces, and its count pops. The
  product page's Add to bag flips to "✓ Added" for a moment; its quantity dropdown becomes the bag's − / + stepper.
  The card's + turns a quarter on hover; once added it fills with the brand colour, the check draws itself and a ring
  ripples out.
- **Bag page:** the totals and Checkout sit together under the prices' column on wide screens (Checkout was at the far
  edge from the totals); primary buttons give under the finger.
- **Header:** the links' underline draws in from the left.
- **Velocity drift:** product grids' columns and the cards of sideways rows fall behind or run ahead by their own
  amount while the page scrolls fast (Lenis's velocity, at most 24 px, half on phones) and close again as it settles.
- **Section headings** of the rows rise out of a mask as they come into view; "See all" gets an arrow that nudges.
- **Region page:** the sticky section pills follow the reader: the section in the middle of the screen has its pill
  filled in ink, slid into view.
- **Product page:** Details and Size chart open smoothly and the + folds into a −; "In stock" has a slow breathing dot;
  the region · type · category line gets even spacing.
- **Region page greeting:** the greeting in the state's own script writes itself in, left to right, as the page opens.
- **Checkout:** a finished step's check draws itself and the next step's content rises in.
- **Panels and fields (web):** the menu's links and the bag panel's lines slide in one after another as the panel
  opens; a text field being typed in gets a soft brand halo.
- **App:** the same free-delivery pill above the tabs (Reanimated; the glow is drawn with layered halos so Android
  shows it too) and the same meter line in the Bag's summary, whose Subtotal now lines up with the rows under it. The
  tab bar's brand marker glides to the chosen tab, the current tab's icon is filled and springs, the bag count pops
  when it grows. The card's + squeezes under the finger and springs back filled with the brand colour. Explore's
  States · Clothing · Food · Home & gifts are sized by their words, so "Home & gifts" is no longer cut off.
*Claude's choices in it (proposed):* everything above; each is its own small change and can be undone alone.

**D-117 · 2026-10-12 · founder: The free-delivery bar fills sideways; phones get Search for Saved; layout fixes** · amends D-116, D-079
Founder, verbatim: "1. I want the same thing in the free delivery pill but currently it is a vertical line, I want a
horizontal bar which fills up. 2. The frame bleeds on the website, make it responsive properly(it might be due to the
grid or I dont know) 3. a subtle whitish cloudy blur can be seen on both ends of the grid on home as well as the state
page, remove that 4. On almost every page there is white empty space below the footer. 5. In phone view there is no
search icon replace the wishlist with search icon when clicked it takes over the navbar. 6. find more crashes"
What it means for the build:
- **Free-delivery pill (web and app):** D-116's light fill with a vertical glowing edge goes. Under the pill's line of
  text a slim bar fills from the left: a glowing head at its end that breathes and flares on each add, and a shimmer
  running through the filled part; full at the line, then one sheen across the pill. The bag's summary uses the same
  bar in brand on cream.
- **No sideways bleed:** photos below the fold wait for their reveal at 106 %, and Home's full-width album at 106 %
  pushed the page 43 px past the window (production, 1440 wide). The page now clips anything wider than the window
  sideways (`overflow-x: clip` on html and body; sticky still works).
- **No fade at the album's ends:** the album's mosaic (Home and state pages) no longer fades out to the page colour at
  its left and right ends.
- **The footer ends the page:** on a short page the main part grows so nothing shows under the dark footer, and the
  room kept for the free-delivery pill is the footer's own padding instead of the page's.
- **Phones (under 768 px):** the header's heart becomes a search icon; a tap grows a search bar over the whole header
  bar (circle reveal from the icon, field focused, × or Escape closes, Enter opens /search). Saved moves into the menu
  panel's big links. Wider screens keep the heart.
- **Found broken (item 6):** on production every info link (About us, How it works, FAQ, Shipping & returns, Contact,
  Privacy, Terms) fell back to a full page load instead of the glass panel (D-092): Vercel's 5-minute re-render of the
  cached intercepted route answered 404, and each page view also sent seven failing prefetches. The panel routes now
  render on request and links to info pages are not prefetched.
**D-118 · 2026-10-13 · founder: Auto-sourcing from targets, variants of every kind, a weekly price and stock check**
Founder, verbatim: "Alright all of your csv is approved, your rules are correct, drop the held items, and now although
we have to preserve the bookmark process for the admin, but we will have to smartly automate the inventory ingestion,
so make something which picks the category say himachali rajma then finds it on the web then only adds those pieces to
iwc which provide under 2-3 days delivery for e.g. zepto, blinkit, bigbasket, instamart, amazon, flipkart, myntra for
clothes, oyela, nishorama, offduty. Also one addition, generalise the category on items like, different colors for
clothes, different types for edibles like i found different types which i attached. make something for this and also a
weekly check strictly on prices and stock of everything, if it changes on indian website(linked to product in backend)
then it changes on iwc too. Be very smart, optimal and efficient about this process." (with a screenshot of Amazon's
"Flavour Name" picker: Assorted, Chocolate Malai, Crushed Peanut, Malai and Mawa Malai Chikki, each with its own price).
The approved list is the state bestseller list of 2026-10-12 (282 products after the 14 "can't ship yet" rows were
dropped: Indian rice, fresh mithai, mustard oil).
What it means for the build (migrations `supabase/migrations/20261013090000_auto_sourcing.sql`, `..._0100_variant_prices`,
`..._0200_sourcing_worker`; the runner `tools/sourcing-runner`; the rules in `packages/shared/src/sourcing/auto`):
- **Targets** (`/admin/import/auto`): a name, the words to search and to require, a state, a type and category,
  a tier. The list is added from a CSV (the bestseller list's columns).
- **The sourcing runner** runs on a PC in India whose browser has the hub's address set on each shop. Per target it
  searches every enabled shop of that type side by side; keeps results that are the target (the target's words, and
  no other form of it: rajma masala is not rajma), in stock and reaching the hub within **3 days**; puts the same
  product on several shops together (the others are backup sources); reads the best pages and adds up to 3 listings,
  different brands first, each with all its items as variants and its photos copied. A page that shows its own
  delivery date (Amazon, Flipkart, quick commerce) must show one within the limit; shops whose pages don't (Myntra
  without a pincode, Shopify shops) count as the founder's 2–3 days. The bookmark import stays as it was and now keeps
  the page's variants with their own prices too.
- **Variants of every kind**: a variant's options are colour, flavour, type (`style`), pack and size; the product page
  shows one row per option that differs. A variant can have its own shop price (`product_variants.shop_price_paise`)
  and is priced from it at its own weight; the product shows its lowest variant price.
- **The weekly check**: every sourced listing (found or imported by hand) is read again every 7 days, each page once.
  Prices follow the shop; a variant sold out on its shop stops selling (pieces already ordered stay reserved) and comes
  back when the shop has it again; the cheapest in-stock source within the delivery limit is the one the India desk
  orders from; a new flavour or pack on the page becomes a new variant; a page unreadable twice stops that source.
- None of it reaches customers (D-003): sources, shops, targets and runs are admin and worker only, and the listing's
  words are cleaned of every mention of the shop, delivery, returns and offers.
*Claude's choices in it (proposed, the founder confirms or changes in the admin):* 3 listings per target; a price that
rises more than 60% or falls more than 50% since the last check is held for an admin instead of followed (a wrong pack
or a page error, not a real price); 5 pieces on sale per variant while the shop has it (D-110's cap); 40 targets per
daily run; a target with nothing found is searched again after 30 days; new listings wait as drafts until an admin
publishes them ("go live by themselves" is a switch), and go live only with a photo and every detail customers must see.
Nishorama's shop address (`nishorama.com`) and its platform are assumed until the first run shows them.

**D-119 · 2026-10-14 · founder: The pilot price in two recipes, a profit guard, and a bulk saving that stops at a cap** · small food amended by D-120, D-122; restored by D-125
Founder, verbatim: "we are close enough to the pricing still we are running in loss as we have a risk of going
underpriced, we have to tune the pricing more. The flow of indian product price, then 10% indian safety buffer, then air
shipping and then 50% margin on overall is working but we still have to keep the price in mind. Figure something out
smartly that the price tunes in more." Asked how US duty is paid: "It should get paid in the 50% profit margin". After
the first tuner: "why are you stressing out on customer ordering just one snack of 90rs 100g when he definitely has to
pay 20$ shipping so why are you charging the 3.49$ to 4.49$ 2. then the mid range are good 3. then the heavy ones as more
and more and heavier total bag gets, you decrease the total cost, instead put a saturation point after which no matter
how much the customer is adding orginal price will be totaled(the customer will have a notion that the more they add the
more discount they will get.) rest is good, I feel like we wont be going in loss in any condition." The founder's own
formula: "Adjusted shop price = Shop price ÷ 0.90 Shipping cost = Weight in grams ÷ 100 × ₹146(constant shipping) Total
cost = Adjusted shop price + Shipping cost Selling price in INR = Total cost ÷ Category factor (food 0.75, clothing 0.50,
home decor 0.40 margins) Selling price in USD = Selling price in INR ÷ USD exchange rate". Then: "Okay give me the final
tuner which uses my formula but smartly on clothes and home decor and your very smart tuner on food." and "yes this
good now lay off a bit of cheaper foods and everything is good to go after making push the changes".
What it means for the build (migration `supabase/migrations/20261014090000_pilot_pricing_two_recipes.sql`):
- **Clothing and home & gifts** take the founder's formula: (shop ₹ ÷ 0.90 + g ÷ 100 × ₹146) ÷ rate, then ÷ (1 − margin):
  clothing 50%, home 60% of the price. A **taper** eases the margin on expensive pieces (clothing down to 38% from $20 to
  $150 of cost, home to 45% from $15 to $100), so a ₹12,000 lehenga is $296.49 instead of about $367.
- **Food** takes the cost-by-cost tuner: (shop ₹ + ₹15 fee) × 1.10 ÷ rate + billed kg (140% of the label) × the courier
  rate card (₹2,242 first kg, ₹678.50 each further kg, ₹1,050 per parcel) over a 5 kg parcel ÷ rate, × 1.25.
- **The profit guard** on every piece: duty is paid from the margin, as the founder said; a price is lifted only where
  the margin cannot pay US duty (clothing 22%, food 16%, home 13%, on what the customer pays) and the 2.9% card fee and
  still leave the minimum profit ($4 a piece for clothing and home, 8% of the price; food 4% and no dollar minimum, the
  "lay off a bit of cheaper foods").
- The exchange rate keeps its 4% safety buffer (D-075) and prices keep the .29 / .49 / .79 / .99 ending (D-109).
- **Bulk saving:** from the free-shipping line ($149.99) up, 10% of the amount over the line comes off the bag, up to
  $25; after that, pieces add at full price. The bag, checkout and the free-delivery bar (web and app) show it; checkout
  works it out on the server and the order keeps it inside its discount (`orders.bulk_saving_cents`, admin view).
- **Settings** lists every number in the groups above, with a profit check that reprices sample pieces and bags as they
  are typed. The small-order charges stay $18.79 + $1.99 (D-112).
*Claude's choices in it (proposed, the founder confirms or changes in Settings):* the duty rates (US MFN + India's 10%
Section 301 tariff; de minimis is suspended), the ₹1,050 per parcel (box + customs clearance), the food fee, parcel kg
and billed weight are estimates labelled in Settings until real bills replace them; duty is counted on what the customer
pays (a duty-paid parcel to a shopper is usually valued so), the safe side; the taper points, the minimum profits and
the bulk numbers come from the tuner the founder approved; customer order pages and emails show the bulk saving inside
"Discount" (the admin's order page shows it apart). Supersedes D-109's and D-112's formula; D-111's margins now mean a
margin of the price for clothing and home.

**D-120 · 2026-10-14 · founder: Small food on $1.99 – $3.99, and every draft published**
Founder, verbatim: "Alright Although I wanted to achieve total of 3000 items from all over india, but let's publish all
of these 307 drafts, also before this little update about this, some articles mostly like masala and very small priced
articles are shown 4.29, 7.29 which actually are of 1.99, 2.99,3.99 so limit them in this range, smartly"
What it means for the build (migrations `20261014120000_small_food_shelf.sql`, `20261014120100_publish_drafts.sql`):
- **The small-food shelf.** A food piece (each variant on its own) costing at most ₹200 at the shop and weighing at most
  250 g is priced on whole-dollar steps: **$1.99, $2.99, $3.99**. Its goods are priced as in D-119 (shop ₹ + fee, × 1.10,
  ÷ rate, × 1.25), plus only **half its shipping share** (a small bag pays its courier through the small-order charges,
  D-112), then up to the next step and at most $3.99; never below what its goods cost after duty and the card fee, and
  never dearer than its own D-119 price (raised to $1.99). At ₹96.30: ₹50 · 100 g $1.99, ₹90 · 100 g $2.99 (was $3.99),
  ₹100 · 100 g $2.99 (was $4.29), ₹100 · 200 g $3.99 (was $6.79), ₹150 · 250 g $3.99 (was $8.49). Heavier or dearer
  food, clothing and home keep D-119. All five numbers are in Settings (Small food shelf); an empty one turns it off.
- **What it costs (the profit check shows it):** a bag of only shelf packets past the free-shipping line loses (60
  packets of ₹90 · 100 g: −$14.85, the courier on 8.5 kg is not paid by $2.99 packets); the 20-piece pantry bag drops
  from +$22 to +$5; a bag of packets with clothing still makes money (12 packets + 2 kurtas: +$23.74).
- **Publish all drafts** (Products → Drafts): every draft with a photo, an active option and a piece to sell goes live
  at once, each on its own (food is refused only while not cleared, D-074); the rest stay drafts and are counted. Demo
  listings and US clearance pieces are not touched. Drafts go live even without every detail customers see (fibre and
  care, ingredients and allergens, material): the result counts them, to be finished on the product page.
*Claude's choices in it (proposed, the founder confirms or changes in Settings):* the ₹200 and 250 g limits, the 50%
shipping share, the steps a dollar apart (the founder named $1.99, $2.99, $3.99), skipping drafts with no photo, no
option or nothing to sell. The 3,000-listing goal is noted; the sourcing runner's targets and listings per target set
how fast it is reached (D-118).

**D-121 · 2026-10-14 · founder: Myntra ₹600 – ₹1,600 clothing for every state; the state tag optional; cheap home pieces priced right**
Founder, verbatim: "Alright now we have to target the 600-1600rs market (myntra clothing) and fill the inventory list,
keep the state tag optional on a product, if there is no tag, don't show it. And this  market should fill in all states
Also you have literally capped the home and decor items minimum at 60$ now disposables, toilet rolls, basket, 15-20$
things everything is listed around 60$ fix that."
What it means for the build (migration `20261014140000_all_india_and_bands.sql`):
- **The state is optional.** A listing may have no state (an *all-India listing*). The store never shows one for it:
  no state on its card, its page, the bag, orders or emails; the origin line reads "Made in India · Imported". It is
  never given an invented state (D-004).
- **All-India listings fill every state:** each state's page and See all show them after the state's own pieces (the
  counts include them); the page is `/states/india/<slug>`.
- **Targets with shops, a price band and a number of listings:** a target may be for all states, limited to some shops,
  kept to a shop price band (colours outside it are left out) and ask for its own number of listings. A page that names
  another country of origin is not listed. `tools/sourcing-runner/targets/myntra-600-1600.csv`: 79 Myntra targets,
  ₹600 – ₹1,600, all states (women's kurtas and sets, sarees, blouses, dupattas, lehengas, men's kurtas, sets, Nehru
  jackets, dhotis, footwear, kids), 10 – 25 listings each, about 1,170 listings with their colours and sizes.
- **Home & gifts without a weight** was priced at its category's typical weight (1.5 kg for decor, 2 kg for serveware),
  so a ₹200 basket came out at $62.29. Now it is priced at its shop price × 1.5 g per rupee, at least 200 g and at most
  the category's weight: ₹100 $10.99, ₹200 $17.99, ₹400 $35.79. A piece with its own weight is priced on it as before.
*Claude's choices in it (proposed, the founder confirms or changes):* all-India pieces after the state's own; the
address word `india`; the Myntra target list and its numbers; 1.5 g per rupee and 200 g (estimates in Settings);
nothing made outside India is listed. Myntra's listings reach the hub only if its delivery days (Auto-sourcing → Shops)
are within the limit (3 days).

**D-122 · 2026-10-14 · founder: Food priced in step with its weight, footwear like Amazon US, the pack on food cards, See all for every type, each state's own first row, food for every state**
Founder, verbatim: "slippers and jutis are all listed from 45-60$ while they are 30-40 on amazon us. also there is no
sense in picked numbers as 200gm bhujiya is 3$ but 400gm is 12$ and 1000gm is 29$ also add a tag of weight on the card
of food item so the person knows why one card is 2$ and another is 4. Also when see all is clicked only clothing is
opened, there is no way to go to food except manually type the address, so when see all is click there should be a
glass toggle button which can switch between clothing food and home decor. Next we are filling food items so I am
attaching a list which has to be filled. at least 5-8 products per object. [...] Also in Just listed, I should be
seeing that state's particular items, because in every state items are the same, so the first row should be different."
What it means for the build (migration `20261014160000_food_share_footwear_pack.sql`):
- **Food in step with its weight.** Every food piece carries the same share of its courier cost, 70%
  (`food_ship_share_pct`; the small-food shelf the same 70%), instead of 100% above the shelf and 50% on it. At ₹96.30:
  bhujia 200 g (₹55) $3.99, 400 g (₹100) $8.49 (was $11.29), 1 kg (₹230) $20.49 (was $27.49). The air courier costs
  about $20 for a 1 kg bag (1.4 kg billed), so 1 kg cannot go much lower without losing money.
- **Footwear** without its own weight is priced at 600 g (a pair with its box), not 1 kg: ₹600 $33.49, ₹800 $38.29,
  ₹1,000 $42.99. The Myntra list's footwear targets now take ₹400 – ₹900.
- **The pack size on food cards** ("200 g"), on the photo: the pack of the option whose price the card shows, else the
  weight in the name (the pack size is printed on the pack; not operations information).
- **See all for every type:** the See all pages have a frosted-glass switch, Clothing · Food · Home & gifts, keeping
  the chosen state; Similar items opens its own type. The "All states" count counts each piece once.
- **The first row is the state's own:** New arrivals on a state's page shows only that state's pieces (all-India
  pieces fill the rows below, D-121); "New pieces are on their way" until it has some.
- **Food for every state:** `tools/sourcing-runner/targets/food-by-state.csv`, 753 targets from the founder's list,
  6 listings each (about 4,500): a state's specialties tagged with its state (562), everyday foods sold everywhere
  (turmeric powder, mango pickle, roasted chana…) once for all states with no state (191), so no state shows another
  state's or a national brand's food as its own (D-004).
*Claude's choices in it (proposed):* 70% and 600 g (estimates in Settings / the category's weight); the toggle's look;
the list's rules: left out are perishables (fresh pitha, chhena sweets, siddu, holige, puran poli and other fresh breads
and frozen food: 45), fish and prawn pickles (US import rules: 8) and names too vague to search ("Namkeen", "Herb
seasoning": 30); an item in four or more states, or made only of everyday words, is for all states.

**D-123 · 2026-10-14 · founder: The bag's charges follow the bag; food carries its weight in Shipping, not in its price** · SUPERSEDED by D-125 (the food weight)
Founder, verbatim: "add new rule where the final shipping and retailer cost is not constant anymore, it changes with the
total amount in the bag, doesn't matter if its strikethrough or not it will follow a rule so that the food can be cheaper
because i feel like 8.49 and 20.49 is still very expensive for bhujia." Asked who pays for the food's flight, the founder
chose "Food weight in shipping": food prices carry 30% of their courier; the bag's Shipping carries the rest as the
food weight, 10% less for every $50 of goods, up to 40% less, paid even above the free-shipping line; the parcel's
$18.79 stays (struck through from $149.99); the retailer charges become 1.5% of the bag, at least $0.99.
What it means for the build (migration `20261014180000_food_weight_charge.sql`):
- **Food prices** carry 30% of their courier (`food_ship_share_pct`, the small-food shelf too): bhujia 200 g $2.79,
  400 g $4.79, 1 kg $10.99 (were $3.99 / $8.49 / $20.49); a 100 g masala $2.49.
- **Food weight** (a line under Shipping in the bag, the pill's bag and checkout, web and app): the food's courier its
  prices leave out, worked out in the database from the bag's food weights (INV-1: only cents leave it), $12.73 a kg at
  today's rate; 10% less for every $50 of goods, at most 40% less; paid at every bag size.
- **Shipping** ($18.79 for the parcel) is paid below $149.99 and struck through from it up, as D-112.
- **Retailer charges** are 1.5% of the goods, at least $0.99 (were a fixed $1.99), struck through from the line up
  showing what they would be. Below the line the bag says "Add $X more and Shipping comes off" when it has food.
- Every number is in Settings (Bag charges); the profit check uses the same rule.
What it does to bags (profit check at ₹96.30): one 400 g bhujia pays $29.66 (the parcel's $18.79 and $6.09 of food
weight; it loses $8.27, as small bags did before); 4 × 400 g + 2 masalas $66.84 (+$3.99); 12 × 1 kg bhujia $274.89
(+$61.71: the food weight over-recovers on big parcels, whose courier per kg is lower); mixed bags keep their profit.
*Claude's choices in it:* the food weight is worked out per kg of label weight with the same rate card and billed % as
the prices; the courier's rate card and the steps are settings. A lever if big food bags feel dear: 20% less per $50, up
to 60% less, brings 12 × 1 kg to $244.33 (+$32.65).

**D-124 · 2026-10-14 · founder: One Shipping number that grows with the bag, struck through and free from the line up** · SUPERSEDED by D-125 (one Shipping number stays)
Founder, verbatim: "this is good but you didn't have to show the cutomer a new cost to pay, you just had to add it in the
backend and in the frontend the shipping just increases. I asked the shipping for 18.79 on 0$ cart and then increase as
the bag fills up. let's say (just an example) if it is 90$ for 140$ bag then it will still increase even after 149 it's
just that we will strikethrough the shipping price and show it as free."
What it means for the build (no migration; `bagChargesAt()` in packages/shared, the bag and checkout, web and app):
- **No Food weight line.** Shipping is one number: $18.79 for the parcel plus the bag's food weight (D-123: 10% less
  per $50 of goods, up to 40% less), so it starts at $18.79 and grows as food goes in.
- **From $149.99 up** Shipping keeps following the bag but is struck through and free, like the retailer charges
  (1.5% of the goods, at least $0.99). Food prices stay as D-123 (bhujia $2.79 / $4.79 / $10.99).
- **What it costs (profit check, now with these two bags):** 12 × 1 kg bhujia ($131.88 of goods) pays $274.89 with
  Shipping $141.03 (+$61.71); 14 × 1 kg ($153.86) pays $153.47 with Shipping free and IWC loses $83.58, because past
  the line nothing pays the 70% of the food's flight its price leaves out. Mixed bags past the line keep their profit.
*Claude's choices in it:* the bag's hint is "Add $X more for free delivery" again. The loss on food-heavy bags past the
line is the founder's to decide (see the reply of 2026-10-14).

**D-125 · 2026-10-14 · founder: No bag ever loses: every cost in the price, heavy pieces on the founder's formula** · food's price amended by D-126 (the band; Shipping still keeps every bag whole)
Founder, verbatim: "Noooo we can't bear any loss, we have to add all the costs in margin including the weight cost, how
are we going in loss in 14 piece order that is absurd, think deeply out of this logic, like in this whole cost logic
where are we going wrong. we should be listing lighter orders and heavier orders should be following our initial
formula."
Where the logic went wrong (Claude's finding):
1. **The flight was taken out of the prices.** D-120 (the shelf at 50%), D-122 (70%) and D-123 (30%) let food carry only
   part of its courier, and Shipping was made free from $149.99 up (D-112, D-124). On a food-heavy bag past the line
   nobody paid the rest: 14 × 1 kg bhujia lost $83.58. Free shipping is only safe when every price already carries its
   flight; the founder's formula (D-119) did.
2. **A parcel has a minimum cost the $18.79 never paid.** The courier bills at least 1 kg (₹2,242) plus the box and
   customs clearance (₹1,050): about $34 for any parcel, even one 100 g masala whose price carries $1.82 of flight. So
   one-or-two-piece food bags lost $4 – $12 since D-112.
3. **Heavy, cheap food cannot fly cheaply.** 1 kg of bhujia costs ₹230 in India and about $17.50 to fly (1.4 kg billed
   at ₹1,201 a kg); its price must carry that, so it is about $27.
What it means for the build (migration `20261014200000_parcel_pays_its_way.sql`):
- **Prices:** every piece carries its whole cost again (the founder's formula: shop price, its weight on the courier,
  duty, card fee, margin, the guard). Food's share is back to all of its flight. Bhujia 200 g $5.99, 400 g $11.29, 1 kg
  $27.49; a ₹90 masala of 100 g $3.99, ₹50 $3.49, ₹20 · 20 g $1.99. The small-food shelf only rounds a light, cheap
  piece up to its step and never sells under cost (the ₹150 · 250 g masala goes back from $3.99 to $8.49).
- **Shipping (one number, D-124):** below $149.99 at least $18.79, more when the bag's pieces cannot pay for its parcel
  (one masala: $35.79; one 400 g bhujia: $29.79; one kurta stays $18.79); worked out per bag in the database from each
  piece's shop price, duty, card fee and returns against the parcel's real courier. From $149.99 up it is struck
  through and free; a bag that still could not pay its way past the line (none of the sample bags) pays the rest.
- **The profit check:** every sample bag and the one-piece bags now leave a profit (the least: $2.49, one 400 g bhujia).
- The food weight of D-123 is retired (its settings stay unused); the retailer charges stay 1.5%, at least $0.99.
*Claude's choices in it:* the parcel model is the profit check's (2% returns, the card's 30¢, a shop's ₹40 / ₹60 fee for
clothing / home); "lighter" is served by listing light pieces (they are cheap because they are light), heavy food stays
on the formula.

**D-126 · 2026-10-15 · founder: The courier at ₹2,000 a kg; food in a strict 17–20% band, packed tighter; prices end in .69 too** · paused by D-127 (beta pricing; archived)
Founder, verbatim: "I just got updated from the courier guy the shipping will be changed from 1460 to 2000, now think of
all situation and let me know if we decrease our margins or any other way can we still adjust 2k shipping in the same
prices?"; then "generate a new table in which we lower the food margins to sharp strict 17-20% because I want to compare
and still pack food tighter"; then "Alright now fix the prices on these, it's all good, also change the round off to 29,
49,69,79,99".
What it means for the build (migration `20261015090000_courier_2000_food_band.sql`; every number is a setting):
- **Courier:** ₹2,000 per kg, everything in (no first-kg premium, no per-parcel fee), billed by the half kg from 1 kg.
  Clothing and home & gifts carry ₹200 per 100 g (was ₹146). A 1 kg parcel now costs less than before (₹2,000, was
  ₹3,292 with the box and clearance); above about 2 kg more.
- **Clothing 42%** (lowest 35% on the dearest pieces), **home & gifts 50%** (lowest 40%): their prices stay about where
  they were (a ₹699 kurta $31.29, a ₹1,499 kurta set $63.69, a ₹350 brass diya $31.29).
- **Food packed tighter:** billed at 110% of its label (was 140%).
- **Food in a band, 17–20% on its cost** (`margin_food_pct` = the bottom, the new `food_margin_max_pct` = the top): the
  first price ending at or above +17%; past +20% (a cheap piece, where one ending is a big step) the ending nearer the
  band, a tie going up. Food skips the profit guard and the small-food shelf; an empty band top brings both back.
  Garam masala ₹90 · 100 g $4.29, bhujia 200 g $6.69, 400 g $12.79, 1 kg $31.29, tea ₹180 · 250 g $9.69.
- **Price endings** .29, .49, .69, .79, .99 for every price (was .29 / .49 / .79 / .99).
- **No bag loses still holds (D-125):** a food piece in the band leaves less than its duty and card fee (cents to $0.71
  on 1 kg of bhujia, as shown to the founder), and the bag's Shipping brings what its parcel still needs. One garam
  masala pays $26.07 (Shipping $20.99), one kurta $55.27. **The cost of it:** a food-heavy bag past $149.99 pays some
  Shipping instead of free: 14 × 1 kg bhujia $54.99, 20 pantry pieces $20.29, 60 masala packets $30.29. Mixed and
  clothing bags stay free. Every sample bag in the profit check leaves a profit (the least: one masala, $1.92).
*Claude's choices in it:* ₹2,000 read as all-in (to confirm with the courier: box, clearance, volumetric weight, a lower
rate for heavier parcels); the taper's lowest margins (35%, 40%) and the 110% packing are from the table the founder
approved; the band's tie rule.

**D-127 · 2026-10-15 · founder: Beta pricing, fixed in code; the full formula archived** · beta formula SUPERSEDED by D-128 (the archive and the switch stay)
Founder, verbatim: "1. Take all of this complete logic and put it in archive so we can use it later. 2. We are going to
hardcode this system for a beta testing to see prices, Strictly put shop price, strict, then india handling 10%, then
exchange rate, then flight 2000rs/kg strict, then margin strict 20% food, 40%clothing and 50% home n decor. 3. and then
send me the table with price margin."
What it means for the build (migration `20261015120000_beta_pricing.sql`):
- **Every automatic price:** cost = (shop ₹ × 1.10 + weight kg × ₹2,000) ÷ the day's ₹ per $ (no buffer); food × 1.20,
  clothing ÷ 0.60, home & gifts ÷ 0.50, **to the cent** (amended the same night, migration
  `20261015130000_beta_exact_cents.sql`: "don't round up the numbers, I need the original numbers, so i get to see
  margin as 20, 20, 20, 20, 40, 40, 40, 40 … like this"; the first cut went up to .29/.49/.69/.79/.99). The numbers
  are in code (`_auto_price_cents`, `BETA_PRICING` in `packages/shared`), not Settings; only the exchange rate moves
  prices. **Amended again** (migration `20261015140000_beta_rate_92.sql`): "take safety buffer as 4% as 92rs and convert
  at last": worked out in rupees and divided by a fixed ₹92 at the end; the day's rate no longer moves a beta price.
  At ₹92: ₹90 masala of 100 g $3.90, bhujia 1 kg $29.39, ₹699 kurta $30.23, ₹1,499 kurta set $62.48, ₹350 brass diya
  $31.20 (at the day's rate they were $3.73, $28.07, $28.88, $59.69, $29.80). The founder's example listed home & gifts at 60; the rule he set says 50%, which the build follows.
- **Archived, not deleted:** the full formula (D-119 – D-126) is written up in `docs/archive/pricing-full-formula.md`
  and stays in the code behind `pricing_settings.beta_pricing`; a migration setting it false brings it back with its
  settings as they were.
- **Unchanged:** the bag's charges (D-125): Shipping at least $18.79 and what a parcel still needs, free from $149.99
  unless the bag still needs it; retailer charges; the bulk saving.
*Claude's choices in it:* food's margin on its cost and clothing's and home's of the price, as the founder's tables have
read since D-119; flight on the label's weight; no shop divisor, fee, packing % or buffer ("strict"). Not in the beta
formula: US duty and the card fee. Shipping makes up for them per bag, so no sample bag loses (the least: one masala,
+$1.95; at ₹92 +$2.09), but food-heavy bags past $149.99 pay Shipping (at ₹92: 14 × 1 kg bhujia $77.29, 20 pantry
pieces $30.49, 60 masala packets $47.29). Asked again how the margin counts, the founder answered "calculate after adding
shipping": the margin is taken on the whole cost including the flight, as built.

**D-128 · 2026-10-15 · founder: The beta prices by the founder's exact rules; Products → Download Excel**
Founder, verbatim: "calculate the suggested selling price in US dollars using these exact rules: 1. Adjusted cost =
product cost in INR ÷ 0.90. 2. Shipping = ₹2,000 per kg = ₹2 per gram. Shipping cost = weight in grams × ₹2. 3. Subtotal
= adjusted cost + shipping cost. 4. Category divisor: Food & Beverages = 0.80; Clothing & Fashion = 0.60; Home Decor =
0.50. 5. Price after category divisor = subtotal ÷ category divisor. 6. Final selling price in USD = price after category
divisor ÷ 92 (fixed exchange rate ₹92 = US$1). … Example: cost ₹100, weight 100 g, Food & Beverages => adjusted cost
₹111.11 + shipping ₹200 = subtotal ₹311.11; ÷ 0.80 = ₹388.89; ÷ 92 = US$4.23. final columns should be name indian
price, category, weight, us price and then margin"; then "I want exactly by these numbers once done and then I want a
button in the products section which creates a excel sheets output of these 6 columns only."
What it means for the build:
- **Prices** (migration `20261015150000_beta_exact_rules.sql`, `BETA_PRICING` in `packages/shared`): every automatic
  price is (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ 0.80 / 0.60 / 0.50 ÷ 92, to the cent. Supersedes D-127's × 1.10 and food
  × 1.20. ₹100 · 100 g food $4.23; ₹180 mango pickle of 500 g $16.30; ₹230 bhujia of 1 kg $30.65; ₹699 kurta of 450 g
  $30.37; ₹350 brass diya of 525 g $31.28. The full formula stays archived behind `beta_pricing` (D-127).
- **Products → Download Excel** (`/admin/catalog/export`, admins only; `admin_price_sheet()` in migration
  `20261015150100_price_sheet.sql`): an .xlsx of the page's view (its tab, the US clearance tab or a search), one row per
  product: Name, Indian price (₹), Category (Food & Beverages, Clothing & Fashion, Home Decor), Weight (g), US price ($),
  Margin. Indian price and weight are the ones that gave the product its price (its cheapest option with its own shop
  price, else its own); margin = 1 − subtotal ÷ (US price × 92): 20%, 40%, 50% for automatic prices (within a cent's
  rounding), a hand-set price shows its own. Built without a dependency (`apps/web/features/admin/xlsx.ts`).
- **Unchanged:** the bag's charges (D-125); Shipping still covers duty and the card fee per bag.
*Claude's choices in it:* one row per product (not per option); the margin as a share of the US price, as the founder's
divisors give it; the file is named `iwc-prices-<tab>-<date>.xlsx`.

**D-129 · 2026-10-15 · founder: Every price rests on a real weight, and every product shows its weight**
Founder, verbatim: "The main point of selling all of this is pricing. Now pricing algorithm is set, it is not changing.
Pricing heavily depends on weight. Now you have to make a system which makes sure that this product has/is showing
correct weight and each product is showing it's weight. It is your choice how to make it, it can be intelligent as well
which can search the item for it's price. wherever there is an assumption in price, the price will change and customer
will be lost. so fix this problem very very smartly without changing the price algorithm."
What it means for the build (migration `20261015160000_weights.sql`; the D-128 formula is untouched):
- **Every weight says where it came from:** `product_variants.weight_source` = weighed (on a scale), admin (typed),
  shop (the shop's own page: its packed weight, item weight, net quantity, pack or title) or similar (a matching item
  on other shops, or another size of the same piece), with `weight_note` (what the page said). Admin and runner only;
  customers never see a source (INV-1, D-003).
- **No listing goes live on a guessed weight:** the database refuses to publish a listing while an active option has
  no weight (before, such a price used the category's usual weight or the home estimate: a 1 kg bhujia priced as its
  200 g sibling, $8.91 instead of $30.65). A live option cannot lose its weight; a new item the weekly check finds on a
  live listing is held, not sold, until it has one. Publish all drafts counts them (`no_weight`). Demo rows and US
  clearance pieces (priced by hand, D-072) are not held.
- **Reading weights smartly** (`packages/shared/src/sourcing/weight.ts`): "1,000 g" (it read "2,500 g" as 500 g),
  "200 g (Pack of 2)" = 400 g (it read 200 g), lb, oz, ml and litres; Amazon's "Package Dimensions: …; 320 g"; the
  strongest statement wins (packed > item > net > pack > title) and a page that contradicts itself is flagged.
  Auto-sourced clothing now takes the weight its page states (before: never, so every Myntra or Amazon garment was
  priced on its category's weight); never from a garment's title.
- **Finding the rest:** `pnpm sourcing run` ends by reading the listing's own shop pages for weights it lacks, then the
  same item on Amazon and Flipkart, where at least two pages must agree within 30%; it never overwrites a weighed or
  typed weight, and a shop's own weight replaces a matching item's.
- **Every product shows its weight (admin):** Products has a Weight column (red: none; amber: to check), the tab
  **Weights to check** (no weight, a matching item's, recorded before sources were kept, or under a quarter or over
  four times its category's usual weight for clothing and home) with a weight form per option and one for all sizes
  of a piece; the product page shows each option's weight, source and note with the same forms ("weighed on a
  scale"). The importer says where its weight came from and what contradicts it.
*Claude's choices in it:* the packed (shipping) weight wins over the net weight when a page states both, because the
courier bills the packed piece (a 500 g pickle in a 780 g jar is priced on 780 g; D-127 had priced on the label);
the same weight for every size and colour of one piece (marked similar, never across packs); two agreeing pages
before a matching item's weight is used; customers are not shown weights (food already shows its pack, D-122):
whether the store should show a weight line is for the founder.

**D-130 · 2026-10-15 · founder: The India desk weighs each piece when it reaches the hub**
Founder, verbatim: "Do this task here: “Weigh pieces at the hub when they arrive”" (the follow-up D-129 proposed: the
scale's weight becomes the option's weight, so the first sale of a product fixes its weight).
What it means for the build (migration `20261015170000_weigh_at_hub.sql`):
- **Picked with a weight:** next to every Picked (the cycle's pickup cards and the order page, web and app) a weight
  box, grams of one piece packed, optional; "Weigh it" under a picked piece not yet weighed.
- **What weighing does:** `admin_weigh_pickup()` makes it the option's weight (`weighed`, which the runner never
  overwrites); other sizes and colours of the same piece that have no weight or only a matching item's take it too;
  the listing is repriced for the next customer (D-128; the order already paid is unchanged; a hand-set price stays).
- **What the desk sees:** the pickup keeps a note with the weight it replaced, the change in % and the price now and
  before ("Weighed 310 g (listed 450 g, -31%): price now $25.30, was $17.33").
- **Found on the way:** in the made-to-order pilot (D-115) a standard order's pieces have no cycle, so no cycle page
  listed them and the order page offered Picked only for express orders: the desk could not mark them picked. The order
  page (web and app) now offers Picked for every order without a cycle that is still in India.
*Claude's choices in it:* the weight is optional (a busy desk is never blocked); one piece is weighed, not the whole
quantity; the note is kept on the pickup instead of a pop-up, so the web, the app and later readers all see it.

**D-131 · 2026-10-15 · founder: A weight estimator on the laptop gives every listing a realistic weight, fast**
Founder, verbatim: "I need to build a very smart system on my laptop which goes through each product and assigns them
a very realistic weight. If we build this system on website it will become heavy, I can even run my gpu if needed, but
we have to build a very smart system when it runs it goes through each piece and gives it a very very realistic weight,
now strict condition is it should take little time per product or there is no gain in running it on my system because
there are thousands of product."
What it means for the build (migration `20261015180000_weight_estimates.sql`, `tools/weight-estimator`, `pnpm weights`):
- **On the laptop, not the website:** Ollama runs two local models on the GPU: one finds the items IWC already knows
  that are most like the listing (weighed at the hub first, then typed, then a shop's page), the other weighs one unit
  as shipped, part by part with its packing, with a 90% range. The code adds the parts. Three near-identical known
  items that agree give the weight without the model. Listings are asked four at a time (`IWC_WEIGHT_PARALLEL`).
- **Sure or not:** a weight is sure when its range is within ±25%, similar known items (if any) agree within 25%, it is
  not below a pack's stated net weight and not far from its category's usual weight. A sure weight becomes the option's
  weight, source **estimated**: the listing is priced on it and may go live. Any other weight is kept as a suggestion
  (`weight_estimate_g`), shown in Products → Weights to check and filled in the weight box.
- **What it never does:** change a weight a person weighed or typed, or a shop's page stated. A shop's page (the runner)
  and the hub's scale replace an estimate; `--audit` compares the shops' weights and Weights to check lists one the
  estimator puts more than a third away (a saffron box its page calls 1 g).
- **It learns from the scale:** every hub weighing (D-130) becomes a reference for the next estimates (`--redo`
  re-estimates), and the estimate made before a piece was weighed is kept, so `pnpm weights eval` reports how close it
  came.
- **Found on the way:** a weight rewritten with the same source turned into the changer's (a second weighing at the hub
  made the other sizes "admin"); a new note now keeps the source.
*Claude's choices in it:* `qwen2.5:7b` and `nomic-embed-text` (free, fit the RTX 4060's 8 GB together); the rules of
thumb in the model's question (fabric, containers, materials; `estimate/prompt.ts`) are Claude's, not measurements;
the ±25% and 25% thresholds and the 0.80 / 0.93 similarity lines are starting points for `eval` to tune; a sure estimate
counts as a weight for D-129's "no listing goes live on a guess" (the founder asked for weights to be assigned). Whether
it may price live listings without an admin's look is the founder's to confirm.

**D-132 · 2026-10-16 · founder: Clothing is weighed by class: light 350 g, medium 750 g, bottoms and footwear 800 g, heavy 1.5 kg**
Founder, verbatim: "This crashes very badly not technically but logically because almost everything on the database
does not have any correct weight. Literally every item came false weight on dry run. Therefore, in clothing let's do
this first: classify category light350g(headwears, jhumka, kurti, kurta, tops, salwar), medium750g(light sarees,
dupatta, potli pouch, kurta, dhoti, jackets, , coord and dresses) pants, jeans, footwear can be taken as 800gm and
heavy1.5kg(shawls, very heavy saree,lehnga, set of suit or kurta basically any set) let's globalize this for all
clothing and assign everything this weight accordingly but remember categorize them very very carefully and smartly."
What it means for the build (migration `20261016090000_clothing_classes.sql`, `packages/shared/src/sourcing/estimate/classes.ts`):
- **Every clothing option gets its class's weight**, source **class**: light 350 g, medium 750 g, bottoms and footwear
  800 g, heavy 1,500 g (a "Pack of 3" three times). The D-128 price follows. Not changed: a weight weighed at the hub
  or typed by an admin (they are the piece itself); the hub's scale later replaces a class weight (D-130). Shop pages
  and the estimator no longer change a clothing weight once it has its class.
- **Sorting:** rules on the listing's name first (sets before single pieces, so a kurta with pyjama is a set), then
  its category, then the local model (D-131) for a name no rule reads; `pnpm weights classes --dry` writes every
  listing's class and the reason to a CSV for the founder to look over before `pnpm weights classes` writes them. The
  sourcing runner sorts new clothing by the rules at the end of each run.
- **D-131's estimator now weighs food and home & gifts only.**
- **The founder's review of the classes (2026-10-16), verbatim:** "Gamosa, Kaftan, dress or skirt should be in 350g
  rest is good commit and push. the priority order should be Manually inserted at hub > updated from admin portal >
  our current categories(Update everything in the current database's clothing according to these categories also when
  I run the scraper which adds clothing products should put the products from now on into one of these categories
  smartly) We have categorized these weights for the pricing logic only, The customer should not be seeing the
  weights of clothing and home decore anywhere." So: gamosas, kaftans, dresses, gowns and skirts are light (350 g);
  a clothing weight is the hub's scale, else an admin's, else its class (as built: shop pages and estimates never
  replace a class); every clothing listing in the database takes its class at the first sourcing run after the
  deploy (the runner sorts all clothing not yet sorted, by name and category; `pnpm weights classes` on the laptop
  also sorts what neither reads), and each run sorts the clothing it adds. Weights stay for pricing only: no store
  page, app screen or `store_*` view or function sends a weight, its source or note (the SQL tests' forbidden keys
  now include all of them).
- **Kids' sets (2026-10-16), verbatim:** "Make kids' and baby sets medium (750 g) instead of heavy." A set, lehenga,
  sherwani or sharara is medium when it is for children: "boys", "girls", "kids", "baby" (and the like) in its name,
  the kids category, or sizes by age ("3-6M", "2-3Y"); a kids' shawl stays heavy. Applied on production the same day
  (35 listings, 646 options).
*Claude's choices in it:* a kurta is in both of the founder's lists: a plain or short kurta is light, a kurta in silk,
velvet, brocade, sequins or zari, or an Anarkali or long kurta, is medium; a kurti is always light. "Very heavy saree":
Banarasi, Kanjivaram, Paithani, Patola, Baluchari, pattu, bridal or wedding, brocade, velvet, tissue, pure silk or
"heavy" in the name; any other saree is medium. Sets: "set", "suit", "N-piece", kurta-pyjama and the like, or a garment
"with" a second garment (with pyjama, dupatta, jacket, sharara…; not with a blouse piece); a co-ord set stays medium as
the founder listed it. Shawls include pashmina, phiran and loi. Salwar, churidar, leggings and pyjama alone are light
like salwar; palazzos, trousers, dhoti pants and joggers are pants (800 g); gowns, jumpsuits, maxis and frocks are
dresses (light since the founder's review), a co-ord set stays medium; jewellery
(jhumkas, bangles, necklaces, kamarbandh, paranda) and headwear are light; mufflers, stoles and scarves are medium like
dupattas.

**D-133 · 2026-10-16 · founder: Food is priced on its packed weight: the label's net quantity plus its pack; the hub's scale, then an admin, then the system**
Founder, verbatim: "The main point of selling all of this is pricing. Now pricing algorithm is set, it is not changing.
Pricing heavily depends on weight. Now you have to make a system which makes sure that this product has/is showing
correct weight and each product is showing it's weight. It is your choice how to make it, it can be intelligent as well
which can search the item for it's price. Now wherever there is an assumption in price, the price will change and
customer will be lost. so fix this problem very very smartly without changing the price algorithm. the priority order
should be Manually inserted at hub > updated from admin portal > the system you are going to produce(Update everything
in the current database's food according to whatever system we make, also when I run the scraper which adds food
products update there also smartly"
What it means for the build (migration `20261016160000_food_weights.sql`, `packages/shared/src/sourcing/estimate/food.ts`
and `food-packs.ts`; the D-128 formula is untouched):
- **Every food option is priced on its packed weight**, source **packed**: the net quantity its label states (its
  options, its label, the shop page's net quantity or title, matching items that agree on it, its name, a "Net weight:"
  line), unit by unit ("200 g (Pack of 3)" is three packs; light units such as 16 g chikki bars share one), liquids
  by density (a litre of ghee 910 g), plus the weight of its pack. Before, food was priced on the label alone (a 500 g
  pickle in a glass jar ships at about 800 g) and many multi-packs on one unit ("100 g (Pack of 3)" priced as 100 g):
  the hub's scale would have moved those prices.
- **The pack:** the page's spec rows ("Package Information: Jar", "Material: Glass", read when the runner adds the
  listing), then its name and options, then its description (never a line about storing it), then what such food
  comes in, then its category's usual pack. A jar or bottle that names no material is plastic for dry food and between
  glass and plastic otherwise, marked "glass or plastic? weigh one at the hub".
- **It learns from the scale:** three or more food pieces of one pack weighed at the hub set that pack's factor (their
  middle ratio, kept within half to twice the table).
- **The order:** the hub's scale, then an admin's weight, then the system. The system never replaces a weighed or
  typed weight, and shop pages and the estimator never replace a packed one. New in the database: an admin's typed
  weight no longer replaces one weighed at the hub (the weight box offers "weighed again on a scale"); weighing a
  flavour at the hub also gives the other flavours of the same net quantity its weight.
- **Everything in the database, and every new listing:** each `pnpm sourcing run` (and `pnpm sourcing food`) works out
  every food listing not yet done (after the deploy: all of them); the runner prices a new food listing on its packed
  weight when it adds it; `pnpm weights food --dry` writes `food-weights.csv` for review. An option whose net quantity
  nothing states keeps what it has: the runner's page search (D-129) reads the shop's page for it, then the hub weighs.
- **Each product shows its weight:** customers see the net quantity (a "Net quantity" line in Details, web and app, and
  the card's pack size), which is printed on the pack (D-122); never the packed weight or its source (INV-1). Admins see
  the packed weight, its source "Net weight + its pack (D-133)" and the sum ("500 g net (its name) + glass jar,
  wrapped 295 g: …").
*Claude's choices in it:* the pack weights (`PACK_TARE`: pouch 6 g + 3%, box 15 g + 8%, sweet box 40 g + 12%, glass jar
120 g + 35% with its wrapping, plastic jar 15 g + 6%, tin 40 g + 10%, glass bottle 150 g + 40%, plastic bottle 15 g +
4%, bag 20 g + 1.5%; an unknown jar or bottle between glass and plastic) are typical Indian retail packs, not
measurements, until the hub's scale tunes them; a shop page's packed weight is used when it fits its net quantity
(at least the net plus a third of the usual pack, at most the net plus two and a half packs and 30 g); weights round
up to 5 g; units under 50 g share one pack; rules only, no model (D-132 found the model's guesses wrong); the admin
rule (typed cannot replace weighed) reads the founder's order literally. On production (2026-10-16, a dry run before
the deploy): 920 food listings, 1,635 options in 8 s; 1,059 get a packed weight, 576 state no net quantity anywhere
(mostly listings whose names were cleaned of it; the page search fills them), 178 are marked glass or plastic.

**D-134 · 2026-10-16 · founder: Home & gifts are priced on the weight their own page states, checked, never shown to customers**
Founder, verbatim: "Similarly design a very smart system for home decor items which has a very large amount of range,
although mostly is and will be from amazon and almost every item will definately have its weight listed in one of
those dropdown abouts. but this weight will not be shown in frontend"
What it means for the build (migration `20261016180000_home_weights.sql`, `packages/shared/src/sourcing/estimate/home.ts`,
`tools/sourcing-runner/src/home.ts`; the D-128 formula is untouched):
- **The dropdowns are read:** the capture (the "Add to IWC" button and the runner) now also reads Amazon's newer
  "Product details" dropdown tables ("Item details", "Measurements", every `prodDetTable`) and fact rows, once each.
- **Each option on its own page:** on Amazon every size and colour is its own item with its own weight; the runner
  reads each option's own page (the end of every `pnpm sourcing run`, or `pnpm sourcing home`, 40 listings a go). A
  new listing takes its page's weight for the page's own item; its other options read theirs at the end of the run.
- **Which weight:** the packed weight the page states (Item Package Weight, Package Dimensions "…; 640 g") as it is,
  source **shop**; else the piece's own weight (Item Weight, Product Dimensions "…; 450 g", or the option's size as
  the shop sells it) plus its packing by what it is made of, source **packed**; else another option's page (similar),
  else two matching items on Amazon and Flipkart that agree (similar).
- **Checked, not trusted blindly:** a package lighter than its piece, a weight impossible for its box (under
  0.01 g or over 4 g a cm³: a "30 g" piece in a 5-litre box), and an option holding more pieces that weighs no more
  than a smaller one ("Pack of 5" as heavy as "Pack of 1") are marked; an impossible weight is not priced. Fragile
  pieces are marked to weigh one packed at the hub.
- **The order (D-133):** the hub's scale, then an admin's weight, then this; the runner never replaces either.
- **Never shown to customers:** no store page, app screen or `store_*` view or function sends a home weight, its
  source, note or a net quantity (D-132; tested).
- **Bulky pieces:** the box's weight by size (litres ÷ 5) is kept in the note and in `home-weights.csv`; whether the
  courier bills by size is Q-36. Prices use the real packed weight until the founder answers.
*Claude's choices in it:* the packing weights (`HOME_PACKING`: fragile glass, ceramic, terracotta, marble or resin
120 g + 25%; flat art and frames 80 g + 15%; textiles 20 g + 5% in a poly bag; wood, metal and the rest 60 g + 12%,
also for textiles with wood or metal in them) are typical, not measurements, and the hub's scale replaces them piece
by piece; the density bounds; weights round up to 5 g; ÷ 5,000 for the size weight (the usual courier divisor, for
Q-36 only); a page's packed weight is used as stated when it holds the piece and fits its box; the `packed` source
label is now "Its weight + its packing (D-133, D-134)".

**D-135 · 2026-10-16 · founder: Food weighs its label's net weight, no packaging; liquids are not sent, shown as coming soon (supersedes D-133's packing)**
Founder, verbatim: "In food I randomly opened 5 products each one was shown 20g heavier, I assume that is because of
packaging. Don't consider packaging in food, show the real accurate weight. Also insert a check if the scraped item is
liquid put it in coming soon(which has a like button instead of add) on frontend(in archives in backend) because we are
not sending liquids but we are sending pickles. Also move every live liquid product to archives."
What it means for the build (migration `20261016200000_coming_soon.sql`, `packages/shared/src/sourcing/estimate/food.ts`,
`packages/shared/src/sourcing/liquid.ts`, `tools/sourcing-runner/src/liquids.ts`; the D-128 formula is untouched):
- **Food weighs its net quantity:** the label's net quantity, unit by unit ("200 g (Pack of 3)" is 600 g),
  millilitres by density, to the gram; D-133's pack table and its tuning by the hub are gone. The database value stays
  `packed` (so the deployed functions write it), shown to admins as "Net weight on its label (D-135)". Done on
  production the same day: `pnpm weights food --all` rewrote 1,146 options (D-133's weights are in
  `food-weights-before.jsonl`); a second pass found nothing left to change. The hub's scale, then an admin, still
  come first.
- **Liquids:** a food listing whose page says "Item Form: Liquid", whose name or options are in millilitres or litres,
  or that is a juice, sharbat, syrup, soda, oil, sauce or vinegar; a home listing that is an attar, perfume, rose
  water or a body or hair oil (never a vessel by its size). Never pickles (even in oil), pastes, powders, sweets or
  snacks, and "no palm oil", "oil free" or "in sunflower oil" say how it is made, not what it is.
- **Coming soon:** a liquid is archived (admins find it under Archived, "coming soon on the store") and still shown to
  customers: its card says "Coming soon" instead of a price, the web card has the heart instead of the +, the app card
  a "Coming soon" pill, and its page says "Coming soon. Save it with the heart to find it again." instead of Add to bag.
  It cannot be bought (no options in `store_variants`; `create_order` sells live listings only). An admin can hide it
  or show it again (the archived product's page), and putting it back on sale ends its coming soon; the check looks at
  each listing once, so it never undoes an admin.
- **When:** the runner checks each new listing as it adds it (with the page's "Item Form" row) and every listing not
  yet checked at the end of each run (after the deploy: all of them; alone: `pnpm sourcing liquids [--dry]`). On
  production (2026-10-16, a dry preview before the deploy): 1,072 food and home listings, 16 liquids (juices, sea
  buckthorn pulp, a soda, coconut and kernel oils, a sharbat, kokum agal, three attars, two ghees sold by the ml).
*Claude's choices in it:* ghee and honey count as liquids only when sold by volume (ml, L) or when the page says so;
no price is shown for a coming-soon piece; coming-soon pieces keep their place in the lists (by date); the copy
"Save it with the heart to find it again." is Claude's, for the founder to change.

**D-136 · 2026-10-16 · founder: Home's Just listed switches between the types; See all gets a proper filter panel; filters and Show more never reload the page; admin Products gets filters**
Founder, verbatim: "Under the just listed on home page, I want the same pill which chooses clothing, food and home
decor, which changes the grid and the see all should take them to the respective page. On the products page I want a
proper filter on the left panel, and when filters are selected I dont want the whole page to refresh just products
pane, similarly when someone goes down and clicks load more the whole page refreshes and the users gets scrolled up
again instead the next products should be just appended while maintaining everything like that only, there are no
proper filters in admin too." (with a screenshot of a big store's filter column: size boxes, a price slider with
ready-made ranges, deals.)
What it means for the build (migration `20261016210000_browse_filters.sql`):
- **Home:** Just listed has the See all pages' Clothing · Food · Home & gifts switch under its heading; it swaps the
  row in place (the twelve newest of each type, `store_home().just_listed_types`) and See all opens that type's page.
  A type with nothing on sale says its See all line ("Food is coming soon.").
- **See all (`/clothing`, `/food`, `/home-and-gifts`):** from 1024 px a filter panel on the left (it scrolls on its own
  and stays beside the cards): Category, State, Price (a two-handle slider and four ready-made ranges from the prices
  shown) and Size (Pack for food) as boxes that combine. Above the cards: the count, what is chosen as chips with ×
  and Clear all, and Sort by (Newest, Price: low to high, Price: high to low). Below 1024 px the same groups sit in
  the Filter bar's side panel (D-084), which stays open while choosing and closes with "Show n pieces". It replaces
  D-084's state and category pill rows on wide screens.
- **No page loads:** a filter fetches only the cards and counts (`GET /api/browse`, the same cached `store_browse()`
  read) and writes the filters into the address (Back steps through them; every choice is still a real link). Show
  more appends the next 24 where they are, the scroll untouched. Coming back from a product restores the cards and the
  scroll exactly (a snapshot per history entry in the tab's sessionStorage).
- **Admin Products:** filters for type, state (or All-India), category, shop, a US price range and a sort (recently
  updated, newest added, price both ways, name), within every tab; a select applies at once (no page load), and
  Download Excel exports the filtered view.
*Claude's choices in it:* the price ranges are the quartiles of the prices shown, rounded ($5 steps under $50, $10
under $200, else $25); the slider's scale is squared so cheap pieces get most of the track; a price filter leaves out
coming-soon pieces (no price shown) and a price sort puts them last; choosing a state drops the category (as before);
the state list shows 8 states and "Show all"; no "deals" filter (there are no discounts to filter by).

**D-137 · 2026-10-16 · founder: Source in bulk: food ₹1–300 without liquids or dairy, all of Amazon and Flipkart's home & gifts, thousands of listings in as few runs as possible**
Founder, verbatim: "In food, I want to run the sourcer to find all the items(snacks and literally everything except
liquids and dairy) in 1-300rs range. In clothing, I suppose I will have to give different online store's csv In home
and decore, literally scrape all of amazon and flipkart. I want everything scraped in minimum runs. I am talking about
products inventory counts in thousands" and "Yes: make Amazon and Flipkart search read several result pages with the
price band in the URL, and draft the food (1-300, no dairy) and home target CSVs for me to review."
What it means for the build:
- **Deeper searches:** Amazon and Flipkart searches use the shop's own price filter for a target's band (Amazon
  `rh=p_36:<min>-<max>` in paise, Flipkart `facets.price_range` in rupees) and read up to four result pages (one per
  10 listings the target wants, `searchPages`), each page its own turn on the shop's lane so the pause between pages
  holds; a page that brings nothing new ends the search. A results page is read whole (Amazon up to 60 rows, Flipkart
  48), no longer only its first 24.
- **A page that did not load is a failure, not "nothing found":** an Amazon or Flipkart first results page with no
  rows that does not say "no results" fails that shop's search; a target that made nothing while half its shops or
  more failed goes back to the queue (one flaky shop of food's six does not hold it). The run log names what a draft
  lacks ("details to finish: material", "photos").
- **Draft target lists** (in `tools/sourcing-runner/targets/`, to review before uploading): `food-under-300.csv`
  (172 searches, ₹1–300, every food category, all-India) and `home-amazon-flipkart.csv` (94 searches on Amazon and
  Flipkart, no price band, the three home categories). Liquids are left to D-135's check.
*Claude's choices in it:* "no dairy" is each food row's Must match: a title naming paneer, cheese, curd, dahi, yoghurt,
khoya, mawa, ghee, milk, whitener, cream, lassi, chhena, kalakand, rasgulla, rasmalai or butter (peanut butter
excepted) is left out, so ghee sweets and milk biscuits are left out too; dry fruits are filed under Snacks & Namkeen;
listings per search are 10–40 by how broad the search is; up to four result pages.

**D-138 · 2026-10-18 · founder: Home & gifts next: fill it with festival pieces (dandiya, Navratri, Dussehra, Diwali) and the whole range of home decor, ₹0–900, Amazon only**
Founder, verbatim: "Clothing and food sourcing are almost done, now let's start home decor and gifts sourcing, we want
to fill it fully with festival related stuff dandiya navratri dusherra and diwali are around the corner, then also I
want the whole range of home decor. The pricing I want is 0-900, make a very smart csv for amazon only"
What it means for the build:
- **A new target list,** `tools/sourcing-runner/targets/home-festive-amazon-900.csv`: 185 searches (up to 3,790
  listings), all on Amazon, ₹1–900 (the upload takes no ₹0; Amazon's own price filter then reads the band), all-India,
  the three home categories. Festivals first: Diwali, Dhanteras, Bhai Dooj and Chhath (48 rows: diyas of every kind,
  candles and holders, lanterns and kandils, torans, garlands, rangoli, Lakshmi Ganesh, pooja thalis, kalash, return
  gifts, shagun envelopes, dry fruit boxes), then Navratri, garba and dandiya, Durga Puja, Golu and Dussehra (17), then
  pooja all year, serveware, paintings and wall art, figures and pottery, natural fibre, textiles and gifts.
- It does not replace `home-amazon-flipkart.csv` (D-137); uploading both only overlaps on Amazon, and one Amazon item
  is never listed twice (each shop item belongs to one listing), so a second search of the same thing finds the next
  pieces.
*Interpretation (proposed, confirm before uploading):* tier 1 for Diwali and Navratri rows and the broadest everyday
searches, 2 for the rest, 3 for niche crafts (tier only orders a run; a run takes up to "targets per run" of them).
Every row's Must match leaves out lit and battery pieces (LED, electric, USB, solar, string lights: Indian plugs, and
batteries on the flight), cow dung (gobar) pieces, real peacock feathers, fireworks and camphor tablets (Q-37); gift
rows leave out food hampers (dry fruit, chocolate, sweets, namkeen); loose powders (rangoli colours, kumkum) are left
out by the matcher's form words. Kids' toys are not searched (US toy-safety rules). Dussehra is 2026-10-20 and
Diwali 2026-11-08: with delivery at today + 12–18 days, a Navratri or Dussehra piece ordered now
arrives after the festival, a Diwali piece ordered by about 2026-10-21 arrives before it.

**D-139 · 2026-10-18 · founder: Food: every branded snack, munchie, biscuit and everyday food people order again and again, ₹1–200**
Founder, verbatim: "In food, make the csv, I want all the branded snacks, munchies, buiscuits and food items in my
inventory which are repeatedly ordered, most usually seen. prices 1-200"
What it means for the build:
- **A new target list,** `tools/sourcing-runner/targets/food-branded-200.csv`: 119 searches by brand or product line
  (up to 1,410 listings, each with its packs as options), ₹1–200, every food shop (no Shops column: Blinkit, Zepto,
  Instamart, BigBasket, Amazon, Flipkart), all-India. Chips and munchies (Lay's, Kurkure, Bingo, Balaji…), namkeen
  brands (Haldiram's, Bikaji, Bikano, Prabhuji, Chheda's…), biscuits, rusk and cakes (Parle, Britannia, Sunfeast,
  Oreo, Unibic, Karachi Bakery…), chocolates and candies (Cadbury, Nestle, Pulse, Parle candies…), instant food
  (Maggi, Yippee, MTR, Gits…), masala brands (Everest, MDH, Catch…), branded pickles and papad, tea, coffee and drink
  powders. It adds to `food-under-300.csv` (D-137), which searches by dish; one shop item is never listed twice.
- A row's Product names the flavour words its titles carry ("masala", "cream", "chips"), because the matcher drops a
  title with such a word when the target does not name it.
Founder, verbatim, the same day: "Yes, keep milk biscuits, butter cookies, cream biscuits and milk chocolate in the
branded food list." So "dairy" (D-137) here means dairy products, not everything with milk in it: titles naming paneer, curd, dahi, khoya, mawa, ghee, lassi, chhena, rasgulla, rasmalai, gulab jamun,
whitener, milk powder, cheese slices or spreads, or ice cream are left out, while milk biscuits, butter cookies, cream
biscuits and milk chocolate are kept (Milk Bikis, Good Day, Bourbon, Dairy Milk are among the most ordered). Every row
also leaves out meat and fish (chicken noodles, prawn crackers), frozen food, bread, juice and anything sold by the
ml. Chocolates can soften in transit.
*Claude's choice in it (proposed):* tier 1 is the brands seen everywhere, 3 the regional ones.

**D-140 · 2026-10-18 · founder: Design & ergonomics plan v5: Home's three Just listed rows, Women · Men, order from the shop in one tap, three invoices, the struck Shipping figure, instant taps, + picks the size, − n + on cards, admin pagination**
The plan is `docs/plan/design-plan.md` (v5, written by Claude from the code and the live site, with the founder's
answers of 05:31, 06:16 and 06:23 folded in). Founder, verbatim, the same day:
- Product types: three, clothing, food, home & gifts (D-106, D-110 unchanged).
- Invoice C: "shows only the ordered cart with delivery, all the costs are counted in margin"; "should be fillable like
  a form with uploadable and pastable photos". Invoice B is the Indian cost + handling + shipping with no margin.
- Like button: "the like button latency on the frontend should be very low of animation, let it take its time on the
  backend".
- Home's Just listed: three scrollable rows with their See all.
- "keep the you're saving x and no we do need to show big numbers as struck through and that is an order."
- "no kids at launch." · "the checkout steps are good."
- "When a state is opened its own pieces should be top of the horizontal rows."
- "If I added a piece in my bag and if I see it again somewhere while browsing I should see it as -1+ instead of add
  button. not necessarily 1 but however many I've added."
- "When + is clicked anywhere in clothing the sizes should pop up in a creative way in food the variants should [be]
  see[n], if its a single item with no choice then it should be just added instead of opening the product page (this
  should be opened whenever anything is clicked instead of + on the card)."
- "don't mess with any pricing, it is fixed the express remains how it is, don't overcomplicate things I will balance
  everything physically you put higher prices on shipping when its cut."
- "do pagination in admin products and Import from shops, that is so badly designed, 1000 items on one page loading?"
- To the whole plan: "These were all the problems that I could find, solve them mannerly and solve the additional
  problems you find on your way."
What it means for the build (each item's full change and its "done when" are in the plan):
- **Rule 0.1:** every tap that changes state answers in the same frame and syncs after, rolling back if the server
  refuses; never for money. **Rule 0.2:** no price, fee, margin or Express changes.
- **Home:** three Just listed rows (Clothing, Food, Home & gifts), each with See all; a row under 4 pieces is left
  out. Supersedes D-136's Home switch only (See all keeps its type switch).
- **Clothing:** `products.wears` (women, men, kids, unisex); See all → Clothing filters by For (Women · Men; unisex
  under both); no Kids tile, filter or menu entry at launch; sizes normalised and grouped.
- **Admin:** each sold piece is ordered from its variant's shop item in use (D-118) from the order page and a To order
  screen; three invoices (A the customer's, B our landed cost, C the shop bill as a form with photos); one pager for
  every admin list, no silent caps.
- **Cards:** + picks the size or variant on the card (one choice adds at once); a piece in the bag shows − n +; the
  heart fills at once and is on every card.
- **F5:** the struck Shipping figure at the free-delivery line is a display number: the bag's packed weight × a
  Settings value in $ per kg the founder sets (empty: today's $18.79); never charged, stored or sent to Stripe.
  Claude flagged that a struck figure never charged can read as a fictitious former price (FTC 16 CFR 233.1); the
  founder chose to show it.
Open: Q-38 (the live Kids listings), Q-39 (an interim size line). Supersedes D-136 in part (Home's switch).

**D-141 · 2026-10-20 · approved: photos live in Cloudflare R2 as two AVIF copies; Supabase's storage keeps none**
- The founder: "Also supabase is hitting the limits, let's research deeply through everything and solve this
  bottleneck productively and efficiently(without any money) We want the fastest and clearest images." Asked where
  the photos should live (R2, Backblaze B2 or Cloudinary), the founder chose "Cloudflare R2 (Recommended)".
- Why: production held 54,627 photos, 7.9 GB, in Supabase's storage (free plan: 1 GB; a project kept over quota can
  be restricted); even as AVIF they need about 4 GB. R2 holds 10 GB free and never charges for traffic (a card or
  PayPal on file switches it on; nothing is charged under 10 GB).
What it means for the build (engineering.md PR-6, ops.md §Photos):
- Every photo is stored as AVIF copies 640 and 1200 px wide (about 70 KB together; never upscaled), recorded with an
  `s/` path; the original is not kept. Pages draw them from `/media/s/…` on the site's own address, with a JPEG made
  on demand for email and browsers without AVIF. Nothing resizes per view.
- The website, the phone (through the website) and the sourcing runner write to R2; Supabase's storage only holds a
  photo for the minutes between an upload and its move. `pnpm photos:move` moves older photos, most needed first,
  within a Supabase egress budget per run.
Builds on D-140 (the photo fix). Supersedes the Supabase-stored WebP copies of 2026-10-19.

**D-142 · 2026-10-20 · approved: a listing keeps each picture once (the shop's preview copies are dropped)**
- The founder: "each product's each photo get's a duplicate in that gallery, so the photos were doubled … go through
  every best way we can remove exact duplicates from the database … and then find the best one".
- Why it happened: Amazon's page lists every photo full size (`hiRes`) and as a 500-pixel preview (`large`) under
  another file name; the capture (the Add to IWC bookmark and the sourcing runner) took both. A sample of 40 listings
  (268 photos) found 93 repeats, all Amazon (44% of its photos): about a third of production's 54,600 photos, but only
  about 8% of the bytes, since the previews are small. Storage filled because of the full-size originals (D-141).
- Ways weighed: a byte hash (Supabase's stored MD5) finds only byte-identical files, 329 in production; a perceptual
  hash (dHash 64-bit, as imagededup, Czkawka and dupeGuru use) mixed real pairs with different photos (a jar's front
  and back at distance 5, a real pair at 8); colour or gradient correlation of thumbnails took the same idols on
  another background, or the jar's two sides, for one picture. Chosen: the same shape (within 2%) and a PSNR of at
  least 27 dB between both photos at 256 × 256, softened (blur 1.5): on the sample every real pair scored 28.9 dB or
  more, every different photo 25.3 or less. Compared only within one listing and one variant, never across listings.
What it means for the build (packages/shared `same-picture.ts`, engineering.md PR-6, ops.md §Photos):
- The capture takes each Amazon photo once, full size when Amazon has one. Re-add the Add to IWC bookmark from the
  importer page after the deploy (the bookmark carries its own code).
- Importing (the bookmark, pasted links) and the runner download a listing's photos, keep each picture once (the most
  pixels, in its first place), then store them: a repeat never reaches the store, whatever the shop.
- `pnpm photos:move` drops each listing's repeats while moving it (it downloads every photo once anyway), keeping the
  full-size file in the first one's place (order, main photo, words); `--review=<n>` shows what it would drop.

**D-143 · 2026-10-21 · founder: a piece's name loses only the shop's or brand's name**
- The founder: "I feel like the tidying tool is not so accurate right now because we just wanted to remove the shop's
  name right? It is removing the important words like 3 in 1 Incense stick -> 1 Incense stick, 100% pure brass urli
  bowl etc etc and many many more".
- Why it happened: D-140's L1 rules also cut "search words" and kept about six words from the end, and the brand
  guess for old names grouped all of Amazon as one shop, so any start three names shared ("3 in", "100% Pure") was
  taken for a brand and cut.
What it means for the build (packages/shared `sourcing/title.ts`, apps/web `features/admin/names/proposals.ts`):
- `cleanTitle` removes the brand at the start, "by <brand>", a "| <brand>" or "- <shop>" tail and "Amazon Brand –";
  nothing else. Supersedes D-140's search-word, "with" and six-word rules.
- `guessBrands` never takes a word with a digit or sign, a count, material or product word, or words that also turn up
  inside other names of that shop.
- Names to tidy makes a name the first rules cut down again from its shop title (kept since D-140), so the lost words
  come back; the admin still ticks every rename. Supersedes the L1 line of D-140 in that respect.

**D-144 · 2026-10-21 · founder: See all opens low to high; Clothing's finishing touches in a jewellery drawer**
- Founder, verbatim: "I want the customer to see low to high prices by default but in clothing only accessories comes up
  first"; on Claude's proposal (design plan v6, F11): "I really like the jewellery drawer".
What it means for the build (migration `20261021090000_low_to_high`, apps/web `features/catalog/finishing-drawer.tsx`):
- See all (`/clothing`, `/food`, `/home-and-gifts`) opens low to high (`?sort=` absent; a state's own pieces still
  first, D-140 L2; coming-soon pieces last). Newest, Price: low to high and high to low stay in Sort by. Supersedes
  D-136's newest-first default.
- Clothing's default view (no category chosen) is "one of each, then step up": each category's cheapest, then each
  one's second cheapest; Price: low to high stays a strict list there.
- On that view Accessories and Turbans & Headwear leave the list and open as a drawer after the second row of every
  24 cards: a dark velvet band with a gold stitch, "Finishing touches · from $X", a sideways row of 12 smaller cards
  with + and − n +, See all → the accessories. Inside any category, or with another sort, there is no drawer. The count
  reads "252 pieces · 26 finishing touches".
- *Interpretation (proposed, confirm when convenient):* footwear stays in the clothing order, not the drawer (Q-40);
  the app's Browse stays newest first until it gets the drawer too.

**D-145 · 2026-10-21 · founder: stay on Vercel's free plan; fewer page-cache writes**
- Founder, verbatim: "We won't be buying vercel pro anytime soon." Then, on Claude's three proposals: "Yes: publishing
  refreshes only what changed, deploy once a day, and a card loads its choices on its +. Then I move Vercel."
- Why: Vercel's free plan allows 200,000 page-cache writes a month, counted in 8 KB units of each page rebuilt with
  new content; 208,000 were used by 2026-10-21. A state page was 2 MB (HTML plus the same data again), Home 0.9 MB, each
  of the 5,852 product pages 0.23 MB, and every admin edit and import refreshed all of them, as did each of about 70
  deploys.
What it means for the build:
- An admin change to listings refreshes only their own pages, their state page (every state page for an all-India
  piece), Home, See all and the sitemap (`features/admin/refresh-listings.ts`); an edit to a draft refreshes nothing;
  more than 100 listings at once, and changes to cycles, settings, states, refunds and reviews, still refresh the whole
  store. Similar items on other product pages catch up within the 5-minute fallback, as after a sale.
- The website deploys once a day at 09:00 UTC, when `main` changed and its CI run is green
  (`.github/workflows/daily-deploy.yml` calls the Vercel deploy hook; `apps/web/vercel.json` turns off Vercel's
  deploy on every push). "Run workflow" on it deploys at once. Migrations still go through the Deploy workflow.
- A card with several options no longer carries them in the page: the cache keeps their number and whether all are
  sold out (`features/catalog/slim-cards.ts`), and the + reads them when pressed from `GET /api/card-options` (the
  store's variants view, kept by Vercel's CDN a minute; the read starts as the finger goes down). A card with one
  option still adds at once.
