# Decisions log

Append-only. Never edit the meaning of an entry: to change a decision, add a new entry that supersedes it
(`Supersedes D-xxx`) and mark the old one `SUPERSEDED by D-yyy`.

**By:** `founder` = decided by the founder, binding · `approved` = proposed by Claude, approved by the founder ·
`proposed` = Claude's recommendation awaiting founder review. It may change, so don't treat it as final.
Founder quotes are verbatim (typos kept) so later sessions don't reinterpret them.

---

**D-001 · 2026-09-27 · founder: Users, emotion, competition**
Users: Indians living in the US, plus some US citizens. The emotion we resolve is homesickness. We are cutting out
two competitors: slow couriers, and the feeling of owing a favour when asking a relative or friend travelling from India.
> "the target users are Indians residing in USA and some of the native citizens, the emotion we have to resolve is
> home-sickness … the competition that we are cutting by doing this is the couriers which take so long and the
> feeling of debt if someone asks their relative or friend who is coming from india."

**D-002 · 2026-09-27 · founder: Regions are the core concept, all 36 treated the same**
The site revolves around India's states. Selecting one shows that region's clothes and spices and the emotion.
All 28 states **and** 8 union territories are shown, with no distinction between them.
> "Once the user selects a state they will get to see that state's regional clothes and spices and the emotion that we are selling."
> "Show everything don't differentiate between states and ut's"

**D-003 · 2026-09-27 · founder: No operations info on the customer side**
The customer side never shows physical-operations information. IWC presents the inventory as its own. The site is US-based
and hosted in the US. Operations info is allowed only in the admin.
> "don't use any physical work information on the customer side because it is a US based site and I will host it from US,
> you are only allowed to use that kind of info on admin side." · "I will show it on website as mine"
*Interpretation (proposed, confirm at R1 review):* "operations info" = shops/vendors, shop location, sourcing, pickups,
payouts, cycles and export logistics, staff. Customers **may** see: the product's region, its craft/style name, "Made in
India / Imported" (D-004), and an estimated delivery window (D-008). The exact whitelist is in `storefront.md`.

**D-004 · 2026-09-27 · proposed: Honest origin labelling; the old "stealth origin" layer is removed forever**
Product pages show the region and "Made in India". Listings disclose "Imported". Why: it's the concept itself (D-002), and US
FTC textile rules require country-of-origin labels on garments and an "Imported" disclosure in online listings. The
pre-restructure code rewrote tracking and emails to hide India (see tag `pre-restructure`). That must never return.

**D-005 · 2026-09-27 · founder: Order-first supply in cycles**
Shops' pieces are listed as IWC inventory. When a customer in the US orders, the selected pieces are collected from the
shop in that region. Everything is shipped together and delivered. Shopkeepers are paid when their pieces are collected.
One export every 20–23 days.
> "I will be paying the shopkeepers once their selected pieces are taken from them. And they will be taken from them when
> someone ordered it in US. the flow is, I will take inventories from every shop, I will show it on website as mine, people
> place orders, the selected items from inventory will be taken from that state and everything will be shipped at once and delivered."
> "the goods will be exported every 20-23 days from India to US"

**D-006 · 2026-09-27 · founder: Hidden admin on web and app**
Web: the normal site is for everyone. The admin lives only at `/admin` behind credentials and is not loaded for customers. App: the same
app for everyone, and signing in with an admin account loads the admin app. Never shown or explained publicly. Access only for
admin emails.
> "one endpoint will be for the admin panel, if we can decrease the load by not loading admin side for each customer, it
> will only be loaded when the admin hits the /admin and then enter credentials, same for app … when certain email and
> password will be entered the admin app will be loaded. but dont show it publicly … just give that access to admin email."
> (founder brief) "So we need a very optimized admin side as well."
*Implementation (proposed):* the server enforces access (`profiles.role = 'admin'` **and** email in `ADMIN_EMAILS`) on every
admin page, API route and RLS policy. Hiding is only UX. Admin screens ship inside the mobile binary but aren't loaded until
the server confirms the role.

**D-007 · 2026-09-27 · founder: Two operators**
> "One founder operates on US side and one COO operates on Indian side."
*Proposed:* both have `role = 'admin'`. `profiles.desk` (`us` | `india`) picks the default dashboard. COO scope is open: Q-4.

**D-008 · 2026-09-27 · proposed: Delivery estimates come from cycle data and are honest**
Checkout shows an estimated delivery window computed from the open cycle's dates before payment, and it is stored on the order.
If a cycle slips past an order's window, the customer is notified and offered cancellation with a refund. Why: US FTC
Mail/Internet Order Rule (ship within the stated time, or within 30 days if no time is stated; delays need consent). Confirm with a lawyer.

**D-009 · 2026-09-27 · founder: Brand** "The Indian Wholesale Club", short "IWC".

**D-010 · 2026-09-27 · founder: The app shares the web's backend**
One Supabase backend for web + app (the existing setup). Realtime is part of the product ("realtime functional website").

**D-011 · 2026-09-27 · founder: Speed and real tests are top requirements**
> "the existing codebase is very very veryyy slow, loading takes a long time, endpoints take a long time, tests are trash,
> and even building takes a long time."
Performance budgets and the testing strategy are in `engineering.md`.

**D-012 · 2026-09-27 · founder: The docs must stop the model from inventing things**
> "Make the docs in such a way that the model does not hallucinate with its own answers, solutions and context."
Implemented as the rules in `CLAUDE.md`, decision IDs, `questions.md`, and evidence-only status.

**D-013 · 2026-09-27 · founder: Claude may reset the hosted Supabase dev DB** (test data only).
> "yes yes do whatever you feel like would be the best for IWC."

**D-014 · 2026-09-27 · founder: Git**
GitHub `yobslob/The-Indian_Wholesale-Club`, branch `main`. Baseline commit `d5342ae`, tag `pre-restructure` (pushed by founder).

**D-015 · 2026-09-27 · proposed: Keep the stack, rebuild how it's used**
Keep Turborepo + pnpm, Next.js (storefront + admin), Expo (app), Supabase (Postgres/Auth/Storage/Realtime), Stripe (USD),
Resend (email). Rebuild the domain, schema, data access, tests and docs. Why: the slowness comes from usage patterns (`engineering.md`
§Diagnosis), not from the frameworks.

