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

**D-018 · 2026-09-27 · proposed: Shops never get logins. · SUPERSEDED by D-102** Founder/COO enter all shop data.

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

**D-050 · 2026-09-30 · founder: Direction A chosen, symmetric grid below the hero, fonts · fonts SUPERSEDED by D-079**
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

**D-051 · 2026-09-30 · founder: Mockup v3 - map hover delay, headline options, Helvetica Neue, region and product page sections · Helvetica Neue SUPERSEDED by D-079**
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

**D-052 · 2026-09-30 · founder (was Q-21, Q-24, Q-25; part of Q-23): Headline, photo hero, fonts fallback, album, reviews check · fonts fallback SUPERSEDED by D-079**
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

**D-053 · 2026-09-30 · founder: Hero photo as the full background, only the name and the heading · phone fade SUPERSEDED by D-079**
Founder, verbatim: "put the photo as background for the hero section instead of left side, also remove the
subdescription and delivery info just the name and the heading"
What it means for the build: the founder's photo fills the whole hero (cropped to the screen, the face kept in view); the
hero shows only "The Indian Wholesale Club" (stacked, right-aligned, on the white wall of the photo) and the heading
"Miss local Market? Start here." directly under it. No label, intro or delivery line in the hero. Supersedes those parts
of D-052; the scroll fade into the header logo stays.
*Interpretation (proposed):* the delivery window stays visible elsewhere on Home and on every product page (D-008); on
phones, where the photo leaves too little clear wall, a soft dark fade at the bottom carries light text. The photo needs a
high-resolution original for large screens (the file sent is 736 px wide), part of Q-26.

**D-054 · 2026-09-30 · founder: Wider hero photo, behind the nav bar too, no white space · nav on a dark fade SUPERSEDED by D-079**
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

**D-055 · 2026-09-30 · founder (was Q-26): Hero crop and label; the hero image is AI-generated and IWC has the rights; C1 build starts · crop and label SUPERSEDED by D-079**
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

