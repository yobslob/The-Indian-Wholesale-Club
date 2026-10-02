# Coding plan (after the restructure)

Status: **drafted by Claude 2026-09-29, founder answers folded in the same day (D-045 – D-049). Phase order: as below
unless the founder changes it.** The restructure (R0–R8, `roadmap.md`) left a fast, tested skeleton: every customer page
and app screen works on real data with plain styling, checkout and order tracking work on web and app, both admins can
run the core jobs, and `node scripts/check.mjs` + CI prove it on every change. This plan turns the skeleton into the
product in `product.md`. It invents no business rules: every open point is a question (`questions.md`) or a founder
decision, and a phase waits for its answers.

**How each phase runs:** Claude (Claude Code, on the founder's machine) builds it in small commits with tests and runs
`node scripts/check.mjs` itself; CI runs it again on push; the founder tries it by hand; the phase is done when its
"Done when" is true and logged in `current.md`. Sizes: S ≈ a session, M ≈ 2–3, L ≈ 4+.

## Already settled (2026-09-29)
- Hosted dev DB reset to the new schema (founder). Nothing uses the old schema any more.
- Cycles close and the next one opens by themselves; admins mirror physical reality, incl. moving pieces into an earlier
  export and telling the customer (D-045, C4).
- Vercel until launch; domain and support email bought at launch (D-046, C8). Emails use Resend's test sender until then.
- Pricing settings: researched **estimates**, labelled, until the founder's own numbers (D-047, C6).
- Express: 15–18 days (D-048). Still open: from the order or from arrival (Q-18).
- Storefront design direction: editorial, image-led, Lenis smooth scrolling (D-049, `design.md` §Direction).
- Direction A chosen (2026-09-30, D-050): A's hero, a symmetric grid below it, Georgia / Poppins / Montserrat / Inter, no dark mode.

## Phases
| # | Phase | Size | What it delivers | Waits on | Done when |
|---|---|---|---|---|---|
| **C1** | Design | L | Following D-049 (`design.md` §Direction): 2–3 mockup directions of Home (India map + regions), Region, Product and the admin Listing screen → founder picks → final tokens (colours, type scale, spacing), script fonts per region, accent contrast check. Then the storefront built on it: editorial image layout, Lenis smooth scroll, reveal/parallax (reduced-motion safe); the app gets the same look with native motion (Reanimated). Placeholder photography is clearly marked until real photos exist (C3) | founder's pick of a mockup | the four screens match the chosen mockup on web and app; speed budgets hold (`check.mjs http`, first-load JS ≤ 150 KB); reduced-motion and keyboard checks in E2E |
| **C2** | Regions come alive | M | Admin Regions: image upload and greeting-script field; the 36 regions' greetings, stories, taglines and accents filled and approved by the founder (D-019); "Coming soon" regions handled | C1; the founder's text for each region | every live region shows approved content; drafts never show (INV-8 test) |
| **C3** | Listing from the field | L | App admin: add a product with the camera (photos to Storage, `product_media`), variants and quantities, drafts → review → publish; stale-quantity reminders on Today; offline drafts later (F-3) | C1 for the look | the COO lists a product on a phone, end to end, and it appears in the store; an E2E flow covers it |
| **C4** | Cycles end to end | L | D-045, D-063: automatic close at cutoff + next cycle opens (dates moved forward by the "days between cutoffs" setting, admin can correct), late payments join the cycle just closed (D-065); moving orders between cycles with the window change, and the discounted faster-delivery offer or the "it came sooner" note once the admin confirms the piece shipped (D-064); export fields (AWB, forwarder, freight, duty, FX) and arrival check-off; packing list + commercial invoice export; US pack & ship with tracking links (D-066) | confirmed 2026-10-03 (D-063 – D-066) | a whole cycle runs from open to closed by itself and by admin action; SQL tests for every new rule (no late orders into a closed cycle, INV-6 on moves) |
| **C5** | Customer messages | M | Emails for shipped, delivered, item unavailable + refund, cancellation, delay and the D-045 faster-delivery note (B-20); the delay notice with a cancel option (D-008, `flows.md` §7); self-service cancel before cutoff (D-042 note). Sent with Resend's test sender until launch (D-046) | C4 for the delay and move flows | each email is queued and sent in a test; nothing operational in any email (D-003) |
| **C6** | Pricing help | S | Researched estimates for FX, freight, duty (incl. current US tariffs on Indian goods), margin, delivery and stale days, each with source + date, entered as *estimates* (D-047); the suggested price on the listing form (`suggestPrice`, already unit-tested) | — (estimates allowed) | the suggestion shows only with every setting set; the admin sees which values are estimates |
| **C7** | Insights + live admin | M | Sales by category/vendor, demand signals (searches, saved items), Realtime order and stock feed for admins (PR-7), `desk` picks the default Today | — | numbers match SQL checks; no fabricated analytics |
| **C8** | Launch readiness | L | Domain + support email (Q-9, D-046) and Vercel production; policy pages (Q-5, privacy, terms); spices compliance (Q-10) before any spice goes live; sales tax check (Q-19); the founder's own pricing numbers replace every estimate (D-047); Expo SDK upgrade (B-9) and store listings with real bundle ids; shared rate limiter (B-3); alerting (B-8); app bag kept across restarts (B-16); app admin changes refresh the web cache (B-17) | Q-5, Q-9, Q-10, Q-19 | the deploy workflow runs against production after a green CI (D-044); a real order end to end on production |

**Why this order:** the look (C1) shapes every screen after it; the region pages are the core experience (C2); listing
(C3) and cycles (C4) are what the two operators need to run the business; messages (C5) follow the flows they describe;
launch work (C8) is last, but its questions (Q-5, Q-10, Q-19) should be answered early. C6 and C7 can slot in wherever
there is a gap.

## Not in this plan (founder approval needed first, `product.md` §Later ideas)
"Ask for it from home" requests, notify-me, gift boxes (F-6; reviews are wanted, D-051, rules D-056, built with the product page in C1); returns/exchanges flow (F-4, Q-5); a faster US-stock
option (F-5); Stripe Tax instead of the 8 % estimate (F-2).