**D-016 · 2026-09-27 · proposed: In code, a state or UT is a `region`**
`state` already means React state and the US address field. UI copy says "state" or "home".

**D-017 · 2026-09-27 · proposed: Customer reads only through `store_*` views/functions**
Base tables that hold vendor, cost or operations data are admin-only under RLS. Customer surfaces read whitelisted
columns through `store_*` views/functions. This makes D-003 structural and testable (INV-1 in `data-model.md`).

**D-018 · 2026-09-27 · proposed: Shops never get logins.** Founder/COO enter all shop data.

**D-019 · 2026-09-27 · proposed: Claude-drafted content is marked `draft`**
Region greetings, stories and taglines written by Claude are seeded with `content_status = 'draft'`. They are visible in the admin,
and the storefront shows them only after the founder approves them.

**D-020 · 2026-09-27 · proposed: Squash the 13 old migrations into one new baseline** (allowed by D-013).

**D-021 · 2026-09-27 · proposed: Verification runs on the founder's machine**
Claude's sandboxes can't reach npm, so `scripts/check.mjs` is the single verification run. Its output (`.checks/latest.json`)
is the only accepted evidence for build, test and speed claims.

**D-022 · 2026-09-28 · founder: Couriers are also expensive**
Adds to D-001: international couriers are not only slow but also very expensive for Indians living abroad.
> "takes a long time and is very expensive for Indian locals who are abroad."
(founder review comment on `product.md`)

**D-023 · 2026-09-28 · founder: The docs and all `proposed` decisions are approved**
The founder reviewed the R1 docs and approved them. Every entry marked `proposed` above (D-003 interpretation, D-004,
D-006 implementation, D-007 proposal, D-008, D-015 – D-021) now counts as `approved`. Every "current assumption" in
`questions.md` was accepted as the answer (recorded as D-024 – D-036 below).
> "All answers in Questions.md are assumed correctly and yes I do have docker desktop and you have the access for it and yes
> the above markdown is approved you can start."

**D-024 · 2026-09-28 · founder (was Q-1): Order-first only**
Build only the order-first flow (D-005). Keep room for a future faster option through `orders.fulfilment_mode`. Nothing else is built for it.

**D-025 · 2026-09-28 · founder (was Q-2): Retail to consumers.** No B2B or bulk pricing, and no membership. "Wholesale Club" is only the brand name.

**D-026 · 2026-09-28 · founder (was Q-3, first half): No fixed lead times**
Admins enter each cycle's dates (cutoff, estimated export, estimated arrival). Nothing is hard-coded. The US carrier is still open (Q-3).

**D-027 · 2026-09-28 · founder (was Q-4): The COO is a full admin**, with the same access as the founder. `desk` only picks the default screen.
Supersedes the "COO scope is open" note in D-007.

**D-028 · 2026-09-28 · founder (was Q-5, first half): No returns/exchanges flow in the restructure.** SUPERSEDED by D-071. Policy text is still needed before launch (Q-5).

**D-029 · 2026-09-28 · founder (was Q-6): Payout records** hold the method, reference and an optional receipt photo.

**D-030 · 2026-09-28 · founder (was Q-7): Piece unavailable at pickup** → refund that item and notify the customer. No substitutes.

**D-031 · 2026-09-28 · founder (was Q-8): Local Supabase via Docker**
The founder has Docker Desktop. The new schema is developed and tested on local Supabase (`supabase start`) first. The hosted
dev DB is reset only when the app code matches the new schema (R5).

**D-032 · 2026-09-28 · founder (was Q-10, first half): Spice listings stay unpublished** until the FDA facility and labels
are settled (Q-10). Spices can still be drafted in the admin.

**D-033 · SUPERSEDED by D-073 · 2026-09-28 · founder (was Q-11): Sales tax is a flat 8% estimate for now.** Stripe Tax is a later option (F-2).

**D-034 · 2026-09-28 · founder (was Q-12): "Preparing your order"** is the customer-facing status while goods are in India or in transit.

**D-035 · 2026-09-28 · founder (was Q-13): The home page may show "Order by <date>"** for the next delivery window.

**D-036 · 2026-09-28 · founder (was Q-14): USD only, no compare-at prices.**

**D-037 · 2026-09-28 · approved: Keep `node:test` + `tsx` as the unit-test runner**
Supersedes the "Vitest replaces node:test" line of the R1 `engineering.md` (approved in D-023). Why: the baseline test step
took 1.8 s (`.checks/baseline.json`), and Vitest would add a dependency without solving a measured problem. What was wrong
with the old tests was their content, not the runner (they asserted on SQL text).
Status: offered to the founder as "reply only if you disagree"; no objection in the founder's next two messages (2026-09-28).


**D-038 · 2026-09-28 · approved: The order is created from the checkout the server stored, never from the browser**
`POST /api/checkout` prices the bag from the catalog (`checkout_context()`, one round trip), creates the Stripe
PaymentIntent for that exact total and stores the priced checkout in `pending_orders`. After payment the browser sends only
the PaymentIntent id (`POST /api/orders`); the Stripe webhook does the same if the browser never comes back. Whichever
arrives second finds the existing order (`payment_intent_id` is unique). If `create_order` refuses (sold out meanwhile, price
changed, no open cycle), the payment is refunded in full and the refusal is recorded in `failed_reconciliations` (flows.md §3.5).
Why: the old flow re-sent the cart from the browser and trusted it for the webhook fallback.

**D-039 · 2026-09-28 · approved: `/admin` is not named in robots.txt**
Listing it there would advertise it, which D-006 forbids. Admin pages send `noindex` instead (response header set by the
middleware + page metadata). Supersedes the "robots.txt disallows it" line of the R1 `admin.md`.

**D-040 · 2026-09-28 · approved: Shipping charge is a setting, empty until the founder decides (Q-16)**
`pricing_settings.shipping_flat_cents` + `free_shipping_min_cents` (migration 3). While the flat charge is empty, checkout
is closed ("not open right now") instead of guessing a fee (D-012). The dev demo seed sets it to 0 as a placeholder. The
old code's $5.99 / free over $75 / $12.99 express were generic-store numbers, not IWC decisions, and are gone.
The founder then set the values (D-041).

