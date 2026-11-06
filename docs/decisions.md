# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-176 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept). When Recent holds more than about ten entries, the oldest move to the archive in full and
leave a one-line index entry here (done for D-109 – D-139 on 2026-10-22, D-140 – D-143 on 2026-10-23, D-144 – D-145 on 2026-10-24, D-146 – D-150 on 2026-10-26, D-151 – D-176 on 2026-11-05).

**By:** `founder` = binding · `approved` = Claude's proposal the founder approved · `proposed` = awaiting the founder.
To change a decision, add a new one (`Supersedes D-xxx`) and mark the old line `SUPERSEDED by D-yyy`.

## Index (full text in the archive)

- **D-001** 2026-09-27 · founder: Users, emotion, competition
- **D-002** 2026-09-27 · founder: Regions are the core concept, all 36 treated the same
- **D-003** 2026-09-27 · founder: No operations info on the customer side
- **D-004** 2026-09-27 · proposed: Honest origin labelling; the old "stealth origin" layer is removed forever · the state is optional since D-121
- **D-005** 2026-09-27 · founder: Order-first supply in cycles · SUPERSEDED by D-187
- **D-006** 2026-09-27 · founder: Hidden admin on web and app
- **D-007** 2026-09-27 · founder: Two operators
- **D-008** 2026-09-27 · proposed: Delivery estimates come from cycle data and are honest · its cycle half SUPERSEDED by D-187
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
- **D-045** 2026-09-29 · founder (was Q-20): Cycles close and open on their own; the admin mirrors what happened physically · SUPERSEDED by D-187
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
- **D-064** 2026-10-03 · founder: A piece that leaves earlier is first offered as discounted faster delivery · SUPERSEDED by D-187
- **D-065** 2026-10-03 · founder: A payment that lands seconds after the cutoff still joins that cycle · SUPERSEDED by D-187
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
- **D-102** 2026-10-10 · founder (was Q-34): Vendors get their own sign-in; the photo pipeline is approved · Supersedes D-018 · SUPERSEDED by D-187
- **D-103** 2026-10-10 · Claude, proposed: How vendor accounts and the photo worker are built · SUPERSEDED by D-187
- **D-104** 2026-10-10 · founder: The house models are the founder's own; two poses, two photos · SUPERSEDED by D-187
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
- **D-148** 2026-10-22 · founder: 7-day delivery: a page of the quick-delivery shops' pieces, Home's new line, and the first Blinkit batch · its mixed-bag rule (one normal piece makes the whole bag normal) SUPERSEDED by D-154 · Home's line SUPERSEDED by D-161 · SUPERSEDED by D-187
- **D-149** 2026-10-23 · founder: the sourcing runner rests a shop that blocks it · its rests SUPERSEDED by D-158 (knowing a robot check stays)
- **D-150** 2026-10-23 · founder: the 7-day targets search all four quick shops (answers Q-43)
- **D-151** 2026-10-23 · founder: the runner never browses headless (the cause of D-149's Blinkit block)
- **D-152** 2026-10-23 · proposed: Zepto and Instamart are read from their own search answer and item-page data
- **D-153** 2026-10-23 · founder: the runner keeps each quick-commerce shop to the pace it took without trouble · SUPERSEDED by D-158
- **D-154** 2026-10-23 · founder (was Q-41): 7-day delivery is its own store; one bag, two shipments from $49.99; Shipping at $18.62 a billed kg · its store and its $49.99 line SUPERSEDED by D-187
- **D-155** 2026-10-24 · founder: a bottle's and a lunch box's real weights; heavy cookware priced on half its weight plus Heavy-item shipping
- **D-156** 2026-10-24 · founder: ergonomics: one free-delivery bar, instant categories, a state's types in a switch, the store tabs · the state page's rows SUPERSEDED by D-157
- **D-157** 2026-10-24 · founder: a state's inventory has See all's filters, not pills
- **D-158** 2026-10-24 · founder: the sourcing runner has no rests and no hourly limits; one run takes every target
- **D-159** 2026-10-24 · founder: every listing in its own category, never shown in another's
- **D-160** 2026-10-26 · proposed: search reads words as customers write them, and costs nothing to run
- **D-161** 2026-10-26 · founder: the homesick design: the wait becomes the proof; every promise rides on what the page already has · Supersedes D-079's and D-148's Home line · its tab dates, festival line, India time, Where's home, postmarks, diary lines, away tab title and joke copy SUPERSEDED by D-166 · its 7-day parts SUPERSEDED by D-187
- **D-162** 2026-10-26 · proposed: the Diwali home & gifts list, and every listing that can be bought whole from the quick shops is bought there (its 7-day tag)
- **D-163** 2026-10-27 · founder: every listing's photos made again on the founder's laptop GPU: clothing gets a house model's face and skin, food's main photo a tempting scene, home & gifts a room · its skin recolouring, scenes by default and kids waiting SUPERSEDED by D-164
- **D-164** 2026-10-30 · founder: faces change without one photo looking wrong; every other photo only a small change of its own · Changes D-163's clothing skin and food and home scenes · its faces (drawn, cut under the chin) SUPERSEDED by D-165
- **D-165** 2026-10-30 · founder: food and home's refresh is right for every product; clothing's faces are swapped, not drawn, and a cut keeps the neck · Changes D-164's faces
- **D-166** 2026-10-30 · founder: faster cards and endless scroll; the tabs say only "IWC" and "7-day store"; the homesick design told in pictures, not text · Changes D-161, D-136's Show more, D-154's tabs · its 7-day parts SUPERSEDED by D-187
- **D-167** 2026-10-30 · proposed: the Diwali outfits list
- **D-168** 2026-10-30 · founder: one pipeline for new listings: scraped, photos made again, then uploaded · Changes D-163's order for new listings
- **D-169** 2026-10-31 · founder: Home's mosaic shows only the founder's own photos, in the founder's order · Changes D-113's album for Home
- **D-170** 2026-10-31 · founder: Savana and NEWME as sourcing shops, 3,000+ listings · Savana held by Q-49 (honest origin, D-004) · its Savana hold, NEWME's India-only and next-day rules and its targets SUPERSEDED by D-171
- **D-171** 2026-10-31 · founder: all of Savana and NEWME, made in China included; "Imported" instead of "Made in India" for them; NEWME and Savana in 10 days; R2's last 2 GB and the page cache kept in check · Answers Q-49 · Changes D-004 for these two shops, D-170, D-068's 5-minute fallback · its Savana drafts waiting for care SUPERSEDED by D-172
- **D-172** 2026-10-31 · founder: Savana's care given from its fabric where certain, the rest left out; the founder's photos in the picture slots · Answers Q-50 · Changes D-171's Savana drafts · its 7-day, Home and Sign in photos SUPERSEDED by D-173
- **D-173** 2026-10-31 · founder: only Page not found and the empty bag keep the founder's photos · Changes D-172's photos
- **D-174** 2026-10-31 · founder: Home's flight becomes a row of Diwali windows, the plane flying inside one · Changes D-161's "no banners" for Home's band
- **D-175** 2026-10-31 · founder: a photo slot in each Diwali window; the arches' prices $11.45 and $0.39 · Changes D-174's prices
- **D-176** 2026-10-31 · founder: the Diwali windows get the founder's photos and a quiet button each
- **D-177** 2026-11-02 · founder: the Diwali night across the top, the three arches under it, no sliding · Changes D-174's layout
- **D-178** 2026-11-02 · founder: every listing's description written again on the laptop, fast and checked
- **D-179** 2026-11-03 · founder (was Q-52 – Q-59): the launch QA questions answered

## Recent (full text)

**D-180 · 2026-11-03 · founder: Home's hero line points to the 7-day store; every live piece in stock at 10**
- Founder, verbatim: "Instead of "we go home so you don't have to and the link below it" Change these home sub-line to
  say Want it in 7 days? Get it here >> (with these two signs expanding and contracting making a smooth animation)
  also put all items in stock except for liquids, all items to 10"
- What it means:
  - **The hero:** "Want it in 7 days?" (the bold line) and "Get it here" with two arrows drifting a few pixels right and back (made minimal the same day: "make the >> animation minimilistic"), a link
    to `/7-day-delivery` (`home-hero.tsx`). The arrows stop with reduced motion. While 7-day delivery is off or paused
    the 7-day store 404s, so the hero keeps D-161's two lines then (a proposal, not the founder's words).
  - **Stock:** every active option of every live listing at 10 available (`qty_listed` = held by open orders + 10),
    logged as an adjustment. Liquids are not live (D-135 archives them as coming soon), so they are left out by the
    same rule. Claude does not write to the hosted database: the founder runs `scripts/stock-every-live-piece-to-10.sql`
    once in Supabase's SQL editor. The sourcing runner's next shop check sets stock from the shops again (D-118).

