# Restructuring Plan: from generic apparel store to "home, one state at a time"

> **Status:** draft for your review · 2026-09-27
> **Scope:** reshape the existing code, database, docs and design foundations around the new idea.
> Building the real features (designed pages, the intake flow and so on) comes afterwards, in the coding plan.

---

## 1. The idea (everything below exists to serve this)

Indians living in the US, and Americans who love India, miss home. Today they either wait weeks for
an international courier or ask a relative who is flying over, and then carry the small debt of
that favour. We remove both problems. You pick one of India's 28 states, see that state's own clothing
and spices, and buy from stock that is **already in the US**. The founder supplies the store by
signing up shops in person, state by state. The goods travel together in **one shipment every 20–23 days**.
What we sell is the feeling of home, so we show the origin proudly: the state, the town, the shop and
the craft. We never hide it.

---

## 2. What exists today and what happens to it

| Area | Today | Plan |
|---|---|---|
| Monorepo, TS, lint, CI | Turborepo + pnpm, strict TS, GitHub Actions | **Keep** |
| Auth & roles | Supabase auth, SSR clients, admin guard, roles `customer/staff/admin` | **Keep**. Roles become `customer/admin/sourcing/warehouse` |
| Payments | Stripe PaymentIntents (web Payment Element, app PaymentSheet), signed webhook, idempotency, orphan-payment reconciliation, and a dev "simulator" that returns fake `mock_pi_` intents when Stripe isn't configured | **Keep Stripe** (always test-mode keys in dev), **delete simulator** |
| Email | Resend + durable outbox table | **Keep** |
| Security | rate limiting, CSP headers, guest order lookup with email check, unguessable order numbers | **Keep** |
| Cart / checkout / account | working, but tied to XS–XXL variants | **Keep**, adapt to flexible variants and pre-orders |
| "Stealth origin" layer | rewrites tracking and emails so customers never learn goods come from India (it strips "Jaipur", "Delhi" and so on), plus a simulator page and support scripts that say "we're a US-based brand" | **Remove entirely.** The origin is now the product. Hiding it also conflicts with US rules that require imported textiles to be disclosed as imported |
| Catalog model | Men/Women/Accessories; sizes locked to an `XS–XXL` DB enum; no state, shop, shipment, lot or expiry | **Rebuild** (§4.2) |
| Admin | orders, products (image = pasted URL), stock +/−, promos, analytics, "logistics" simulator | **Re-map** around sourcing → shipment → receiving → fulfilment (§4.7). Keep the orders, promo and stock-adjust pieces |
| Storefront | generic fashion home, shop, category, product page, size guide | **Re-map** around states (§4.6) |
| Mobile app | Expo shell + tabs, auth screens, Stripe PaymentSheet checkout; its own 857-line query file with a hard-coded fallback catalog | **Keep shell, auth and checkout**, share queries with web, remove the fallback catalog |
| DB migrations | 13 incremental files, test data only | **Squash** into one clean baseline for the new model |
| DB types | 996 lines, hand-written | **Generate** from the DB |
| Docs | ~289 KB (≈75k tokens): 11 docs with pasted SQL/config that drift from code, plus BUGS.md (80 KB), findings.txt (32 KB), AUDIT_NOTES.md | **Replace** with a lean doc system (§4.5) |

**Problems found while reading, fixed during the restructure:**
1. **There is no git repository**, so none of this work can be undone yet. Step R0 fixes that before anything else changes.
2. **RLS hole:** migration `20260926000007` lets a signed-in customer UPDATE or DELETE their own orders (including `status` and `payment_status`) and delete tracking events.
3. **Oversell race:** stock is checked and then deducted without a lock, and the deduction is clamped with `GREATEST(0, …)`, so two concurrent checkouts can both buy the last item.

---

## 3. Guiding rules for the restructure