D-038 – D-040 were offered as "reply only if you disagree"; the founder replied "this all was good" (2026-09-28).

**D-041 · 2026-09-28 · founder (was Q-16): Standard shipping is free, express shipping is $8**
Founder, verbatim: "for fast express shipping we can show $8 and for normal we can show free. This is an abstract
information". So both are settings (admin → Settings), not code, and can change. Implemented in migration 4: the
customer picks Standard or Express at checkout; the order keeps the choice (`orders.shipping_method`).
*Interpretation (proposed, confirm with Q-18):* everything still ships together from India every cycle (D-005), so
express can only be faster **inside the US** after the export arrives. Its window = estimated arrival + express days.
Those days are not decided, so express is not offered until they are set (Q-18).

**D-042 · 2026-09-28 · founder (was Q-17): Refunds**
Founder, verbatim: "if the person deliberately cancels the product then dont add tax, we will take the tax money but if
the piece is not available and it's our fault then we do complete refund."
Implemented in migration 4 (the amounts live only in SQL: `item_refund_cents`, `cancel_refund_cents`):
- Piece unavailable at pickup (our fault, D-030): its price after its share of any discount + its share of the tax.
  When it is the last piece of the order, everything left is refunded (incl. shipping): a complete refund.
- The customer cancels (their choice): everything except the tax.
- We cancel (our fault): everything.
*Interpretation (proposed):* cancelling is possible only before the cycle's cutoff (after that, pieces are being
collected; late problems go through the unavailable-piece path). For now an admin cancels on the customer's request;
a self-service cancel button is a coding-phase item. **Compliance check before launch (Q-19):** in most US states,
sales tax collected on a sale that is cancelled has to go back to the customer or to the state; confirm with an
accountant that keeping it is allowed.

**D-043 · 2026-09-28 · Claude, proposed (R6): what the app does itself and what goes through the website's server**
The app talks to the database directly (the user's own session, under RLS) for everything the database can decide on
its own: catalog reads (`store_*`, D-017), the account's own rows, and admin mode (`@repo/db/admin`, refused by RLS for
non-admins, INV-7). Anything that needs a secret goes through the website's server, the same routes the website uses:
checkout and order confirmation (Stripe secret key, D-038) and guest order lookup (service role). A signed-in user's
access token only links the order to the account. So the app holds no secret, and refunds stay on the web panel. Cost:
app admin changes reach the website's cached pages within the 5-minute fallback (B-17).

**D-044 · 2026-09-29 · Claude, proposed (R7): deploys are manual, CI is the gate**
`.github/workflows/deploy.yml` runs only by hand (Actions → Deploy, typing "deploy"), never on a tag push, and builds
the apps on EAS without submitting them to the stores. Why: production does not exist yet (Q-9), the app's bundle ids
are placeholders, and since R7 `next build` no longer repeats lint and typecheck, so a deploy must follow a green CI
run (`ci.yml` runs `check.mjs` against a local Supabase in the runner). Revisit when production is set up.

**D-045 · 2026-09-29 · founder (was Q-20): Cycles close and open on their own; the admin mirrors what happened physically**
Founder, verbatim: "automatically closes and next cycle starts, but the admin should have power to operate online exactly
what he has done physically(such as in cycle 5, 6 items are packed, now cycle 5 is closed and cycle 6 is started, but if
the founder has squeezed 3 more items in cycle 5, we can actually show it as a fast shipping offer to the customer after
confirmation that the item is sent or not)"
*Interpretation (proposed, confirm when C4 starts):*
- At `cutoff_at` the open cycle closes to new orders by itself and the next cycle opens by itself, its dates carried
  forward from the last one (the export rhythm is 20–23 days, D-005); an admin can correct the dates (D-026).
- The admin can move ordered pieces between cycles to match reality: a piece packed into cycle 5 after its cutoff is moved
  from cycle 6 to cycle 5, and the order's delivery window moves earlier through the normal window change (INV-6, D-008).
- The customer is told of the earlier delivery as a "fast shipping" upgrade only after the admin confirms the piece was
  actually sent with that export. Whether that offer is free or paid is not decided.
Supersedes the "Today" gap B-19 once built (C4).

**D-046 · 2026-09-29 · founder (was Q-9, in part): Vercel until launch; domain and support email at the very end**
Founder, verbatim: "I will be running all of this on vercel till the point it goes live, at last when everything is ready
to go live I will buy domain and support mail. we can hold this till last."
So: the site runs on Vercel preview/production URLs until launch; customer emails are built and tested with Resend's
test sender (`ops.md`) and switch to the real domain at launch (C8). Q-9 stays open for the domain itself.

**D-047 · 2026-09-29 · founder (was Q-15): Estimates for the pricing settings until the founder's own research**
Founder, verbatim: "For now take an estimate because I will have to research on everything including the taxes so I will
be updating this before it goes live."
So Claude may fill the pricing settings (FX, freight per kg, duty %, margin %, US delivery days, stale-listing days) with
researched estimates, each **labelled as an estimate with its source and date**, in dev only. The founder replaces them
before launch; a launch check refuses to go live while any value is still marked as an estimate (C6, C8).

**D-048 · 2026-09-29 · founder (was Q-18): Express delivery takes 15–18 days**
Founder, verbatim: "15-18 days". *Open (Q-18, narrowed):* counted from the order date, or from the export's arrival in
the US (how express days work today)? Express stays off until confirmed.

**D-049 · 2026-09-29 · founder: Design direction for the storefront** · PARTLY SUPERSEDED by D-050 (layout below the hero, fonts, no dark mode)
The founder's four prompts, verbatim:
1. "Asymmetric editorial composition with large photographs placed at varying vertical positions. Generous whitespace
   with overlapping image edges and strong visual rhythm. Lenis smooth scrolling with subtle image parallax and slow
   scale transitions. Images gently shift and reveal as they enter the viewport. Minimal typography with a premium luxury
   magazine aesthetic."