**D-181 · 2026-11-03 · founder: the 7-day store inside every state's Food and Home & gifts; a state's own pieces first** · its 7-day parts SUPERSEDED by D-187
- Founder, verbatim: "Now the priority is that 7 days store should be available everywhere on each state's food and home
  decor like a strip in between(like finishing touches on clothing)(but just enough to reach the 7 day page like a CTA or
  like a horizontal row with some products) second was goa was not showing food, neither are state's pages showing
  their own products first, so fix that now low to high comes secondary there first priority is their own products"
- What it means:
  - **The 7-day band:** on a state's page, its Food and Home & gifts lists carry one light band after their second row
    of cards, "Arrives in 7 days" with a sideways row of 12 pieces from the 7-day store's own Food or Home & gifts page
    (its first page, low to high) and "Shop the 7-day store →" ("7-day store" on phones) to that page
    (`features/seven-day/quick-band.tsx`). Only while 7-day delivery is open, not when the "In 7 days" filter is on, and
    left out when the 7-day store has none of that type. See all's own Food and Home pages do not have it (only the
    state pages were asked for).
  - **Own pieces first:** on a state's page (and See all with a state chosen) the state's own pieces come before the
    all-India ones under every sort; the sort orders each half. Before, only Newest and the default did (D-140 L2).
  - **Goa's Food:** not a Goa fault. The store reads the database as `anon`, which Supabase stops after 3 s; a Food list
    took 1.3 – 2 s alone, so a few opened at once failed and the tab said "These pieces did not load"
    (`20261108090500_browse_reads` makes the read about 2.4 × faster).