- **Honest provenance everywhere:** every product shows its state, town, shop and craft, and tracking shows the real journey.
- **Two stock truths, shown clearly:** *in the US now* (ships in days) or *on the next shipment* (pre-order with an ETA).
- **The admin is built for the field:** it has to work on a phone, inside a shop, on a bad network.
- **Context-efficient repo:** one vocabulary, small files, feature folders, docs that state intent and invariants, and code that holds the details.
- **Every step ends green:** lint, typecheck and tests pass, followed by one git commit. Any step can be rolled back on its own.

---

## 4. Target shape

### 4.1 Vocabulary (the same word in the DB, code, folders and routes)

| Term | Meaning | Note |
|---|---|---|
| **region** | an Indian state (or a UT if we add them) | Code says `region` and users see "State". `state` already means React state and the US address field |
| **vendor** | a shop you have signed up in India | |
| **product type** | `clothing` or `spice` (more later: crafts, snacks) | decides which attributes and variant options apply |
| **lot** | one batch of one variant bought from one vendor | carries cost, shipment, best-before |
| **shipment** | one India→US consolidation (every ~20–23 days) | carries freight, duty, FX, ETA |
| **landed cost** | ₹ cost × FX + freight share + duty | drives the suggested US price |
| **pre-order** | buying a lot that is still in transit | shows the shipment's ETA |

Money is stored as integers: USD in `*_cents`, INR in `*_paise`.

### 4.2 Data model (one new baseline migration)

| Group | Table | Purpose and key fields |
|---|---|---|
| Places | `regions` | 28 states. slug, name, kind (`state`/`ut`), status (`live`/`coming_soon`), language, greeting in native script + transliteration + meaning, tagline, story, hero image, accent colour |
| People | `profiles` | adds `role`: customer / admin / sourcing / warehouse |
| | `vendors` | shop and owner name, phone/WhatsApp, town, region, terms (bought outright or consignment + %), licence numbers (GSTIN, FSSAI, FDA reg.), status, notes, photos |
| Catalog | `categories` | two roots, **Clothing** and **Spices**, with children (Sarees, Kurtas, Shawls… / Whole spices, Masalas…). New roots can be added without a schema change |
| | `products` | region + vendor + category + product_type; `story` (the "memory" copy), craft/technique, origin town; `attributes` JSON validated per type (fibre and care / ingredients, allergens, shelf life); full-text search |
| | `product_variants` | flexible `options` JSON (`{size, colour}` or `{weight_g}`), SKU, price override, shipping weight, cached `stock_available` |
| | `product_media` | images uploaded to Supabase Storage from a phone (no more pasted URLs) |
| Supply | `shipments` | code (`SHP-2026-10`), status, air/sea, forwarder, AWB/BL, dispatched / ETA / arrived dates, freight, duty, FX rate |
| | `inventory_lots` | variant, vendor, shipment, qty, unit cost ₹, status, lot code, best-before, landed cost $ |
| | `inventory_movements` | append-only ledger: sourced, received, sold, returned, damaged, adjusted. Records who, when and why |
| | `pricing_settings` | FX, freight per kg, duty %, target margin. Used for the suggested price at intake |
| Commerce | `addresses`, `wishlists`, `orders`, `order_items`, `order_events`, `promo_codes`, `reviews` | carried over. Orders gain a fulfilment mode (`ready`/`preorder`) and an expected ship date. Items snapshot region + vendor. `tracking_events` is renamed `order_events` and uses honest wording |
| Ops | `webhook_events`, `pending_orders`, `failed_reconciliations`, `email_outbox`, `admin_error_events`, `newsletter_subscribers` | carried over unchanged |
| Later (room left, not created now) | `home_requests`, `region_waitlist`, `bundles` | "ask for it from home" (the direct replacement for asking a relative), notify-me for coming-soon states, gift boxes per state |
| Dropped | `cart_items` | never used. The cart stays on-device until cross-device carts are needed |

### 4.3 How stock flows

```
 India                                  │ in transit                  │ US warehouse
 sourced ──► packed (on a shipment) ──► │ in_transit ──► arrived ──►  │ received = SELLABLE ──► sold / depleted
 (intake on phone)                      │ (pre-order allowed, per     │ (receiving = tick lots
                                        │  product, with ETA)         │  on a phone)
```

