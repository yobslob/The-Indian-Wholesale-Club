# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-143 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept). When Recent holds more than about ten entries, the oldest move to the archive in full and
leave a one-line index entry here (done for D-109 – D-139 on 2026-10-22, D-140 – D-143 on 2026-10-23).

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

## Recent (full text)

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

**D-146 · 2026-10-22 · founder: every listing gets a weight, then everything is published; one press each for Weights to check, Drafts and Names to tidy**
- Founder, verbatim: "Then finally our admin panel comes which stucks at huge numbers(not talking about live). The
  listings are messed in between these migrations between platforms now its time to assign all the "check the
  weights" what weight they've been assigned and if some aren't assigned then make a better system which can assign
  them, I want everything assigned and then published, also add a button similar to publish all in "check weights" and
  "tidy names". Also we will have to handle all drafts so that we can start new batches."
- What was there (production copy of 2026-10-21): 2,180 drafts, 1,793 of them held only by an option without a weight
  (D-129), 80 without a photo; Weights to check 2,600 listings (1,883 with a missing weight, the rest a matching
  item's, an unrecorded or an unusual weight); Names to tidy 774 proposals. Publish all drafts did everything in one
  database call, about 3.5 s for 2,100 listings locally: near the hosted database's 8 s limit.
What it means for the build (migration `20261022090000_assign_weights`, apps/web `features/admin/actions/bulk.ts`):
- **Assign all and publish** (Weights to check): every option without a weight gets one: clothing by its class (D-132),
  food by the net quantity on its label (D-135), anything else the middle weight of the 7 most similar pieces of its
  category already weighed by a trusted source (the same words in the name, the closest shop price), else the
  category's usual weight; source "Estimated", with a note saying which. Measured on the production copy against
  known weights: home & gifts within 34 – 37% (median), against 266% for the category's usual weight. Then every weight
  the tab shows is accepted as it is (`weight_checked_at`; a new weight clears it), then every ready draft goes live.
  Weights weighed at the hub or typed by an admin are never changed; the runner's page reads (D-134) and the hub's
  scale (D-130) still replace an estimate. Supersedes D-129's "a listing cannot go live on a guessed weight" only in
  that an estimate now counts as a weight.
- **Publish all drafts** (Drafts) does the same without accepting, then publishes; **Archive the drafts that can't go
  live** archives those without a photo, an active option or a piece to sell (nothing is deleted), so Drafts holds
  only the next batch.
- **Rename all** (Names to tidy): every proposal on every page, as proposed (D-143's rules); old names stay as the shop
  title. A name that would be only a shop word ("ELVRIT Collections" → "Collections") is not proposed.
- Every bulk step runs in batches (40 listings, 2,000 options, 400 drafts, 250 names a call) the page repeats until
  nothing is left, then refreshes the store once (D-145).
*Interpretation (proposed, confirm when convenient):* "stucks at huge numbers" is read as these lists' counts staying
high and the one-call publish being too slow at that size; no admin page was found slow on the production copy
(Weights to check 45 ms, Products 50 rows in one request).

**D-147 · 2026-10-22 · founder: new Vercel and Supabase accounts, used within their free limits; a production metrics plan; one tidy set of docs**
- Founder, verbatim: "Update everywhere that we initially set up a vercel and supabase account, but then vercel's image
  optimization hit and supabase storage limit hit, we tried saving those by putting up our own Cloudflare R2 but
  finally we set up a new vercel and new supabase which are currently at base limits(mostly near 0) so this time we
  will be using them efficiently and productively. Then a fully production organized plan for checking our websites
  metrics that it is behaving efficiently and productively with a resilient architecture or not, as soon as a bug or
  weak behaviour is noticed, we fix that." And: "we need to clean-up the mess that different claude accounts and my
  work has left, so that we end up with a clean working repo as context for a new claude account. (without changing
  any working or operation) Clean the docs, remove the extra useless things, archive the archivable things, and then
  put up the rest of it in a more structured manner in less documents."
What it means for the build:
- The history (`ops.md` §Accounts and limits): the first Vercel and Supabase accounts (2026-10-06) hit Vercel's image
  optimisation limit (5,000 a month, 402 on 2026-10-18), then its page-cache writes (208K of 200K), and Supabase's 1 GB
  storage (7.9 GB of photos). Photos went to Cloudflare R2 (D-141, still where they live), page refreshes were narrowed
  (D-145), and on 2026-10-21/22 the site moved to a new Vercel account and a new Supabase project that start near
  zero. The old accounts are not used.
- Each limit has a monthly budget well under the free plan and a check (`docs/monitoring.md`): weekly the dashboards'
  numbers, daily the site's own health checks; a bug or a weak spot found becomes a fix the same week, recorded in
  `docs/status.md`.
- Docs: one status page (`docs/status.md`, replacing the old plan folder), product with its glossary, storefront with design,
  admin with vendors; the plans, roadmap and backlog of the build phases and D-109 – D-139's full text are archived.
  No code path or behaviour changes.

**D-148 · 2026-10-22 · founder: 7-day delivery: a page of the quick-delivery shops' pieces, Home's new line, and the first Blinkit batch** · its mixed-bag rule (one normal piece makes the whole bag normal) SUPERSEDED by D-154
- Founder, verbatim: "Our website is complete, now we will be introducing a new feature called 7-day delivery: It will
  be a new page with an aesthetic feel, It will have all the products from blinkit, bigbasket, zepto, instamart. Which I
  can order in 1 hour and directly ship to USA, The restrictions will be same as normal delivery regarding liquids,
  electronics, dairy etc etc. Instead of the subheading Miss local market on home page, write Want in 7 days? click
  here. Also now that website is complete It is time that we add products efficiently (remember all the limits as R2
  limit is 10 GB and vercel and supabase too) Firstly we have to copy the blinkit deliverables inventory into our 7 day
  delivery so make a csv for that."
- Asked how listings are marked: "Automatic (Recommended)". Asked the window: "Exactly 7 days". Asked about a mixed
  bag and its cost: "The checkout remains same, It's just that as soon as a normal product is added, the
  exclusivity(The product's card will have a tag) of the 7 day product is removed and it will also counted as normal
  product, because if someone ordered 3 chips and 2 sets of kurtas then we can't just ship 3 chips in 7 days. So, until
  the cart only has 7 day products show the exclusivity". Asked the first batch: "3000 but remember only the products
  that can be shipped".
What it means for the build (migration `20261022120000_seven_day_delivery`, apps/web `app/(store)/7-day-delivery`,
`features/seven-day/`, Settings → Standard delivery):
- **A 7-day piece** is worked out on every read: live, not already in the US, and every option on sale is bought from a
  shop marked `sourcing_shops.quick_delivery` (Blinkit, BigBasket, Zepto, Instamart), its source in use or else the shop
  it was imported from. A listing the weekly check moves to Amazon leaves the page by itself. Customers see only
  "In 7 days", never the shop (D-003).
- **The days** are Settings → `quick_delivery_days_min/_max` (7 and 7); empty = no tags, no page (404), and Home's old
  line (non-negotiable 4).
- **Cards** carry a brand-colour "In 7 days" tag (`quick_days`); the product page says the 7-day date "when your bag
  holds only 7-day pieces" and the normal window with others; the bag says "Every piece here comes in 7 days, so your
  bag does too." only while every piece is one (`store_quick_bag`, through `/api/bag-charges`).
- **Checkout** prices and charges are unchanged; a bag of only 7-day pieces gets the 7-day window in checkout and on its
  order (`create_order`, bought at once like the made-to-order pilot); one other piece makes it a normal order.
- **The page** `/7-day-delivery`: a header in the brand's type with the days, category pills with counts and the cards
  (one of each category, then step up, by price), Show more; cached with See all (`listingsTag`).
- **Home's line** reads "Want in 7 days? Click here." and opens the page while 7-day delivery is on.
- **The first Blinkit batch:** `tools/sourcing-runner/out/blinkit-7-day.csv` (gitignored), 113 auto-sourcing targets,
  Blinkit only, all states, up to 2,972 listings; each row's Must match leaves out dairy, meat, eggs, frozen food,
  liquids (and anything sold by the ml or litre), honey and oils (D-135), and in home & gifts electronics, lights,
  batteries, cow dung, feathers, fireworks, camphor, loose powders (D-138, Q-37), lighters and matches. The runner
  still archives any liquid it finds (D-135). Sized to the limits: about 1.8 GB of R2 (to about 6 – 7 GB of 10), about
  30 MB of database, and up to about 60,000 page-cache writes if every new page is visited once (`status.md`).
*Interpretation (proposed, confirm when convenient):* a bag of only 7-day pieces is not offered Express (15 – 18 days,
slower and dearer); "click here" is written "Click here." like "Start here."; the page's words and the card, bag and
product-page lines are Claude's draft (D-059) until approved; the CSV has no ₹ band and leaves out butter, lighters and
matches (Q-42).

**D-149 · 2026-10-23 · founder: the sourcing runner rests a shop that blocks it**
- Founder, verbatim (after every Blinkit search of the 7-day batch failed): "the env was the problem, i fixed it now I
  ran it so it showed run: 0 checks due, 76 targets, 6 shops then on every item blinkit showed robot checked and
  failed, then I stopped it, ran the setup again, signed in in every one and did address then ran again it now showed
  0 checks due, 11 targets, 6 shops and same robot check failure. Research and design something resilient and strong."
- What was found: Blinkit answers the runner with Cloudflare's block page (403, `cf-mitigated: challenge`, "access
  denied, sorry, you have been blocked … your recent actions … might have led to this", a "Verify you are human" box).
  A normal browser on the same connection still gets results, and the runner's own browser sometimes does: the block
  follows the automated browsing (likely the 400-listing check earlier that day). From 13 to 19 October a robot check
  came about once an hour and the next search passed; on 22 October every one failed. The runner then kept asking
  Blinkit every few seconds, once per target, which strengthens such a block.
What it means for the build (`tools/sourcing-runner/src/lanes.ts`, `rest.ts`, `packages/shared/src/sourcing/auto/shop-rest.ts`):
- **Cloudflare's own check gets 20 seconds** to clear by itself in the page, as in anyone's browser; still there, it is
  a robot check. The runner never clicks or solves one, and adds no disguise.
- **Two robot checks in a row rest the shop**: nothing more is asked of it for 2 hours, 6 if it blocks again within two
  days, then 24. The rest is kept on the PC (`tools/sourcing-runner/shop-rest.json`, not committed) so the next run
  and the other terminal's runner leave the shop alone too; the run's first line names resting shops. The first block
  of each run is saved as the shop showed it (`out/blocks/`).
- **A block changes nothing in the catalogue:** a target whose shops rest, or that lost its pages to robot checks,
  goes back to the queue (not "nothing fit"); a weekly check that met one writes nothing, so no source counts a failure
  (two take it out of use) and the listing stays due.
- **Ctrl+C puts the run's unsearched targets back in the queue** (before, they waited six hours as "being searched");
  so does a target whose search crashed.
- **`pnpm sourcing setup --type food`** opens that runner's own profile: a plain `setup` reaches only the main one,
  which `--type` runners copied once.
*Interpretation (proposed, confirm when convenient):* the numbers (two checks, 2 / 6 / 24 hours, 20 seconds) are
Claude's; the 7-day targets search BigBasket, Zepto and Instamart too (D-150).

**D-150 · 2026-10-23 · founder: the 7-day targets search all four quick shops (answers Q-43)**
- Founder, verbatim: "Q-43: yes, the 7-day targets may also search BigBasket, Zepto and Instamart. Update the targets'
  shops."
What it means for the build (`packages/db/src/admin/auto-sourcing.ts` `addTargets`, `widenedSites` in
`packages/shared/src/sourcing/auto/targets.ts`):
- **A target uploaded again takes the row's shops it lacked**, and keeps everything else; it never loses a shop (one on
  every shop stays so, a row without Shops changes nothing). The upload says "n of them now search more shops". Before,
  a target already there was skipped whole (D-118).
- **The CSV:** `tools/sourcing-runner/out/7-day-four-shops.csv` (gitignored) is the Blinkit batch's 113 targets with
  Shops "blinkit bigbasket zepto instamart"; uploading it widens the 102 Blinkit targets. All four are 7-day shops
  (D-148), so whichever shop a piece comes from, it stays a 7-day piece. A Blinkit rest (D-149) no longer stops the
  batch, and each shop is asked less.
- Each target still makes up to its Listings; the same product on two shops is one listing with the other as its backup.

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

**D-153 · 2026-10-23 · founder: the runner keeps each quick-commerce shop to the pace it took without trouble**
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