**D-182 · 2026-11-04 · founder: Home's hero is the Diwali poster and the two doors; the first-load JS budget is 160 KB**
- Founder, verbatim: "yes they failed, now raise everyone's budget to 160kb, and then solve this second problem: as
  everyone is using it on their phones, my customers complained about scrolling too much to get to the interactive part
  yet I want to keep it minimilistic and not to fill it with AI slop then it will look like a blogging page. the girl
  that this ain't vibe an ecommerce website but they liked the host your diwali part, so redesign my hero section
  accordingly such that it is properly defined what the 7 day store is how to get to it and what the iwc is and still
  keeping it designing and minimalistic. I had an inspo to use a colorful image instead, I added it to visuals for you
  to inspect, it's name is hero_updated."
- What it means:
  - **Budget:** every storefront page may load 160 KB of gzipped JS up front (`check.mjs`, was 150 KB, D-011's speed
    rule otherwise unchanged).
  - **The hero:** one screen at every size, so a phone can open the store without scrolling. The poster (a link to
    `/home-and-gifts?max=99`) over a dark panel, or beside it on landscape screens: Indian Wholesale Club with Clothing,
    Food, Home & gifts and States, then the 7-day store with "Get it here" and D-180's two arrows. Replaces the stacked
    brand name on the white wall (D-052 – D-055, D-079) and D-180's two lines; the header's logo now always shows.
    The Android and iPhone app's hero is unchanged.
  - *Interpretation (proposed, confirm on the live site):* the poster's small date and "SHOP UNDER $99" were painted out
    of `hero_updated.png` and redrawn as live text (about 7 px tall in the picture on a phone, and not a real link); the
    large headline stays in the picture, because the site has no serif with a true italic. The source PNG (3.1 MB) is
    not served: `public/images/home-hero-diwali.avif` (91 KB) and `.webp` (115 KB) are.
  - *Interpretation (Claude's draft, the founder to confirm the words):* "Clothing, food and gifts from all 36 states of
    India, at your door in 12–16 days." (the days from Settings). The 7-day line is the 7-day page's approved one, "Snacks,
    masalas and sweets from home, at your door in 7 days." (days from Settings).
  - After Diwali the poster's headline is out of date: Q-60. "Host your Diwali under $99" also still shows in the Diwali
    night further down the page (D-179), kept as it was.

**D-183 · 2026-11-04 · founder: Home's hero becomes the 7-day store's poster; no "$99" on the first screen; shorter windows on phones** · Supersedes D-182's poster offer, its 7-day row and its "about" line (D-182's one-screen rule and 160 KB budget stay) · its 7-day parts SUPERSEDED by D-187
- Founder, verbatim: "This is strictly regarding the frontend hero section. Mostly are on phone webapps, People are clicking off because it is too much text and high 99$ prices, So I am suggesting changes : we should remove the host your diwali banner because it is already under global grid, think of something creative something out of the box, use the power of vocabulary, some CTA for the 7-day store showing $49.99 we gotta change the "Host your Diwali under $99 SHOP UNDER $99" Also the window banners are looking too stretched in mobile view, we need to remove the 7 day store part from hero section bottom and show it on headline somehow, keep the Indian wholesale club part as it is but remove the subtext, these were just suggestions, you should be very creative about them and redesign our hero section."
- What it means:
  - **The poster is the 7-day store's front door.** "Host your Diwali under $99." and "Shop under $99" leave the hero
    (the Diwali night further down keeps them, D-179). The picture's own headline is painted out
    (`public/images/home-hero-7day.avif` 86 KB, `.webp` 109 KB, from `hero_updated.png`; the old
    `home-hero-diwali.*` are no longer read), and its words are live text on the picture's dark wall: a gold kicker with a
    small plane ("The 7-day store"), the headline, "From India to your door in <days> days." and a gold button "Bring it
    home"; the whole poster is one link to `/7-day-delivery`. The free 7-day line sits on the lehenga as a round seal
    ("FREE DELIVERY • 7-DAY STORE •" turning slowly around "from $49.99"). The days and the amount come from Settings
    (non-negotiable 4); while 7-day delivery is off the poster opens Food with the whole store's days and no seal.
  - **Under it (portrait) or beside it (landscape):** "Indian Wholesale Club" and its four doors only; the line under the
    name and the 7-day row are gone, so the poster gets the room.
  - **The Diwali windows on phones** (under 640 px) are about 1 : 1.56 instead of 1 : 2 (1 : 1.66 under 380 px, 1 : 1.76
    under 340 px): the photo takes 52 % of the window instead of 46 %, and the diya leaves the sill to make room; the
    arrow stays. Tablets and wide screens unchanged (D-177's one row stays).
  - **A fourth font, on Home only:** the gold italic is Lora Italic 500 (SIL OFL, Basic Latin, 17 KB WOFF), declared in
    `features/home/hero-font.ts` so no other page loads it. The other words use Cinzel and Karla as before. No new JS and no
    new read (the hero already had the policy).
  - *Interpretation (Claude's draft, the founder to confirm or change in `features/home/hero-words.ts`):* the headline
    "Mithai. Masala. *Memories.*" (what the 7-day store sells, and what it brings back), the button "Bring it home", the
    kicker "The 7-day store". No Diwali date on the poster: a 7-day order placed this week lands after Diwali, and a date
    beside "7 days" would read as a promise. Alternatives kept in that file.
  - Q-60 narrows: only the picture's Diwali look dates after Nov 8, not its words.

**D-184 · 2026-11-04 · founder: the hero keeps the poster's lettering and its Diwali date; no seal; the $49.99 under a smaller button** · Changes D-183's kicker, headline font, seal and button · its 7-day parts SUPERSEDED by D-187
- Founder, verbatim: "Perfect, it's just that the font before was the final one and instead of the 7 day store write diwali. Sun, nov 8 like it was before, the stamp disturbs whole miniimilism, rest it good just let's try to show the 49.99 in some other way, maybe the CTA button or something else? also make the cta pill smaller."
- What it means:
  - **The kicker is the Diwali date again,** "Diwali · Sun, Nov 8" with the hairline under it, from `diwali-hooks.ts` as in
    D-182 (Q-60 for after Nov 8). Screen readers still hear "The 7-day store." first, since the poster opens it.
  - **The headline in the poster's lettering:** mixed case in a book serif with the last word in gold italic, as "Host
    your *Diwali* under $99." was drawn. That lettering was part of the picture and its font is not known, so the nearest
    free one is used: Lora, roman 400 and italic 500 (`features/home/hero-font.ts`, Home only, 16 KB + 17 KB WOFF).
    Cinzel stays for "Indian Wholesale Club".
  - **No seal.** The free 7-day line is one quiet line under the button: "Free delivery from **$49.99**" (the amount from
    Settings, in gold); none while 7-day delivery is off.
  - **The button is smaller:** 32 – 42 px tall with the poster (was 44 px), no shadow; the whole poster stays the tap target.
  - *Interpretation (proposed, confirm on the live site):* with the date over "From India to your door in 7 days.", a
    shopper may read it as arriving by Diwali; an order placed from Nov 2 lands after Nov 8. The words do not promise it.

**D-185 · 2026-11-04 · founder: the hero in the poster's own fonts; the button is the free line** · Changes D-184's fonts and button · its 7-day parts SUPERSEDED by D-187
- Founder, verbatim: [an image: a table of the poster's fonts: "Host your" / "under $99": Cormorant Garamond · "Diwali" (italic): Cormorant Garamond Italic · "Indian Wholesale Club": Cormorant Garamond · Description text: Inter or Montserrat · "DIWALI · SUN, NOV 8": Montserrat Medium, letter-spaced · "SHOP UNDER $99": Montserrat SemiBold, letter-spaced] "put the fonts as stated(Although the references are old but the fonts stay the same), then this is just too much text so remove bring it home and put free delivery line into the CTA. And then give me a lot of ideas very very creative for the header line."
- What it means:
  - **Fonts, in the hero only:** Cormorant Garamond 500 for the headline and "Indian Wholesale Club" (was Lora and
    Cinzel), its italic for the gold word; Montserrat for the date (500, letter-spaced), the days line (400), the button
    (600) and the four doors (500; Montserrat chosen over Inter). Files: `app/fonts/cormorant-garamond-latin-variable.woff2`
    (38 KB), `cormorant-garamond-italic-latin-variable.woff2` (39 KB), `montserrat-latin-variable.woff2` (38 KB), the latin
    WOFF2 Google Fonts serves (variable 400 – 700), declared in `features/home/hero-font.ts` so only Home loads them. Cinzel,
    Syne and Karla stay everywhere else. D-184's Lora files are no longer read.
  - **"Bring it home" is gone; the button is the free line:** a small gold capsule, "FREE DELIVERY" small and spaced over
    "from $49.99", and the arrow (the amount from Settings). While 7-day delivery is off: "Shop the store" (D-183's Food
    fallback).
  - *Interpretation (proposed):* "Inter or Montserrat" for the description: Montserrat, so the hero has one sans.
  - The headline ideas asked for were answered in the conversation; the headline stays "Mithai. Masala. *Memories.*"
    until the founder picks another (`hero-words.ts`).

**D-186 · 2026-11-04 · founder: the hero says the 7 days and the $49.99 line are for food** · its 7-day parts SUPERSEDED by D-187
- Founder, verbatim: "Make a small change we have to show that we are only delivering food in 7 days and on food only 49.99, so add a small(on food) and rest is good push all the commits then I will run the deploy, also e2e failed"
- What it means: the days line reads "From India to your door in 7 days (on food).", "(on food)" small (`hero-words.ts`),
  only while the 7-day store is open. *Interpretation (proposed):* one "(on food)" right over the button covers both; the
  button keeps "Free delivery from $49.99", since adding it there too widened the button onto the woman's arm on a phone.
  The rules themselves (Settings, the bag) are unchanged.

**D-187 · 2026-11-04 · founder: Simple store: one store, food 7 and the rest 12 – 16 business days, free shipping from $49.99; no 7-day store, vendors, cycles, payouts or house-models table** · Supersedes D-005, D-008's cycle half, D-045, D-064, D-065, D-102 – D-104, D-148, D-154's store and line, and the 7-day parts of D-161, D-166, D-181, D-183 – D-186 · its §10 Y-10 SUPERSEDED by D-188
- Founder, verbatim: "I have been adding on and on as soon as I got ideas and building up this website, but I forgot the most important part clearing up that clutter and mess that I left behind. Therefore Make a very smart removal plan which My subagents will perform. The Honest truth about this website is that we buy from online webstores and resell it on our website providing faster shipping and very efficient interface. Now we will clear all the clutter and make a very simple interface. We will remove the 7-day store, We will remove the entire concept of shops and vendors and everything related to that, no cycles, no payouts, no house models. We will simply show that clothing takes 12-16 delivery days and food takes 7 delivery days to arrive. Then we will define the defination of delivery days in somewhere in faqs, delivery days is considered as the business working days except for the delays of flights. We will remove the concept of 99.99$, we will give free shipping over 49.99$ on everything. rest of it I want to keep the same, just remove the 7 day store page and put the categories exactly as they are under the global grid, then diwali banner then what everyone missed this week then the kirana counter then the just listed clothing then home decor. Just keep everything simple so we don't hit the limits anymore. keep everything light, so everything loads fast and efficiently while giving the customer a seamless experience"
- The same day, to Claude's questions: Home & gifts delivery: "12–16, like clothing". Faces on new clothing photos: "We still want new clothing to have a model to replace with", the models live as "Folders on the laptop only". Old tables: "Drop them in the same release". Home order: "Yes, keep map and band at end" ("global grid" = Home's drifting photo mosaic; Just listed Food goes because the two food rows cover it). Bulk saving and heavy-item 20% off: "Keep them at $99.99" (only shipping moves to $49.99).
- The founder's answers to the plan's §10, verbatim: "1. Remove express option. 2. yes 3. show it at checkout and also show which product is unavailable and give a remove option. 4. yes 5. Just use the term "delivery days" and quietly explain it in faqs, so you can easily promise using this term and it will still be valid, It basically defines that an order can be delayed due to flight delay. 6. yes. 7. no 8. yes 9. yes no need to load 10. remove it because the payment is already made 11. yes 12. no 13. yes 14. move to archive now but keep track of what was done before in short. 15. We'll see it after diwali leave as is."
- What it means: the contract is `docs/archive/simple-store-plan.md` §1, §2 (what stays) and §10. A delivery day is a working day, Monday to Friday, counted from the order day; flight delays are not part of the promise. Food 7 delivery days; clothing and home & gifts 12 – 16; a bag with both always ships in two shipments; free shipping from $49.99 on every bag; bulk saving and the heavy-item discount from a new setting at $99.99 (money unchanged); no Express; store pages say "delivery days" and no calendar date, checkout and the order page keep the order's estimated window; stock is checked at checkout instead of live on product pages. Existing orders keep their promised dates (INV-6).
- *Interpretation (the plan's §7 defaults, used because the founder gave no other answer; confirm before release):* the packing list and commercial invoice go with the Cycle pages (invoices A/B/C per order stay); every food listing promises 7 delivery days, including food bought from slower shops; US public holidays count as delivery days; food that cannot reach the hub fast enough stays live.
- Release, the founder (2026-11-04): the migrations waiting for the Deploy workflow ship in the same release as this one. The founder's runbook: `docs/release-simple-store.md`. Answers Q-35 and Q-45. What went: `docs/archive/retired-2026-11-simple-store.md`.

**D-188 · 2026-11-05 · founder: the hidden $1 payment page stays, to test Stripe after the simple store's release** · Supersedes D-187's §10 Y-10
- Founder, verbatim: "yes we can do the hidden $1 payment page again to test stripe. then create PR"
- What it means: `/admin/settings/payment-test`, its files and the webhook's skip for `metadata.kind = 'admin_test'` are back as they were on `main`, and the release runbook's step 15a runs it after the Deploy.
- *Interpretation (proposed):* this answers the verifier's question about a real payment after the Deploy with the $1 test, not with a real order. The $1 test proves the live keys, the store's card form and the site's security rules. It makes no order, so `create_order` on production is first used by a real customer's payment.

**D-189 · 2026-11-06 · founder: almost all of the website is static; fewer page-cache writes without changing what customers see** · Changes D-171's hour and D-145's refreshes
- Founder, verbatim: "Most things on our website won't change except for in stock values and dollar rate and might be something which I am missing out. So almost all website should be static and fast." and "Now make a new branch on which you will first make changes for the minimization of these rates, using everything efficiently and optimization without disturbing the user's experience. then I will buy the pro plan, And I will be continuing my more design work on this branch only, at the end I will merge it."
- Why: Vercel's Hobby limits passed in about three days on 2026-11-06: ISR writes 228K of 200K (three times the 76K ISR reads), Active CPU 4 h 23 m of 4 h, Fast Origin Transfer 9.46 of 10 GB.
- What it means: the store's fallback refresh is a day, not an hour. A sale, a cancel, a weighing, a confirmed quantity, a review and a source's price refresh only that listing's pages. The app's `POST /admin/revalidate` names what moved, and an empty body refreshes nothing. `robots.ts` keeps crawlers off filter addresses and shuts out AI training and SEO-tool crawlers. A finger or a mouse must rest 250 ms before a page is read ahead, so a scroll starting on a card reads nothing. The CDN keeps `/api/browse` an hour and `/api/card-options` 5 minutes.
- What customers can see: a price the sourcing runner moved shows on the store within a day (it was an hour); checkout always charges and checks the current price and stock. Home and See all show a weighed piece's new price within a day. `/clothing?state=kerala`-style addresses leave search results; the state and product pages stay.
- *Interpretation (proposed):* "dollar rate" is fixed in beta pricing (₹92) and has no timer since D-187 Y-2, so it never refreshes pages on its own; only Settings does.

**D-190 · 2026-11-06 · founder: mobile web first; Shop by category grows; Shipping follows every piece; a rail of groups; struck-through prices in wine on 55% of listings** · Changes D-154's billed kg, D-187's tiles, D-136's Category filter
- Founder, verbatim: "1. from now our focus will be on maxxing out designs and productivity and user experience on mobile web-app, website and app are complimentry. 2. In shop by category, add clothing(shirts(men), pants(both), tops(women), dresses, kurtis, sarees and home decor) and home decor and remove ground spices as there are already two categories available. 3. In the older version of IWC, the shipping charges increased with addition of products seeing which users added more products so it reached $49.99, now the shipping charges freezes at 18.62. I want it to increase with the amount of products even after free delivery under the strike through I want it to increase as the products increase. 4. I want a new vertical sub-category on the left side of the panel as small icons working similarly like filters but shown differently from them, In those sub category names of grouped items will be shown in the whole category 5. Finally the most important detail missing on our website, we need is cutting selling prices and showing discounted prices. Now we will have to show a bit higher price(If we add the amount it would've been on adding the margin cut to the current price(let's say buying price+10%+shipping is rs x and after adding margin it is shown as y rupees, then from now on it will be shown as y+(y-x) and we will strike through it and show the discounted price as y rupees.) we don't have to do it on every product but some of the random 55% of the products) 6. after all this make sure we are still optimal, efficient and on with our plan with efficient usage of vercel and supabase."
- To Claude's question on item 3, the founder chose "Both paid and struck". To Claude's objection on item 5, verbatim: "you do not have the whole context, todays prices are actually charged less because over margin therefore we are choosing to only increase 55% products to the real price, we have all the signed government papers, you have to make as I directed I will handle the rest."
- The founder's answers once it was built, verbatim: "1. The cut prices remain the same color and the new prices should be in wine color which attracts viewers eye. 2. One should be handicrafts and decor and one should be gifts, 3. no worries of three to two tiles 4. why do they pay less make them somehow the actual price they should be paying. 5. Close the legal risk as I have submitted those signed documents to the office. Do not stress about it. 6. no let it be the margin because we only have permission for that. 7. Once everything checks final then we commit then push to branch once CI shows green I will buy vercel then merge and deploy"
- **Shipping:** the heaviest piece is billed as the courier bills one (at least 1 kg, then by the half kg), every other piece adds its own weight, all at the $ a kg in Settings, food at its billed %. Paid below the free line, struck through from it up: one figure, the bag's real one. A one-piece bag pays what it paid. Most small bags pay more (5 × 100 g food at 110%: $26.81, was $18.62; 10: $37.05, was $27.93). Never under the whole bag by the half kg (D-154), so no bag pays less than it did: a 1 kg piece and a 100 g piece stay $27.93, and the figure moves again once the bag passes it. Orders already placed keep their amounts.
- **Shop by category:** Ground Spices out. In: Shirts (`shirts-and-tops`, men), Tops (the same, women), Pants (`jeans-and-trousers`), Dresses (`co-ords-and-dresses`), Kurtis (`kurtas`, women), Sarees (`sarees`), Gifts. A tile with a "for" counts and opens as that filter does, unisex pieces included. Still biggest first. Handicrafts & Decor keeps its tile and name. *Interpretation (proposed):* the catalogue has no gifts category, so Gifts opens and counts all of Home & gifts (`/home-and-gifts`).
- **The groups' rail** (`group-rail.tsx`, `public/icons/groups.svg`): every See all and state page with more than one group. Down the left, small round icons with their names, sticky while the cards scroll; a tap swaps the cards in place, a real link as every filter is. *Interpretation (proposed):* it replaces the Category group in the filter panel, so one list is not shown twice; on phones the food and home grids go from three cards a row to two beside it (the founder: "no worries"), and the round Filter button moves to the right when pinned. The app keeps its Category filter (mobile web first); its Shirts, Tops and Kurtis tiles open for men or women.
- **Struck-through prices:** on cards and the product page, website and app, the struck price muted and the price in wine (`brand`). Struck figure = y + (y − x) = price × (2 − the category's divisor): food 1.2, clothing 1.4, home & gifts 1.5 (`wasCents`). Which listings: picked from the id, `offer_pct` % of them (Settings → Prices, 55; 0 turns it off), only those priced by the rules; hand-priced listings have no cost to work from and US clearance has its own price. *Interpretation (proposed):* no "% off", "Sale" or "You save" wording, no change to the bag, checkout, orders, invoices, Stripe or the search engines' price data: what is charged stays y.
- **Claude's flag, closed by the founder (as with D-140's F5):** Claude flagged that the struck figure is one no customer has been charged (FTC 16 CFR 233.1, state rules such as California's Business & Professions Code §17501) and that struck − price equals the margin. The founder answered that the signed documents have been submitted and that the gap stays the margin, the words above; Claude has not seen the documents. Settings at 0 removes every struck price at once.
- **Cost (item 6):** no read from the browser; one small read per card drawn; a picked card adds about 13 bytes of data and 30 of HTML; Home's cached answer gains about 700 bytes; the rail uses the page's own read and one cached static file; no new index, table or scheduled page-cache write. The new tile addresses add at most six cached pages.