2. "Experimental image layout with photographs breaking the traditional grid and extending between sections. Varied
   image widths, offsets, overlaps, and floating compositions. Lenis smooth scrolling with subtle horizontal and vertical
   movement tied to scroll velocity. Soft image scaling and opacity transitions as elements enter the viewport. Clean
   typography and a highly polished interactive feel."
3. "Oversized artwork photography arranged like a contemporary gallery wall. Uneven spacing, offset images, floating
   compositions, and intentional negative space. Lenis smooth scrolling with gentle vertical parallax and
   velocity-based movement. Images reveal through subtle clipping and scale transitions. Minimal typography with a
   sophisticated art-direction aesthetic."
4. "Reduce excessive whitespace and bring visual elements closer together. Increase image sizes and allow sections to
   occupy more of the viewport. Maintain clean alignment while creating a denser, more immersive composition. Keep
   consistent breathing room without large empty gaps. Preserve the premium editorial aesthetic."
Supersedes, for the storefront's scrolling only, the "no animation libraries" line of PR-5 and design.md: Lenis is allowed
because the founder named it. *Proposed guard rails (design.md §Direction):* Lenis and the scroll effects load as one small
client module after the page is interactive, are switched off entirely for `prefers-reduced-motion`, never block
keyboard or screen-reader scrolling, and the speed budgets still hold (`check.mjs http`, first-load JS ≤ 150 KB).

**D-050 · 2026-09-30 · founder: Direction A chosen, symmetric grid below the hero, fonts**
Founder, verbatim, reviewing the three C1 mockups: "Direction C is absolute trash, no dark mode, B is very mid, A is workable
upon keep the hero section format as is, make everything below it symmetrical (grid wise).  I have attached a photo for the
grid below it. I did not like the available now and pick your home, these are just too big, now I am not asking for very
small but I am saying I didnt even like the design, build it from scratch and think of something creative something that
would look creative, minimilistic, elegant, out of the AI slop box. Also very concerning thing is the very big whitespaces
left on either sides of the screen. Fonts currently very trash very very bad ai looking fonts, use poppins for paragraphs,
must use georgia family according to the placements,montserrat wherever necassery and Inter only for the footer"
The attached grid: four equal columns of rounded portrait photos, each with name, price and an "Add" button, a section
title on the left and a "Discover More" pill on the right. The founder also attached a political map of India's states
and union territories.
What it means for the build: Direction A (`design/mockups/a-gallery.html`); B and C are dropped. **No dark mode** on
customer pages (answers `design.md` §7). The hero keeps A's asymmetric format with Lenis/reveal/parallax (D-049);
**everything below it sits on a symmetric grid**, full width with small side gutters (no centred max-width column).
**Fonts:** Georgia for headings, Poppins for paragraphs, Montserrat for interface text, Inter for the footer only.
Supersedes D-049's asymmetric/overlapping layout rules below the hero; D-049's motion rules and guard rails stay.
*Interpretation (proposed, confirm when C1 step 2 starts):* "Georgia according to the placements" = headings, region
names, section titles, the product title and origin line; Montserrat "where necessary" = navigation, buttons, labels,
product names on cards; product photos 3 : 4 portrait as in the reference; the attached map = the look and the official
boundaries for Home's map, drawn from DataMeet's open data rather than traced from the (copyrighted) image (Q-21).

**D-051 · 2026-09-30 · founder: Mockup v3 - map hover delay, headline options, Helvetica Neue, region and product page sections**
Founder, verbatim, reviewing mockup A v2: "Okay The map section is perfect, its just that when someone hovers over the
states names the map reacts by darkening the actual state in the map, I want this when the user holds the mouse over that
name for at least 700ms, and remove where's home instead send me 10 variations
Also use Helvetica Neue in hero section and the lower headings
When a region is opened I need New arrivals, Most wanted, then an album of photos automatically getting scrolled
horizontally and the user can't interact with this section, then curated for you(I need this in a card) and finally
leaving soon for almost out of stock items.
Then let's come to product description page, It lacks reviews, One full length Image not bigger than screen and then
three stacked images beside it. for save I want a heart button besides the name, and just add to cart button on bottom
where it is right now. Instead of dropdowns on details and size use the plus and minus button also name it size chart.
under the product show the same Similar items grid and curated for you. In the pdp the lower grids cards should be a
little smaller to be minimilistic"
What it means for the build (mockup `design/mockups/a-gallery.html` v3):
- Home: the "Pick your home" section is approved as built. A state name (or stamp) highlights its state on the map only
  after the pointer rests on it for **700 ms**; hovering the map itself stays immediate. "Where's home?" is replaced by
  one of 10 headline options (drafts, the founder picks one).
- **Helvetica Neue** for the hero (headline and hero text) and the section headings below it. Supersedes D-050's Georgia
  for those places; Georgia stays for the logo, the product title, the origin line and stamp captions.
- Region page, below the hero: **New arrivals → Most wanted → a photo album that scrolls sideways by itself and cannot be
  interacted with → Curated for you (in a card) → Leaving soon** (almost out of stock).
- Product page: **reviews**; one full-length photo no taller than the screen with **three stacked photos** beside it; a
  **heart** button beside the name to save; the Add to bag button stays where it is; Details and **Size chart** open and
  close with **+ / −** buttons; below the product, **Similar items** and **Curated for you**, with smaller cards (five
  columns).
- Reviews move from "later ideas" (F-6) into the product; how they work is Q-23.
*Interpretation (proposed, confirm when C1 step 2 starts):* "hero section" = all hero text (label, headline, intro,
delivery line); keyboard focus on a name highlights at once (no delay); the Clothing / Spices choice stays as filter
pills above the region sections; the region's tagline and story stay in the hero. The data behind Most wanted, Curated
for you and Leaving soon is Q-22; Helvetica Neue's web licence is Q-24; the album's accessibility is Q-25.