- Every change is a row in `inventory_movements`. A trigger keeps `product_variants.stock_available` in sync. The decrement is conditional (`… WHERE stock_available >= qty`), which makes overselling impossible.
- Supabase Realtime on `stock_available` and `orders` gives live "only 2 left" counts on product pages and a live order feed in the admin.

### 4.4 Repo layout

```
root/
├─ CLAUDE.md                ← the only file read at the start of every session
├─ docs/                    ← §4.5
├─ apps/
│  ├─ web/                  Next.js: storefront + /admin
│  │  ├─ app/               routes only (thin files)
│  │  ├─ features/          regions · catalog · cart · checkout · orders · account ·
│  │  │                     admin/{sourcing, catalog, shipments, inventory, fulfilment, insights}
│  │  ├─ components/ui/     design-system primitives only
│  │  └─ lib/               infra: supabase, stripe, email, auth, logger, rate-limit
│  └─ app/                  Expo customer app (same feature names as web)
├─ packages/
│  ├─ shared/               pure domain logic: zod schemas, pricing, state machines, constants (no I/O)
│  ├─ db/          NEW      generated Supabase types + typed queries, used by both apps
│  ├─ tokens/      NEW      design tokens → Tailwind preset (web) + NativeWind (app)
│  ├─ typescript-config/
│  └─ eslint-config/
├─ supabase/
│  ├─ migrations/           one baseline, then small incremental ones
│  └─ seed/                 regions.sql · categories.sql · demo.sql (dev only)
└─ scripts/                 db reset + seed, type generation
```

Code conventions: files under ~250 lines (split `lib/queries/admin.ts`, which is 1,022 lines today); each feature exports through its `index.ts`; validate with zod at every boundary; no `any`.

### 4.5 Docs system (built for iterative work with Claude)

```
CLAUDE.md                 ≤120 lines: the idea in 5 lines, stack, commands, repo map, conventions,
                          and a table "before touching X, read Y"
docs/
├─ product.md             idea, users, the emotion, competition, principles
├─ glossary.md            §4.1, the single vocabulary
├─ data-model.md          tables, relations, invariants (links to the migration, no pasted SQL)
├─ flows.md               stock, shipment, order and pre-order lifecycles
├─ storefront.md          web + app route map, anatomy of the state page
├─ admin.md               admin sections, roles, field workflows
├─ design.md              brand, voice, tokens summary, per-state theming, UI patterns
├─ ops.md                 env vars, deploy, DB reset, compliance checklist (§8)
├─ decisions.md           append-only log, 3–5 lines per decision (so nothing is silently re-decided)
└─ plan/
   ├─ roadmap.md          iterations and their status
   ├─ current.md          the active checklist + a "resume here" note for the next session
   └─ backlog.md          open items carried over from BUGS.md, and ideas
```

**Rules:** each doc stays under ~150 lines. Docs hold *why* and *rules*, and code holds *what*. Status lives only
in `plan/`. A change that alters a rule updates its doc in the same commit.
**Budget:** about 45 KB of docs in total (today: 289 KB). A normal session reads `CLAUDE.md` + `current.md` + 1–2 docs, about 10 KB.
**Session ritual:** read CLAUDE.md → read plan/current.md → read the doc(s) the table points to → work → update current.md → commit.

### 4.6 Storefront map

