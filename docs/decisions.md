# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-139 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept). When Recent holds more than about ten entries, the oldest move to the archive in full and
leave a one-line index entry here (done for D-109 – D-139 on 2026-10-22).

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
- **D-125** 2026-10-14 · founder: No bag ever loses: every cost in the price, heavy pieces on the founder's formula · food's price amended by D-126 (the band; Shipping still keeps every bag whole)
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

## Recent (full text)

**D-140 · 2026-10-18 · founder: Design & ergonomics plan v5: Home's three Just listed rows, Women · Men, order from the shop in one tap, three invoices, the struck Shipping figure, instant taps, + picks the size, − n + on cards, admin pagination**
The plan is `docs/archive/plan-design-v6.md` (v5, written by Claude from the code and the live site, with the founder's
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