**D-052 · 2026-09-30 · founder (was Q-21, Q-24, Q-25; part of Q-23): Headline, photo hero, fonts fallback, album, reviews check**
Founder, verbatim, reviewing mockup A v3: "headline: Miss local Market?
Start here.
Checked by an admin before they appear
use a free look alike of helvetica
no pause button and I want you to play with the grid of the album, be creative
Yes it is OK and whatever is the fallback do it.
Now I feel like the hero section feels very very dull and feels like a presentation. I want you to be very creative with
it and I have sent you a picture we can put this in the background, and put The Indian Wholesale Club vertically word by
word but right aligned in the white space. big text. when the user scrolls down I need an animation of the brand name text
disappearing fading out and at the same time the logo text appearing fading in. Don't delete the current hero section code
btw, save it into archive if nothing works then we will put the current hero section again."
The founder attached a black-and-white photo (a woman in a white embroidered suit and dupatta on a wooden bench, a white
wall to the right) for the hero background.
What it means for the build (mockup `design/mockups/a-gallery.html` v4):
- **Headline:** "Miss local Market? Start here." (shown as written). Replaces D-051's ten options.
- **Hero:** the founder's photo on the left, fading into its own white wall (measured #FBF7F4) that runs to the right edge;
  "The Indian Wholesale Club" stacked one word per line, big, right-aligned on that wall; headline, intro and delivery
  line below it. **Scrolling fades the brand words out while the header logo fades in** (the logo starts hidden). The v3
  hero is kept in `design/mockups/archive/a-gallery-v3.html`.
- **Fonts:** Helvetica Neue where installed, otherwise the free look-alike **TeX Gyre Heros** (GUST Font License) (was
  Q-24). Georgia where installed, otherwise **Gelasio** (open licence). Each fallback downloads only on devices that need it.
- **Album:** no pause control (was Q-25). This is the founder's accepted exception to WCAG 2.2.2 (`design.md`
  §Accessibility); it still stops for "reduce motion" and when off screen. The album becomes a mosaic of mixed photo shapes.
- **Map:** DataMeet India's state boundaries with the visible CC BY 4.0 credit are approved (was Q-21).
- **Reviews:** an admin checks each review before it appears (part of Q-23; the rest stays open).
*Interpretation (proposed, confirm when C1 step 2 starts):* "Yes it is OK" also confirms 3 : 4 product photos; the hero
photo is used only after its rights are cleared (Q-26); the words fade one after another (The → Indian → Wholesale →
Club) and drift up slightly, the drift off for "reduce motion"; on phones the brand name sits under the photo, over its
faded lower edge.

**D-053 · 2026-09-30 · founder: Hero photo as the full background, only the name and the heading**
Founder, verbatim: "put the photo as background for the hero section instead of left side, also remove the
subdescription and delivery info just the name and the heading"
What it means for the build: the founder's photo fills the whole hero (cropped to the screen, the face kept in view); the
hero shows only "The Indian Wholesale Club" (stacked, right-aligned, on the white wall of the photo) and the heading
"Miss local Market? Start here." directly under it. No label, intro or delivery line in the hero. Supersedes those parts
of D-052; the scroll fade into the header logo stays.
*Interpretation (proposed):* the delivery window stays visible elsewhere on Home and on every product page (D-008); on
phones, where the photo leaves too little clear wall, a soft dark fade at the bottom carries light text. The photo needs a
high-resolution original for large screens (the file sent is 736 px wide), part of Q-26.

**D-054 · 2026-09-30 · founder: Wider hero photo, behind the nav bar too, no white space**
Founder, verbatim: "that was too much zoomed in, here I generated a new image with bigger background now carefully crop it
such that the photo is the background of hero section and nav bar as well. I don't want any whitespaces."
The founder attached a wider version of the hero photo (1117 × 1409 px, the background extended by image generation).
What it means for the build: the hero fills the first screen edge to edge and the nav bar sits on the photo (no band
above it, no side margins). Crop: the photo covers the screen from about 21 % down, so the wall disc, her head and the
clean wall on the right are all in view; the brand name and heading stand on that wall. Supersedes D-053's layout under
a separate header band.
*Interpretation (proposed):* over the photo the nav bar is white on a soft dark fade at the top (readable over both the
door and the disc); it turns solid ivory with dark text once the photo has scrolled past. On phones the crop shifts right
to keep her and the disc in view. The extended image is derived from the original photo, so Q-26 (rights, and a
high-resolution original) still applies.

**D-055 · 2026-09-30 · founder (was Q-26): Hero crop and label; the hero image is AI-generated and IWC has the rights; C1 build starts**
Founder, verbatim: "Instead of starting from 21%, start from a bit more lower so her hand is visible. remove the heading
from there Instead put "Clothing and spices from home" in the same font as it was before getting removed.
Rest is good you can now start the next phase. Also, this is an AI generated image and we do have the rights"
What it means for the build: the hero photo is cropped from 30 % down (her hands in view); the heading "Miss local Market?
Start here." is removed from the hero and the label "Clothing and spices from home" (Helvetica Neue, small caps style as
before) sits under the stacked brand name, which becomes the page's main heading. The hero image is AI-generated and IWC
holds the rights to use it (closes Q-26). The mockup (`design/mockups/a-gallery.html` v7) is approved: C1 step 2 (tokens,
fonts and the storefront built on it) starts.
*Note:* the image file is 1117 px wide; a larger export (about 2400 px) will look sharper on big screens.