**D-078 · 2026-10-07 · founder: The first cycle is a demo round on the placeholder catalogue, then cleared**
Founder, verbatim: "I want to do the first cycle as demo round so Filling the database and inventory photos is very
very hectic can we fetch a database regarding this and fill it? I will clear the data base once demo is completed, I
want to fill exisiting inventory with photos sizes colors reviews of only five states delhi, maharasthra, Kerala ,Assam
and Punjab"
And the founder's choices of 2026-10-07 (asked as options): "Stripe test mode", "Free-licence photos", "Labelled 'Demo
review'", "Everyone, with a demo banner".
What it means for the build: production may carry the placeholder catalogue (catalogue/data) of Delhi, Maharashtra,
Kerala, Assam and Punjab for the demo round, loaded by `pnpm demo:load` and removed by `pnpm demo:clear`; demo mode is
`dev_preview` on, and every store page (and the app's Home and checkout) shows the demo banner. Photos are public-domain
stand-ins from curated collections (museums, stock product photos), checked by eye; a photo that needs credit shows it.
Demo reviews come from demo reviewer accounts, show only in demo mode and are always labelled "Demo review" (the FTC
rule on fake reviews). Payments run in Stripe test mode for the whole round (Vercel and the app switch to test keys);
real money is never taken for a demo listing. Nothing of the demo round is kept after the clear.

**D-079 · 2026-10-08 · founder: The shell (header, banner, footer, app tab bar) and the Home hero, from the design pass; Cinzel and Karla · header colour, "no blur" and heading font amended by D-080**
Founder, verbatim, over four rounds of `design/pages/shell/mockup.html` (2026-10-07 – 10-08; every round's notes are
quoted in full in `design/pages/shell/brief.md` §Rounds):
Round 2: "Remove clothing and spices form header and footers, add about us, instead of account I need three icons
heart(whislisht/liked), bag(cart with the number),  profile(guest or signed in doesnt matter) these three icons should be
there. When search is clicked another page opens, instead as soon as search is hovered it transitions into the search
placeholder pill and when the mouse is taken off it transitions back into the text of search. The Indian Wholesale club
text should be more lower in the hero seciton, remove the clothing and spices from home and replace with(Miss local
market? Start here.) the fonts are very trash change them.
when the hamburger icon is clicked, the whole screen is taken by the sidepanel, instead it should be smoothly opened as a
sidepanel hovering over the homepage and close like it opened, also it shouldn't be mentioned menu and close, the icons
are enough, in webapp of phone, the footer should be very small and minimal,remove extra things"
Round 3: "All fonts are trash, the text is too much big and lower than before I need it in center with right aligned with
the screen and always on the whitish part of the wall whatever the size of the screen is(adjust the size of text
accordingly). the color should be #1D1A17(for hero headline and black for rest) don't add any blur anywhere"
Round 4: "I choose cinzel and karla, also why did you make the header bg solid make it on the photo and you also removed
the fade in algorithm of the logo text in the header, undo it. footer text is fine. let's finalize and go to next steps"
What it means for the build (approved mockup: `design/pages/shell/mockup.html`):
- **Fonts:** **Cinzel** for headlines (the hero name, page and section headings, product titles) and **Karla** for
  everything else (nav, buttons, labels, paragraphs, prices, footer). Two families instead of five. Supersedes the fonts
  of D-050, D-051 (Helvetica Neue) and D-052 (its fallbacks). The logo text keeps Georgia (D-077's India outline is
  fitted to Georgia's I).
- **Header (website):** States · Search · About us, then three icons: heart (saved), bag with its count, profile (the
  same for guests and signed-in customers). Clothing and Spices leave the header and the footer (their pages stay).
  The current section is underlined. **Search** is the word itself: on hover it slides into a search pill and back to
  the word when the pointer leaves, unless something was typed; Enter opens the results page. One row at every width.
- **Phones:** logo, heart, bag, profile and a menu icon; the menu is a side panel from the right over the page (search
  pill, States, About us, then Track an order, How it works, Shipping & returns, FAQ, Contact), opened and closed with
  the same motion, icons only (no "Menu" / "Close" words). The footer on phones is one small block of links (Track an
  order, Shipping & returns, FAQ, Contact, Privacy, Terms) and the credit line.
- **Footer (tablet and up):** Shop (States, Search) · Help · About (About us, Privacy, Terms); the name and line stay as
  they are ("footer text is fine"), so D-077's footer name "The Indian Wholesale Club" stays.
- **Demo banner (D-078):** above the header on every page, never under it; on narrow screens one short line with a
  "Test card" toggle.
- **Home hero:** the header sits on the photo (D-054) and **the scroll fade stays** (D-052): the words fade out one after
  another while the logo fades in, and the header turns cream once the photo has passed. "Indian / Wholesale / Club"
  (#1D1A17, Cinzel) with "Miss local market? Start here." under it (black, Karla) replaces D-055's label "Clothing and
  spices from home". The name stays **on the photo's white wall at every screen size**: right-aligned to the screen,
  centred on the wall, sized to fit it; the photo is cropped 85 % across and 20 % down so phones keep the wall. Nav and
  icons on the photo are black. **No blur anywhere:** no fades, text shadows or soft shadows. Supersedes D-054's white
  nav on a dark fade, D-055's crop and label, and D-053's phone fade.
- **App:** cream tab bar with labels in Karla, the active tab marked by a short brand-colour bar, the bag
  badge in the brand colour; tab roots get a large Cinzel title, pushed screens a back bar.
*Interpretation (proposed, confirm on sight when the shell is built):* "Start here." links to Pick your home on the same
page; the side panel also closes with Escape and a tap on the dimmed page (a flat dim, not a blur); the short banner line
("Demo store. Nothing here is for sale." + "Test card") is approved with the mockup. Known trade-off, raised in round 3 before the
founder chose the header on the photo: at the very top of Home the black nav crosses the dark wall disc on some widths and
reads poorly there.

**D-080 · 2026-10-08 · founder: Home below the hero, the header on the photo as before, Syne for headings, stamp pages**
Founder, verbatim, over three rounds of `design/pages/home/mockup.html` (every round is quoted in
`design/pages/home/brief.md` §Rounds):
Round 2: "Things we finalized are good such as cinzel and karla, placement of the hero heading etc etc rest should be
like it was before(such as before when the header moved down the hero image its bg became colored but smoothly fading in
now it harshly switches colors and also the haeding were in white)" and "let the date be as is". Asked which round-1
changes below the hero stay, the founder chose only "+ button on the photo".
Round 3: "I need pagination in the stamps when they are less than 6 so they look as they are now, but when they are
greater than 6 start pagination and provide two arrows on right and left, with a smooth scroll animation. rest is good
1. Alright for lower headings let's use syne.
2. Blur is fine I asked the no blur for harsh blurs.
now let's move to the next page"
What it means for the build (approved mockup: `design/pages/home/mockup.html`):
- **Header on the Home photo, as built today** (`apps/web/app/globals.css`): white links over the dark band at the top of
  the photo, the logo fading in with the scroll, and a 0.35 s cross-fade to cream once the photo has passed. Amends
  D-079's black nav and its "no blur" line: soft fades and shadows are fine, only harsh blur is out.
- **Headings below the hero in Syne** (section and page headings). Cinzel stays for the hero name, product titles and
  stamp names; Karla for everything else. Amends D-079's fonts.
- **Below the hero, as today** (row of cards with See all and arrows over the photos; Pick your home with the map, stamps
  and names, stacked below 1100 px) with one change: **the add button is a round + on the card's photo**, so the name
  keeps the card's full width; a piece with sizes opens its options.
- **Open now stamps:** up to 6 they sit as today; **from 7, pages of 6** (3 × 2) that slide with a smooth scroll, an
  arrow on each side (hidden at either end) and a page count under them.
- The hero photo keeps its date stamp. On phones the stamp names scale down to fit (Cinzel runs wider than Georgia).
*Interpretation (proposed, confirm on sight when Home is built):* "the haeding were in white" is the header's links (the
hero name stays #1D1A17 on the white wall, D-079); "lower headings" are the section and page headings below the hero; the
page count ("1 / 2") under the stamp pages is added so the arrows are not the only sign of more pages.

**D-081 · 2026-10-08 · founder: The region page, from the design pass**
Founder, verbatim: asked as options (`design/pages/region/brief.md`): state name font "Cinzel (Recommended)"; fixes
"Something else", "Arrows on the jump pills", "Picked for you as a row" (the "something else" was never specified). On
round 1 of `design/pages/region/mockup.html`: "approved, move to next".
What it means for the build: the region page keeps today's layout (D-051, D-062) in the D-079 / D-080 fonts, the state
name in **Cinzel**, section headings in Syne, the rest in Karla, and the + on every card (D-080). Two changes: the
**jump pills get the product rows' arrows** at either end (each hidden at its end; phones swipe), and **Picked for you
is a standard row** of full-size cards filling its box, with arrows when they overflow. Not chosen: the photo first on
phones, merging small categories.

**D-082 · 2026-10-08 · founder: The product page, from the design pass**
Founder, verbatim: asked as options (`design/pages/product/brief.md`): tablet fix "Photos left, info right
(Recommended)"; also "regardless of screen size clicking a photo opens a panel showing full size image providing both
swipe and arrow to move in these photos of the particular product.", "Add to bag stays in view", "Reviews as a row on
phones". On round 1 of `design/pages/product/mockup.html`: "approved, move to next".
What it means for the build: the product page keeps today's layout (D-051) in the D-079 / D-080 fonts (name and origin
line in Cinzel, section headings in Syne, the rest in Karla), with:
- **Tablets (768 – 1099 px):** two columns, the big photo with the three small ones in a row under it, the info box
  beside them. Fixes today's bug there (the info box squeezed to one word per line, the page scrolling sideways).
- **Photo viewer at every size:** any photo opens a full-screen panel over the page at that photo; swipe and arrows move
  through the product's photos, with a count, a close button, Escape and the arrow keys. The small photos open the
  viewer instead of swapping into the big spot.
- **Phones:** a buy bar (name, price and option, Add to bag) slides up while the page's own Add to bag is out of view;
  the review cards are a sideways row under the rating summary.
Not chosen: a swipeable gallery on phones (the big photo and three small ones stay).

**D-083 · 2026-10-08 · founder: The States page is Home's Pick your home; the app screens get their own pass after the website**
Founder, verbatim (asked as options): States page "Same as Home (Recommended)"; app mockups "After the website pages
(Recommended)".
What it means for the build: `/states` is the approved Pick your home block (D-080: map, stamps with pages from 7,
names, search) as its own page, its heading in Syne; nothing else changes there. In the design pass (`design/pages/`)
every website customer page is designed first; then one pass mocks the app's customer screens on the same decisions,
before the admin side.

**D-084 · 2026-10-08 · founder: Clothing and Spices (the See all page), from the design pass · pinned row's blur amended by D-098**
Founder, verbatim: asked as options (`design/pages/browse/brief.md`): "the things that run off edge, give them a very
very little soft blur, not too harsh", "Filters stay on screen", "One Filter button on phones". On round 1 of
`design/pages/browse/mockup.html`: "I don't want both the regions and categories to pin but just the region. In phone,
when the user scrolls down the filter panel changes to a circular button of the icon only. Rest approved, move onto
next".
What it means for the build: `/clothing` and `/spices` keep today's page (D-062, D-067, D-068) in the D-079 / D-080
fonts with the + on every card, and:
- **Soft edge:** where a pill row runs off the screen, its end fades into the page under a very light blur (about
  1.5 px), only on a side that has more.
- **Only the state row pins** under the header while the grid scrolls; the category row scrolls away with the page.
- **Phones:** one pinned Filter bar (button + what is chosen and the count) opens a side panel from the right with the
  menu's motion (D-079): State and Category as lists with counts, the current ones ticked, Clear; choosing a row applies
  it and closes the panel. Once the page is scrolled the bar shrinks to a round icon-only button in the same place.
The grid's columns stay as today (2 below 1280 px, 4 from 1280).

**D-085 · 2026-10-08 · founder: The search page, from the design pass**
Founder, verbatim: asked as options (`design/pages/search/brief.md`): "Count with the words", "No dead end on no
results", "Something to start with", "Icon button on phones". On round 1 of `design/pages/search/mockup.html`: "the
state cards in search page should have the stamp as they are looking very stale. rest approved move onto next".
What it means for the build: `/search` keeps today's page (D-067) in the D-079 / D-080 fonts with the + on every card,
and: a **count with the words** under the box ("24 pieces for “saree”", "1 state and 6 pieces for “kerala”"; draft
wording, approved with the mockup); matching **states shown as the D-080 stamps** (not plain cards); on **no results**,
today's message, then the open states as stamps and the Just listed row; on an **empty search**, the same two blocks;
on **phones**, a round search icon inside the right end of the box instead of the Search button.

**D-086 · 2026-10-08 · founder: The bag, from the design pass**
Founder, verbatim: asked as options (`design/pages/bag/brief.md`): "Photo on each line", "− 1 + instead of a dropdown",
"Bag slides in as a panel", "Empty bag isn't blank". On round 1 of `design/pages/bag/mockup.html`: "approved, move to
next".
What it means for the build: `/cart` keeps today's page in the D-079 / D-080 fonts, with a **small photo on each line**
(it and the name open the product), **quantity as − / number / +** within today's 1 – 10, and an **empty bag** that
shows the open states as stamps and the Just listed row under its sentence. **The header's bag icon opens the bag as a
side panel** from the right with the menu's motion: "Your bag (n)", the lines, Subtotal and the shipping line, Checkout
and "View bag" (`/cart`); an empty panel shows only the sentence and its link. Prices are still checked by the server at
checkout (D-038).

**D-087 · 2026-10-08 · founder: Checkout as phone → delivery → payment, and the thank-you page, from the design pass**
Founder, verbatim: "I don't want to shove the signin or any details from the customer anywhere on the website, I only
want it when the user deliberately goes to profile or if the user checks out, so we will show it like a part of the
process, first we will only ask for number putting the us +1 with flag by default, when number is done we will ask for
name pincode(fetch us city automatically by pincode) and address, when both are done then we will show payment
methods." Also chosen: "Bag beside the form", "Quiet header", "Fuller thank-you page"; email "Ask email in step 2
(Recommended)"; phone "No code, just the number (Recommended)". On round 1 of `design/pages/checkout/mockup.html`:
"Instead of underlined change, replace it with edit. rest is good, proceed onto the next".
What it means for the build (`/checkout`, `/checkout/success`; the order is still priced and created by the server,
D-038):
- **No sign-in or personal-detail prompts** anywhere on the website except Profile and checkout.
- **Three steps on one page**, each opening when the one before is done; a finished step folds to one line with an
  **Edit** button (not an underlined "Change"): 1. **Phone**, +1 with the US flag by default (required; delivery
  contact only, no code sent); 2. **Delivery**: full name, email (confirmations and guest tracking, as built), ZIP code
  with the city and state filled in from it (editable; an unknown ZIP asks for them), street, apartment (optional),
  promo code behind "Add a promo code"; "Continue to payment" prices the bag on the server; 3. **Payment**: Standard /
  Express with each window (D-041, D-070), Stripe's payment form, "Pay $…".
- **The bag beside the steps** from the start (photos, lines, subtotal; shipping, tax, total and the estimated delivery
  once priced); on phones a "Bag (n) · $…" bar at the top opens it.
- **Quiet header** on checkout: the logo and "Back to bag"; a one-line footer.
- **Thank-you page:** today's text, then the pieces with photos, the total and the estimated delivery window.
*Interpretation (proposed, confirm when built):* "pincode" is the US ZIP code; the ZIP → city lookup's source (a bundled
ZIP list or a lookup service) is chosen at build time.

**D-088 · 2026-10-08 · founder: Order tracking, from the design pass**
Founder, verbatim: asked as options (`design/pages/order/brief.md`): "A real timeline", "Status card on top", "Photo on
each item", "Lookup in a card". On round 1 of `design/pages/order/mockup.html`: "approved, move to next".
What it means for the build: `/orders/lookup` puts the order number, email and "Find my order" in a centred card with
"Both are in your order confirmation email." (draft wording, approved with the mockup). `/orders/[number]` opens with a
**status card** (order number, the customer status in the heading font, the estimated delivery window, and a "Track the
parcel" button with the carrier's link once shipped, D-066), a **timeline** Confirmed → Preparing your order → Shipped →
Delivered drawn as a line that fills to the current step with each reached step's date from the order's updates (none
for cancelled or refunded orders, as today), and **a photo on each item**. The faster-delivery offer, the cancel / keep
choices and returns stay as built (D-042, D-064, D-071, D-072).

**D-089 · 2026-10-08 · founder: The profile (account) page, from the design pass**
Founder, verbatim: asked as options (`design/pages/account/brief.md`): "One profile page, sections", "Orders as cards",
"Heart to unsave", "Sign in on the profile page". On round 1 of `design/pages/account/mockup.html`: "change the big
buttons of edit and remove with icons of pencil and minus in the corner of the card, rest is approved, move to next".
What it means for the build: what the profile icon opens is **one page with four sections**, Orders · Saved ·
Addresses · Your details (a list on the left on desktop, pill tabs on phones; each section keeps its own address), Sign
out at the foot. **Orders** are cards (the first piece's photo with "+n", number, placed date and delivery window, the
status as a label, the total; the card opens the order page, D-088). **Saved** uses the standard cards with a **filled
heart on the photo that removes** the piece. **Addresses** are cards with Default and "Make default", and **Edit and
Remove as a pencil and a minus icon in the card's corner**; "Add an address" opens today's form. **Your details**: the
email, full name, phone, Save. **Signed out**, the profile page itself shows a sign-in card (email, password; "New
here? Create an account" turns it into account creation with full name) instead of a jump to `/login` (D-087).
The two one-line leads on the sign-in card are draft wording, approved with the mockup.

**D-090 · 2026-10-08 · founder: Writing a review, from the design pass**
Founder, verbatim: asked as options (`design/pages/review/brief.md`): "Tap the stars", "The piece at the top", "Photo
tiles", "Opens as a panel". On round 1 of `design/pages/review/mockup.html`: "approved, move to next".
What it means for the build: "Write a review" on the product page **opens the form as a side panel** over the product
(the menu's motion; signed out, the sign-in card first, D-089); `/account/reviews/[productId]` keeps the same form for
links from outside. The form shows **the piece at the top** (photo, name, option · state), the rating as **one row of
five large stars** (tap or arrow keys, "n of 5" beside it), and for verified buyers **photo tiles** with previews, × to
remove and "+ Add photo" (hidden at the limit of 4). Fields, limits, texts and the thank-you / already-reviewed states
stay as built (D-051, D-052, D-056).

**D-091 · 2026-10-08 · founder: Signing in, from the design pass**
Founder, verbatim: asked as options (`design/pages/auth/brief.md`): "Forgot password", "Show password eye", "Email code
instead" (also "Nothing else" ticked; read as the three). On round 1 of `design/pages/auth/mockup.html`: "approved, move
to next".
What it means for the build: `/login` and `/signup` show the profile's sign-in card (D-089) centred, with an **eye** in
every password field to show / hide it, **"Forgot password?"** (email → "Send reset link" → "Check your email" → the
link opens "Set a new password", typed twice), and **"Email me a sign-in code"** as a second way in (email → a 6-digit
code in six boxes that a paste fills, "Resend code", "Use a password instead"). Creating an account stays as built
(full name, email, password; then "Check your inbox to confirm your email, then sign in."). Supabase Auth sends the
reset and code emails; their templates are written in the IWC voice before launch. New wording is draft, approved with
the mockup.

**D-092 · 2026-10-08 · founder: The info pages as a glass panel on the same page, from the design pass**
Founder, verbatim: "In the info pages I don't really need a whole new page to open, I just need a glass tab which opens
on the same page(whichever page it is clicked on) with a cross button". On round 1 of `design/pages/info/mockup.html`:
"need the cross to be smaller, rest approved move on".
What it means for the build: About us (header, side menu) and the footer's info links open a **frosted-glass panel over
the current page** (a soft blur of the page behind, D-080; the page dimmed a little) with **tabs** for About us · How it
works · FAQ · Shipping & returns · Contact · Privacy · Terms, FAQ answers that open with + / −, and a **small × (32 px,
with a 44 px tap area)**; Escape or a click outside also closes it, with the same short fade and lift both ways. On
phones it is a glass sheet rising from the bottom (about 90 % of the screen). The content stays as written (drafts until
approved, D-019; About and Contact still to be written).
*Interpretation (proposed, confirm when built):* each info page keeps its URL (emails, checkout notes, search engines and
legal links need them); opening a tab updates the URL and Back closes the panel; a direct visit opens Home with that
panel showing.

**D-093 · 2026-10-08 · founder: The not-found and error pages, from the design pass**
Founder, verbatim: asked as options (`design/pages/errors/brief.md`): "Header and footer on them", "Somewhere to go", "A
line in our voice", "Proper buttons". On round 1: "nah remove the stamps, search and just listed from there". On round
2 of `design/pages/errors/mockup.html`: "approved, move to next".
What it means for the build: the not-found page (`app/not-found.tsx`) and the error page (`app/(store)/error.tsx`) carry
**the normal header and footer**, a heading, **one line in the IWC voice** ("We looked everywhere, even under the bed.
This page isn't here." / "That's on us, not you. Try again, and if it keeps happening, give it a few minutes."; drafts
approved with the mockup) and **real buttons** ("Back to Home"; "Try again" and "Back to Home"). Nothing else under the
message.

**D-094 · 2026-10-08 · founder: The customer emails, from the design pass**
Founder, verbatim: asked as options (`design/pages/emails/brief.md`): "The IWC look", "Photos of the pieces", "A useful
footer". On round 1 of `design/pages/emails/mockup.html`: "We will give them a tracking link which will take them back
to website tracking page, rest is good".
What it means for the build (`apps/web/lib/email/`): every customer email keeps its wording (D-059 drafts) in a new
frame: the cream page, the logo with the gold India outline at the top (sent as an image), the message in a card with
a heading, Syne / Karla where the email app allows web fonts, the button in the brand colour; **small photos of the
pieces** in the order confirmation and the item-unavailable email; a **footer** with Track your order · Shipping &
returns · Contact, "You're getting this because you ordered from The Indian Wholesale Club. These emails are about your
order only." and the support email (Q-9). **The shipped email's tracking link opens our order page on the website**
(`/orders/[number]`, D-088, where "Track the parcel" goes on to the carrier), not the carrier's site. Nothing
operational appears (D-003).

**D-095 · 2026-10-08 · founder: The app's customer screens, from the design pass**
Founder, verbatim: "now the app screens can be done in one go, all the pages, i believe you". On round 1 of
`design/pages/app/mockup.html`: "approved".
What it means for the build (`apps/app/app/`): every customer screen follows the approved website decisions (D-079 –
D-094) in the app's own patterns: the cream tab bar (Home · Explore · Bag · Saved · Profile) with a brand bar over the
active tab and the bag count; large Syne titles on tab roots and back bars on pushed screens; Home's photo with the name
on the wall, then Just listed and Pick your home; Explore's States as stamps, Clothing and Spices as rows, search with the
count; Region, Product (viewer, buy bar, reviews row), Browse (round Filter button, filter panel); the Bag tab (photos,
− 1 +; the app has no bag panel, the bag is its tab); Checkout as phone → delivery → payment with Stripe's PaymentSheet;
the thank-you and order screens; Saved with hearts that remove; Profile signed in (Orders · Addresses · Your details,
Track an order, About us & help, Sign out) and signed out (the sign-in card with show password, forgot password and
the email code); About us & help as the glass sheet; the error state. **Write a review opens the D-090 form as a sheet
in the app** instead of sending the customer to the website.

**D-096 · 2026-10-08 · founder: The web admin, from the design pass**
Founder, verbatim: "now let's design the admin higly effieciently so keep your eyes out for everything considerable. The
admin panel should be lightweight yet highly designed productively." Chosen (all offered, `design/pages/admin/brief.md`):
"Grouped nav with counts", "Quick find (Ctrl+K)", "Your own time zone", "Plain status chips", "Today as a work queue",
"Orders: search + bulk", "Order page: actions that apply", "Confirm money actions", "Cycle progress bar", "Pickup
checklist by shop", "One-step new listing", "Shop price → live $ price", and "Also make the uploading easy, so that I can
upload multiple photos on gallery grids at once, also the products listings uploadings." On round 1 of
`design/pages/admin/mockup.html`: "approved and move on".
What it means for the build (`apps/web/app/admin/`, `apps/web/features/admin/`; still server-rendered and light, D-011;
never linked from the store, D-006):
- **Frame:** a sidebar grouped by job (Daily: Today, Orders, Cycle, Listings, Payouts · Catalog: Products, Regions,
  Reviews, Promotions · People: Customers, Vendors, Returns · Insights, Settings) with live counts of what waits; a top
  bar with **quick find** (Ctrl+K: orders by number / name / email, products, customers, vendors), the desk's clock in
  both zones and the live dot. Phones: a top bar with the menu, find and the title.
- **Times** in the admin's desk zone (US: New Jersey, India: India) with the other zone beside them, never UTC.
- **Status chips** in plain words and colours for orders, payments and pickups.
- **Today:** the open cycle's countdown to cutoff with its progress and totals; Needs attention; the admin's desk as a
  work queue (count, the job, one button to it), the other desk below; live orders.
- **Orders:** search, status chips with counts, ticked rows get a bulk bar (Mark shipped asks one tracking number per
  order; Mark delivered); pages of 50.
- **Order page:** the order on the left (pieces with photos and pickup state, customer with tap-to-call, the timeline in
  plain words with customer-visible lines marked); on the right only the actions possible now, the main one first, and
  the money; **every refund and cancel confirms** with the exact amount and the customer's email.
- **Cycle:** Open → Collecting → Packed → Exported → Arrived → Fulfilling → Closed as a bar with dates and the next step as
  the main button; pickups as one card per shop (Call, WhatsApp, Map, progress, big Picked / Unavailable).
- **New listing in one step:** a photo grid that takes many photos at once (drag to reorder, first is main, alt text
  under each, upload progress), the web address from the name, the type's fields, options with pieces and weight, the
  shop price ₹ with the dollar price shown live (D-075), Save draft / Publish; on a phone, the camera or many from the
  gallery. **Add many:** a batch of photos becomes drafts (drag to group), one row each for name, category, vendor,
  shop price (→ $), pieces; "Create n drafts".
- The other sections take the same frame, chips, tables and confirm boxes; codes in titles (orders, cycles) in Karla.

**D-097 · 2026-10-08 · founder: The app's admin mode, and building the whole design pass**
Founder, verbatim, on round 1 of `design/pages/appadmin/mockup.html`: "Let's build all this".
What it means: the app's admin mode is approved as drawn (five tabs Today · Orders · Cycle · Listings · More with counts;
quick find; the desk's clocks; plain chips; the order's main action at the bottom and the Pack & ship sheet; cycle
progress and pickups by shop; New listing with the camera or many from the gallery, Add many, drafts showing what each
needs; Payouts that confirm; Vendors with Add a vendor; refunds and the catalog-wide sections stay on the web panel).
And every approved design of the pass (D-079 – D-097) is now to be built, in the phases of `plan/coding-plan.md`
§Design pass build, each verified with `node scripts/check.mjs` before it is called done.

**D-098 · 2026-10-08 · founder: No blur on the pinned state row; the ZIP lookup from our own list**
Founder, verbatim (asked as options): "Soft fade, no blur (Recommended)"; "Our own list (Recommended)".
What it means for the build: on Clothing / Spices the **pinned state row** ends in a soft fade into the page **without
a blur** (blur on anything sticky re-blurs the page every scroll frame, `engineering.md` §Budgets); the category row,
which scrolls away, keeps D-084's very light blur. Amends D-084 for the pinned row only. Checkout's ZIP → city and state
(D-087) comes from **a US ZIP list kept on our server** (GeoNames' free postal-code data, CC BY 4.0, credited on the
privacy page): no outside service at checkout and no customer data sent anywhere.

**D-099 · 2026-10-09 · Claude, under D-011 (speed is a feature) and D-068, proposed: the second speed audit, after the design pass**
The founder asked for the audit again now that the frontend is built: "now that frontend is also setup, do this
again", "find and optimize everything which should be optimized". What it means for the build (`engineering.md`
PR-3, PR-5, PR-6, §App specifics; migration 31):
- **Admin counts are made in the database.** The Orders chips, Today's order counts, the shops to pay and the cycle
  card counted rows the API had sent, and the API sends at most 1,000: past 1,000 orders they would have shown too few,
  with no error. Now each is one count in SQL; indexes added for the admin's busiest filters.
- **Smaller pages, same look:** the India map on Home and States is written compactly (the very same points, about 40%
  less text); the product page's photo viewer, review form and sign-in card load when first opened instead of with
  the page.
- **Smaller app download:** the app carries only the one icon font it uses instead of all 19.
- **Saved pieces** show the newest saved first again (website and app); the order was lost between two reads.
Left as it is, on purpose: checkout's locking and overselling guard (D-068) re-checked and unchanged; the cache
refresh after a sale (D-068) unchanged. *Option for later, not built:* the app reads the catalogue straight from the
database on every screen, while the website shares one cached copy among all visitors; sending the app's catalogue
reads through the website's cache would take that load off the database at scale. It changes D-043's split (the app
calls the website only for what needs a secret), so it waits for the founder.

**D-100 · 2026-10-10 · founder: Product photos: the close-up is the real photo; the details say the model photo is AI-generated**
Founder, verbatim: "You are right the close up of material will be the original photo dropped by the retailer.
labelling will be done and added in the details section above the size chart which will contain how it should be
washed and the photo is ai generated, where the cloth is actually originated from etc etc"
Context: the product photo pipeline proposed by Claude (D-101): each clothing piece gets a three-view card, Front and
Back worn by an AI-generated model, and a Material close-up.
What it means for the build:
- **The Material close-up is always the original photo** of the piece. It is never generated, never upscaled (upscalers
  invent weave detail) and never edited beyond a crop and a white balance.
- **The product page's Details** (the section above the Size chart, `storefront.md` §The product page) carry the care
  (how to wash it), a line saying the model photos are AI-generated, and where the cloth comes from.
*Interpretation (proposed, confirm when the pipeline is built):* "where the cloth is actually originated from" is the
honest origin line that already exists ("Made in India · from <Region> · Imported", D-004), never the shop (D-003);
the AI line shows only on pieces that have an AI-generated photo, and the photos themselves carry no badge. Who takes
the photos ("dropped by the retailer") is Q-34.

**D-101 · 2026-10-10 · Claude, proposed: The product photo pipeline runs on the founder's GPU, free models only**
The founder asked for the best free / open-source way to turn raw shop photos into a three-view product card without
paid AI and without risk to the website or app, then: "Now try whatever you want to from my gpu". Proposed after a
spike on the founder's laptop (RTX 4060 8 GB, 16 GB RAM; numbers in `plan/current.md`, verification log 2026-10-10):
- **Where it runs:** a batch worker on the founder's machine, never on Vercel or in the app. Drafts wait in the admin;
  nothing goes live until a person picks and approves a photo. Customers only ever get the finished image files.
- **Capture (admin app):** three guided shots per piece (front, back, close-up) on a plain sheet with nothing touching
  the garment, each piece of a set shot on its own; the app checks size, brightness and blur after each shot.
- **Steps:** BiRefNet cutout (MIT) → FLUX.2 [klein] 4B (Apache 2.0) puts the garment on a fixed synthetic house model,
  front from the front photo and back from the back photo, 3 – 4 candidates → the garment's colour matched back to the
  real photo → Real-ESRGAN ×2 (BSD-3). FASHN VTON v1.5 was tried and set aside (lost tone-on-tone embroidery, sheer
  fabric and flares; its human parser is non-commercial).
- **Not used:** models whose licence forbids commercial use (IDM-VTON, CatVTON, OOTDiffusion, RMBG-2.0, FLUX.2 [klein]
  9B, 4x-UltraSharp), hosted free tiers that would send shop photos to a public service (D-003).
- **House models are synthetic**, never a real person's likeness without a signed release.
Not built yet. Open before it is: the house models' look, locking the model's face across photos, and a folded
(not draped) saree, which the spike did not test.

**D-102 · 2026-10-10 · founder (was Q-34): Vendors get their own sign-in; the photo pipeline is approved · Supersedes D-018**
Founder, verbatim: "Let's add another role in this website, now there will be customer, admin and retailer. I have
attached a reference pipeline, don't take it as the final word. This is just an example, make the final one according
to yourself. 1. The shop name is never going out to customers. 2. yes pipeline is good just make sure if we can still
somehow make it productive and efficient, also engaging for the retailer as most of them are not that sharp in
education and technology. 3. keep the admin uploading part as is(but there is no staff for that purpose) and the
retailer role will give access to uploadings. 4. we will keep 6-7 models in our assets 5. remove the extra data that we
downloaded in this process which we'll never need."
And the founder's choices of 2026-10-10 (asked as options): where vendors work "Both" (a phone web link and the app);
sign-in "qr/link is the main choice but also provide a very small option of join as a vendor? on main sign in page for
the us stores trying to partnership with iwc", then "Retailer sign-in page only (Recommended)" for that option and
"Both" for who may ask to join (shops in India now, US stores as a later decision, Q-35); what a vendor sees "Sold:
keep it ready", "Money owed / paid (₹)", "The AI model photos" (not the customer price); language "English + each
region's language". The attached reference (a FastAPI server, a task queue and storage on the laptop) is an example only.
What it means for the build (design in D-103):
- **Three roles:** customer, admin, vendor (the founder's "retailer"; glossary). A vendor's owner signs in and uploads
  their own pieces; the admin's listing flow stays as it is. D-018 is superseded.
- **The vendor's name never reaches customers** (D-003 unchanged): not in the store, its page source, emails or API
  replies.
- **A vendor sees** their own pieces and whether each waits, is live or needs a retake; pieces ordered and to keep
  ready for collection (the piece and count only, never who bought it); money owed and paid in ₹; the AI model photos of
  their pieces. Never customers, other vendors, the customer price or IWC's costs.
- **Where:** a hidden phone web page first, then a vendor mode in the app. **Sign-in:** a one-time QR code or link made
  by an admin. **"Join as a vendor?"** only on the vendor sign-in page, never on a customer surface.
- **Languages:** the vendor screens in English and the vendor's region's language.
- **Photos:** the D-101 pipeline is approved; 6 – 7 house models are kept in our assets.
*Interpretation (proposed, confirm when V1 starts):* every vendor upload stays a draft until an admin approves it,
picks the photo and sets the price; translations drafted by Claude are marked draft until someone fluent checks them
(as D-019); a join request is reviewed by an admin, and the COO meets the shop before it gets a QR code.

**D-103 · 2026-10-10 · Claude, proposed: How vendor accounts and the photo worker are built**
Under D-102, D-101, D-003, D-006 and D-011:
- **No server on the laptop.** Supabase stays the only backend: a vendor's phone uploads straight to private storage
  and saves a draft through database functions; a `photo_jobs` table is the queue. The GPU worker on the founder's
  laptop signs in as its own limited account, takes jobs when the laptop is on, uploads the candidate photos and marks
  the job done. Vendors can upload when the laptop is off; nothing on the internet depends on it.
- **Access is enforced in the database:** `is_vendor()` (role `vendor`, account active, linked to one vendor); every
  vendor read goes through `vendor_*` functions that filter by the caller's vendor and return whitelisted columns; base
  tables stay admin-only. SQL tests prove a vendor cannot read another vendor, a customer, an order's buyer, the
  customer price or costs (INV-10).
- **Hidden like the admin:** `/vendor` on the website (`noindex`, never linked from the store), its code loaded only
  there; vendor mode in the app only after the server confirms `is_vendor()`.
- **Made for shop owners:** one job per screen, big buttons, pictures before words; the three photos one at a time with
  an outline to follow and an instant "too dark" / "blurry" check; then category, fabric, sizes and pieces, and the shop
  price in ₹; statuses as pictures (waiting · being made · live · sold · keep ready); the AI photo shown when ready.
- **Storage kept small:** photos shrink on the phone before upload; candidates not picked are deleted once an admin
  picks one; the raw front and back are deleted after approval; the close-up is kept (it is published, D-100).
Phases V1 – V6 in `plan/coding-plan.md` §Vendor accounts.

**D-104 · 2026-10-10 · founder: The house models are the founder's own; two poses, two photos**
Founder, verbatim: "I do not want any of these models, I will be providing my own AI generated licensed models free to
use. I have provided one as w_1 as initial and w_1_green_kurti_set as the output. I want these two poses only as
different images. I have provided one example for you to see, I will be giving 6 female and 4 male models soon."
What it means for the build: the ten candidates Claude generated are dropped (and `make_house_models.py`); the house
models are the founder's images (`design/mockups/assets/w_1.jpg` is the first), each holding two poses side by side:
facing front, and from behind with the head turned. The worker splits each into its front and back pose
(`tools/photo-worker/prepare_house_model.py`) and every piece gets two separate photos, one per pose: the front photo
from the vendor's front photo, the back from the back. 6 women and 4 men (amends D-102's "6 – 7").
*Interpretation (proposed, confirm on the next results):* the look follows the example output
(`w_1_green_kurti_set.jpg`): a warm cream plaster wall, matching ethnic footwear, small earrings for women; no bindi or
other jewellery is added. The founder confirms the images are licensed for commercial use (the example carries an
image generator's corner mark, which our photos do not copy).

**D-105 · 2026-10-10 · founder + Claude, proposed: The vendor integration as built; women_black chosen**
Founder, verbatim: "I updated all the models I want. You will find them in mockups/assets/women_black. Now, You have
to try the kurti and saree set on each model so 24 photos(6 kurti front, 6 kurti back, 6 saree front and 6 saree back)
in total. Then we will compare them with the women_white the previous model photos we had, Women_black should work
better because it has more skin but let's see. After all this you should finish up this integration, code whatever is
left, and make sure in the last that everything is ergonomic, productive and efficient without loosing any quality or
experience."
What it means for the build (the founder's expectation held, `plan/current.md` log 2026-10-10):
- **House models: `women_black`** (6 women, separate front and back files). `women_white` let its white bodysuit into 4
  of 6 saree back views; `women_black` into none. The 4 men are still to come (D-104).
- **Built without a mockup round** at the founder's word ("code whatever is left"): the vendor web and app, the admin's
  Vendor pieces and House models, the product page's Details (`vendor.md`, `admin.md`, `storefront.md`).
*Claude's choices in it (proposed, the founder confirms or changes):*
- A kurti or top photographed alone is shown over plain matching trousers (it came out as a short dress).
- The colour fix also corrects dark garments and up to two colours of a piece (a saree and its blouse).
- The product page's words "Made in: India, from <Region>" and "The photos on a model are AI-generated from real photos
  of this piece; the close-up is a real photo." are drafts (D-012).
- The vendor screens' 11 Indian languages are Claude drafts until someone fluent checks each (D-102); the switch offers
  English, Hindi and the shop's region language, not all twelve.
- The app's vendor sign-in has no visible link anywhere a customer looks (D-003): it opens from IWC's app link
  (`iwc://vendor-login?code=…`) or the website's QR link works in the phone's browser.

**D-106 · 2026-10-11 · founder: A third product type, Home & gifts (amends D-002)**
Founder, verbatim: "Now clear the whole inventory from production website and introduce spice, and then insert this
inventory accordingly." (with the catalogue file `india_regional_products_master_with_photos.csv`), and the founder's
choice of 2026-10-11 when asked what to do with its Pooja, serveware and decor rows: "Add a 'Home & gifts' type".
What it means for the build: besides clothing and spices, each state sells **Home & gifts**: Pooja & spiritual items,
thaali & serveware, handicrafts & decor (product type `home`, three categories, tax class general). It gets its own
See all page and a place in the menus, the region page and search, like Spices. Everything else in D-002 stands.
*Claude's choices in it (proposed, the founder confirms or changes):* the route `/home-and-gifts` and the menu label
"Home & gifts"; Pooja items are described plainly, as objects, never as blessings or promises.

**D-107 · 2026-10-11 · founder: Spices are introduced on the store**
Founder, verbatim: "introduce spice" (in the message of D-106).
What it means for the build: "Spices are cleared" (`pricing_settings.spices_cleared`, D-074) is switched on, so pantry
listings can be live. D-074's FDA and label details stay placeholders in Settings until the founder enters them.

**D-108 · 2026-10-11 · founder: The production inventory is replaced by the master catalogue, as placeholders**
Founder, verbatim: as D-106, and the founder's choices of 2026-10-11: "No photos for now", "Placeholder rupee prices",
clear "Everything".
What it means for the build: everything listed on production goes (the demo catalogue with its photos, demo reviews and
demo orders, and the founder's own "Demo saree" draft); settings, states and cycles stay. The master catalogue (2,880
rows, 36 states, built by another AI tool) goes in as placeholder listings (`is_placeholder`, D-012), shown while demo
mode is on (D-078), cleared with `pnpm demo:clear`:
- names and one-line details from the file, as drafts; its "Ecommerce_Popularity_Trend" claims ("Amazon bestseller"…)
  are never shown, and its photos are not used (61 generic pictures reused across 2,880 items);
- the shop price in rupees is the low end of the file's range where it has one, a category band otherwise, and the
  dollar price follows from the pricing engine (D-075);
- sizes and colours are the catalogue's placeholder sets by category; stock and shops are placeholders;
- "Top 10 Most Ordered" is not a category: those rows mark each state's picks (the newest and Curated for you).

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

**D-149 · 2026-10-23 · founder: the sourcing runner rests a shop that blocks it** · its rests SUPERSEDED by D-158 (knowing a robot check stays)
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
