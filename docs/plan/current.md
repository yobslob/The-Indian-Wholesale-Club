# Current status

## Resume here
**Coding plan C1 (design): the mockup is approved (2026-09-30, D-055); C1 step 2 has started** (tokens + fonts in
`packages/tokens`, then the storefront built on `design/mockups/a-gallery.html` v7). Parts of the mockup that need
answers or new data wait: Most wanted / Curated for you / Leaving soon (Q-22), reviews (Q-23), region album photos (C2).
Open questions: Q-18, Q-22, Q-23, and before launch Q-3, Q-5, Q-9, Q-10, Q-19.

## Steps
| Step | Status | Evidence |
|---|---|---|
| R0 Safety net | ✅ done | commit `d5342ae`, tag `pre-restructure`. Baseline timings recorded 2026-09-28 (log) |
| R1 Docs system | ✅ done, approved (D-023) | |
| R2 Remove dead paths | ✅ done | commit `c22656b`. One leftover (unused `Ionicons` import in the app) was caught by the founder's run and fixed in the R4 fix commit |
| R3 DB baseline | ✅ done | commit `96b964c`. Applied and tested on real local Supabase (log) |
| R4 Packages | ✅ done | commit `7d7c525` + fix commit (generated `database.types.ts`, lockfile, `check.mjs --continue`) |
| R5 Web reshape + speed | ✅ done (founder run 2026-09-28; typecheck fix in the R5 close commit) · hosted dev DB reset still pending | sub-steps below |
| R6 App reshape | ✅ done (founder `check.mjs` green + emulator smoke test, 2026-09-29) · app admin mode not yet tried on a device | sub-steps below |
| R7 Tests, tooling, CI | ✅ done (founder `check.mjs` all green incl. E2E 6/6, first CI run green, 2026-09-29) | sub-steps below |
| R8 Hand-off | ✅ done (docs audited, coding plan reviewed and answered by the founder, 2026-09-29) | sub-steps below |