| Route (web) | Purpose |
|---|---|
| `/` | "Where's home?": an India map + list to pick a state, a next-shipment countdown, how it works |
| `/states` | all 28, live vs coming soon |
| `/states/[region]` | **the core page:** a greeting in the state's script, its story and colour, Clothing · Spices tabs, the shops behind them, "ask for something from here" |
| `/states/[region]/[product]` | product page with provenance (town, shop, craft) and either "ships from the US in 2–3 days" or "pre-order, arrives with the shipment landing ~Oct 18" |
| `/clothing`, `/spices` | browse across states, with a state filter |
| `/search`, `/cart`, `/checkout`, `/checkout/success`, `/account/*`, `/login`, `/signup` | kept and adapted |
| `/orders/lookup`, `/orders/[number]` | honest tracking (renamed from `order-lookup` / `order-status`) |
| `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | kept; copy rewritten in the coding phase |
| removed | `/shop`, `/category/[slug]`, `/size-guide` (moves onto product pages), and the duplicate wishlist route (there are two today) |

**Mobile app tabs:** Home · States · Bag · Saved · Profile. The screens mirror the web. The app is for customers only.

### 4.7 Admin map

| Section | Job | Who | Device |
|---|---|---|---|
| Today | orders to ship, low stock, shipment status, drafts awaiting review | all | desk |
| Sourcing → Vendors | sign up a shop in about a minute: photo, contact, terms | you | phone, in the shop |
| Sourcing → Intake | photo → state (auto from vendor) → type → variants → qty → cost ₹ → suggested $ → saved as a draft | you | phone, weak network |
| Catalog | review drafts, polish copy, publish; edit each state's page | you | desk |
| Shipments | build the next shipment from packed lots, export the packing list + commercial invoice, track it, **receive** it in the US (tick lots and the stock goes live) | you / warehouse | phone + desk |
| Inventory | stock by variant × location, lots, best-before warnings, adjustments (all through the ledger) | all | desk |
| Orders | fulfilment queue: pick → pack → label → shipped; refunds | warehouse | desk |
| Customers · Promotions | kept | admin | desk |
| Insights | sales by state, shop and category; demand signals (searches, wishlists, requests) that tell you what to buy on the next trip | you | desk |

Principles: one screen per job, phone-first for sourcing and receiving, keyboard-friendly tables on desktop, drafts that autosave, bulk actions, and live updates.

### 4.8 Design foundation (only the foundation is built now)

- Tokens live in `packages/tokens`, so web and app read the same values.
- A warm neutral base and one brand colour. **Each state has its own accent** (`regions.accent_color`) that re-themes its page through a single CSS variable.
- Type: a display serif and a clean sans, plus **Noto Sans for the state's script** (Devanagari, Bengali, Gujarati, Gurmukhi, Tamil, Telugu, Kannada, Malayalam, Odia…), loaded only on that state's page.
- The India map must follow **India's official boundaries**. This audience will notice straight away.
- Voice: warm and specific, never kitsch. "Made in India, already in America."
- Real page design happens in the coding phase. I'll mock up Home, the State page and Intake for your review before building them.

---

## 5. Execution steps

Size: S ≈ one short session · M ≈ one full session · L ≈ one to two sessions. Each step ends with lint + typecheck + tests green and **one commit**.

**R0 · Safety net (S)**
- `git init`, commit the current code as it is (making sure `.env` stays out), tag `pre-restructure`.
- Run lint / typecheck / tests in a separate copy, so your own `node_modules` aren't touched, and record the baseline.

**R1 · Docs system (M)**
- Write `CLAUDE.md` and the new `docs/` from this plan (§4 becomes product, glossary, data-model, flows, storefront, admin, design, ops, decisions, plan/*).
- Move the ~10 still-open audit items into `docs/plan/backlog.md`.
- Delete old docs 01–10, STATUS.md, BUGS.md, findings.txt and AUDIT_NOTES.md (they stay in git history). Cut README down to a short pointer. This plan file moves to `docs/plan/`.
- ⏸ **Checkpoint:** you read `product.md`, `data-model.md`, `storefront.md` and `admin.md`. Every later step depends on them, so changes are cheapest here.

**R2 · Remove the stealth layer and dead paths (S)**
- Delete: the shared stealth sanitizer + its tests; the admin Logistics page and stealth preview card; the carrier webhook + its test (it comes back when we choose a US label provider); the `mock_pi_` payment simulator and the `stripe_simulator` provider value; the mobile fallback catalog; the Razorpay and tracking-proxy env vars; legacy scripts (`apply-migration-05.ts`, etc.). The sanitizer alone is used in about 15 files today.
- Tracking pages show plain, honest events.
- Done when a search for `stealth|sanitiz|simulator` returns nothing and the build is green.

**R3 · Database baseline (L)**
- Replace the 13 migrations with one baseline that implements §4.2 and §4.3. It keeps all the hardening: idempotency, reconciliation, outbox, promo guard, order numbers.
- One `has_role()` helper. RLS is rewritten so customers can read their orders but never modify them, and staff roles are scoped per section.
- Stock goes through the ledger, with a trigger-maintained `stock_available` and a conditional decrement (no overselling).
- Storage buckets: `product-media` (public read, staff write) and `vendor-docs` (private).
- Seed: 28 states (names, languages, greetings; I draft these, you correct), the category tree and pricing settings, plus dev-only demo data for 3 states.
- ⏸ **Reset the hosted Supabase dev database.** It only holds test data, but this wipes it, so I need your OK first. Then generate types from it.

**R4 · Packages (M)**
- New `packages/db`: generated types + typed query functions per domain, used by web and app. The 996-line hand-written types and both duplicate query layers are deleted.
- `packages/shared` is reorganised by domain (regions, catalog attributes per product type, inventory, shipments, orders, pricing/landed cost, checkout). It holds pure logic only; tests are updated.
- New `packages/tokens`, wired into both Tailwind configs.

**R5 · Web reshape (L)**
- Move to the `features/` layout and split the oversized files.
- Create every route in §4.6 and §4.7 as a working skeleton on real data (plain styling). Remove the old generic pages. Add the admin sidebar and per-role guards.
- Cart, checkout and account are adapted to flexible variants and the pre-order flag.

**R6 · Mobile reshape (M)**
- Tabs and screens per §4.6, feature folders, `@repo/db` queries and shared tokens. The existing auth and PaymentSheet checkout carry over, adapted to the new variants.

**R7 · Verify and hand off (S)**
- Lint + typecheck + tests + web build all green. Check every route against `storefront.md` / `admin.md`. Set `plan/current.md` to "restructure done". Final commit.
- Then we write the **coding implementation plan**.

---

## 6. Decisions I need from you (my default in brackets)

1. **Brand name.** The code says "ROOT" and the project is "IWC". *(Default: a single brand constant with a placeholder until you decide.)*
2. **Union territories.** Only the 28 states, or also J&K (saffron, pashmina, kahwa), Ladakh, Delhi, Puducherry? *(Default: the model supports both; launch with 28.)*
3. **Shop terms.** Do you buy stock outright, or do you sell on consignment and pay the shop when an item sells? *(Default: the model supports both, per vendor.)*
4. **Pre-orders** on goods in transit? *(Default: yes, as a per-product toggle. It turns the 20–23-day cycle into a feature.)*
5. **US fulfilment.** Who receives shipments and packs orders: you, family/friends, or a 3PL? *(Default: a `warehouse` role in the admin; the carrier/label provider is chosen later.)*
6. **Where the admin lives on your phone.** Responsive web (installable to the home screen) or inside the Expo app? *(Default: web. One admin codebase, and the phone camera works from the browser.)*
7. **Wiping the hosted Supabase dev DB** at R3. *(Default: yes, since it holds test data only. I'll still ask right before doing it.)*

---

## 7. Not part of the restructure (goes into the coding plan)

Visual design and copy · intake polish and offline drafts · US shipping labels / carrier provider · Stripe Tax (tax is a flat 8% estimate today) ·
home requests, waitlist, bundles · reviews UI · Insights charts · Expo SDK upgrade (the app is on SDK 52).

---

## 8. Business notes that shape the data model

- **Clothing:** garments need "Made in India", fibre-content and care labels, and online listings must say "Imported". Clothes made in small shops often lack compliant labels, so the plan is to add them at packing time. Intake records whether a label is attached.
- **Spices are FDA-regulated food imports.** The maker or packer needs FDA food-facility registration, every shipment needs FDA Prior Notice, the US importer has Foreign Supplier Verification (FSVP) duties, and packs need English labels (ingredients, net weight, allergens, origin). Small shops are often not registered, so decide the packing route with a licensed customs broker **before the first spice shipment**. The data model stores licence numbers, lot codes and best-before dates so every pack can be traced.
- The exporting entity in India needs an IEC (Importer-Exporter Code).
