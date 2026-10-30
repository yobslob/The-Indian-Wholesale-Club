# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-150 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept). When Recent holds more than about ten entries, the oldest move to the archive in full and
leave a one-line index entry here (done for D-109 – D-139 on 2026-10-22, D-140 – D-143 on 2026-10-23, D-144 – D-145 on 2026-10-24, D-146 – D-150 on 2026-10-26).

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
- **D-079** 2026-10-08 · founder: The shell (header, banner, footer, app tab bar) and the Home hero, from the design pass; Cinzel and Karla · header colour, "no blur" and heading font amended by D-080 · the hero's line SUPERSEDED by D-161
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
- **D-109** 2026-10-11 · founder: The pilot price follows the shop's own price (Amazon → door) · formula SUPERSEDED by D-119
- **D-110** 2026-10-12 · founder: Pilot listings come from Indian online shops; "spice" becomes "food"
- **D-111** 2026-10-12 · founder: Margins by product type; small orders pay their charges instead of a minimum; the free-delivery bar · margins amended by D-119
- **D-112** 2026-10-12 · founder: Card fees are inside the margins; the small-order charges are fixed and show $0.00 when waived · formula SUPERSEDED by D-119; charges amended by D-123
- **D-113** 2026-10-12 · founder: Home's moving album of all of India; the header's Search grows into a search bar
- **D-114** 2026-10-12 · founder: Checkout saves the address and offers the saved ones
- **D-115** 2026-10-12 · founder: The pilot is made to order: no cycles, delivery 12 – 18 days from the order · amends D-008
- **D-116** 2026-10-12 · founder: A polish pass on every element before launch (website and app)
- **D-117** 2026-10-12 · founder: The free-delivery bar fills sideways; phones get Search for Saved; layout fixes · amends D-116, D-079
- **D-118** 2026-10-13 · founder: Auto-sourcing from targets, variants of every kind, a weekly price and stock check
- **D-119** 2026-10-14 · founder: The pilot price in two recipes, a profit guard, and a bulk saving that stops at a cap · small food amended by D-120, D-122; restored by D-125
- **D-120** 2026-10-14 · founder: Small food on $1.99 – $3.99, and every draft published
- **D-121** 2026-10-14 · founder: Myntra ₹600 – ₹1,600 clothing for every state; the state tag optional; cheap home pieces priced right
- **D-122** 2026-10-14 · founder: Food priced in step with its weight, footwear like Amazon US, the pack on food cards, See all for every type, each state's own first row, food for every state
- **D-123** 2026-10-14 · founder: The bag's charges follow the bag; food carries its weight in Shipping, not in its price · SUPERSEDED by D-125 (the food weight)
- **D-124** 2026-10-14 · founder: One Shipping number that grows with the bag, struck through and free from the line up · SUPERSEDED by D-125 (one Shipping number stays)
- **D-125** 2026-10-14 · founder: No bag ever loses: every cost in the price, heavy pieces on the founder's formula · food's price amended by D-126 (the band; Shipping still keeps every bag whole) · its Shipping top-up SUPERSEDED by D-154
- **D-126** 2026-10-15 · founder: The courier at ₹2,000 a kg; food in a strict 17–20% band, packed tighter; prices end in .69 too · paused by D-127 (beta pricing; archived)
- **D-127** 2026-10-15 · founder: Beta pricing, fixed in code; the full formula archived · beta formula SUPERSEDED by D-128 (the archive and the switch stay)
- **D-128** 2026-10-15 · founder: The beta prices by the founder's exact rules; Products → Download Excel
- **D-129** 2026-10-15 · founder: Every price rests on a real weight, and every product shows its weight
- **D-130** 2026-10-15 · founder: The India desk weighs each piece when it reaches the hub
- **D-131** 2026-10-15 · founder: A weight estimator on the laptop gives every listing a realistic weight, fast
- **D-132** 2026-10-16 · founder: Clothing is weighed by class: light 350 g, medium 750 g, bottoms and footwear 800 g, heavy 1.5 kg
- **D-133** 2026-10-16 · founder: Food is priced on its packed weight: the label's net quantity plus its pack; the hub's scale, then an admin, then the system
- **D-134** 2026-10-16 · founder: Home & gifts are priced on the weight their own page states, checked, never shown to customers
- **D-135** 2026-10-16 · founder: Food weighs its label's net weight, no packaging; liquids are not sent, shown as coming soon (supersedes D-133's packing)
- **D-136** 2026-10-16 · founder: Home's Just listed switches between the types; See all gets a proper filter panel; filters and Show more never reload the page; admin Products gets filters
- **D-137** 2026-10-16 · founder: Source in bulk: food ₹1–300 without liquids or dairy, all of Amazon and Flipkart's home & gifts, thousands of listings in as few runs as possible
- **D-138** 2026-10-18 · founder: Home & gifts next: fill it with festival pieces (dandiya, Navratri, Dussehra, Diwali) and the whole range of home decor, ₹0–900, Amazon only
- **D-139** 2026-10-18 · founder: Food: every branded snack, munchie, biscuit and everyday food people order again and again, ₹1–200
- **D-140** 2026-10-18 · founder: Design & ergonomics plan v5: Home's three Just listed rows, Women · Men, order from the shop in one tap, three invoices, the struck Shipping figure, instant taps, + picks the size, − n + on cards, admin pagination
- **D-141** 2026-10-20 · approved: photos live in Cloudflare R2 as two AVIF copies; Supabase's storage keeps none
- **D-142** 2026-10-20 · approved: a listing keeps each picture once (the shop's preview copies are dropped)
- **D-143** 2026-10-21 · founder: a piece's name loses only the shop's or brand's name
- **D-144** 2026-10-21 · founder: See all opens low to high; Clothing's finishing touches in a jewellery drawer
- **D-145** 2026-10-21 · founder: stay on Vercel's free plan; fewer page-cache writes
- **D-146** 2026-10-22 · founder: every listing gets a weight, then everything is published; one press each for Weights to check, Drafts and Names to tidy
- **D-147** 2026-10-22 · founder: new Vercel and Supabase accounts, used within their free limits; a production metrics plan; one tidy set of docs
- **D-148** 2026-10-22 · founder: 7-day delivery: a page of the quick-delivery shops' pieces, Home's new line, and the first Blinkit batch · its mixed-bag rule (one normal piece makes the whole bag normal) SUPERSEDED by D-154 · Home's line SUPERSEDED by D-161
- **D-149** 2026-10-23 · founder: the sourcing runner rests a shop that blocks it · its rests SUPERSEDED by D-158 (knowing a robot check stays)
- **D-150** 2026-10-23 · founder: the 7-day targets search all four quick shops (answers Q-43)

## Recent (full text)

**D-151 · 2026-10-23 · founder: the runner never browses headless (the cause of D-149's Blinkit block)**
- Founder, verbatim: "I deployed and uploaded on auto runner, still getting errors, Can you properly fix it? It was
  working well before all the vercel supabase cloudflare R2 changes, why is it failing now, properly deeply fix it"
- What was found: the runner's `.env` says `IWC_SOURCING_HEADLESS=1`. Blinkit's Cloudflare answers headless Chrome
  with its block page every time, while the same code, profile, PC and minute in a window read Blinkit at once (28
  results, product pages, listings ready; checked by switching only that setting). Blinkit last worked on 2026-10-19;
  the `.env` was rewritten on 2026-10-20 (the R2 photo store's keys, D-140) and again on 2026-10-23 (the new Supabase
  project), and no run went between 10-19 and the first failing one, which fits the founder's sense that it broke with
  the account changes (the file's earlier contents can't be seen, so not proven).
What it means for the build (`tools/sourcing-runner/src/browser.ts`):
- **Chrome always opens a real window, off-screen** as before; `IWC_SOURCING_HEADLESS=1` is ignored with a line in the
  log. The headless-only code that changed Chrome's user agent is gone.
- D-149's rests stay as the safety net when a shop does block.
- Seen on the way, not fixed here: Instamart's search has returned 0 results on every run since 2026-10-13 and Zepto's
  on about four in five, so the 7-day targets (D-150) find pieces on Blinkit and BigBasket only until those readers are
  fixed.

**D-152 · 2026-10-23 · proposed: Zepto and Instamart are read from their own search answer and item-page data**
- Asked for: the readers D-151 left to fix (Instamart 0 results on every run since 2026-10-13, Zepto 0 on about four
  runs in five), so the 7-day targets (D-150) fill from all four quick shops.
- What was found (dry runs in the runner's window, 2026-10-23): neither shop blocks the window; both show results and
  item pages as usual. The generic reader (D-118: any object with a name, a price and an id, the unit checked against
  "₹" prices on the page) could not see them: Zepto's search answer (`bff-gateway.zepto.com/user-search-service/api/v3/search`)
  keeps the name in `product`, the pack in `productVariant` and the price (paise) beside them; Instamart's
  (`/api/instamart/search/v2`) keeps each pack in `variations`, prices as `{ units, nanos }`, and its page prints prices
  without "₹". Zepto's few hits came from other answers its page loads. Instamart's 403s (2026-10-13 to 10-19) were
  headless Chrome (D-151); in a window its AWS check clears by itself.
What it means for the build (`packages/shared/src/sourcing/auto/readers/quick.ts`, `tools/sourcing-runner/src/shops.ts`):
- **Search:** the reader waits up to 30 s after the page opens for the shop's own search answer and reads every pack
  in it: price, MRP, stock (Zepto's available quantity or sold-out flag, Instamart's `inventory.inStock`), pack, rating,
  photo, sponsored, and its page (`zepto.com/pn/x/pvid/<pack id>`, `swiggy.com/instamart/item/<item id>`). No answer in
  time is a failed search, searched again (D-137); an answer with no products is nothing found. One page (30 – 60 packs).
- **Item pages:** Zepto's from the page's Next.js flight data (its `self.__next_f` scripts), Instamart's from its page
  state (`___INITIAL_STATE___.productV2`). A product's packs are one listing's variants (Instamart's "57 g x 2" beside
  "57 g"); Instamart's card pack keeps the item's id as its key (the id in its page address), its other packs their own.
- Unchanged: the pace, the window (D-151), the robot-check rests (D-149); no disguise. Drafts from both still need
  ingredients and allergens (the capture does not read them on these pages), as BigBasket's do.

**D-153 · 2026-10-23 · founder: the runner keeps each quick-commerce shop to the pace it took without trouble** · SUPERSEDED by D-158
- Founder, verbatim: "I did everything again this time it is working well, but the food run showed 0 checks due, 4
  targets, 6 shops and added only some of the items while the home is still running and it showed 0 checks due, 100
  targets, 6 shops, I also want all those food items too not just a little"
- What was found: the food run's 4 targets made 76 listings (Zepto, Instamart and BigBasket read; D-152). Only 4 were
  waiting because about 65 food targets were claimed by the run stopped at 20:37 UTC on 2026-10-22 (before Ctrl+C gave
  them back, D-149); the database takes them back six hours after the claim, at 02:37 UTC (08:07 in India). Then
  Blinkit answered **429 "too many requests" with Retry-After 73,954 s** (about 20½ hours) and BigBasket's Akamai
  "Access Denied" after the home run asked it about 100 pages in 20 minutes, with the food runner on the same shops at
  once. From 13 to 19 October these shops took up to 60 – 95 pages an hour with at most one robot check.
What it means for the build (`PAGES_PER_HOUR`, `paceWaitMs`, `retryAfterMs` in
`packages/shared/src/sourcing/auto/shop-rest.ts`; `tools/sourcing-runner/src/lanes.ts`, `rest.ts`, `robot.ts`):
- **An hourly page limit per shop, both runners together:** Blinkit, BigBasket and Instamart 60, Zepto 90; Amazon,
  Flipkart, Myntra and Shopify shops none (their own pace and 429s). A shop at its limit waits ("60 pages in the last
  hour; the next in 4 min"); the others go on. Each runner writes its own `out/pace/<process>.json`, both read all.
- **A shop's own Retry-After is believed:** a 429 rests the shop at once for as long as it asked (never past two days),
  instead of two hours.
- **A run stops starting targets after five hours** and gives the rest back, so a slow run never meets the six-hour
  take-back.
- At these limits a 7-day target (four searches and up to its Listings' page reads) takes about a quarter of an hour of
  one shop's hour: the batch fills over several daily runs, not one evening.
*Interpretation (proposed, confirm when convenient):* the limits are Claude's, from the log; they can be raised for a
shop that keeps answering.

**D-154 · 2026-10-23 · founder (was Q-41): 7-day delivery is its own store; one bag, two shipments from $49.99; Shipping at $18.62 a billed kg**
Supersedes D-148's mixed-bag rule and the Shipping top-up of D-125 / D-126 (and D-140's display-only struck figure).
- Founder, verbatim (approving `7-day delivery study and build plan.md`, 23 Oct 2026, by @Jollwin): "Now read this
  design carefully and design this into our existing website without breaking any code."
- The plan's own words for the rules, in the order the site applies them: "**The 7-day store** has its own entrance (a
  sliding store switch), front page, categories and search, holding only 7-day pieces. One account and one bag serve
  both stores." · "**7-day pieces worth $49.99 or more** ship in 7 days as the first shipment. Everything else in the
  bag ships in 12 – 16 days as the second." · "**7-day pieces under $49.99** travel with the rest in 12 – 16 days, and
  the bag says how much more brings them in 7." · "**Shipping is free** for a bag of only 7-day pieces from $49.99 and
  for any bag from $99.99, shown struck through at its growing figure; otherwise it is charged at $18.62 a billed kg,
  and a split bag pays what one parcel would."
- Decided in the plan: "The $49.99 counts the 7-day pieces after any promo code, before Shipping and the bulk saving."
  · "The 7 days count from the order, any hour, any day: the courier collects door to door every day, 24 × 7, and
  delivers in 7 days (your answer of 23 Oct; this closes Q-41)." · "7 days for the 48 contiguous states and DC;
  elsewhere the 7-day pieces travel with the rest." · "Cancel: free until the hub buys the 7-day pieces; after that the
  7-day shipment cannot be cancelled (food cannot go back). The second shipment can be cancelled until it leaves India
  (D-072)." · "Late: the usual delay notice with the choice to cancel that shipment (D-008)." · "Food shipped with at
  least 3 months of shelf life." · "The normal window becomes 12 – 16 days (Settings → Standard delivery; it reads 12 –
  18 today)." · "The drafted words are approved (23 Oct)."
- Shipping: "**Shipping = $18.62 × the bag's billed kg**: its packed weight (food at 110% of its label, as today)
  rounded up to the half kg, at least 1 kg." · "**A split bag is priced as one parcel:** the whole bag's weight, not
  each shipment's. On the receipt, shipment 1 carries its own weight's share and shipment 2 the rest, so the two always
  add up to the one-parcel figure." · "**Settings:** "Shipping per kg" ($18.62), the free line ($99.99) and the 7-day
  free line ($49.99)." · "The pricing formula's margins carry US duty and the other costs, so Shipping only follows the
  weight" (the top-up of D-125 / D-126 is "Gone with this plan").
- The plan's 35 cases, the store switch's design, the bag's shipment groups and two meters, the admin's two shipments
  and the five-step build plan are in the plan itself; the build follows its order (1 database, 2 admin, 3 bag and
  checkout, 4 the store switch and front page, 5 Insights). Express stays off for the 7-day shipment and may apply to
  the second as today.
What it means for the build:
- **Settings** gain `quick_delivery_min_cents` (4999: the 7-day line and the 7-day free-Shipping line),
  `shipping_cents_per_kg` (1862) and a 7-day pause switch; the normal window is set to 12 – 16. The fixed small-order
  Shipping ($18.79), the shown-Shipping $ a kg (D-140) and the top-up stop deciding Shipping.
- **`order_shipments`:** an order has one or two shipments, each with its pieces, promised dates, tracking, status and
  delay notice; existing orders get one each (their tracking becomes shipment 1's).
- **The server decides** the shipments and Shipping in `store_quick_bag`, `store_bag_charges`, `checkout_context` and
  `create_order`; the browser only shows them (`/api/bag-charges`), so no page is rebuilt per visitor (D-145).
- **Price, retailer charges, bulk saving and Express** are not changed by this plan.
*Interpretation (proposed, confirm when convenient):*
- **One parcel, not per shipment.** The plan's rules, money section and worked tables price a split bag as one parcel
  ("7-day pieces ($55.71) + a kurta (two shipments) … $46.55 (as two parcels it would be $55.86)"), while its build
  plan says "Shipping becomes $18.62 a billed kg per shipment" and "Shipping as $18.62 a billed kg per shipment". Built
  as one parcel, split between the shipments by weight on the receipt.
- **Retailer charges** ($0.99 on production) are not named by the plan: an all-7-day bag from $49.99 gets free
  Shipping and still pays Retailer charges until $99.99, as today below the line.
- The docs still say the free line is $149.99 and Retailer charges $1.99 while production has $99.99 and $0.99 (the
  plan, from the production copy of 21 Oct): Settings values, read from Settings, nothing hard-coded.
- "48 contiguous states and DC" is the address's state code; a PO box or APO/FPO/DPO address line or a non-contiguous
  state (AK, HI, territories, AA/AE/AP) keeps the 7-day pieces with the rest.
- Step 2 (the admin, migration `20261024090000`): a shipment of an order without a cycle (the pilot) ships from the hub
  once its pieces are there, as the plan says the second shipment leaves "when its pieces have reached the hub";
  until now `ship_order` wanted an arrived cycle, so a pilot order could not be marked shipped at all. A cancelled
  shipment refunds its pieces, its Shipping share and their tax; a 7-day piece refunded as unavailable refunds its
  price and tax only (the item rule of D-042), its Shipping share stays. A cancelled shipment's pieces already at the
  hub become US clearance drafts, as a whole-order cancel's do today (D-072).
- Step 3 (the bag and checkout): words the plan does not give are Claude's draft (D-059): "Your 7-day pieces now travel
  with the rest: …" (falling under the line), the meter's "7-day delivery: $37.59 of $49.99", checkout's line for an
  address outside the 48 states and DC, and its line naming the promo code; the order page's "Keep it" / "Cancel
  shipment 2". A note with Undo stays six seconds instead of three, so the button can be reached.
- Step 4 (the 7-day store, migration `20261026090000`): the 7-day store is every page under `/7-day-delivery` (its
  front page and its search). The header's categories are the database's own 7-day categories, biggest first ("Snacks &
  Namkeen", "Rice, Flours & Staples"…), not the plan's short names (Snacks, Sweets, Masalas, Staples, Pickles, Tea,
  Pooja and home), which no category has; two fit beside the logo below 1280 px, four above. "From your state (when
  one is chosen)" is not built: the site keeps no chosen state. The switch shows only while the 7-day store has pieces
  (an empty store has no door). Most ordered this week counts units in paid orders of the last 7 days; Under $5 is
  under 500 cents. In the app, which has no shared header, the switch sits at the top of Home and of the 7-day screen.
  Words the plan does not give are Claude's draft (D-059): "Search the 7-day store", "Everything in the 7-day store",
  "Nothing in the 7-day store matches …" with "Search the whole IWC store", and See all's Delivery group ("Any" / "In
  7 days").
- Step 5 (Insights, migration `20261027090000`): "bags" are paid orders (a bag never checked out leaves no record);
  "stopping just past $49.99" is 7-day pieces after the promo within $5 of the line (then $5 – $15, more). "On time"
  is delivered (its delivered event, on the US Eastern calendar) by the date promised when the order was placed, kept
  in `promised_to`, since a delay moves the date the customer sees; a late shipment "had its notice first" when a
  delivery-window change for it was sent on or before that day. The split's extra courier cost is the two parcels'
  courier charge less one parcel of both (Settings' ₹ a kg, at least 1 kg then by the half kg, food at its billed %).
  The app has no Insights screen, so this is web only.
- Founder, 2026-10-24 (web): "I want the same aesthetics for 7-day store as the main one, when clicked on category it
  should open up, filters all over"; "Design aesthetically for smaller screen viewers lower the size cards for them";
  "The switch pill should be smaller, hovering over the page under the nav bar". Built as: the 7-day store's own See
  all pages (`/7-day-delivery/food`, `/7-day-delivery/home-and-gifts`, `?category=`), the IWC store's See all with only
  7-day pieces; tiles, the header's categories and the front page's new Food and Home & gifts rows open them (the front
  page's pills and full list are gone, as is `/api/seven-day`). On phones row cards are 148 px and food and home See
  all grids three to a row (clothing keeps two). The switch is a 272 × 38 px frosted pill under the header (224 × 36
  on phones). The app is unchanged.

**D-155 · 2026-10-24 · founder: a bottle's and a lunch box's real weights; heavy cookware priced on half its weight plus Heavy-item shipping**
- Founder, verbatim (on tiffins, lunch boxes and bottles at $48 – $74 and a cooker over $110): "Tiffins/lunch boxes and
  bottles are very very expensive for some reason as 73.55, 48.38,etc etc they should be $20-35 same goes for cooker it
  should be around 90-110"; then "the bottles are 450-550gms, the lunch boxes are 600-800gms and on the heavy cookware
  such as steel cooker show the price for half the weight considered and then add a new tag as heavy-item shipping
  which will be added to it at checkout, it won't affect the pricing rules, they remain the same just a new charge will
  be added as heavy-item shipping only when a heavy cookware which we can't really modify is added." Their answers the
  same day: the charge is "The other half"; from the free-shipping line it is "dropped by 20% only(shown as
  struck-through)"; heavy pieces are "Items like steel cooker".
- What was found: a quick shop's bottle or lunch box page states no weight in grams, so its capacity ("1 L", "1.2 L")
  was read as its weight (1 ml = 1 g) and its packing added: a 1 L bottle was priced on about 1.2 kg.
What it means for the build (D-128's rules unchanged):
- **Weights:** a bottle's or lunch box's ml and litres are never its weight (`vesselWeight`, `homeWeight`, `pieceWeight`
  in packages/shared); with no weight in grams it is priced on the middle of the founder's range, 500 g or 700 g, packing
  included. Migration `20261028090000_vessel_weights` corrects the listings already made: an option no person weighed
  or typed, above the range (550 g, 800 g), goes to 500 g or 700 g.
- **Heavy-item shipping** (migration `20261028100000_heavy_items`): `products.heavy_item`, set for a home piece named a
  cooker when it is listed, ticked or unticked on the product's admin page. Its options are priced on half their weight;
  the other half (the same rules on the whole weight, less the price) is `heavy_cents`, added in the bag and at checkout
  as "Heavy-item shipping" on standard and express alike, taxed like Shipping, kept in the order's shipping with its
  part beside it (`orders.heavy_shipping_cents`). From the free-shipping line or the 7-day line 20% comes off it
  (`pricing_settings.heavy_line_off_pct`, Settings), the whole struck through. The product page tags it: "Heavy-item
  shipping + $65.21, added at checkout". A heavy piece priced by hand has no charge.
*Interpretation (proposed, confirm when convenient):*
- "Items like steel cooker" is built as every home piece with "cooker" in its name, the admin ticking any other heavy
  cookware (a kadai, a large handi); nothing else is found automatically.
- A bottle's or lunch box's weight is the middle of the founder's range, whatever its size; a weight its page states in
  grams still wins.
- The cards (rows, See all) do not carry the tag; the product page, the bag and checkout do.
- A heavy piece refunded as unavailable refunds its price and tax (D-042's item rule); its Heavy-item shipping stays
  with the order's shipping, as Shipping does, unless the admin refunds it by hand (Q-44).

**D-156 · 2026-10-24 · founder: ergonomics: one free-delivery bar, instant categories, a state's types in a switch, the store tabs** · the state page's rows SUPERSEDED by D-157
Founder, verbatim: "The website currently has a lot of bad ergonomics choices made while designing such as: 1. two
bars while showing that the customer is approaching free delivery, They should only focus on one. When $50 delivery is
unlocked I am seeing add more for free delivery at bottom while at checkout it is already free. 2. In 7 day store when I
click on a category it waits for a long time before opening the category. 3. In states I want the same consistency in
design as normal pages while distributing clothing, food and home n gift in a toggle. 4. I still don't like the 7 day
toggle it looks so badly placed, do something creative with it. 5. Look all these issues from a user's perspective, use
psychology, designing and ergonomics. All these things show that test's haven't been done properly."
What was found: the pill and the bag counted "free" only from $99.99, so a bag of only 7-day pieces from $49.99 (free
Shipping at checkout, D-154) still read "Add $X more for FREE DELIVERY", under a second 7-day meter; every open page asked
`/api/bag-charges` four times for one bag; a 7-day category was built on its first click after each deploy (1.7 – 2.4 s
with nothing on screen, measured on the live site; 35 – 270 ms once built); the state page ran every type into one long
page under jump pills; the store switch floated over the page's content.
What it means for the build (prices, lines and charges unchanged):
- **One goal, one bar** (`packages/shared/src/domain/bag-goal.ts`, used by the pill, the bag's summary and the app): a bag
  of only 7-day pieces under $49.99 → "Add $12.40 more for FREE 7-DAY DELIVERY" (the bar on the 7-day line); from $49.99
  → "FREE 7-DAY DELIVERY · by Fri, Oct 30", the bar full; any other bag under $99.99 → "Add $X more for FREE DELIVERY";
  from $99.99 the bar refills with the bulk saving (D-119). The 7-day meter is gone; a mixed bag under the 7-day line
  keeps "Add $12.40 of 7-day pieces and they arrive by …" as words under its shipment. One `/api/bag-charges` request per
  bag, whichever components ask.
- **Instant categories:** every 7-day category's page is built with the deploy (about a dozen more page writes a day,
  well inside `monitoring.md` §1), and a See all page (both stores) shows its own shape and the running stitch the moment
  its link is tapped (`loading.tsx`, `browse-skeleton.tsx`).
- **A state's types in a switch:** under the hero and the album, the See all pages' frosted Clothing · Food · Home & gifts
  switch with each type's count, pinned under the header; each type's rows as Home and the 7-day store draw theirs (New
  arrivals, Most wanted, Picked for you, Leaving soon, then a row per category with "200 pieces" and See all), its
  categories as chips above them. All three are in the cached page; the switch only shows one (`#food` in the address).
- **The store tabs** (`store-switch.tsx`): the two stores as two tabs on a dark strip along the very top, like a
  browser's; the open tab is the header's own colour and runs into it (ivory in the IWC store, a warm brand tint in the
  7-day store), each says its promise ("All 36 states", "arrives by Fri, Oct 30"). The strip scrolls away with the page
  and the header stays; nothing floats over content.
*Interpretation (proposed, confirm when convenient):* the goal for a bag with both kinds is free delivery ($99.99), never
the 7-day line (one bar, and the bigger saving); the IWC tab's line "All 36 states"; the 7-day header tint (12% of the
brand colour on ivory); a state opens on Clothing, or the first type it has. The app's Bag and pill use the same goal; its
store switch is unchanged.

**D-157 · 2026-10-24 · founder: a state's inventory has See all's filters, not pills**
Founder, verbatim: "need filters instead of pills on a state's inventory."
What it means for the build:
- Under the hero, the album, Most wanted and Picked for you, the state's Clothing · Food · Home & gifts switch (D-156)
  opens each type as See all draws it (`browse-view.tsx`): the filter panel from 1024 px and the Filter bar below it
  (For, Category, Price, Size or Pack, and Delivery while there are 7-day pieces), the chips, Sort by, the grid and Show
  more. The state is the page's: no State filter or chip, Clear all keeps it, the heading is the type or category.
- The address stays the state's and carries the filters: `/states/punjab?type=food&category=sweets` (Clothing has no
  `type`); Back steps through them, a refresh or a shared link opens the same view (`BrowseQuery.inState`,
  `use-browse.ts`). The page stays one cached build: each type's first 24 cards and counts come from one cached
  `store_browse()` read per type, refreshed with the state (`browseStateCached`), so a sale shows "Sold out" on the
  state's page at once as before; the other filters are read in the browser from `/api/browse`.
- The category pills, New arrivals, Leaving soon and the rows per category are gone from the state page (See all's
  Newest sort and "In 7 days" cover them).
- The page reads only its head (`store_region_head()`, migration `20261029090000`) and its first type's first page; the
  other types are read when opened, from See all's cached `/api/browse` answer. The website build of 2026-10-24 ran
  past the database's 8 s statement limit ("canceling statement due to statement timeout") with every state page
  reading `store_region_page()`'s card lists (Punjab: about 380 KB, 3.6 s cold on a production copy) and three
  inventories; the head takes about 40 ms. The build prerenders one page at a time per worker.
*Interpretation (proposed, confirm when convenient):* Most wanted and Picked for you stay above the switch (the state's
own picks); Leaving soon is dropped.

**D-158 · 2026-10-24 · founder: the sourcing runner has no rests and no hourly limits; one run takes every target**
Founder, verbatim: "remove these limits that you've put on the sourcing runners, I will just add the csv and run it
one time, remove the resters for these bot checks". Supersedes D-153 and D-149's rests.
What it means for the build (`tools/sourcing-runner`):
- No shop rests after robot checks or a "too many requests" (`shop-rest.json` is gone) and no shop is paced (D-153's
  60 – 90 pages an hour, `out/pace/`, are gone); a refused page only fails and the run goes on. The robot check is still
  recognised, so a refusal never marks a target "nothing fit" or a listing out of stock: an empty target goes back to
  the queue, a refused listing keeps its price and stock. The pause between one shop's pages (2.5 s and a little) and
  the Shopify catalogue's short 429 waits stay: they are how a page loads, not a limit.
- One run takes every queued target: it claims Settings' Targets per run at a time and claims again until none is
  left; no five-hour stop. Targets handed back during the run wait until it ends, so the run never takes one twice.

**D-159 · 2026-10-24 · founder: every listing in its own category, never shown in another's**
Founder, verbatim: "make sure everything is in their category and not getting shown in someone else's".
Found on the live store (9,887 listings read 2026-10-24): the sourcing runner files a listing under its target's
category (`worker_sourcing_add`), so a search's stray results landed under it: chutneys and pickles under Masala
blends, kahwa under Masala blends, black cardamom under Papad & wadi, bhakarwadi under Papad & wadi, soan papdi under
Snacks; and some are not food or home at all: dog chews and dog food under Snacks and Staples, hair oil, rakhis under
Sweets, dhoop sticks under Whole spices, Mysore pak under Home & gifts. No listing's category was of another type.
What it means for the build:
- One set of rules reads a listing's own name (`packages/shared/src/sourcing/category-check.ts`): a category is
  proposed only when the name plainly says it and nothing else ("masala cashew" stays a snack, "laddu gopal" is
  Krishna, "jaggery balls" stay a sweet); names that fit their category, two or none are left alone. Clothing is not
  checked.
- Admin → Products → **Categories to check** (`/admin/catalog/categories`): each food and home listing whose name says
  another category, with that category picked and ticked (changeable); "Move the ticked" moves them. Below, the ones
  not their type at all, to archive or fix by hand. Nothing changes until an admin presses. A moved listing is repriced
  by the database, which only changes a price where an option has no weight yet.
- The sourcing runner skips a result whose name says another category of the target's type (it waits for that
  category's targets) or not the type at all, so new stray listings are not made.
*Interpretation (proposed, confirm when convenient):* rakhi gift packs with sweets count as gifts, not food; jaggery,
sattu and poha count as staples; chutney powders (podi) as chutneys; whole garam masala as whole spices.

**D-160 · 2026-10-26 · proposed: search reads words as customers write them, and costs nothing to run**
The request (the founder's session brief, as relayed): build the storefront's search "the way a properly built
production website does it: fast, smart, efficient, productive and semantic, but only where it costs nothing".
What it means for the build (Claude's design, awaiting the founder's look):
- **In the database only** (migration `20261030090000_search`): Postgres full-text search with English stems ("kurtis"
  finds "kurti"), a synonym list (spellings and Hindi/English names of one thing: sari = saree, haldi = turmeric,
  punjabi = Punjab; **Claude's draft**, `search_synonyms`), spelling fixes from the live listings' own words ("kurtha"
  → "kurta", said on the page) and, when no piece has every word, the pieces with some of them. A listing is found by
  its name, category, craft, state, summary and type; its description only as the last resort. No paid service, no
  model call per search, no embeddings (they would need a model to read every search).
- **Order:** what can be bought first (coming soon and sold out last), then how well it matches, then the newest.
- **Suggestions while typing** come from one small list (words, categories, states, popular searches) the CDN keeps for
  an hour: typing never reaches the database. Popular searches are suggested only when made of the listings' own words,
  so nobody's name or address typed into search is ever shown to another customer.
- **Search pages are not for search engines:** `noindex` and kept out of robots.txt's crawl, so bots do not run the
  database for random words.
- What is recorded stays as before (the words and the number found, no person); in addition the words a search was
  answered with after a fix, and whether only some words matched (counted with the searches that found nothing).

**D-161 · 2026-10-26 · founder: the homesick design: the wait becomes the proof; every promise rides on what the page already has** · Supersedes D-079's and D-148's Home line · its tab dates, festival line, India time, Where's home, postmarks, diary lines, away tab title and joke copy SUPERSEDED by D-166
Founder, verbatim: "If we don't standout then why will people use our website, providers are already selling to people there in 1 hour delivery, 1 day delivery but we are selling in 7-day or 12-16 days. So we have to target the homesickness emotion, we have to show them the product is coming directly from indian shops directly to their door, so that they buy on monday and they will know it that it is coming on the weekend so that they won't have to go out. We don't have to overkill or fill the whole website or distract the user or make it a blogging page but We have to fill their subconscious with these thing like 7 days shipping from india directly to your door, no tariffs, no shipping over 49.99 in 7 day store, no shipping over 99.99 and door delivery. Introduce new ideas, be very creative about these things, we have to fight with these static website, think outside of the box, not just these points but generate your own new points and be very creative about them. I am giving you the whole plan for this whole design."
With it the founder handed over "IWC: the homesick design plan" (Oct 26, kept as `docs/archive/plan-homesick.md`): its
seven settled decisions (shops said in general, never named; the diary in plain steps; "Duties paid. Nothing to pay
at your door.", never "no tariffs"; the real weekday, no weekend promise; a state postcard in every parcel; the rupee
price on a pack never mentioned; no new emails) and its words, which stay **Claude's drafts** until the founder
approves them line by line (D-019, D-059).
What it means for the build (built 2026-10-26, website and app; not deployed):
- **Every date from Settings and today** (`packages/shared/src/domain/homesick.ts`, tested): the 7-day and the
  standard days reach every page through the cached store policy (migration `20261031090000_policy_days` adds the
  pilot's days to `store_policy()`; no new read), and the browser works the dates out, so a cached page never shows
  yesterday's (`features/shell/days.tsx`).
- **The promises ride on what exists** (no banner, pop-up or ticker): Home's heading "We go home so you don't have to."
  with "India's shelves, at your door." (the plan's pick 1; the 7-day line moved to the store tabs, which already link
  there); the store tabs "At your door by Nov 11" and "Saturday at your door"; 7-day cards "Sat at your door" (CSS,
  no script per card); the 7-day front page "Home is 7 days away. Order today, open it Sat, Oct 31." with "Free 7-day
  delivery from $49.99" and duties paid; Home's band adds the 7-day free line and duties paid; the product page "At
  your door … if you order today", "Duties paid. Nothing to pay at your door." and the India pack line for food; the
  pill "$12.40 more and the flight's on us", its bar a flight path from India to a house, "Coming home Sat, Oct 31"
  after each add; checkout "Where should we bring home?", "That's everything. Duties are paid…", "Packing your
  parcel…"; the thank-you page "It lands Sat, Oct 31. Clear a shelf." with Add to calendar (an .ics made in the
  browser); the order page's diary line per reached step; every customer email's subject and first line, and the
  sign-off "From our home to yours, the IWC team"; the small moments (404, error, search, sold out, filters, the
  empty bag); the footer "Bought in India. Duties paid. At your door."
- **The plan's ideas built:** 1 day names, 2 the diary's lines (on the existing timeline), 3 Where's home (the state
  opened most, from its second visit, greets the shopper on Home in its greeting; on the device only), 4 the
  flight-path bar, 5 India time (footer and phone menu), 6 the festival clock (Diwali only, the date the plan cites;
  a 7-day order must arrive the day **before** the festival, so the last day is Sat, Oct 31, one day earlier than the
  plan's Nov 1), 8 postmarks in the bag and checkout, 9 the kirana counter, 11 the India pack line, 12 the emails. Not
  built: 7 the postcard (printed in India), 10 recipe baskets (the founder picks them).
- **Claude's own ideas (proposed):** the week strip (today to the door as a row of days, the stitch drawn across, on a
  7-day product page and a one-day thank-you page); the duties-paid rubber stamp in the product page's delivery box;
  the tab that says "Your chai's going cold · your bag is waiting" while the shopper is away with pieces in the bag.
- One switch, `DUTIES_PAID` in `homesick.ts`, turns off every duties line if the courier ever charges at the door.
*Interpretation (proposed, confirm when convenient):* "Bought there, sent from there" became "Bought in India's own shops
and sent from India to your door" (a listing's state is where it was made, not always where it was bought, D-004);
"Made in India" stays on the footer only as "Bought in India" (some listings say Imported); the pill keeps "FREE
DELIVERY" once past the line so the word itself is never lost.

**D-162 · 2026-10-26 · proposed: the Diwali home & gifts list, and every listing that can be bought whole from the quick shops is bought there (its 7-day tag)**
- Asked for (the founder's request, relayed by the session that started this work): a targets CSV of everything
  shippable people buy for Diwali (diyas, kandils, torans, rangoli, lights, pooja thalis and items, idols, candles, gift
  boxes, brass and copper, wall hangings, cushion covers, urlis, incense), state crafts where a state is known for them,
  all-India otherwise, nothing that cannot fly; and "every product currently sourced from Zepto, Blinkit, BigBasket or
  Instamart carries the 7 days tag", for new and re-checked listings and those already in production.
- What was found: the 7-day tag is not stored. It is worked out on every read (`_quick_listings()`, D-148): a live
  listing whose every active option's source in use is on a quick-delivery shop. But `_sourcing_settle` chose each
  option's source by price alone, so a piece found on Blinkit with a cheaper Amazon or Flipkart backup was bought from
  the backup and had no tag, from the day it was added and at every weekly check.
What it means for the build (migration `20261101090000_quick_sources`, not deployed):
- **The source chosen:** when 7-day delivery has its days in Settings and every active option with a usable source has
  a usable quick-shop source (in stock, no price held, read without failing, inside the delivery limit), the quick
  shop's source comes first, even when a backup elsewhere is cheaper; otherwise the cheapest, as before. A listing with
  one option sold only elsewhere keeps the cheapest prices (it could not be a 7-day piece anyway). The pause (D-154)
  changes no source. A quick shop sold out or its price held: the backup takes over and the tag goes, so the promise
  stays true. The price follows the shop actually used (D-128's rules unchanged).
- **Already listed:** `pnpm quick:sources` (`scripts/quick-sources.mjs`, the service key; dry run first, then
  `--apply`) switches the listings settled before the migration, in batches, as the weekly check would; each listing
  keeps its check date. It also names sites that look like a quick shop but are not marked as one.
- **The list:** `tools/sourcing-runner/targets/diwali-home-gifts.csv`, 100 home targets (up to 1,515 listings), every
  name starting "Diwali:" so none is skipped as a target already there: 25 on the four quick shops (7-day pieces, no
  ₹ band, as the 7-day CSVs), 36 all-India on Amazon and Flipkart and 39 state crafts on Amazon and Flipkart (both
  ₹1 – ₹900, D-138's band). Tested in `packages/shared/tests/diwali-targets.test.ts`.
*Claude's choices in it (proposed, confirm before uploading, Q-47):* Must match leaves out lit and battery pieces (LED,
electric, USB, solar, string lights: Indian plugs and batteries on the flight, D-138 and Q-37), fireworks, camphor,
lighters and matches, cow dung, feathers, loose colours (kumkum, sindoor, gulal, rangoli colours; powders are the
matcher's form word), pooja samagri kits, hampers and food (dry fruit, sweets, chocolate; food filed under Home & gifts
is skipped by D-159's check), pure silver and gold coins (plated ones only), and liquids are left to D-135's check;
glass and ceramic stay (the hub packs them in a box with wrapping, D-134). Dry-fruit gift boxes are listed only empty
(a box with nuts is food, not home & gifts). A state is given only to a craft the shop's title names and that one
state makes (Moradabad brass, Khurja pottery, Saharanpur wood, chikankari and Banarasi cushion covers, Agra inlay,
Jaipur blue pottery, Pichwai, Jaipuri block print, Kutch torans, Ajrakh, Warli, Madhubani, Sikki, Pattachitra, Pipli,
Bankura horses, Bengal and Bastar dokra, Sohrai, Gond, Kalamkari, Cheriyal, Nirmal, Pembarthi, Bidri, Mysore inlay,
Tanjore paintings and dolls, nettipattam, Kathakali, Kashmiri papier mache and walnut wood, Kangra, Aipan, Phulkari,
Assamese xorai, Majuli masks, Longpi pottery); paintings must say handpainted or handmade and not print or "style".
Children's toys are not searched (D-138). Tiers: 1 the quick-shop rows (only a 7-day piece ordered by Sat, Oct 31
reaches a US door before Diwali on 8 Nov, D-161), 2 the broad Amazon and Flipkart rows, 3 the niche ones; one run takes
every target anyway (D-158). Size: about 10 KB a listing in the database (up to 15 MB) and 0.6 MB in R2 (up to 0.9 GB),
inside the budgets (`monitoring.md`); a bulk publish refreshes the store once.

**D-163 · 2026-10-27 · founder: every listing's photos made again on the founder's laptop GPU: clothing gets a house model's face and skin, food's main photo a tempting scene, home & gifts a room** · its skin recolouring, scenes by default and kids waiting SUPERSEDED by D-164
- Founder (2026-10-27): "We have to change every product's photo, even If a little even if We are making it just look
  enhanced. 1. Clothing: We can't use the current faces, but we made some models and open source AI on our GPU which
  we can replace them with but clothing piece quality should not change, the fabric and the lighting, just the model's
  face and skin(hands, etc.) rest remains the exact same. 2. food: just the front(main) photo, we can change it by
  making it look extra tempting or whatever. 3. home decor and gifts: we can make them put on a wall or something."
  "all our tiers are free(vercel, supabase and R2 cloudflare) so I want minimum usage of everything, cloudflare is
  already at 6.5GB usage with 13k inventory. We can delete or override or replace the current photos no issue in that,
  if it helps." "In all problems like these, try to remember we have a GPU and we have a local laptop which we can
  use." Then: "Just continue with the plan and start building".
What it means for the build (migration `20261102090000_photo_redo`, not deployed; `tools/photo-redo`,
`tools/photo-worker/redo.py`):
- **All on the laptop:** `pnpm photos:redo fetch` reads each photo's 1200 copy from R2 (the original is not kept,
  D-141); `redo.py` makes the new photo on the RTX 4060 offline; `pnpm photos:redo review` shows old and new side by
  side on a local page; `publish` writes the new photo's two AVIF copies to R2, points the listing at it and deletes the
  old copies 10 minutes later (store pages are cached for 5). Nothing runs on Vercel; Supabase sees one small row
  update per photo; R2 about two writes per photo and no net growth for a replaced one.
- **Clothing:** only the face is drawn again (FLUX.2 [klein] 4B on a close crop, the old face blurred away first, the
  house model's face as the reference); arms, legs, hands and neck only change colour towards the new face's skin.
  Every pixel the parser (SegFormer, ATR labels) calls clothing, and a 3-pixel band around it, is copied back from the
  original, so the garment, its fabric and the light cannot change (checked: 0 changed pixels). One house model per
  listing (who wears it, then the nearest skin tone), so a listing never shows two people.
- **Food:** the main photo only: the pack cut out (BiRefNet), a shop thumbnail upscaled ×2 first, set on a table
  scene that suits its category or name, the pack's own pixels pasted back.
- **Home & gifts:** a new main photo in a room (a wall or doorway for torans and wall pieces, a pooja shelf, a
  console, a dining table), the product's own pixels pasted back; the plain photo stays second.
- **R2's size:** new copies use more encoder effort (7 % smaller in a sample of 24 photos); `pnpm photos:redo audit`
  lists what fills the bucket and, with `--delete`, removes listing photo copies no listing shows (over a day old).
*Claude's choices in it (proposed, confirm when convenient):* the hair, earrings and jewellery stay (only the face is
drawn, so a hair accessory or an earring that is the product stays exact); kids' pieces wait (house models are
adults); a clothing listing goes live only when all its photos are approved or have no person in them; a photo the
checks pass can go live with `publish --auto`, but home photos should be looked at on the review page (a home scene can
hide a second, drawn copy of the piece behind it, which the check does not always catch); a photo changed by an admin
or the runner after it was fetched is left alone.


**D-164 · 2026-10-30 · founder: faces change without one photo looking wrong; every other photo only a small change of its own** · Changes D-163's clothing skin and food and home scenes · its faces (drawn, cut under the chin) SUPERSEDED by D-165
- Founder (2026-10-30, after fetching, making and reviewing the first redo): "I did fetch, make and review, when I
  inspected most photos are good but side poses are face-distorted and in some photos neck area skin color is
  distorted, I don't think by this way we can achieve 100% accuracy in clothing. In food, again most are correct but
  then again some arer just cut wrongly. So let's try a way in which we can guarantee 100% seamless change in faces
  that is all what matters, and in rest of the products give me a way which solves the problem of being flagged for
  directly copying the photos I mean we just have to change something a little."
What it means for the build (migration `20261103090000_photo_redo_modes`, not deployed; `tools/photo-worker`
`iwc_worker/redo_clothing.py` and `refresh.py`, `tools/photo-redo`):
- **Faces:** no drawing method can promise every face looks right (side poses are where they fail), so the guarantee
  comes from what is allowed out. A face is drawn again only when it is safe (large, turned to the camera, level, no
  sunglasses, one person) and every check afterwards passes (found once, in the same place, a different person, its
  colour matched to the skin around it, no seam, no pixel outside the face changed). Every other photo with a face is
  cut just under the chin and framed 3 : 4 around the person: nothing drawn, nothing that can look wrong. `--faces
  crop` cuts every face. Neck, arms and hands are never recoloured (the neck faults came from that). Kids' faces are
  always cut. A portrait whose face fills the photo cannot be cut: the founder removes it or keeps it on the review
  page.
- **Everything else (food and home & gifts, every photo; clothing without a face):** the light refresh, nothing cut out
  or drawn (the wrong cuts came from cutting). A white backdrop becomes the store's paper colour and the product is
  framed 3 : 4 with a soft shadow; any other food or home photo is shown whole on paper; both a gentle warm grade.
  Clothing without a face is reframed a little, its colours untouched. Scenes stay available with `--scene`.
- **"Flagged for copying":** measured on 164 live clothing photos, crops, frames and colour grades are what
  duplicate finders are built to see through (perceptual hashes: a 24 % zoom left a fifth of photos under 12 of 64
  bits; a mirror flip a seventh). The paper backdrop moves them reliably (every food and home packshot tested passed
  14 bits); the review page shows each photo's distance and "check it" when it stays close. A small change cannot
  promise a photo is not matched to the shop's by reverse image search.
*Claude's choices in it (proposed, confirm when convenient):* every food and home photo is refreshed, not only the
main one (each is a shop's photo); a shop's transparent backdrop is made white before anything else (it turned black,
the likely cause of some wrong cuts); the paper is the store's own `paper` token shading towards `surface`.

**D-165 · 2026-10-30 · founder: food and home's refresh is right for every product; clothing's faces are swapped, not drawn, and a cut keeps the neck** · Changes D-164's faces
- Founder (2026-10-30, after reviewing D-164): "You have done amazing work with the food and home section, I literally
  like every single photo that It has generated, we can run this for all the products, On the other hand the clothing
  is just trash although there are some very rare conversion which are literally perfect I even clicked on approve on
  those but almost all of them (cropped ones are cropped too much the neck area is so important in kurti if you want
  to crop then start from atleast the chin, on the rest which have face, I can literally see face squares just pasted
  on their original faces), somehow solve the clohting issue. First deeply analyze your option what choices you have
  and then efficiently solve it." Then, asked before downloading, "Yes, download all" (the face swap's models).
What it means for the build (`tools/photo-worker/iwc_worker/faceswap.py`, `redo_clothing.py`; no migration):
- **Why D-164 failed:** the parser's face label runs down the neck, so the cut went on until the collar; and the drawn
  face was limited to a rectangle while the face label ran past it, so its straight edges showed.
- **Faces:** a face swapper, not a drawing: the face is aligned from its five landmarks, HyperSwap (256 px) gives it
  the house model's identity with the photo's own pose, expression, light and skin tone, GFPGAN sharpens a large one,
  and it goes back through the inverse alignment with soft edges, so there is no edge and the neck matches. Kept only
  if every check passes (one face, in the same place, a different person, no seam, no garment pixel changed).
- **Cuts:** at the chin (the bottom of the face YuNet finds), the neck and neckline kept; only for a profile, two
  people or a failed check. A face is only what YuNet finds (the parser's label alone also marked shoulders and a
  cheek under an earring). A cut that would lose most of the photo (a portrait, a collage) is the founder's call.
- Measured on 164 live clothing photos: 74 swapped (all seamless by eye, side poses included), 8 cut at the chin, 82
  without a face; about half a second a photo.
*Claude's choices in it (proposed, confirm when convenient):* HyperSwap over inswapper (sharper; inswapper kept a bindi
more often and stays behind `--swapper inswapper`); `redo.py --again` keeps the photos the founder approved.

**D-166 · 2026-10-30 · founder: faster cards and endless scroll; the tabs say only "IWC" and "7-day store"; the homesick design told in pictures, not text** · Changes D-161, D-136's Show more, D-154's tabs
Founder, verbatim: "The design is better but a lot of code broke internally without showing any errors and passing all the tests, a lot of inconsistencies, a lot of AI slop got introduced our website looked 'made without AI' before. Also the functioning got worse, Now when I load and click + on any product it takes so long, when I click + for a multi varient product its weight shower takes so long, The load more issue again, it takes the user back to top and it takes so long to load more products, let's do this instead as soon as the user screen bottom reaches on row above the load more, it is already triggered, so the user gets an illusion of never ending scroll until the inventory runs out and if the user reaches ther first show a loading icon only, the stores name should be IWC and 7-day store only no subtext on the top tabs. The free delivery bar comes so late after adding a product. Now coming to design, When I said I want it to look like it is coming from India I didn't mean I want it to fill it with whole lots of texts and AI slop cues. I want it visually I want you to generate ideas of your own, ideas that are very very creative and out of the box, something like a plane flying from india to us carrying a banner of diwali or free delivery on 49.99 I want to make the website more visual rather than AI slop. You don't have to generate images just leave a placeholder there and I will fill. I want to modify and make the 7 day store as visually powerful as IWC look right now, 7 day store is just filled with text although the sections are perfectly named."
What it means for the build (2026-10-30, website; not deployed):
- **The +:** a several-option card's options are read while it comes near the screen, every card in that moment in one
  request (`GET /api/card-options?ids=`, up to 48, CDN-kept a minute), and the picker's code is loaded with them, so
  the + opens at once. Adding a piece no longer re-renders every card (`useShallow`). Card links no longer prefetch
  every product page in view; a product page is fetched when the pointer or a finger reaches its card.
- **The free-delivery bar:** shows with the first piece (its count), asks for the bag's charges at once instead of
  after a pause, and starts from the last answer kept for the tab.
- **Endless scroll on every See all page** (replaces "Show more"): the next 24 are asked for when the screen's bottom
  reaches the row above the last one, and the 24 after them are read ahead, so the cards keep coming until the
  pieces run out; the address never changes, so the page is never reloaded and the scroll stays put; reaching the end
  first shows only a loading circle (a "Try again" if a read fails). Pages past the first 480 pieces are read fresh,
  not kept in the data cache, so scrolling far never grows it.
- **Store tabs:** "IWC" and "7-day store", nothing under them.
- **Text taken out** (D-161's ideas that were words, not pictures): the tabs' dates, the festival line, India time,
  Where's home, the postmark line, the order page's diary lines, the away tab title, the footer promise line, the
  India-shops line on product pages, and the jokes in small places (sold out, no filter match, search placeholder,
  404, error, checkout's step and button). Kept, as the founder chose them: "the flight's on us", the empty bag
  ("Lighter than a tiffin. Let's fix that."), the thank-you heading ("It lands … Clear a shelf."), the emails, Home's
  heading, the kirana counter and the 7-day rows' names; the product page's duties stamp and week strip (pictures).
- **The flight** (`features/visuals/flight.tsx`): India's outline (`INDIA_OUTLINE`, the map's states traced as one,
  under 2 KB), a plane that sews the running stitch to a house once the band is in view, towing a maroon cloth: "Free
  delivery from $49.99" on the 7-day store, "Free delivery from $99.99" on Home, "For Diwali, order by Oct 31" while a
  festival can still be reached (on Home it then opens the 7-day store). Drawn in SVG, no image, parked with reduced
  motion.
- **The 7-day front page:** the paragraph became a parcel's address label (From India, To your door, "Order today, open
  it Sat, Oct 31.", duties ticked like a customs box, a rubber stamp with the weekday), the founder's photo beside it,
  the flight under it, the category tiles on a shop shelf, and a wide seasonal poster between the rows.
- **The founder's pictures** (`features/visuals/slots.ts`): `seven-day-hero` (1200 × 1500), `seven-day-poster` and
  `home-poster` (2400 × 800). Empty slots show a labelled frame on local and preview builds and nothing on the live
  site; to fill one, put the file in `apps/web/public/visuals/` and set its `src` and `alt`.
*Claude's choices in it (proposed, confirm when convenient):* the address label, the stamp, the shelf and the
three picture slots; the banner's words; the flight's place on Home (under the album, above Pick your home).

**D-167 · 2026-10-30 · proposed: the Diwali outfits list**
- Founder, verbatim (relayed by the session that started this work): "give me a csv to run for diwali outfits".
- What it means: `tools/sourcing-runner/targets/diwali-outfits.csv`, 63 clothing targets (up to 860 listings with
  their colours and sizes), every name "Diwali: …" so none is skipped as a target already there. Built as
  `myntra-600-1600.csv` is (D-121, D-122): Myntra only, ₹600 – ₹1,600, footwear ₹400 – ₹900, 10 – 25 listings a row.
  Women (23): festive, silk, embroidered and anarkali kurta sets, sharara sets, salwar suits, gowns, co-ords, festive
  kurtas, silk, sequinned, organza and ready-to-wear sarees, blouses, lehengas, dupattas, bandhani, jackets, potlis,
  jhumkas, juttis and mojaris, kolhapuris. Men (11): kurta pyjama sets, with Nehru jacket, silk kurtas, Nehru jackets and
  bandhgalas, sherwanis, indo-western, dhoti kurta, pathani, silk veshtis, mojaris, kolhapuris. Kids (7, category Kids).
  State weaves and crafts (22). Tested in `packages/shared/tests/diwali-outfits.test.ts`.
*Claude's choices in it (proposed, confirm before uploading, Q-48):* an adult row leaves out the other wearer and
children's titles, and a set row leaves out unstitched dress material; the store reads who a piece is for from its
name (D-140). A state goes only to a piece whose title names the weave or craft **and** says handloom (or hand
embroidered / handmade for chikankari, Phulkari, Kutch work and footwear), and never says style, inspired, art silk,
synthetic, polyester, print, digital, replica or look: a ₹1,000 "Banarasi" or "Kanjeevaram" is usually woven elsewhere,
which is why the Myntra list keeps those all-India ("Banarasi-style", D-121). Weaves made in more than one state
(bandhani, ajrakh, kolhapuri, kantha, kalamkari prints) stay all-India; Dhakai jamdani is left out (Bangladesh's).
The state rows: Banarasi sarees and dupattas, Lucknowi chikankari kurtas and sets (Uttar Pradesh), Kanjeevaram (Tamil
Nadu), Chanderi and Maheshwari (Madhya Pradesh), kasavu (Kerala), Pochampally, Narayanpet and Gadwal (Telangana),
Mangalagiri (Andhra Pradesh), Sambalpuri and Bomkai (Odisha), tant and jamdani (West Bengal), Paithani (Maharashtra),
Ilkal (Karnataka), mekhela chador (Assam), Kota doria, leheriya and mojaris (Rajasthan), Phulkari and juttis (Punjab),
Kutch work (Gujarat); inside ₹1,600 genuine handlooms are few, so these rows may find little. Timing: Myntra pieces
travel in the standard window (Settings: 12 – 16 days), so one ordered on 2026-10-31 arrives about 12 – 16 November,
after Diwali (8 November); none of this list can be a 7-day piece. Size: about 10 KB a listing in the database (up to
9 MB) and 0.6 MB in R2 (up to 0.5 GB), inside the budgets (`monitoring.md`); a bulk publish refreshes the store once.

**D-168 · 2026-10-30 · founder: one pipeline for new listings: scraped, photos made again, then uploaded** · Changes D-163's order for new listings
- Founder, verbatim: "Make a pipeline such that I don't have to run the redo pipeline for the new sourcing runs, Make
  one long pipeline which scrapes modifies then uploads. (Currently I have to first scrape then approve drafts, then
  fetch, then modify and then replace.) Make it productive"
What it means for the build (migration `20261103100000_sourcing_media_redo`, `tools/sourcing-runner/src/redo.ts`,
`tools/photo-worker/redo_serve.py`):
- **The runner makes a new listing's photos again before uploading them**, through the photo redo service on the same
  laptop (the GPU's work exactly as `redo.py` does it). `pnpm sourcing run` starts the service when it is not running;
  it lets the GPU go after 10 idle minutes and ends after 30. The photos go up once, already changed, with their mark
  (`face`, `fresh`) in `product_media.redo`, so `pnpm photos:redo` never takes them: no fetch, review or publish for
  new listings, and a listing never shows a shop's photo first.
- **Food and home:** every photo the refresh made goes up made again (the founder approved every refresh, D-165, and
  all 297 home photos at once). **Clothing** goes a whole listing at a time (D-164): faces swapped or cut at the chin,
  photos without a face reframed; if any photo is a portrait (the founder's call) or fails, every photo of the listing
  goes up as it is and waits for the review page as before. Kids' faces are only ever cut (D-102), read from the
  listing's `wears` (`worker_product_wears`).
- **Safe without it:** with no photo worker on the PC, `IWC_SOURCING_REDO=off`, a service that fails, or a database
  without the migration (asked once at the start of the run), photos go up as they are and the laptop's redo does them
  later. Drafts are unchanged: a listing missing details still waits for Publish all drafts (D-120, D-146).
- Measured on the laptop (RTX 4060): the first clothing listing 73 s (the models loading), then 4 – 9 s a listing; a
  food photo under a second.
*Claude's choices in it (proposed, confirm when convenient):* food and home go up made again whether or not the
refresh's distance check passed; the service on port 4318, started by the runner rather than as a separate step.

**D-169 · 2026-10-31 · founder: Home's mosaic shows only the founder's own photos, in the founder's order** · Changes D-113's album for Home
- Founder, verbatim: "Remove the existing working and states photos from home and just use the photos which I will
  upload and give me an option to move them in the grid."
What it means for the build (migration `20261104090000_home_photos`, admin **Home photos** `/admin/home-photos`):
- **Home's drifting mosaic shows only `home_photos`**, in their order (up to 60): no state album photo and no listing
  photo fills it any more. The states' albums stay on their own pages. Until there are three, Home has no mosaic.
- **The admin page:** choose many photos at once, each with its line (alt text, started from the file's name); they go
  up one by one (8 MB each, JPEG, PNG, WebP or AVIF) and Home is refreshed once per batch (only Home's cache entry).
  The grid is Home's own layout (`album-tiles.ts`): drag a photo onto another tile, or pick one and move it earlier,
  later, first or last, then Save order; a picked photo's line can be changed, or the photo removed (its files too).
*Claude's choices in it (proposed, confirm when convenient):* the 60-photo cap; the line started from the file's name.

**D-170 · 2026-10-31 · founder: Savana and NEWME as sourcing shops, 3,000+ listings** · Savana held by Q-49 (honest origin, D-004) · its Savana hold, NEWME's India-only and next-day rules and its targets SUPERSEDED by D-171
- Founder, verbatim (relayed by the session that started this work): "generate a savana scraper(https://www.savana.com/)
  we have to fill atleast 3k items from here" and "also include https://newme.asia/".
- **Savana is not added.** Each Savana product page states its origin ("More Information"); all 119 pieces read on
  2026-10-31, across all 14 of its departments (tops, dresses, bottoms, denim, co-ords, knitwear, lingerie, activewear,
  curve, accessories, jewellery, bags, beauty, fragrances), say "Country of Origin: PRC", imported into India. IWC
  says "Made in India" on every piece (D-004, non-negotiable 2), so none of them can be listed. Savana's site also
  calls itself "Fashion from London". Q-49 asks the founder.
- **NEWME is added** (migration `20261105090000_newme_shop`, reader `newme`, `readers/newme.ts`). Each NEWME piece
  states its own country of origin: "NM-IN-…" style codes say India (made for NEWME in Bangalore), "NM-PRC-…" say
  PRC (checked on 56 pieces: the code and the stated origin always agreed). The runner lists **only a piece whose page
  says India**; a "PRC" piece or one whose page says nothing is never listed, and PRC pieces are dropped from the
  search results before any page is read. Clothing only (NEWME sells women's western wear: dresses, tops, T-shirts,
  bottoms, co-ords, jumpsuits).
- **Delivery:** each size says whether it comes "by Tomorrow" to the shop's delivery pincode; other sizes take NEWME's
  usual 12 – 14 days, longer than the runner's 3-day limit, so they count as out of stock. `pnpm sourcing setup`
  opens NEWME so its pincode is set to the hub's; a piece with no fast size is skipped ("delivery takes 14 days").
- **Targets:** `tools/sourcing-runner/targets/newme.csv`, 99 rows, 40 listings each, no price band (none was given;
  the pricing rules are unchanged), each row a run of one collection's pages ("collection:dresses pages:1-2", 30
  pieces a page, NEWME's best sellers first) so every page is read once. A scan of every fifth page on 2026-10-31
  found about 3,200 India-made pieces with a size coming by tomorrow (dresses ~750, tops ~1,200, bottoms ~760,
  T-shirts ~450, co-ords ~160, jumpsuits and bodysuits ~70): 3,000 is close to NEWME's whole India-made catalogue,
  and pieces skipped on their page (sold out, unreadable) will leave it somewhat under.
- **Size (D-167's numbers):** about 10 KB a listing in the database and 0.6 MB of photos in R2: 3,000 listings ≈ 30 MB
  and ≈ 1.8 GB. The database stays far inside its 250 MB budget; **R2 does not**: about 4 GB was in use on 2026-10-19
  (more since the photo redo), so 1.8 GB more passes the 6 GB budget (`monitoring.md` §1) though not the 9 GB line.
  Run `pnpm photos:redo audit` before the run and watch R2 → Metrics during it.
*Claude's choices in it (proposed, confirm when convenient):* origin read from the page itself, never guessed from
the brand; the "NM-PRC" style code used only to skip pieces early; 2 – 10 pages a row so each row expects about 30 – 40
India-made pieces; tier 1 for the first 15 pages of each collection; jumpsuits (Co-ords & Dresses) and bodysuits
(Shirts, Tees & Tops) as two rows over the same 8 pages; NEWME's coupon prices ("Get it at ₹…") never used, only the
size's own price and MRP.

**D-171 · 2026-10-31 · founder: all of Savana and NEWME, made in China included; "Imported" instead of "Made in India" for them; NEWME and Savana in 10 days; R2's last 2 GB and the page cache kept in check** · Answers Q-49 · Changes D-004 for these two shops, D-170, D-068's 5-minute fallback
- Founder, verbatim: "I want all of savana and newme, It doesn't matter if they are made in china on the products page
  we will remove the made in India besides Imported and In product details we will remove made in India only for
  savana products. and for newme orders, It works under 10 days delivery time. First I will run for savana then if
  space is left so newme. 7.3GB is filled in R2 se we got only 2GB left. In vercel the ISR writes are 153k/200k filled
  so control that."
What it means for the build (migration `20261105100000_imported_pieces`):
- **Origin per piece:** `products.made_in` holds the country the shop's page states ('India' for every listing before).
  On Savana and NEWME only, a piece whose page names another country is listed (the runner sets the country,
  `worker_set_origin`); every other shop still lists only what is made in India (D-004). A page that names no country
  is never listed. Customers see only `store_products.made_in_india`: such a piece's page says "Imported" (no "Made in
  India" line, no "Made in" row in Details), on the web, the app and the customer's invoice. The customs invoice states
  the real country ("China"); US customs needs it. The FAQ, Delivery and Terms pages no longer say every piece is made
  in India.
- **Delivery:** Savana and NEWME bring a piece to the hub in 10 days (their shop rows). A shop's own usual days are now
  its limit when longer than Settings' 3 days, so their sources are used; every other shop is unchanged. NEWME takes
  every size in stock (no "by tomorrow" rule).
- **Targets:** `savana.csv` (447 rows × 40: every clothing department, 3 pages of 20 a row; the first 300 best sellers
  of each clothing department tier 1, about 3,000 listings at most; the rest of clothing tier 2; jewellery, bags, hair
  accessories, sunglasses, hats, belts and bag charms tier 3, Accessories) and `newme.csv` (237 rows × 40, every page
  once, 2 pages of 30 a row, NEWME's made-in-China pieces included). No price band (none given).
- **R2:** `pnpm sourcing run --targets --photo-gb 1.8` stops starting new listings once that run has written 1.8 GB to
  the photo store (both copies of every photo counted, `out/photo-budget.json`); the targets not reached wait in the
  queue. At about 0.6 MB a listing (D-167) 1.8 GB is about 3,000 listings: Savana's tier 1 alone fills it.
- **Page cache (ISR):** the store's fallback refresh is an hour instead of 5 minutes (`STORE_REVALIDATE_SECONDS`): a
  page visited after its fallback is rebuilt and written again. Sales, cancels and admin changes still refresh their
  pages at once; prices after the daily exchange-rate update and the runner's weekly checks show within the hour
  (checkout always prices fresh). New listings arrive as drafts (Savana's always: below) and are published in batches
  of 100 or fewer (Products → Drafts), so each batch refreshes only its own pages (D-145).
- **Savana's pages state no wash care** and give a weave ("Twill Woven", "Flat Jersey") as their fabric: every Savana
  listing waits as a draft ("details to finish: care"), and a clothing piece cannot go live without care (D-140). Q-50.
*Claude's choices in it (proposed, confirm when convenient):* Savana's 10 days (the founder named NEWME's; 10 is the
pilot's upper bound for a piece to reach the hub); NEWME's made-in-China pieces taken too ("all of savana and newme")
and shown as "Imported" like Savana's, never as made in India; the customer's invoice and the info pages follow the
product page; both shops' names start "Women's …" when the shop's own name does not say who it is for (both sell
women's wear only; the store needs it to sell clothing, D-140); left out of `savana.csv`: beauty and fragrances
(liquids and sprays, D-135), bras and panties (no category), phone cases (not clothing); lounge sets under Co-ords &
Dresses; the hour's fallback.