**D-056 · 2026-09-30 · founder (part of Q-22, was Q-23): Curated for you, Leaving soon, reviews; region photos**
Founder, verbatim: "Your assumption for curated for you and leaving soon was correct, verified buyers can upload photos and
rest of them only text and ratings. I have addded images for kerala, punjab and rajasthan in design/mocukps/assets(I
didn't know where else to add them) Now start the next phase"
What it means for the build:
- **Curated for you** = pieces an admin picks per region (personalised from saves and views later). **Leaving soon** =
  live pieces with 1–2 left (the "2" is a setting). **Most wanted** stays open (Q-22, narrowed).
- **Reviews:** a rating and text for everyone who reviews; **photos only from verified buyers**; an admin checks each
  review before it appears (D-052).
- Region photos for Kerala, Punjab (two) and Rajasthan were supplied; they go in through the admin Regions page.
*Interpretation (proposed, confirm when reviews are built):* "everyone" = signed-in customers (a review needs an
account); a verified buyer has a delivered order containing that product; the first Punjab photo is its main image and
the second waits for the region album (C2).

**D-057 · 2026-09-30 · founder (was Q-27): Rights to the supplied photos; the kasavu product photos**
Founder, verbatim: "yes I have all the license and permissions, Also I put the kasavu main, full front, full back and
material closeup photos in the assets of design folder. Because I didn't know the process of logging into the admin I
will do it in next iteration, upload these four images in the kasavu product. then work on the next steps"
What it means for the build: IWC holds the licences for the region photos (closes Q-27) and for the four kasavu saree
photos (`design/mockups/assets/Kasavu_main.jpg`, `kasavu_front_full.png`, `kasavu_back_full.png`,
`kasavu_closeup.png`). They go on the (demo) kasavu saree through the admin product page, which gains photo upload now;
the founder signs in to the admin next time (`docs/ops.md` bootstrap).
*Interpretation (proposed):* the main photo is the product's main (cover) photo, in the order main, front, back, close-up.

**D-058 · 2026-09-30 · founder (was Q-22): Most wanted = most pieces ordered in the last 30 days**
Founder, verbatim: "Most wanted = your assumption was correct."
The assumption was the one proposed in Q-22: **most pieces ordered in the last 30 days**.
What it means for the build: the region page gets **Most wanted** between New arrivals and the album (D-051): that
region's live pieces ranked by how many pieces customers ordered in the last 30 days. It is computed from orders in the
database, never typed in or invented (D-012), and it is a count only: no numbers or sales figures are shown to customers.
*Interpretation (proposed, confirm when the section is reviewed):* only paid orders count, and cancelled or refunded
lines do not; a piece needs at least one order in the window to appear (no orders → the section is hidden); ties go to
the newer listing; at most 4 pieces, like New arrivals; sold-out pieces are left out (they cannot be bought).

**D-059 · 2026-10-01 · founder: The six launch regions, the voice for drafted copy, the catalogue**
Founder, verbatim: "1. Delhi, Punjab, Rajasthan, Assam, Maharashtra and Kerala
2. You should draft them but with these instructions strictly(Not a single word should give away the AI tone or AI slop, be human, be relateable, be creative, be out of the box, be frank, be natural)
3. Make a folder or tell me how do I upload for all this inventory and regions.

You will find the inventory to upload in docs/iwc-live-regions-catalogue.md, update all this data written in these specific states and have all the variations of each product, let the inventory fill, don't hold back. Have different colors in all the clothing. btw I ran git push, so now finally proceed to next steps."
What it means for the build:
- **Launch regions:** Delhi, Punjab, Rajasthan, Assam, Maharashtra, Kerala go live first (C2).
- **Drafted copy** (region taglines and stories, product lines) follows the founder's rule above, added to `design.md`
  §Voice. It stays `draft` until the founder approves it (D-019).
- **Catalogue:** every item in `docs/iwc-live-regions-catalogue.md` becomes a listing for its region, with its
  variations; clothing comes in several colours. Photos go in one folder per product (`catalogue/README.md`).
*Interpretation (proposed, confirm when the catalogue is reviewed):* the catalogue has no prices, pieces, sizes or
shops, so those are **dev placeholders** (`is_placeholder = true`, D-012) until real shops are signed up; pantry items
are drafts because spices cannot go live yet (D-032, a database rule); gold and silver jewellery is left out (the
catalogue's appendix makes it a separate founder decision); product names leave out shop and brand names (D-003);
entries that are markets or industries rather than products are left out and listed in `catalogue/README.md`.

**D-060 · 2026-10-01 · founder (was Q-28): Items loved in one state but made in another stay on that state's page**
Founder, verbatim: "Q28,29 are correctly assumed go with your assumed answer"
The assumption was: such items (Lucknowi chikan on Delhi's page; Ilkal, Narayanpet and khun sarees on Maharashtra's)
are listed under the state whose people miss them, and **their description names the real making place** ("Woven in
Karnataka, …"), so origin stays honest (D-004).

**D-061 · 2026-10-01 · founder (was Q-29): No brand names**
Founder, verbatim: (the same answer as D-060) "Q28,29 are correctly assumed go with your assumed answer"
The assumption was: products are listed under their own names (Puneri bakarwadi, Pune poha chivda), never with a
brand or maker's name (MDH, Chitale, Maganlal…), which the store treats like shop names (D-003).

**D-062 · 2026-10-01 · founder: Horizontal rows everywhere, "See all" opens the full list**
Founder, verbatim: "3. I want scrollable horizontal grids everywhere until the user deliberately clicks see all, then take him to the page where all the clothes cards are of that category."
What it means for the build: every product list on Home, the region page and the product page is a row that scrolls
sideways (web and app). A row with more behind it has **See all**, which opens the full list of that category:
`/clothing?state=<region>&category=<category>` on the web and the Browse screen in the app. Region pages show one row
per clothing category. The lists that rows show grow from 4 to up to 12 pieces (Just listed, Most wanted, Curated for
you, Leaving soon, Similar items); this replaces "at most four" in D-058's interpretation.
*Interpretation (proposed):* Most wanted, Curated for you and Leaving soon show their whole list in the row, so they
have no See all; See all pages show 24 cards at a time with "Show more".

**D-063 · 2026-10-03 · founder: The next cycle's dates come from a "days between cutoffs" setting**
Asked: "When a cycle closes by itself at its cutoff, how should the next cycle's dates be set?" Founder picked, verbatim:
"Days setting (Recommended)" (the option read: "A new setting, 'days between cutoffs' (you'd put 20–23, D-005). The next
cutoff, export and arrival all move forward by that many days. Until it's set, it copies the gap between the last two
cutoffs.")
What it means for the build: confirms D-045's interpretation. At `cutoff_at` the open cycle closes to new orders by
itself (pickups created, as an admin cutoff does) and the next cycle opens with the cutoff, estimated export and
estimated arrival moved forward by `pricing_settings.cycle_days`; while that is unset, by the gap between the last two
cutoffs. An admin can correct the new cycle's dates (D-026).
*Interpretation (proposed):* with neither a setting nor two earlier cycles, no cycle opens by itself and Today says so;
if the moved-forward cutoff is already in the past (nothing ran for weeks), it moves forward again until it is ahead.

**D-064 · 2026-10-03 · founder: A piece that leaves earlier is first offered as discounted faster delivery**
Asked: "A piece ordered in cycle 6 gets squeezed into cycle 5's export. After the admin confirms it shipped, what does
the customer get?" Founder, verbatim: "First we offer them a discounted paid faster shipping offer, If they accept then
best, If not we'll just notify them at the last moment that yay it arrived faster."
What it means for the build (refines D-045's "fast shipping offer"): when an admin moves an order into an earlier export
and confirms it went with it, the customer is offered faster delivery for a discounted price (the earlier window, shown
before they pay, D-008). If they pay, their delivery window moves to the earlier one. If they don't, the promised window
stays (INV-6) and, when the order reaches them early, they are told it came sooner.
*Interpretation (proposed):* the offer price is a setting the founder fills (`pricing_settings.fast_offer_cents`); while
it is unset no offer is made and only the "it came sooner" note is sent. The offer stays open until the order ships in
the US. The note never says why it is early (D-003).

**D-065 · 2026-10-03 · founder: A payment that lands seconds after the cutoff still joins that cycle**
Asked: "A customer sees a delivery window at checkout, but the cutoff passes in the seconds before their payment
completes. What should happen?" Founder picked, verbatim: "Let it into that cycle (Recommended)" (the option read: "If
they were priced before the cutoff, the order joins the cycle that just closed, and its pickup is added to the COO's
list. The window they saw stays true.")
*Interpretation (proposed):* only while that cycle is still collecting; once it is packed, the order is refused and
refunded in full like a sold-out item, because the window shown can no longer be kept (D-008).

**D-066 · 2026-10-03 · founder (narrows Q-3): Tracking links for USPS, UPS and FedEx while the carrier is undecided**
Asked: "Q-3: which carriers will ship US orders to customers?" Founder picked, verbatim: "Not decided yet" (the option
read: "Keep typing carrier + tracking number by hand; links for USPS, UPS and FedEx anyway").
What it means for the build: an admin picks USPS, UPS, FedEx or "Other" and types the tracking number; the customer gets
a tracking link for the three named carriers and the bare number for others. Q-3 stays open for label integration (F-1).

**D-067 · 2026-10-06 · founder: Long lists load a page at a time**
Founder, verbatim: "Pagination should be done(wherever needed) everywhere where there are a lot of tons of images which
slows the interface."
What it means for the build: no screen downloads or draws a long list of photos at once. Lists of products show 24 at a
time and load more on request or as you scroll: See all (website: "Show more"; app: the next 24 near the end), search
(website and app: "Show more"). Rows show at most 12 (D-062); the app's Explore reads only those 12 per category
(`store_type_rows`). Admin lists: the website's Catalog has pages of 50; the app's Listings shows 50 with "Show more".

**D-068 · 2026-10-06 · Claude, under D-011 (speed is a feature), proposed: speed and concurrency rules from the audit**
The founder asked for "a deep-dive audit and optimization pass … lightning-fast, highly scalable, and structurally
sound without degrading any image quality or user experience", "a strict cache invalidation strategy so that when an
item sells out, the cached product page updates immediately" with checkout and cart bypassing the cache, smooth app
lists, and app screens that request only the fields they need. What it means for the build (`engineering.md`
§Performance, §Caching, §App specifics; migration 23):
- **Checkout concurrency:** orders no longer wait for each other (`create_order` shares the open-cycle lock instead of
  taking it alone) and lock pieces in a fixed order (no deadlocks). Overselling stays impossible (INV-3).
- **Cache invalidation:** every cached store page carries its own tag. A sale refreshes the pages of what was sold (its
  product page, its region page, Home) on the next request; a cancel and the automatic cutoff refresh the whole store;
  admin changes already did. Checkout, cart, order and account reads are never cached (unchanged).
- **App photos** come resized by the website's own image resizer (the one the website uses, same quality), at the size
  they are drawn, with the original as the fallback. *Cost to know:* the host bills image resizing by the number of
  distinct source photos (Vercel's image optimization); the app asks for the same photos and mostly the same widths as
  the website, so the count barely grows. If you'd rather the app keep downloading originals, say so and it is one line
  (`apps/app/components/photo.tsx`).
- **Payload:** cards carry only what a card shows; the region page carries only the cards it draws; See all and the
  app's Browse read one page plus its counts in one round trip.

**D-069 · 2026-10-06 · founder: A pilot shipment first; Claude sets every number at the high end until the real costs are known**
Founder, verbatim: "We will be doing a pilot Shipping just to test the waters(how deep it is = referring to all the
numbers that we will update once we actually know how much it is costing in each step). Therefore, for now you have to
take charge for carefully putting in all the numbers. consider all possibilities. For starter, we will be working on
higher end on almost all variables" and "Just put every variable in a sorted markdown so I can sort everything out when
I have all the values till then take them by yourself as the higher end."
What it means for the build: every cost and setting gets a high-end placeholder with its basis, listed in one sorted
file (`docs/pilot-numbers.md`) that says where each is changed. Placeholders stay labelled until the founder replaces them
(D-047's labels; the launch check lists them).
*Interpretation (proposed):* "higher end" applies to costs (prices come out safe). It does not apply to sales tax, which
is the state's money, not a cost: tax is charged only where IWC is registered, at the real rate (D-073).

**D-070 · 2026-10-06 · founder (was Q-18, with D-048): Air only; standard goes through the US warehouse, express goes door to door**
Founder, verbatim: "Let's remove the ship scenerio for now, and we are taking by air as default. Normal shipping is
mumbai to us airport to warehouse and then to everyone, express is straight mumbai to us door to door." and "standard is
India to us warehouse to customer, express is india to cusstomer."
What it means for the build: standard = the cycle (D-005): pieces fly together from Mumbai, are received at the US
warehouse and shipped to each customer. Express = the order's pieces go by international courier from Mumbai straight to
the customer's door, outside the cycle, delivered 15 to 18 days from the order (D-048, counted from the order date).
Closes Q-18.

**D-071 · 2026-10-06 · founder (was Q-5): Returns: full refund for our mistakes, otherwise a deduction that grows with time**
Founder, verbatim: "For return see whatever seems applicable to you, as there are a lot of scenarios, if the product is
wrong or damaged(the carrier guy will take photos before handing over), then full return(if there are any mistakes from
our end), otherwise if they return it in a specific window then a specific % of amount will be deducted as fetching cost
and as the time increases the return amount will get shorter. Basically, you consider all possibilities yourself."
*Interpretation (proposed, the founder asked Claude to set it):* wrong or damaged (checked against the courier's handover
photos): everything back, shipping included, reported within 7 days of delivery. Otherwise, unworn and unaltered pieces:
returned within 7 days, 15% kept for fetching; within 14 days, 30%; within 30 days, 50%; after 30 days no returns.
Altered pieces and opened food are final sale. Returned pieces go to the US clearance sale (D-072). Every % and day is a
setting (D-069).

**D-072 · 2026-10-06 · founder (was Q-31): Cancel until the order leaves India; after that, customer care only, with a deduction, and the piece goes to a US clearance sale**
Founder, verbatim: "Show the cancel button until the order isn't left from India, But once it is left remove it and if
the customer calls and talks to the customer care, max solution they will get is refunded with some % deduction for
shipping and then that piece will go to clearance sale in US"
What it means for the build: the customer's own cancel stays on the order page until the order's export leaves India
(statuses confirmed, collecting, packed); collected pieces return to stock. After that only an admin cancels, refunding
the order minus a shipping deduction (a setting), and the order's pieces become US clearance stock, sold from the US
warehouse without waiting for a cycle. Closes Q-31.

**D-073 · 2026-10-06 · founder (was Q-19): Sales tax as the law sets it; the business is registered in New Jersey**
Founder, verbatim: "Again take the numbers by yourself, business is registered in new jersey, I will change the numbers
when I get them." (with D-069: "some tax can be considered as 2-8% legally, so we will charge it as 7% on our website")
What it means for the build: replaces D-033's flat 8%. Tax is charged per delivery state, only in states where IWC is
registered (New Jersey now, 6.625%), and only on taxable items: New Jersey exempts clothing, footwear and food (spices),
so most orders carry no tax. Other states once IWC passes their thresholds (often $100k or 200 orders a year) and
registers. Cancelled orders refund the tax. *Claude's note:* charging tax where IWC is not registered would mean
collecting money it cannot lawfully keep or remit, so the "higher end" goes into prices instead (D-069). Supersedes
D-033. Closes Q-19 (confirm with an accountant before scaling).

**D-074 · 2026-10-06 · founder (was Q-10, Q-30): Spices compliance and the invoice details are in hand; placeholders until after deploy**
Founder, verbatim: (Q-10) "Everything is taken, just as I said insert a placeholder value wherever needed we will sort it
out after uploading it to vercel" and (Q-30) "Yes I have all these numbers, Insert placeholder values for now"
What it means for the build: the FDA registration, US agent, importer and label details, and the exporter, importer,
IEC, GSTIN, EIN, HS codes and Incoterms are settings with placeholders, listed in `docs/pilot-numbers.md`. Spices can be
published once the founder switches "spices cleared" on in Settings (after entering the real numbers); the invoice shows
the entered details. Closes Q-10 and Q-30.

**D-075 · 2026-10-06 · founder: Prices in dollars follow from the rupee price automatically, with live rates**
Founder, verbatim: "Also I need a system which keeps fetching these numbers which change but are provided on the web
such as rates, freight etc. there should be like I insert the product from admin in Indian rupee and then your algorithm
does its thing and then directly shows the price in dollar in Customer's inventory including applying everything."
What it means for the build: an admin enters only the shop price in ₹ (and the weight); the customer price in $ is
computed from every cost setting and the margin, and recomputed when a setting or the exchange rate changes. The
exchange rate is fetched every day from a public source. Freight, duty and courier rates have no free public feed, so
they stay settings with a "last checked" date and a reminder when they are old.

**D-076 · 2026-10-06 · founder (was Q-33): A return is collected from the customer's door, the way it was delivered**
Founder, verbatim: "The company will send someone who will take it back just as he delivered it."
What it means for the build: the customer never ships a return themselves. Once they ask on the order page, IWC
arranges a courier pickup from the delivery address, and the courier takes handover photos as at delivery (D-071). The
piece goes to the US warehouse; it is received there, then refunded or rejected. The order page, the email and the
Shipping & returns page say "we'll collect it from your door"; the admin Returns page asks the admin to book it.
*Interpretation (proposed, confirm before launch):* the pickup costs the customer nothing beyond the share already kept
for a change of mind (D-071), and nothing for a damaged or wrong piece. Closes Q-33.

**D-077 · 2026-10-07 · founder: The logo text: the I of "Indian" inside an outline of India; "Indian Wholesale Club"**
Founder, verbatim: "Just a frontend change in hero section, Instead of plain text logo The Indian Wholesale club I want
as shown in picture, only the outline of india and the text(I of Indian) inside it nothing else. not exactly shown in
this but aligned as it is currently. I was thinking to keep the current text in the logo section as placed just draw an
outline around the I. (Not the whole India obviously we have to cut the right part of it as shown in the picture
reference also change "the indian wholesale club" with "Indian wholesale club")" (with a reference image: a gold
outline of India, "INDIAN WHOLESALE CLUB" over its east side). Then, on seeing the outline drawn in the hero heading:
"I didn't ask for the hero section heading keep it as was in the center without "the", I asked the outline for the
logo text."
What it means for the build: the website's logo text (the header) reads "Indian Wholesale Club", placed as before, and
its I stands inside a gold outline of India whose east is cut away between the I and the "n"
(`packages/shared/src/india-map/mark.ts`, `apps/web/features/shell/logo.tsx`). The Home hero heading stays as it was,
without "The": "Indian / Wholesale / Club". Nothing else from the reference (no rule, ornament or tagline).
*Interpretation (proposed, confirm on sight):* the outline is open on the I's east side, as in the reference: closing
it would run the line through "ndian". The rename covers the logo and the hero heading only; page titles, emails, the
footer and the app still say "The Indian Wholesale Club" (D-009) until the founder says the rename goes further.
