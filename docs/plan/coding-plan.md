# Coding plan (after the restructure): DRAFT for founder review

Status: **proposed by Claude, 2026-09-29. Not approved.** The restructure (R0–R8, `roadmap.md`) left a fast, tested
skeleton: every customer page and app screen works on real data with plain styling, checkout and order tracking work on
web and app, both admins can run the core jobs, and `node scripts/check.mjs` + CI prove it on every change. This plan
turns the skeleton into the product in `product.md`. It invents no business rules: every open point is a question
(`questions.md`) or a founder decision, and a phase waits for its answers.

**How each phase runs:** Claude builds it in small commits with tests; the founder runs `check.mjs` (CI does it too) and
tries it by hand; the phase is done when its "Done when" is true and logged in `current.md`. Sizes: S ≈ a session,
M ≈ 2–3, L ≈ 4+.

## Before C1 (founder, no code)
- **Reset the hosted dev DB** to the new schema (`ops.md` §Database workflow). Announced; nothing else depends on the
  old schema any more.
- Answer what unblocks the most: **Q-20** (what happens at a cycle's cutoff), **Q-9** (domain + support email: every
  customer email waits on a verified sender), **Q-15** (pricing settings and US delivery days), **Q-18** (express days).

## Phases (order proposed; the founder decides)
| # | Phase | Size | What it delivers | Waits on | Done when |
|---|---|---|---|---|---|
| **C1** | Design | M | Mockups of Home (India map + list), Region, Product and the admin Listing screen → founder review → final tokens (colours, type, spacing), script fonts per region, accent contrast check (`design.md`). Then web and app restyled on the tokens | founder review of the mockups | the four screens match the approved mockups on web and app; the speed budgets still hold (`check.mjs http`) |
| **C2** | Regions come alive | M | Admin Regions: image upload and greeting-script field; the 36 regions' greetings, stories, taglines and accents filled and approved by the founder (D-019); "Coming soon" regions handled | C1; the founder's text for each region | every live region shows approved content; drafts never show (INV-8 test) |
| **C3** | Listing from the field | L | App admin: add a product with the camera (photos to Storage, `product_media`), variants and quantities, drafts → review → publish; stale-quantity reminders on Today; offline drafts later (F-3) | C1 for the look; Q-15 for "stale" days | the COO lists a product on a phone, end to end, and it appears in the store; an E2E flow covers it |
| **C4** | Cycles end to end | L | Cutoff behaviour per Q-20 (B-19); export fields (AWB, forwarder, freight, duty, FX) and arrival check-off; packing list + commercial invoice export; US pack & ship with the chosen carrier's tracking links (Q-3) | Q-20, Q-3 | a whole cycle runs in the admin from open to closed with real data; SQL tests for the new rules |
| **C5** | Customer messages | M | Emails for shipped, delivered, item unavailable + refund, cancellation and delay (B-20); the delay notice with a cancel option (D-008, `flows.md` §7); self-service cancel before cutoff (D-042 note) | Q-9 (verified sender); C4 for the delay flow | each email is sent from the outbox in a test and on a real inbox; nothing operational in any email (D-003) |
| **C6** | Pricing help | S | Suggested price on the listing form from the pricing settings (`suggestPrice`, already unit-tested) | Q-15 | the suggestion shows only when every setting is set, never a guess |
| **C7** | Insights + live admin | M | Sales by category/vendor, demand signals (searches, saved items), Realtime order and stock feed for admins (PR-7), `desk` picks the default Today | — | numbers match SQL checks; no fabricated analytics |
| **C8** | Launch readiness | L | Production Supabase + Vercel + domain (Q-9); policy pages (Q-5, privacy, terms); spices compliance (Q-10) before any spice goes live; sales-tax check (Q-19); Expo SDK upgrade (B-9) and store listings with real bundle ids; shared rate limiter (B-3); alerting (B-8); app bag kept across restarts (B-16); app admin changes refresh the web cache (B-17) | Q-5, Q-9, Q-10, Q-19 | the deploy workflow runs against production after a green CI (D-044); a real order end to end on production |

**Why this order:** the look (C1) shapes every screen after it, so it goes first; the region pages are the core experience
(C2); listing (C3) and cycles (C4) are what the two of you need to run the business; messages (C5) need a verified
domain; launch work (C8) is last but its questions (Q-5, Q-9, Q-10, Q-19) should be answered early. C6 and C7 can slot in
wherever there is a gap.

## Not in this plan (founder approval needed first, `product.md` §Later ideas)
"Ask for it from home" requests, notify-me, gift boxes, reviews (F-6); returns/exchanges flow (F-4, Q-5); a faster US-stock
option (F-5); Stripe Tax instead of the 8 % estimate (F-2).