## Verification log (facts only. Add a row per run)
| Date | Commit | Who / where | What | Result |
|---|---|---|---|---|
| 2026-09-28 | `11127d8` (old app code) | founder, Windows 11, 16 CPU, 16 GB, Node 24.19, pnpm 9.12 | **baseline** `check.mjs typecheck lint test build http` (`.checks/baseline.json`) | typecheck OK 9.1 s · **lint FAIL** 21.9 s (1 import/order warning in `apps/app/app/(tabs)/profile.tsx`; turbo stopped, so web lint was not reported) · test OK 1.8 s · build OK 45.8 s · pages (prod build, median of 3): `/` 428 ms, `/shop` 420 ms, `/search` 398 ms, `/api/search` 414 ms, `/api/health` 239 ms |
| 2026-09-28 | `96b964c` | founder, local Supabase (Postgres 15.8.1.085) | `npx supabase start` | baseline migration + all 3 seeds applied, no errors |
| 2026-09-28 | R3 | Claude, PostgreSQL 16.13 + stub | 7 SQL test files, 99 assertions. Mutation check: 15 rule breaks | all pass. All 15 breaks caught |
| 2026-09-28 | R4 | Claude, PostgreSQL 16.13 + stub | **8 SQL test files, 129 assertions** (with and without `demo.sql`). Mutation check on the new store functions: 9 breaks (base-table read, region-slug bypass, ownership bypass ×2, missing admin check, shop name in home, guest lookup: `cycle_id` leak, email ignored, internal events shown) | all pass. All 9 caught |
| 2026-09-28 | R4 | Claude, `tsc` 5.9.3 + supabase-js 2.117.1 + zod 3.25.76 types copied from the founder's `node_modules` | typecheck `packages/shared` (src + tests), `packages/db` (against approximate DB types) | 0 errors. This fixed 2 latent type errors in the old `checkout-calculator.test.ts` |
| 2026-09-28 | R4 | Claude, same | real store payloads (demo data) parsed with the `@repo/db/store` zod schemas | 6/6 payloads valid. An injected `vendor_id`/`shop_price_paise` is stripped |
| 2026-09-28 | R4 | Claude, Node 22 | unit tests: `packages/shared` (compiled with `tsc`), `packages/tokens` | 39/39 + 3/3 pass |
| 2026-09-28 | `7d7c525` (+ uncommitted generated types, lockfile) | founder, same machine, local Supabase running | `node scripts/check.mjs` (all steps) | typecheck **FAIL** 5.0 s and lint **FAIL** 5.4 s, both from one unused import in `apps/app/app/profile/orders/[id].tsx` (turbo stopped there, so web was not reported) · test OK 2.0 s · build OK 42.8 s · pages (old app vs hosted DB): `/` 420 ms, `/shop` 427 ms, `/search` 440 ms, `/api/search` 411 ms, `/api/health` 230 ms · **db OK 38.8 s: 8/8 SQL test files pass on real Supabase (Postgres 15)** |
| 2026-09-28 | R4 fix | Claude, `tsc` 5.9.3 | typecheck `packages/db` against the **official** generated `database.types.ts` | 0 errors |
| 2026-09-28 | R5 | Claude, PostgreSQL 16.13 + stub | **10 SQL test files, 160 assertions** (with and without `demo.sql`), incl. new `checkout.test.sql` (15) and `cycle_advance.test.sql` (16). Mutation check: 12 breaks (`checkout_context`: anon grant, customer grant, base-table variants, max uses ignored, expiry ignored, vendor_id leak, inactive promo; `advance_cycle`: no admin check, close with open orders, events visible, orders not moved, open advances) | all pass. All 12 caught |
| 2026-09-28 | R5 | Claude, real `tsc` 5.9.3 + ESLint 8.57.1 with the web's full dependency closure copied from the founder's `node_modules/.pnpm` (453 packages, pnpm links rebuilt from `pnpm-lock.yaml`) | typecheck `apps/web`, `packages/db`, `packages/shared`; lint `apps/web` (`--max-warnings 0`), incl. a probe that the import-boundary rule rejects admin imports from storefront files | 0 errors, 0 warnings. The probe fails as intended |
| 2026-09-28 | R5 | Claude, Node 22 (tests compiled with `tsc`) | unit tests: `packages/shared` (all 5 files), `apps/web/tests` (3 new files), `packages/tokens` | 48/48, 10/10, 3/3 pass. Mutation check: open-redirect guard and HTML escaping broken on purpose → caught |
| 2026-09-28 | `a0aa811` (+ regenerated types, lockfile) | founder, same machine, web on **local** Supabase (`.env.local`) | `node scripts/check.mjs` (all steps) | typecheck **FAIL** 11.5 s: only stale `.next/types/validator.ts` from the old app's build naming deleted routes (fixed: `next typegen` runs before `tsc`) · lint OK 37.8 s · test OK 2.4 s · build OK 51.7 s · **pages (prod build, median of 3): `/` 10 ms, `/states` 15 ms, `/states/kerala` 16 ms, product page 10 ms, `/clothing` 11 ms, `/search?q=saree` 39 ms, `/api/health` 57 ms** (baseline `/` 428 ms). Not like-for-like: the baseline read the hosted DB and the new run a local DB; the cached pages make no DB call per request, the search page and health make one · db OK 43.6 s (all SQL test files pass on Postgres 15) |
| 2026-09-28 | `a0aa811` | founder, `pnpm --filter web dev` + Stripe test card | click-through: region → product → bag → checkout → pay → thank-you page → order page (email check) | order `IWC-260928-127BA2716C` created and tracked. The confirmation email was not sent: Resend refused the placeholder sender domain (`RESEND_FROM_EMAIL`, Q-9); the email stays in the outbox and is retried |
| 2026-09-28 | R5 close | Claude | `pnpm db:types` output vs Claude's hand patch for migration 3 (both formatted the same way) | identical |
| 2026-09-28 | R5.6 | Claude, PostgreSQL 16.13 + stub | **11 SQL test files, 187 assertions** (with and without `demo.sql`), incl. new `shipping_refunds.test.sql` (26). Mutation check: 10 breaks (no tax share, no last-piece rule, customer cancel refunds tax, no stock release, cancel after cutoff, refund without admin, amounts readable by customers, express without days, express window from standard days, guest lookup drifting from `store_orders`) | all pass. All 10 caught |
| 2026-09-28 | R5.6 | Claude, `tsc` 5.9.3 + ESLint 8.57.1 + Node 22 | typecheck web/db/shared, lint web, unit tests (shared `domain.test.ts` 26, web 10) | 0 errors, 0 warnings, all pass |
| 2026-09-28 | R6 | Claude, `tsc` 5.9.3 + ESLint 8.57.1 (the app's dependency closure copied from the founder's `node_modules/.pnpm`) + Node 22 | typecheck app, web, db, shared; lint app + web (`--max-warnings 0`), incl. a probe that app customer files can't import admin code or `@repo/db/admin`; unit tests (shared 26, web 10) | 0 errors, 0 warnings, all pass. The probe fails as intended (2 errors). **Not run by Claude:** the app itself (no Expo / device) |
| 2026-09-29 | `b0a00cd` (+ founder's `pnpm install`, migration 4 applied) | founder, same machine, local Supabase | `node scripts/check.mjs` (all steps) | **all OK**: typecheck 19.2 s · lint 43.5 s · test 2.3 s · build 52.7 s · http 3.8 s · db 43.5 s · pages (median of 3): `/` 8 ms, `/states` 16 ms, `/states/kerala` 17 ms, product page 15 ms, `/clothing` 15 ms, `/search?q=saree` 58 ms, `/api/health` 30 ms. Founder: "Web is working perfectly fine" |
| 2026-09-29 | `b0a00cd` | founder, `expo start` | start the app | **bundling failed**: the Stripe config plugin crashed without options (founder added `merchantIdentifier` / `enableGooglePay` in `app.json`), then `query-string` not found from expo-router, `@babel/runtime` and `@expo/metro-runtime` not found; with a trial `.npmrc`, `react` resolved to `@types/react` (the tsconfig `paths` entry, followed by Metro) |
| 2026-09-29 | app fix | Claude, the repo's Expo CLI 0.22.28 + Metro 0.81.5 with the app's full dependency closure copied from the founder's `node_modules/.pnpm` | `expo export --platform android` and `ios` | the founder's errors reproduced (Stripe plugin, then undeclared modules one after another). After the fix: **Android 1,365 modules, iOS 1,368 modules bundled**; the source map holds one React (18.3.1) and no React 19; app `tsc` + ESLint clean. **Not covered:** `query-string` was a stand-in (it is not in the store yet), Stripe 0.38.6 and `react-dom` 18.3.1 are not in the store (bundled with 0.78.0), CSS is empty (no Linux `lightningcss`), and nothing ran on a device |
| 2026-09-29 | `fa631f4` (after a clean reinstall) | founder, Android emulator + web | app smoke test, first try | the app **bundled and opened** Home; the web kept working. Home showed "Could not load": `apps/app/.env` pointed Supabase at the example's IP (`192.168.1.10`, not the computer's) and the website API at Metro's port 8081 instead of 3000. Fix: the founder's `.env` (Claude never edits it). The app now logs both addresses and the real load error in the Metro terminal (development only), reports an unreachable server as "No connection", and the example uses `YOUR-LAN-IP` |
| 2026-09-29 | `5bd6a58` | founder, Android emulator + web, `.env` fixed (addresses logged by the app) | app smoke test | Home and regions load; **three items added, checkout with the Stripe test card succeeded, the order tracks**; the requests show in the web server's log. Founder: "everything is good to go". Admin mode in the app was not reported on |
| 2026-09-29 | R7 | Claude, `tsc` 5.9.3 + ESLint 8.57.1 + `tsx` 4.21 + Playwright 1.56 (sandbox copy) + the repo's Expo CLI | typecheck web (incl. `e2e/`, `playwright.config.ts`) and app; lint web + app (`--max-warnings 0`); unit tests shared 26, web 10, **app 6 (new)**; `playwright test --list` loads 6 tests in 3 files; `expo export` Android + iOS with `--no-bytecode` as in `check.mjs bundle` (1,365 / 1,368 modules, 104 s cold); `node --check scripts/check.mjs`; workflow YAML parses; CI env snippet dry-run | all pass. Mutation check on the app tests: prices sent to the server, bag line over the limit → both caught. **Not run by Claude:** the E2E flows (no Next.js server in the sandbox), `next build` with the new config, CI on GitHub |
| 2026-09-29 | `f5ec1aa` (+ `pnpm install`, Chromium) | founder, same machine | `node scripts/check.mjs` (all 8 steps) | typecheck OK 9.6 s (baseline 9.1 s) · lint OK 29.0 s (baseline FAIL 21.9 s, app only) · test OK 1.8 s (baseline 1.8 s) · db OK 61.0 s · **build OK 51.1 s** (baseline 45.8 s on the old, smaller app; R5 run 51.7 s with duplicate lint/typecheck) · http OK: `/` 15 ms, `/states` 16, `/states/kerala` 16, product 15, `/clothing` 17, `/search` 34, `/api/health` 33 (baseline `/` 428 ms) · **e2e FAIL 102.4 s: 5 of 6 pass** (admin list + publish, all hidden-admin checks); checkout timed out: Stripe's Payment Element now shows the methods collapsed (Card, Bank, Cash App, Amazon Pay, Klarna), so the card fields never appeared · bundle OK 65.3 s |
| 2026-09-29 | R7 fix | Claude | checkout test clicks Stripe's "Card" option when the card fields are closed and finds the payment iframe inside the page (not by its title); `pnpm dev:admin` for a local admin account | tsc + ESLint clean, `playwright test --list` 6 tests. Not re-run on a server yet |
| 2026-09-29 | `d8447a0` | founder | `pnpm --filter web e2e` + admin sign-in on web and app | admin mode works on the website and in the app (founder). E2E: the card is now filled and paid, but the page said "We could not confirm this payment": **a real bug the E2E flow found.** `finalize.ts` demanded a live-mode payment in every production build, so `next start` (a production build) with Stripe test keys refused every payment, website and app alike (manual tests ran on `next dev`, where the check was off). Also the Stripe webhook path |
| 2026-09-29 | fix | Claude | the payment's mode must match the server's Stripe key (live key ↔ live payment, test key ↔ test payment), in a pure `features/checkout/payment-check.ts` with 4 unit tests | web unit tests 14/14, tsc + ESLint clean. E2E re-run pending |
| 2026-09-29 | `f607284` (clean tree) | founder, same machine, local Supabase | `node scripts/check.mjs` (all 8 steps, `.checks/latest.json`) | **all OK**: typecheck 10.2 s · lint 21.0 s · test 1.8 s · db 57.0 s · **build 39.4 s** (baseline 45.8 s; 51.7 s at R5 with the duplicate lint/typecheck) · http 2.3 s: `/` 13 ms, `/states` 15, `/states/kerala` 15, product 15, `/clothing` 15, `/search` 41, `/api/health` 30 (baseline `/` 428 ms) · **e2e 24.4 s, 6/6** · bundle 43.4 s. Founder: admin works on website and app |
| 2026-09-29 | `f607284` | GitHub Actions | first CI run (`ci.yml`: `check.mjs` on a local Supabase in the runner) | **passed on the first attempt, 5 min 49 s** (founder) |
| 2026-09-29 | R8 | Claude: new `scripts/docs-audit.mjs` (dependency-free) + an independent read-through by a separate agent that had not written the docs | docs vs code: paths, decision/question ids, 25 web pages, app screens, 55 schema objects, 21 env vars; then behaviour claims | the script found 2 real mismatches (a stale guard path in INV-7, an undocumented visitor function) plus stale step references; mutation check: a fake page, env var, path and decision id → all 4 caught. The read-through found 19 claims that were false or overstated (e.g. "the next cycle opens immediately at cutoff", only the confirmation email exists, the app can't add products, no arrival check-off, Insights is sales-by-region only); each was checked in the code and the docs now say what exists and what is target. Two became backlog items (B-19 cutoff, B-20 emails) and one a question (Q-20) |
| 2026-09-29 | `871f6c9` | founder | `node scripts/check.mjs` (with the new `docs` step), `git push`, **hosted dev DB reset** to the new schema | all OK (founder: "everything is OK and running"); hosted dev DB now on the new schema |
| 2026-09-29 | C1 mockups | Claude, the repo's Playwright 1.63 (Chromium) against a local static server and `file://` | full-page screenshots of the 3 directions × 4 screens at 1440 px and 390 px (reduced motion); motion on: wheel-scroll each Home, check console errors, Lenis active, reveals, parallax, C's sideways track, screen switching; WCAG contrast of every proposed colour | no console errors; no horizontal overflow at either width (after fixes: admin tables scroll on phones); Lenis + reveals + parallax run, C's track moves with scroll; every text colour and sample accent ≥ 5.05 : 1 (AA needs 4.5). `check.mjs docs lint` OK (0.6 s, 76.2 s). **Not checked:** real browsers other than Chromium, a real phone, screen readers |
| 2026-09-30 | C1 mockup v2 | Claude, the repo's Playwright 1.63 (Chromium) against a local static server | full-page screenshots of Home at 390 / 1440 / 1920 px, Region and Product at 1440; Home interactions (map hover tooltip, list → map highlight, search filter + empty state, click an open state); computed fonts per element; generated map checked visually (J&K incl. Gilgit-Baltistan, Ladakh incl. Aksai Chin, 36 regions matched to the storefront slugs); contrast of every text colour pair; `check.mjs docs` | no horizontal overflow, no console errors, every interaction works, fonts: headings Georgia, text Poppins, UI Montserrat, footer Inter; map 36/36 regions, 27 KB gzipped; lowest text contrast 5.05 : 1; docs OK. **Not checked:** browsers other than Chromium, a real phone, Android's Georgia fallback, screen readers |
| 2026-09-30 | C1 mockup v3 | Claude, the repo's Playwright 1.63 (Chromium) against the local `mockups` server | full-page screenshots of Home, Region and Product at 1440 px; hero with the longest and shortest headline; name hover highlight at 400 ms vs 850 ms, a quick pass-over, map hover; headline stepper; album moving and not pointer-reactive; product gallery height vs a 900 px screen; thumbnail swap, heart, + / − sections; computed fonts | no horizontal overflow, no console errors; name highlight off at 400 ms, on at 850 ms, never on a quick pass; map hover immediate; album moves and ignores the pointer; gallery 790 px on a 900 px screen; all controls work; hero and section headings resolve to the Helvetica Neue stack (Arial on this Windows machine), logo Georgia, footer Inter; `check.mjs docs` OK. **Not checked:** real Helvetica Neue (no Apple device), a real phone, screen readers |
| 2026-09-30 | C1 mockup v4 | Claude, the repo's Playwright 1.63 (Chromium) against the local `mockups` server | hero at 1440 × 900 and 390 × 844, at the top and after two wheel scrolls (word and logo opacity read from the page); album mosaic screenshot + movement; full-page Home (390) and Region (1440); computed hero font stack | no console errors, no horizontal overflow; at 250 px scrolled the words read 0 / 0.06 / 0.30 / 0.55 and the logo 0.55, at 600 px all words 0 and the logo 1 (the fade runs word by word); on phones the brand name sits under the photo; the album moves; the hero font stack resolves to TeX Gyre Heros on this Windows machine. **Not checked:** real Helvetica Neue, Gelasio on Android, a real phone, screen readers |
| 2026-09-30 | C1 mockup v5 | Claude, Playwright 1.63 (Chromium), local `mockups` server | hero at 1440 × 900, 1920 × 1080 and 390 × 844, top and after two scrolls | no console errors; the name and heading sit on the photo's white wall at 1440 and 1920 (dark via the difference blend); on phones light text over a soft bottom fade; the word-by-word fade into the logo unchanged (0 / 0.06 / 0.30 / 0.55 at 250 px, all 0 and logo 1 at 600 px); the 736 px photo is visibly soft at 1920 (Q-26) |
| 2026-09-30 | C1 mockup v6 | Claude, Playwright 1.63 (Chromium), local `mockups` server | hero at 1440 × 900, 1920 × 1080 and 390 × 844, top and scrolled; nav state after the photo | no console errors; the photo starts at the top edge (hero top 0 px, height = screen) with the nav on it; nav readable over the door and the disc; name and heading on the wall; after the photo the nav is solid rgb(244, 239, 230); word fade unchanged. The 1117 px photo is slightly soft at 1920 (Q-26) |
| 2026-09-30 | C1 mockup v7 | Claude, Playwright 1.63 (Chromium), local `mockups` server | hero at 1440 × 900 and 390 × 844, top and scrolled | no console errors; crop from 30 % shows both hands; label under the brand name in the hero font; word fade unchanged |

## C1 sub-steps (design)
| # | Sub-step | Status |
|---|---|---|
| 1.1 | Three mockup directions (Home, Region, Product, admin Listing) with proposed palettes, contrast checks and motion (`design/mockups/`) | ✅ founder picked A with changes (D-050) |
| 1.1b | A v2 to the founder's feedback: symmetric grid below the hero, full width, new Just listed + Pick your home (DataMeet map, stamps, search), fonts, B/C deleted | ✅ map section approved (D-051) |
| 1.1c | A v3 (D-051): headline options, Helvetica Neue, 700 ms name hover, region sections, new product page with reviews | ✅ reviewed (D-052) |
| 1.1d | A v4 (D-052): photo hero with the stacked brand name → header logo on scroll, chosen headline, album mosaic, font fallbacks; v3 hero archived | ✅ reviewed (D-053) |
| 1.1e | A v5 (D-053): the photo fills the hero; only the name and heading on it | ✅ reviewed (D-054) |
| 1.1f | A v6 (D-054): the wider photo edge to edge, behind the nav bar; nav white on a top fade, solid after the photo | ✅ reviewed (D-055) |
| 1.1g | A v7 (D-055): lower crop, label instead of the heading; **mockup approved** | ✅ committed |
| 1.2 | Founder's pick filed (`/record-answer`), final tokens in `packages/tokens`, script fonts per region, accent contrast check in the admin form | ⏳ after the pick |
| 1.3 | Storefront (web) on the chosen direction: layout, Lenis + reveal/parallax module, `next/image`; then the app with Reanimated | ⏳ |
| 1.4 | E2E: reduced motion + keyboard; `check.mjs` speed budgets | ⏳ |

## R7 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 7.1 | Playwright E2E (`apps/web/e2e`): checkout with the Stripe test card, admin list + publish, hidden admin + no operations fields; local-only guards | ✅ committed · never run yet |
| 7.2 | `check.mjs`: new `e2e` and `bundle` steps; fixed step order (`db` before `build`) | ✅ committed |
| 7.3 | Admin tab title no longer says "Admin" (a refused customer's 404 looked different from any other 404, D-006); found while writing flow 3 | ✅ committed |
| 7.4 | `next build` without lint/typecheck (P7); app unit tests (bag, checkout request) | ✅ committed |
| 7.5 | CI = `check.mjs` on a local Supabase in the runner (B-15); deploy manual-only, no store auto-submit (D-044) | ✅ committed · first CI run after the push |
| 7.6 | Founder: `check.mjs` with timings vs the baseline (the R7 "done when") | ✅ 2026-09-29, all 8 steps green, timings vs baseline logged; CI green |

## R8 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 8.1 | Log R7 (founder run all green, first CI run green) | ✅ |
| 8.2 | Docs audit script (`check.mjs docs`) + independent read-through; every mismatch fixed in the docs, gaps logged (B-19, B-20, Q-20) | ✅ committed |
| 8.3 | Coding plan draft (`plan/coding-plan.md`) | ✅ committed · founder review pending |
| 8.4 | Founder sign-off on the restructure | ✅ 2026-09-29: checks green, pushed, hosted dev DB reset, plan reviewed with answers (D-045 – D-049) |
| 8.5 | Repo ready for Claude Code: CLAUDE.md for local work, `.claude/settings.json` permissions, `/check` and `/record-answer` skills | ✅ committed |

## Invariant tests (`data-model.md`)
INV-1 … INV-9: implemented and passing on Claude's Postgres 16 runs and on real local Supabase, Postgres 15 (see log).

## R5 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 5.0 | Close R4: remove the unused import, `check.mjs` runs turbo with `--continue` (every package reports), commit generated types + lockfile | ✅ `97fadaf` |
| 5.1 | Web on `@repo/db`: server Supabase clients, `features/` layout, storefront routes (`storefront.md`) | ✅ committed |
| 5.2 | Hidden admin (`admin.md` access model), its own route group | ✅ committed (gaps listed in `admin.md`) |
| 5.3 | Checkout on `create_order` (D-038), order pages, guest lookup, account pages | ✅ committed |
| 5.4 | Performance rules (`engineering.md` says where each lives), import-boundary lint, old web code deleted, web rebrand | ✅ committed |
| 5.5 | `check.mjs` routes → new routes (✅). Founder run on local Supabase (✅, log). Hosted dev DB reset | ⏳ founder, when ready |
| 5.6 | Founder answers (D-041 shipping options, D-042 refunds): migration 4, checkout shipping picker, admin refund + cancel, Settings | ✅ committed · Claude-verified (log) · founder run pending |

## R6 sub-steps
| # | Sub-step | Status |
|---|---|---|
| 6.1 | App config: rebrand (name, slug, scheme `iwc`; bundle ids wait for the domain, Q-9), `@repo/db` + `@repo/tokens`, Metro resolver for package exports, NativeWind on the tokens, import-boundary lint | ✅ committed |
| 6.2 | Customer tabs, region and product screens on `store_*` (old screens, query layer and stores deleted) | ✅ committed |
| 6.3 | Sign-in, checkout on the website's API with the payment sheet (D-038), order + guest lookup (new `POST /api/orders/lookup`), addresses. The checkout HTTP types moved to `packages/shared` | ✅ committed |
| 6.4 | Admin mode after `is_admin()`: Today, Orders, Cycles, Payouts, Listings, Vendors, "View the store" (`admin.md`) | ✅ committed |
| 6.5 | Old shared code deleted (hand-written types, schemas, utils, constants and their 4 tests; `domain.test.ts` covers the replacements) | ✅ committed |
| 6.6 | Founder: `check.mjs` | ✅ 2026-09-29, all green (log) |
| 6.7 | App bundling on the founder's machine: `.npmrc` hoisting, Metro resolver (`@/`, one React), tsconfig paths off in Metro, Stripe 0.38.6, `query-string` + `react-dom` declared | ✅ committed · Claude bundled Android + iOS (log) |
| 6.8 | Founder: clean reinstall + smoke test on a phone | ✅ 2026-09-29, Android emulator: browse, bag, checkout, tracking (log) |

**Not verified by anyone yet:** a delivered email (needs a verified sender, Q-9), the admin screens in a browser, and any
app screen on a device.

## Waiting on the founder
1. Q-18: express delivery "15–18 days" (D-048), counted from the order date or from the export's arrival in the US?
2. Q-22 (what decides the region lists) and Q-23 (the rest of the reviews rules) before those sections are built.
3. Before launch: Q-3 (US carrier), Q-5 (returns policy), Q-9 (domain, D-046), Q-10 (spices compliance), Q-19 (sales tax).

## Known leftovers (tracked, not forgotten)
- The app's bundle ids are still `com.root.app` (`apps/app/app.json`): they change with the domain (Q-9). Everything else
  is rebranded (D-009).
- Still open from R5.6: express days (Q-18) and the accountant check on keeping tax (Q-19).
- The old hosted dev DB keeps the old schema and its holes (B-1, B-14) until the reset above.
- `supabase/config.toml` uses the deprecated `[inbucket]` section (CLI warning, harmless) → fix when touching config.
- Founder's `apps/web/.env` has unused `RAZORPAY_*` / `TRACKING_PROXY_*` lines (safe to delete. Claude never edits `.env`).

## Session notes (environment facts, re-check each session)
- **From 2026-09-29 the founder works with Claude Code** in `C:\kod\root` (CLAUDE.md §How work and verification run).
  Claude runs `check.mjs` itself; `.claude/settings.json` holds the command permissions.
- The repo sets `core.fileMode=false`. `.gitattributes` normalises line endings to LF. `.npmrc` hoists packages (Expo SDK 52).
- Cloud-sandbox sessions (before 2026-09-29) had no npm registry and no GitHub access; they copied type definitions and
  the app's dependencies from the founder's `node_modules/.pnpm`, and needed the founder's permission per session to delete
  files in `C:\kod\root`.
