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

**D-119 · 2026-10-14 · founder: The pilot price in two recipes, a profit guard, and a bulk saving that stops at a cap** · small food amended by D-120, D-122
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

**D-123 · 2026-10-14 · founder: The bag's charges follow the bag; food carries its weight in Shipping, not in its price** · display and the free line amended by D-124
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

**D-124 · 2026-10-14 · founder: One Shipping number that grows with the bag, struck through and free from the line up**
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

