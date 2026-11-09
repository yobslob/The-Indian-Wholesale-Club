# Decisions

Every rule in the docs cites one of these IDs. **This file is the index**; the full text of D-001 – D-176 (the
founder's verbatim words and what each means for the build) is in `docs/archive/decisions-full.md`: open it only for
the entry you need (search for its ID). New entries go at the end of this file in full, with the founder's words
verbatim (typos kept). When Recent holds more than about ten entries, the oldest move to the archive in full and
leave a one-line index entry here (done for D-109 – D-139 on 2026-10-22, D-140 – D-143 on 2026-10-23, D-144 – D-145 on 2026-10-24, D-146 – D-150 on 2026-10-26, D-151 – D-176 on 2026-11-05, D-177 – D-179 on 2026-11-06, D-180 – D-181 on 2026-11-07).

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
- **D-180** 2026-11-03 · founder: Home's hero line points to the 7-day store; every live piece in stock at 10
- **D-181** 2026-11-03 · founder: the 7-day store inside every state's Food and Home & gifts; a state's own pieces first
- **D-182** 2026-11-04 · founder: Home's hero is the Diwali poster and the two doors; the first-load JS budget is 160 KB

## Recent (full text)

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

**D-191 · 2026-11-07 · founder: sub-categories with photos, coupons, coins, a weight on every food piece, retailer charges always paid, Popular by default** · Changes D-190's rail, D-144's sort, D-111's retailer charges and the free line's reading (D-187); D-129's weight on every product finally reaches every food card
Founder, verbatim: "1. Make all these new updates with keeping the minimization of the metric rates in mind, using everything efficiently and optimization without disturbing the user's experience, also updating you as I have bought the vercel pro plan but still we have to work like we're very limited except for when something enhances user's experience.
2. You didn't have to move the category from filters to sub-category, the category stays there in filters, by Sub category I meant to introduce sub categories: like in Snacks and Namkeen(Chips & Wafers, Bhujia & Mixtures, Namkeen snacks, Nachos, Healthy snacks, Popcorn, Papad & Fryums, Premium) in bakery and buiscuits (Cookies, Choco Fills, Cream Biscuits, Healthy & Digestive, Sweet & Salty, Glucose & Marie, Rusks & Wafers) and more like these in every category. each sub-category with a photo take one by default(first product as I will update later)
3. Remove the strikethrough from retailers charge from every possible case it is a must add price from now on.
4. On blinkit there is a weight for everything, Now I want the same for IWC(mainly 7 day stuff, most of them don't have proper weights)
5. then we have to introduce coupons(10% off on new customers upto 9$, $7 discount on hitting 99$ bag, and $12 discount on hitting $150 then $20 dollars off on hitting 199$ bag) and wallet(actual real discount but small amount of money, show it as coins here 1 coin is 1 cent) for everyone. Give everyone random amount of coins between 30-90 coins and when they successfully order refill their wallet with (the same amount of coins they had before checking out+a random number(from 1-8)) When someone checksout they get to see the conversion in the billing(on the left they see what amount of coins used and on the right they see amount of equivalent dollars that are getting cut.) always show the most effiecient coupon for the bag on the top of coupon placeholder with an apply button and a view all coupons button which pops up just a small tab showing coupons instead of a whole new page.
6. Instead of rice, flour and staple give a valid name for soup and noodles category, then replace the current category photos with the ones I updated in /visuals also merge gifts and pooja and name them pooja & essentials.
7. Then finally we are loosing a ton of retention bcs of price low to high by default we have thousands of product in a single category but a person only sees max 100 products so those rest just go in vain there are such valuable and sellable high value items sitting at the bottom of the catalogue bcs of low to high filter we are loosing a ton of retention bcs of price low to high by default we should try experimenting without this by popularity or by most selling products with still considering moderate prices."
Founder's answers to Claude's questions, verbatim: coins for guests: "Accounts only (Recommended)". A coupon, coins and the bulk saving on one bag: "show bulk savings when coupon isn't applied and remove bulk savings as soon as a coupon is applied". What the free line reads: "Bag before discounts (Recommended)". Reading the catalogue tables of the copy in C:\kod\move\new: "yes you can access data files keeping in mind to not burn all of your tokens on reading big files".
What it means for the build (migrations `20261111090000_coupons_coins.sql`, `20261111090100_subcategories_popular_packs.sql`):
- **Retailer charges:** paid on every bag from India at every size, never struck, never in "You're saving" (`bagChargesAt`, the bag, checkout, the app). What the setting says still holds: at least $0.99 or the retailer % of the goods.
- **The free line reads the bag before a coupon or coins**, so neither can bring Shipping back; the bulk saving's and the heavy discount's lines read it too.
- **Coupons:** four public promo codes (`promo_codes.is_public`, `new_customers_only`, `max_discount_cents`): WELCOME10 10% up to $9 for someone with no paid order on the account or email; SAVE7 $7 from $99; SAVE12 $12 from $150; SAVE20 $20 from $199, each measured on the bag's subtotal. A coupon replaces the bulk saving; one worth no more than it stays off, with a line saying so, and is not offered as the best. Checkout's coupon box: the best for the bag on top with Apply, "View all coupons" as a small tab with a field for any other code; Apply on a priced bag moves the same payment.
- **Coins:** `profiles.coins`, drawn 30 – 90 per account; 1 coin = 1 cent. Accounts only: a guest sees "Sign in to use your coins". All of them apply on every order, on top of a coupon, and come off before tax. A paid order sets the wallet to what it held plus 1 – 8 (trigger on `orders`, in `create_order`'s transaction; a refused order changes nothing). The bill: "85 coins used" on the left, "−$0.85" on the right; on a phone the bill also sits above Pay. `orders.coins_used` is the only record.
- **Sub-categories:** `subcategories` (word rules on the listing's name, first match wins, the last takes the rest), `product_place` (each listing's). The founder's own lists for Snacks & Namkeen and Bakery & Biscuits; `?sub=` on See all; the rail shows the category's sub-categories, or all of a type's when no category is chosen; each photo is its first piece's until `sub-photos.ts` names one. Category is back in Filters. Refreshed daily inside `iwc-tidy`, so a new listing joins its sub-category the next morning.
- **Popular** is the default on See all and state pages, website and app: pieces ordered in 90 days, weighted towards moderate prices for the category (0.7 – 2 × its middle price 3×, 0.4 – 4 × 2×, else 1×); ties by moderate first, then a weekly turn, so the long tail changes every week; with no category, one of each category then the next. Low to high, high to low and Newest stay choices; `?sort=low` lands on low to high. To go back, change one default (`browse-query.ts`).
- **Weights:** every food card and page shows one: the label's or the shop's, else the option's weight, as "About 200 g" when it is an estimate. Home & gifts only when the weight is known. On the 5 Nov copy: 8,538 food listings all show one, 3,887 of them "About". The billed weight stays hidden (D-003).
- **Tiles:** Rice, Flours & Staples is now **Noodles, Soups & Staples**; Pooja & Spiritual is **Pooja & Essentials**; the Gifts tile is gone. The founder's photos on every tile that has one, cut from 37 MB to 1.2 MB (640 px JPEGs); originals in `C:\kod\iwc-visuals-originals-2026-11-07`. Their addresses keep their slugs, so old links work.
- **Cost (item 1):** coupons, coins and the customer's standing come inside checkout's existing read (`checkout_context`), sign-in is now awaited before pricing rather than beside it. `store_browse`, one read as before: 425 ms against 377 ms for the old sort on 8,538 food listings on this machine, about 7 KB more JSON on a whole type's first page, nothing new in the page cache. Database: about 1 MB for `product_place`, and a refresh of about 2.4 s a day that writes only what changed. Home is 36 MB lighter if every tile loads.
*Interpretation (proposed, confirm when convenient):*
- **"a valid name for soup and noodles category":** the category holds 1,230 listings, of which noodles, soups and pasta are about 210; the rest are dal, rice, atta and the like. "Noodles & Soups" would be untrue of most of them, so it is Noodles, Soups & Staples, with those as its first sub-categories. Renaming it or splitting it is a small change.
- **"bakery and buiscuits":** no such category existed; **Bakery & Biscuits** is new, taking 496 biscuit and cookie listings out of Snacks & Namkeen on the migration and any new ones each morning, with a tile (its newest piece's photo).
- **"merge gifts and pooja":** the Gifts tile had no category of its own, so the merge is Pooja & Spiritual renamed and the Gifts tile removed; Home & gifts keeps its name.
- **"Premium"** holds nuts, dry fruit and names that say premium or gourmet; **"every category":** the eight categories under 50 pieces have none (Lehengas, Dupattas, Shawls, Dhotis, Jackets, Turbans, Accessories, Fabrics), and no rail shows there. The other sub-category names and rules are Claude's, drawn from the words in real listing names: 126 in all, in the migration.
- **Coupon codes** WELCOME10, SAVE7, SAVE12, SAVE20 are Claude's names. Production already had a WELCOME10 (10% from $200, 100 uses, until 2026-12-31): the migration replaces its terms with the founder's and removes the limit and the end date.
Claude's flags, not decided: production's retailer % was 1.5 on the 5 Nov copy, so the always-paid charge grows with the bag ($2.99 on a $199 bag, $4.50 on $300), not a flat $0.99; Settings → Bag charges, empty for the fixed amount. The new noodles tile photo shows a pack printed "₹15", a rupee price beside dollar prices. The app gets the bill, coins, Popular, sub-category chips and tiles but no coupon box: it keeps typing a code.

**D-192 · 2026-11-07 · founder: the coupons in the bag, one bill that adds up, a card for each shipment** · Changes D-191's coupon box and coins line

Founder, verbatim: "Everything turned out good except for the coupons and totalling, It is very very trash, confusing and skeptical, in some places the retailer charge is cut-off then it is automatically added in last, the coupons are vvery very not ergonomic the design is very bad, the coupons that can't be used should be greyed out and which can be used should be in a coloured background, no need to tell 1 coin = 1 cent or sales tax will be at last, no need to tell these extra text. If there are two shipments show them in two cards like how they are shown today but in cards, so that they get seperated from background, apply button should be there on applyable coupons and then the coupon work should be done in the bag only. When showed add $x more for $7 off put a go back to shopping button besides it. Instead of 30 coins used write wallet(30 /coins-icon/)Why do I have to tell you all of this, you should be figuring out the best design by yourself. Make the best ergonomic and resilient payment design that you can."

What it means for the build:
- **The strikethrough the founder saw was real:** checkout's rows before pricing struck the Retailer charges above the free line, then pricing added them back. D-191's claim that they were never struck was wrong. Three pieces of code drew the bill; now one does (`BillCard`, `billOf`).
- **One sum:** the bag works its bill out with `quoteCheckout`, the server's own function, with the same charges and coupon. Shipping does not depend on the coupon or the address, so checkout adds only the state's sales tax. The rows run down to the total: subtotal, what comes off, what is paid, tax once known. The last line says **Bag total** until tax is known, then **Total**. No sentence explains this.
- **Coupons in the bag only** (page and panel): the best in colour with Apply, the next as "Add $x more for $7 off" beside **Back to shopping** (where the customer last shopped; in the panel it closes the panel). View all coupons rises as a sheet: usable in colour with Apply, the rest grey with the reason. Applying needs no request. A picked coupon the bag no longer reaches stays picked, greyed, and counts again when the bag grows. Typed codes are checked by the server in the sheet.
- **Checkout has no coupon box.** A coupon the server refuses once it knows the customer (WELCOME10 on an email with a paid order) comes off with one sentence and a link back to the bag.
- **Wallet:** "Wallet (30 [coin])" on the bill; a guest sees "Wallet [coin] Sign in". "1 coin = 1¢", "Tax and delivery dates are shown at checkout" and "after your details" are gone.
- **Shipments:** each in its own card, in the bag and at checkout.
- **Resilience:** the bill shows its shape rather than a figure that may move while the charges load, dims while a changed bag is re-read, and coupons that fail to load say so with Try again and never block Checkout. Details typed at checkout survive going back to change the bag (this tab only). The free-delivery pill no longer covers the panel's Checkout on a phone, an older fault.
- **Phone:** the total and Checkout stay under the thumb on the bag page; the shipments and bill sit above Pay.
- **Cost:** the bag now reads the coupons and coins: one `/api/checkout/stock` call (one database read, one function call) per tab in five minutes, and only when a bag page or panel is opened. No database growth, no page-cache write.
*Interpretation (proposed, confirm when convenient):*
- **"You're saving"** moved under the total, outside the sum, and now counts the coupon and coins too (D-140 had it above the total, counting struck Shipping and the bulk saving).
- **Free Shipping** reads "Free" beside the struck figure, in place of "$0.00".
- **The panel** counts as the bag, so it has the coupons too; otherwise the header's bag icon would skip them.
- **The app** keeps its own screens: only the wallet's words changed there, as text without the icon.

**D-193 · 2026-11-07 · founder: the 10% off on Home, on the Diwali night's words and under the navbar on every page; the album faster and never paused** · Changes D-161's "no banners, pop-ups or tickers" and D-052's album stopping off screen

Founder, verbatim: "1. We need to promote 10% off on your first order as a banner between the moving grid and shop by category on home page, On the host your diwali banner I need to see the text flipping back and front from "Host your diwali under $99" to "Get 10% off on your first order"
2. These above promotions are static and fixed at one place we don't know if the user will see them or not, so we need to attach one ad to the navbar but not over it, just attached to it so no matter on whatever page the user is they know that they are getting the 10% off while checking out. we need a very dynamic and creative ad to show, think out of the box avoid all the ai slop and be very creative, we need a lightweight ad, all I could think of was a monkey drops down from the navbar via his tail and in his one hand there is an ad of You'll be getting 10% on your first order. Now you think as much as you can, we'll decide what to insert.
3. Finally make sure as we decided how we are not going to disturb the current deployment metrics of vercel and supabase but not overloading anything, I don't think these minor design changes are going to disturb anything."
Then, on Claude's six drawn ideas and the first band: "1. I want all starting 4 except for the truck and mail, But I want them on different pages, It should come down on it's own after that particular page has been loaded for 3 seconds, if tapped it should go above and disappear, make the monkey a bit better and smaller, also make all of these a bit smaller and minimalistic and not too much.
2. On the bigger banner the colors picked are wrong, from outside first comes the greenish background till border then the yellowish border then white background and green text, also remove the subtext upto 9$.
3. Change the flip a bit faster.
4. make the moving grid's speed a bit faster and dont stop it when it goes out of view keep it moving."
Then, on the built ads and band: "These are disturbing the user's space as they are in the middle of the screen, on home page I need nimbu, now put them where there is whitespace or open screen nothing to disturb. and fix the bigger banner It is looking weird make it better or just revert to how it was before"
Then: "1. It comes after 3 seconds, that is good but it only comes when I go to the top of the page, but the user won't stay at the top for 3 seconds, right? so the 3 seconds should be global no matter where on the page the user is it should hang attached to the dashboard. Also, all ads hang in perfect position now except the nimbu one, make it on the rightmost as well with a little longer thread.
2. the banner is good now just missing decorations that's why it is not looking like a banner. lights and firecrackers like host your diwali banner
3. also the users might swipe the ads left right or up or down instead of tapping, so all of those actions on the ad only should make it go away upwards."
What it means for the build:
- **The band** (`features/home/first-order-band.tsx`, words in `first-order.ts`): after the album, before Shop by category. A voucher: green to a solid gold line, white (the `paper` token) inside, green words; a still shagun envelope with 10% on its coin; the Diwali night's string lights and fireworks in colours that show on white; a solid button, "Start your bag", that opens Food. Server-drawn.
- **The flip:** "Host your Diwali under $99." and "Get 10% off on your first order." turn over on the Diwali night, 8 s for the whole turn and back (first built at 11 s). Both are in the page for screen readers. Still on the first with reduced motion. The button stays "Shop under $99".
- **The ad under the navbar** (`features/shell/first-order-ad.tsx`, drawings in `first-order-art.tsx`): three seconds after a page opens, wherever it is scrolled to, it comes down from behind the header at the right edge and stays hanging from the navbar as the page scrolls. A tap, or a swipe in any direction that starts on the ad (8 px is enough), sends it up and away for that page, and that swipe does not scroll the page; a swipe anywhere else scrolls as usual. The next page's comes three seconds after that page opens. Only the monkey's blink keeps moving. It takes no space (`--top-h` does not change) and sits under the header, the menu and the bag panel.
- **Four ads:** nimbu-mirchi (Home), the kirana strip (Food), Rakh lo, beta (Clothing), the monkey (Home & gifts). Each 40 – 146 px wide and at most 136 px tall.
- **Album:** 75 s a pattern (was 110 s), on Home and state pages alike since they are one component, and it no longer pauses off screen. Still for reduced motion.
- **Cost (item 3):** no database read, no page-cache write, no new page, no function call, no image. The drawings are one static file of 3.2 KB compressed that loads when the first ad is due; first-load JS is unchanged (Home 133 KB). Each deploy empties the page cache as usual. An album moving off screen is work for the visitor's phone only.
*Interpretation (proposed, confirm when convenient):*
- **"all starting 4 except for the truck and mail":** the first four on the page; the kite and the truck are out.
- **"on different pages":** one per type's page and Home as above; every other page (a state, search) gets one of the four by its address. A phone under 360 px gets the narrowest, the strip, except on Home.
- **Where it does not show:** product pages (their photo is where it would hang), the bag, checkout, login and sign-up, account and order pages, and info pages. Also not once WELCOME10 is on the bag, or the bag's last read says the customer has a paid order (that read needs a bag or checkout to have been opened in this tab; a returning customer who has not opened one still sees it).
- **"Bohni · first sale, good price"** on the band is Claude's draft (D-019): the founder removed only the subtext and kept it.
Claude's flags, not decided: with the subtext gone, neither the band, the flip nor the ads say the coupon stops at $9, so "10% off" overstates it on a bag over $90 until the bag shows "10% off, up to $9". A tap only hides the ad (the founder's choice over Claude's idea of a tap putting the coupon on), so a customer still presses Apply in the bag. The words are in the code: WELCOME10 turned off in Admin → Promotions leaves them up until they are changed.

**D-194 · 2026-11-07 · founder: every colour, pack and style shows its own photos** · The plan is `docs/plan-look-photos.md`.

Founder, verbatim: "We have a greater problem to solve in many of the products: 1. In clothing most products have different colors, but on clicking it is showing the same photo on the card. 2. In food, many products have a single piece chocolate double piece chocolate or a family pack but on all clicks it only shows what was scraped. 3. In home n decor, almost all pieces are singular but there could be some which have variety but singular set of photos. […] this solution should not affect any part of the rest of the website in any way, the customer's experience should be seamless(I have hardly got my website on its feet again, don't shake it)". Then, 2026-11-07: "to solve that problem follow the plan in docs/plan-look-photos.md".

- **A look** is a variant's options without `size`; a photo belongs to a look through `product_media.variant_id`, an untagged photo is shared (`packages/shared` `looks.ts`).
- **The product page** swaps the gallery and viewer to the picked look; the bag line takes its photo. **The card's +** shows a colour's photo on the card until the ribbon closes, and its bag line takes that photo. `/api/card-options` adds `image_path`; cached cards stay as they are (D-145).
- **A look with no photo, or a listing with one look, shows exactly what it did.**
- *Interpretation (proposed, confirm when Phase 3 starts):* the plan's §8 defaults, because no other answer came: one photo per look; the card's photo changes too, back on close; 0.5 GB of R2, hard stop at 9.3 GB on the dashboard; the orphan report only reports; clothing → food → home & gifts; no colour in the URL.
- *Interpretation:* the plan says a page opens on the look of the variant `AddToCart` picks. When the main photo is untagged that would put a tagged photo ahead of it and change the first paint, against "don't shake it". So such a page opens with every photo in today's order, and the first swap comes with the first tap.
- **Founder 2026-11-09:** "the old csvs which I gave you as the supabase editor queries were ran on the old database and so was the command, that's why It was showing an error but now everything is updated the new values are in sourcing runner's env and the new database is https://ttobhpcidixxdteczccv.supabase.co". So the Phase 0 numbers (and the counts quoted at PR #6) are the old project's; the first dry run on the live project is in the plan.
- **Founder 2026-11-09, on R2:** "8.39GB R2 storage but I am willing to buy 500GB". R2 is billed by use past the free 10 GB, so nothing needs buying ahead; the plan's 0.5 GB cap and 9.3 GB stop give way to each run's `--photo-gb`. L1 – L4 run again on the live project came back the same in every cell, so the Phase 0 numbers stand.
- **Built, not run:** `pnpm sourcing looks` (the backfill), new Amazon listings' look photos, the admin's **For**. The founder runs every step on production. Amazon listings, most clothing colours and food packs, have no photo per look until then, so they look as before.
- *Interpretation:* the founder said "Keep working and keep going on" without choosing about the small photos under a picked colour, so they stay as built. Hiding them moves the page by 158 px on a phone.
- **Cost:** page cache: no new write; measured bytes in `status.md`. Database: one more small read per uncached `/api/card-options` answer (CDN 5 minutes); one migration with worker functions only, about 2 MB at 7,000 photos. R2: nothing until the backfill runs, at most 0.75 GB by the plan's sum. `NEXT_PUBLIC_LOOK_PHOTOS=off` and a redeploy turns it off.

**D-195 · 2026-11-08 · founder: Traditional wear, every state's clothing from one tile**

Founder, verbatim: "Add a new option of traditional wear in categories on which clicking it opens clothing but with the filter of clothes from all states only with a tag of the state below, once done then create the pr"

- **Home's Shop by category** starts with a **Traditional wear** tile ("From every state"), shown when there is clothing. It opens `/clothing?state=any-state`: Clothing with only the pieces from a state, none of the all-India ones. Each card names its state below the photo, as cards already do.
- The page's heading is "Traditional wear"; its chip "From every state" and Clear all go back to all of Clothing. Picking a state in the filter goes to that state, as before. Food and Home & gifts read the same address as their state-made pieces, with their usual heading.
- `store_browse` takes `p_region = 'any-state'` (migration 20261112090100); nothing else in it changes.
- *Interpretation (proposed):* "categories" is Home's Shop by category; the tile goes first, with `/visuals/diwali-clothing.jpg` until the founder sets one (`tile-photos.ts`).
- **Cost:** one more cached See all page per type opened this way, built on first visit; no new read, no database growth, no new JS.
