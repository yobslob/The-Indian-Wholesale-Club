# Launch QA plan: indianwholesaleclub.com and live Stripe

> **Archived 2026-11-04** (founder: "move to archive now but keep track of what was done before in short").
> - **Done:** waves 1 – 3 merged into `main` (A-1 – A-5, A-8, A-9; B-1 – B-3, B-6, B-9 – B-11; C-1 – C-3, C-6, C-7;
>   D-1 – D-3; E-1, E-2a, E-2b, E-2d, E-3; F-0 – F-7; G's tests); e2e on 2026-11-03: 69 passed, 2 failed (both failing
>   before this work too), 2 skipped; the FOUNDER questions answered as D-179; a real payment on the domain
>   (founder, 2026-11-04). The hidden $1 payment-test page goes with D-187 (`docs/simple-store-plan.md` §10 Y-10).
> - **Skipped on purpose:** A-6 (wallets before the address), B-8 (photo widths), C-5 (pre-building 300 product pages:
>   too many page-cache writes).
> - **Not marked done in this file when it was archived** (check before assuming): INC-1's root cause (the database
>   stopped answering again on 2026-11-04, `status.md`); L-4 / L-5 the paid Vercel and Supabase plans (founder decides
>   before Nov 8); L-6 a private repo; L-7 env files in the repo folder (`prod.env`, simple-store plan §9 R-2); L-9
>   Stripe's domain, Radar and 2FA settings; L-10 the search consoles; every box of §12 "Definition of done".
> - **Where the living parts are now:** the domain checks in `docs/ops.md` §Going live on the domain and
>   `scripts/domain-check.mjs`; moving accounts in `docs/ops.md` §Moving.

First written 2026-11-02. **Re-tested 2026-11-03 on the live domain** (`indianwholesaleclub.com`, Cloudflare DNS,
Stripe live, Google Workspace mail). Written by Claude as senior QA engineer and developer, for subagents: every item
has an ID, a severity, evidence, files, a fix and an acceptance test. Order, as the founder asked: **the customer's
experience first (browse → product → bag → checkout), then the domain and payments, then the backend.**

Severity: **P0** blocks selling or loses money/orders · **P1** fix this week · **P2** the first weeks after launch.
**FOUNDER** = needs the founder's decision first (CLAUDE.md "Don't invent", D-012): the agent logs it in
`docs/questions.md` and does not pick an answer.

## How this was tested
- Code read: checkout, payment form, success page, webhook, finalize, middleware, CSP, rate limit, health, search,
  product page, motion, robots, sitemap. Docs: `status.md`, `ops.md`, `questions.md`.
- Live site from the founder's PC **in India** (add ~250 ms each way; US customers via Vercel `iad1` see less), with
  `curl` and the desktop app's browser at 375 × 812: Home → /clothing → a product → pick an option → Add to bag →
  /cart → /checkout step 1. **Stopped before entering details** (that creates a live PaymentIntent). Test bag emptied.
- DNS read with `nslookup` against 1.1.1.1. Nothing in Stripe, Vercel, Supabase or Resend dashboards was opened.
- **Not tested (needs a person or live money):** the payment step itself (Stripe frame, CSP, Apple/Google Pay, 3DS),
  emails arriving, sign-up/sign-in codes, the Android app. They are in §9's manual matrix.

### Measured 2026-11-03 on indianwholesaleclub.com
| Request | Result |
|---|---|
| `/` | 200 in 0.30 s, **753 KB HTML**, 180 `<img>` (175 without size), 2,614 nodes, Lenis running at 375 px · HIT |
| `/food`, `/states/kerala`, `/account` | 200 in 0.14 – 0.58 s (cached) |
| `/contact` | 200, still says **"Contact details are coming soon."** |
| `/search?q=saree` | **500 after 90.7 s** |
| `/search?q=kurti` | **no answer in 40 s** |
| `/api/health` (one `select … limit 1`) | **200 after 90.9 s, then 4 × no answer in 60 s** |
| `the-indian-wholesale-club.vercel.app/<anything>` incl. `/api/*`, POST `/api/webhooks/stripe` | **307 → indianwholesaleclub.com** |
| `www.` | 307 → apex · `http://` → 308 https |
| Response headers | `server: Vercel`, no `cf-ray`: Cloudflare is DNS-only (correct) |

## Progress (2026-11-03)
- **Wave 1 merged into `main`** (branches `qa/D-search`, `qa/F0-safety`, `qa/A-checkout`, `qa/B-product`, `qa/C-home`,
  `qa/G-tests`): A-1 – A-5, A-8, A-9; B-1 – B-3, B-6, B-9 – B-11; C-1 – C-3, C-6, C-7; D-1 – D-3 (D-2's cache rule
  waits for E); F-0 – F-2 (F-1 and F-2 here are the claim fix and the payment sweep); G's 73 tests. **Not deployed.**
- **Waves 2 – 3 merged:** E-1, E-2a, E-2b, E-2d, E-3, D-2's CDN rule, the domain checklist (`docs/ops.md` §Going live
  on the domain) and its check script; F-3 (refunds, disputes, failed payments, founder alerts, the admin's red count),
  F-4 (server error alerts, no new service), F-5 (uptime set-up in `monitoring.md`), F-6, F-7 (next 15.5.28, sharp
  0.35.5; zod, postcss and the Expo toolchain need bigger upgrades).
- **Found by the e2e run and fixed:** a replayed PaymentIntent was reused when already paid (card form "didn't load")
  or at an old amount after a shipping switch (would have charged the old total); the Supabase CLI 3.0 refusing
  `config.toml` (pinned to 2.122.1 in `check.mjs` and the **Deploy workflow**); two `@types/react` copies.
- **Verified 2026-11-03** (Claude Code, the founder's PC, Docker): `check.mjs docs typecheck lint test db build` OK
  (74 SQL files), e2e **69 passed, 2 failed, 2 skipped**. Both failures fail the same way on `2f064d4` (before this
  work): the admin's Publish takes ~30 s to show on the page (the database is updated at once), and
  `customer-choices` "keeps the order" (passes on some runs). One SQL test failed once in five fresh runs (name not
  captured). Not checked: anything on production, the payment step in a real browser on the domain, Apple/Google Pay.
- **Skipped, with reasons in the agents' reports:** A-6 (wallets up front need a quote from a partial address: its
  own piece of work), B-8 (photo widths aren't stored: needs a column, a backfill from R2 and a ranking rule), C-5
  (pre-building 300 product pages would cost 180K – 270K page-cache writes a month against a 100K budget).
- **FOUNDER questions filed and answered (D-179, 2026-11-03):** the "Imported" line, phone cards and Home's Diwali arches built; the rest stay as they are.
- **Deploy order:** migrations `20261108090000_search_speed`, `20261108090100_webhook_claims`,
  `20261108090200_payment_sweep`, `20261108090300_payment_alerts` through the Deploy workflow, then the website. The payment sweep's first run looks
  back 2 days: check any paid-without-order checkouts handled by hand in Stripe first.

## New Vercel account and new Supabase project, before this deploy (founder's choice, 2026-11-03)
**Decided: move first, then deploy these commits straight onto the new accounts.** The old Vercel account is out of
page-cache writes and active CPU, and a deploy rewrites every page on its next visit, so deploying there spends the
limit that is already gone. The old Supabase project is unhealthy (disk IO); the four migrations (search rebuild
included) and a full dump both read the whole database, and they run far better on a fresh project with a full
budget. The code names no account (everything comes from env vars, GitHub secrets and the Vault), so no commit
changes for the move; only the order below does.

**What the move does not fix:** a new free Supabase project has the same small compute. The first one lasted
2026-10-21 → 11-03. To keep it healthy until the paid plan: run no bulk job on production while customers shop
(description redo, photo redo, sourcing runner, weight tools: nights only, one at a time), and watch Reports →
Disk IO each day of the first week. The new Vercel account is Hobby again: its terms keep it non-commercial (L-4).

**Order (a quiet hour; about 2 hours):**
1. **Stop writes:** the sourcing runner, every laptop tool, admin imports (the founder runs none of them until the paid
   plan, 2026-11-03). Disable GitHub → Actions → Daily website deploy until the move is done: it would send `main` to
   the old Vercel project without its migrations. Note the time of the dump.
2. **New Supabase project** (US East): `docs/ops.md` §Moving, Supabase steps 1 – 6 (dump, restore in one transaction,
   timers, Vault, Auth). Then the **Deploy workflow's migrations only** against it (GitHub secrets
   `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` now the new project's): the four
   `20261108…` migrations; `payment_sweep` adds its own timer.
3. **New Vercel project** from the same repo (`docs/ops.md` §Moving, Vercel steps 1 – 4): every env var with the new
   Supabase values, plus this deploy's: `NEXT_PUBLIC_SITE_URL=https://indianwholesaleclub.com`,
   `LEGACY_HOSTS=the-indian-wholesale-club.vercel.app,<new>.vercel.app`, `ADMIN_ALERT_WEBHOOK_URL`. Deploy `main`.
   Check on `<new>.vercel.app`: `node scripts/domain-check.mjs https://<new>.vercel.app`, Home, a product, `/admin`.
4. **Move the domain:** old project → Settings → Domains → remove `indianwholesaleclub.com` and `www`; new project →
   add both (apex, `www` → apex as 308). Cloudflare: the records Vercel shows, DNS only (grey cloud). The Stripe
   webhook already points at the domain, so its URL and signing secret stay. Supabase → Authentication → URL
   configuration: the domain; Vault `iwc_site_url` = the domain.
5. **Check on the domain:** `node scripts/domain-check.mjs https://indianwholesaleclub.com`, `/api/health` under 1 s,
   one real order refunded from the admin. Orders the old site took between the dump and the domain switch exist only
   in the old database (the payment sweep reads the new one's checkouts, so it does not see them): in the old
   project's SQL editor `select order_number, email, total_cents, created_at from orders where created_at > '<dump
   time>'`, and Stripe → Payments since then; make those orders again in the new admin, or refund them.
6. **The Android app:** its build holds the old Supabase URL and key and the old API address. Ship a build with
   `EXPO_PUBLIC_API_URL=https://indianwholesaleclub.com` and the new `EXPO_PUBLIC_SUPABASE_URL` / `_ANON_KEY`.
   Installed old builds read the old project until updated: keep the old Supabase project **running, read-only in
   practice** (no tools pointed at it) until installs have updated, then pause it. Everyone signs in again once
   (new project, new keys).
7. **Old accounts:** keep the dumps outside the repo; delete the old Vercel project once the domain has served from the
   new one for a day; pause the old Supabase project after step 6, delete it a month later.

---

## 0. Right now (founder, before anything else)

### INC-1 (P0, live incident): every page that reads the database live is hanging
**Evidence:** above. Cached pages (Home, categories, states) are fast because they come from Vercel's page cache, but
health, search and anything uncached wait 40–90 s or fail. `/api/checkout` and `/api/orders` read the database, so
**checkout and order confirmation are very likely failing for customers right now**, and a customer who already paid
would sit on "Confirming your order…" (A-4).

**Cause found 2026-11-03:** Supabase reports Database, PostgREST and Auth **Unhealthy** and "about to deplete its
**Disk IO Budget**" (baseline then 5 MB/s). Usage is far from the plan limits (egress 0.74/5 GB), so this is not a
quota restriction: the free compute's small memory can't hold the catalogue (8,000 listings, 20,900 options, 34,900
photos and their indexes), so page builds, search and bulk jobs read from disk, burn the burst budget, and everything
queues behind the 5 MB/s baseline. The budget refills only while disk demand stays under baseline.

**Founder, now (10 minutes):**
1. Supabase dashboard → the project's home: is there a banner "exceeding usage / services restricted" (free plan
   limits: database size 500 MB, egress 5 GB)? Reports → Database: CPU, memory, connections. Logs → Postgres for
   `statement timeout` / `too many connections`.
2. Stop every bulk job pointed at **production**: the description redo (`pnpm descriptions:redo`, D-178), the photo
   redo, the sourcing runner on the India PC, any `weight-estimator` run. Re-test `https://indianwholesaleclub.com/api/health`
   (should answer in under 1 s).
3. Move to **Supabase Pro** and pick a compute size with more memory than the free one (Settings → Compute and Disk
   lists each size's memory and disk IO baseline; Small or above). More memory means the catalogue stays in cache and
   stops reading disk. Once the load is off, Settings → General → **Restart project** clears the unhealthy services.
   Then run the read-only queries in INC-1's "which queries read the disk" below and give the result to Agent D/F0.
4. Stripe → Developers → Webhooks → the endpoint → recent deliveries: any failures since the hang started? Resend
   them once the database answers (each one creates the missing order).

**Which queries read the disk** (Supabase → SQL editor; read-only; or Reports → Query Performance):
```sql
-- since when the numbers below count (a restart resets them: run it again after a day of normal traffic)
select stats_reset from pg_stat_statements_info;
-- the 15 statements that read the most from disk since the last stats reset
select round(total_exec_time / 1000) as total_s, calls, round(mean_exec_time) as mean_ms,
       shared_blks_read, temp_blks_written, left(regexp_replace(query, '\s+', ' ', 'g'), 160) as query
from pg_stat_statements order by shared_blks_read + temp_blks_written desc limit 15;
-- what is running right now
select pid, now() - query_start as running, wait_event_type, wait_event, left(query, 120) as query
from pg_stat_activity where state <> 'idle' and pid <> pg_backend_pid() order by running desc nulls last limit 15;
-- tables that only grow (cron history every minute, pg_net responses)
select pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as cron_history,
       pg_size_pretty(pg_total_relation_size('net._http_response')) as net_responses;
```

**Result on 2026-11-03 (founder's screenshot), read:** the top rows were PostgREST loading its schema cache ("WITH --
Recursively get the base types of domains", 311 loads, about 144 s) and one RPC averaging 0.7 s (`pgrst_call`, 32
calls), with only about 400 blocks (3 MB) read from disk in all; two Supabase start-up statements ran once. So the
counters had just been reset by a restart and the disk eaters were not in them yet. PostgREST reloads its cache on
every reconnect: while the database starves it reconnects again and again, and each load reads the whole catalogue
of tables and functions, which adds to the load but did not start it. No migration or timer of ours sends schema
reloads (temporary tables inside functions are ignored). Run the queries again after a day of traffic on the new
project.

**Code follow-up → Agent F (F-0 below):** every server read gets a time limit and a friendly fallback, so a slow
database shows "try again in a minute" in 8 s instead of a 90 s spinner.

### DOM-1 (P0): the old vercel.app address redirects *everything*, including the webhook and the app's API
**Evidence:** `GET` and `POST` to `the-indian-wholesale-club.vercel.app/api/webhooks/stripe` → 307 to the domain. This
is Vercel's domain-level redirect (Settings → Domains), not code.
- **Stripe does not follow redirects.** If the live webhook endpoint still points at the vercel.app address, every
  delivery fails, and orders exist only when the customer's browser comes back (A-2/A-4 show how often it doesn't).
- **The installed Android app** calls `EXPO_PUBLIC_API_URL` = vercel.app (`apps/app/lib/api.ts`). The 307 re-sends the
  POST, but Android's HTTP client drops the `Authorization` header when the host changes, so a signed-in app customer
  checks out as a guest (order not linked to the account) and account calls fail.

**Founder, today:**
1. Stripe → Webhooks: the live endpoint must be `https://indianwholesaleclub.com/api/webhooks/stripe`. If it isn't,
   add it (events: `payment_intent.succeeded`, plus the F-1 events), put its signing secret in Vercel's
   `STRIPE_WEBHOOK_SECRET`, redeploy, then disable the old one after 7 days.
2. Vercel → Domains: set `the-indian-wholesale-club.vercel.app` to **no redirect** (serve the site). Agent E then adds
   the page-only redirect in code (E-1).
3. Vercel → Domains: `www` → apex as **308 (permanent)**, not 307.

### L: settings, not code (founder)
| ID | Sev | State on 2026-11-03 | What to do |
|---|---|---|---|
| L-1 | **P0** | `/contact` still "coming soon". Card networks and Stripe expect a working support contact; without one an unhappy buyer goes straight to a chargeback. | Google Workspace: create `support@indianwholesaleclub.com` (a group or alias, free). Vercel: `NEXT_PUBLIC_CONTACT_EMAIL=support@indianwholesaleclub.com`, rebuild. Stripe → Settings → Public details: support email, phone, website `https://indianwholesaleclub.com`, statement descriptor (e.g. `IWC INDIA GOODS`). |
| L-2 | P0 | DNS looks right: Google MX + SPF + DKIM, Resend's DKIM (`resend._domainkey`) and its `send.` subdomain, DMARC `p=none`. | Resend dashboard: domain shows **Verified**. Vercel: `RESEND_FROM_EMAIL=orders@indianwholesaleclub.com`, rebuild. `pnpm launch:check` → no stuck outbox rows; resend any that never went out. Make sure `dmarc@indianwholesaleclub.com` exists in Workspace (the DMARC reports go there) or point `rua` at a free DMARC report service. After 2–4 weeks of clean reports: `p=quarantine`. |
| L-3 | P0 | Unknown: Supabase's own mail server sends only to team members, a few an hour. | Supabase → Authentication → SMTP: Resend's SMTP (`smtp.resend.com`, sender `noreply@indianwholesaleclub.com`). Google Workspace SMTP also works (≈2,000 a day per user) but mixes customer mail with the founder's mailbox reputation; prefer Resend. Edit the email templates' wording and sender name. Test sign-up, sign-in code and password reset with a Gmail and an Outlook address **not** on the team: inbox, not spam. |
| L-4 | P0 | Vercel Hobby. | Hobby is for non-commercial use and keeps runtime logs ~1 hour, so INC-1 can't be investigated tomorrow. Move to **Pro** (and set Spend Management). |
| L-5 | P0 (now, given INC-1) | Supabase Free. | **Pro**: dedicated compute, daily backups, no restriction on overuse. |
| L-6 | P1 | Repo `yobslob/The-Indian-Wholesale-Club` public? (2026-10-24) | Make it private (shops, margins, pricing rules are readable). Check Actions and the Vercel deploy hook still work. |
| L-7 | P1 | Dumps / env files in the repo folder (`status.md` §Known leftovers). | Move outside `C:\kod\root`; rotate any key they contained. |
| L-8 | P1 | Supabase → Authentication → URL configuration. | Site URL `https://indianwholesaleclub.com`; Redirect URLs `https://indianwholesaleclub.com/**` and `https://www.indianwholesaleclub.com/**`; keep the vercel.app entry a month. Supabase Vault `iwc_site_url` = the domain (`ops.md` §Email timer). |
| L-9 | P1 | Stripe account. | Settings → Payment method domains: add `indianwholesaleclub.com` and `www.` (Apple Pay needs it). Radar: block if CVC fails, review if ZIP fails. Receipts on. Payouts and bank verified. 2FA on Stripe, Vercel, Supabase, GitHub, Cloudflare, Resend and Google Workspace. |
| L-10 | P2 | Search engines. | Google Search Console + Bing: domain property, submit `https://indianwholesaleclub.com/sitemap.xml` (already points to the domain). |

---

## 1. Before any agent starts (founder, 15 minutes)
1. **Freeze the tree.** The working copy has uncommitted work from another session (`apps/web/app/globals.css`,
   `features/home/diwali-windows.tsx`, `docs/decisions.md`, `status.md`, `storefront.md`) and this file. Commit or
   stash so every agent starts from a green `main` (`node scripts/check.mjs`).
2. **One branch per agent** (`qa/A-checkout`, `qa/B-product`, …) from the same commit. Merge one at a time, running
   `node scripts/check.mjs` after each.
3. Every agent reads `CLAUDE.md` first and keeps its non-negotiables: no ops info on customer surfaces (D-003),
   honest origin (D-004), money in integer cents, no pricing-rule changes, the free-limit budgets
   (`docs/monitoring.md`), files under ~250 lines. **Agents never touch production, `.env` files or the Deploy workflow.**
4. The founder's dev server: if port 3000 is busy, agents skip `check.mjs build`/`e2e` and say so.

---

## 2. Workstream A: checkout and payment reliability (money is lost here first)
Files: `apps/web/features/checkout/`, `apps/web/app/api/checkout/`, `apps/web/app/api/orders/`.

| ID | Sev | Problem (evidence) | Fix | Acceptance |
|---|---|---|---|---|
| A-1 | **P0** | **Card form can stay blank forever.** `payment-form.tsx`: the effect mounts only if `mountRef.current` exists when `loadStripe` resolves, else returns silently; a rejected `loadStripe` stays cached in `stripePromise` for the visit; no `loaderror`/`ready` handling; no `destroy()` on cleanup. The e2e run of 2026-10-30 failed 4–5 of 39 at "card frame left blank". | Mount from a callback ref. Reset `stripePromise` when it rejects or resolves `null`. Listen to `loaderror` → "Payment form didn't load" + **Retry**. Keep **Pay** disabled until `ready`. `element.destroy()` on cleanup. | e2e checkout passes `--repeat-each=20`. With `js.stripe.com` blocked: visible error and a working Retry. |
| A-2 | **P0** | **Charged customer stuck on "Paying…".** `confirmOrder()` (`checkout-flow.tsx:30`) calls `res.json()` unguarded; a 504/HTML page or dropped connection throws inside `paid()`. Separately, `PaymentForm` never resets `busy` after `onPaid`, so when `/api/orders` answers with an error the button stays "Paying…" disabled. With INC-1 this is happening for real. | try/catch in `confirmOrder`, return `{ message }` on any failure. In `paid()`: on anything but an order number, `router.push('/checkout/success?payment_intent=…')`, which keeps checking (A-4). A paid customer never stays on the form. | Mock `/api/orders` → 500, 504 HTML, abort, 30 s delay: the page reaches the success page, which shows "We're confirming your payment" and then the number once the webhook lands. |
| A-3 | **P0** | `post()` (`checkout-flow.tsx:96`) has the same unguarded `res.json()`: a 429/504 throws, `busy` stays true, **Continue** never comes back. No client timeout either (INC-1: 90 s). | try/catch/finally; `AbortSignal.timeout(20_000)`; show the server's message or "Connection problem, try again". | Offline or 504 on `/api/checkout`: an error shows, Continue works again. |
| A-4 | **P0** | **Success page never follows up.** `checkout-success.tsx:50`: one `confirmOrder` call, no catch (a throw leaves "Confirming your order…" forever), no retry, ignores `redirect_status=failed` from 3DS. | Poll `/api/orders` with back-off (2, 4, 8, 16, 30 s; ~60 s total), then "Your payment went through. We'll email your order number within the hour" + support email. `redirect_status=failed` → back to `/checkout` with Stripe's message, bag kept. | 3DS card `4000 0027 6000 3184`: approve → number; fail → checkout with the bag. `/api/orders` 500 for 20 s then OK → number appears without reload. |
| A-5 | P1 | Every shipping-method switch creates a **new PaymentIntent** + pending checkout; the card form rebuilds and typed card details are lost. No idempotency key. | One PaymentIntent per visit: `paymentIntents.update({ amount })` and update the stored pending checkout. `Idempotency-Key` from a hash of the bag + email on create. | Standard ↔ express 5 times → 1 PaymentIntent in Stripe test dashboard; card details kept. |
| A-6 | P1 | **No Apple Pay / Google Pay up front.** Wallets appear only in step 3, after phone and address typing. | Stripe **Express Checkout Element** above step 1, address/email/phone from the wallet, priced through the same `/api/checkout`. Needs L-9 (payment method domain) and E-3 (CSP). | iPhone Safari with a wallet card: tap → paid → success page, no typing. |
| A-7 | P1 | **FOUNDER.** Checkout asks phone first, then email and address. | Propose: email → address (ZIP lookup exists) → phone ("for the courier"). Question only. | n/a |
| A-8 | P2 | Refresh at step 3 restarts at Phone. | `sessionStorage` `{request, paymentIntentId}`; resume at step 3 if the PI is `requires_payment_method`. | Refresh at Payment → same step, same total. |
| A-9 | P2 | All errors read the same. | Map decline codes to plain words; keep the bag; focus the form. | `4000 0000 0000 0002` and `…9995` show mapped messages. |

---

## 3. Workstream B: product page, cards and bag
Files: `apps/web/features/catalog/`, `apps/web/features/cart/`, `apps/web/app/(store)/states/[region]/[product]/page.tsx`.

| ID | Sev | Problem (evidence) | Fix | Acceptance |
|---|---|---|---|---|
| B-1 | **P0** | **Shown price ≠ price added.** Re-confirmed 2026-11-03: *rajasthani rajputi poshak* shows **$17.31**; pick "blue" → **$16.30** in the bag. (2026-11-02: a Kerala frock $24.54 → $22.73.) `add-to-cart.tsx` shows the first in-stock option's price before a pick. | Before a pick: "From $16.30" (lowest in-stock) or the range. After: that option's price. Same rule on cards and the Added sheet. | Every multi-price product: shown price = bag line for every option. Unit test on the label. |
| B-2 | **P0** | **Add to bag below the fold on phones** (its top at 827 px on an 812 px screen; first screen is the photo + three thumbnails). | Sticky bottom bar on phones (price, option state, Add to bag) once the main button is off screen; title and price next to/above the photo. | 375 × 812: Add to bag visible on load and reachable while scrolling. |
| B-3 | P1 | Sizes unordered and mixed ("0-6 M, 4-5 Y, 6-12 year, 1 - 2 year…"); "Size chart" only repeats the list. | One shared normalise + sort (kids by age, adults XS→5XL) in `packages/shared` with tests; hide "Size chart" without measurements. | 50 random clothing listings in order (script). No empty size charts. |
| B-4 | P1 | **FOUNDER.** India-made reads "Made in India · from Kerala · **Imported**"; China-made reads "Imported" (D-171). | Propose "shipped from India" vs "Imported". Question only. | n/a |
| B-5 | P1 | **FOUNDER.** Bag shows subtotal only ("Tax and delivery dates are shown at checkout"); shipping ($18.62 on a $22 piece) and the "Retailer charges" line appear only at checkout: the biggest drop-off point. | Propose: an estimated delivery line in the bag ("Delivery from $x, free over $99.99"), the free line on product page and cards, retailer charges folded into Shipping (D-111). | n/a |
| B-6 | P1 | **Cards on phones:** raw shop SEO titles, badge cut under the heart, 3 columns at 375 px (~108 px a card), tap targets < 44 px. | 2-line clamp (clean `display_name` where one exists), badge below the photo, 2 columns under 420 px, heart and + ≥ 44 × 44. | No clipped badges at 360/375/414. Lighthouse tap-target audit passes. |
| B-7 | P1 | **FOUNDER.** /food and /clothing open on **"Low to high"**: 39¢ masala and the cheapest pieces first. | Propose "Most loved" default (30-day orders, then curated). | n/a |
| B-8 | P1 | **Photos too small.** The poshak's main photo is **156 px wide drawn in a 343 px slot** (≈1,029 device px on a 3× phone); thumbnails 123 px. | Report query of listings whose largest photo is < 600 px; rank them out of Home and the first 24 of each category. The founder re-runs the photo redo for them. | Report exists; none on Home or in the first 24. |
| B-9 | P1 | **Raw text reaches customers:** title "rajasthani rajputi poshak" all lowercase, option "blue", "Cotten Blend", duplicated "Similar items" and "Duties paid…" lines. | Display-time title case for all-lowercase titles and options (a pure function in `packages/shared`, tested); a spelling list in the importer's clean-up; remove the duplicate lines. Don't rewrite rows unasked. | Unit tests; visual check on 10 products. |
| B-10 | P2 | `/cart` shows "Loading your bag…" for ~1 s on every visit (bag read after hydration). | Render the bag skeleton with the line count from a cookie, or read the store synchronously in the first client render. | No text flash on /cart at 4× CPU slowdown. |
| B-11 | P2 | Empty bag's "$ $ $ $" read aloud. | `aria-hidden` + one sentence for screen readers. | VoiceOver reads one sentence. |

---

## 4. Workstream C: Home and phone speed
Files: `apps/web/features/home/`, `apps/web/features/shell/motion.tsx`, `apps/web/app/globals.css`, `apps/web/app/(store)/page.tsx`.

| ID | Sev | Problem (evidence) | Fix | Acceptance |
|---|---|---|---|---|
| C-1 | **P0** | **Scroll hijack on phones.** `motion.tsx:37-57`: Lenis loads at every width and a `requestAnimationFrame` loop runs for the life of the page, writing `--sv` on `<html>` every frame (restyling a 2,614-node page). Confirmed running at 375 px. | No Lenis on `(pointer: coarse)` or `prefers-reduced-motion`. Stop the loop when idle (resume on scroll). Scope `--sv` to the few elements that use it. | Chrome 4× CPU slowdown: Home scrolls ≥ 55 fps, no rAF while idle, long tasks < 200 ms. |
| C-2 | **P0** | **Home is heavy and the phone's first screen sells nothing:** 753 KB HTML, 180 images, 2,614 nodes; first screen is one photo; the "31 03 202…" stamp is cut at the right edge. | Server-render the first screen and first row of each band; lazy-render the rest near the viewport. Target **< 150 KB HTML, < 40 images, < 1,200 nodes**. One clear CTA and a row of real products with prices inside 812 px. Fix the stamp overflow. The founder prefers small design changes: keep today's layout, cut weight, offer layout ideas as options. | Lighthouse mobile (US): Performance ≥ 85, LCP < 2.5 s, CLS < 0.05, TBT < 200 ms. A price visible without scrolling at 375 × 812. |
| C-3 | P1 | 175 of 180 Home images have no `width`/`height`. | Size or `aspect-ratio` box on every image. | CLS < 0.05 cold, cache disabled. |
| C-4 | P1 | Photos come through `/media/s/*` → Vercel rewrite → R2's `r2.dev` address (rate-limited, not for production). `media.indianwholesaleclub.com` doesn't exist yet. | Founder: R2 → bucket → Custom domain `media.indianwholesaleclub.com` (same Cloudflare account, one click). `PHOTO_STORE_PUBLIC_URL` to it; keep the `/media/s/` rewrite so no page changes. `fetchpriority="high"` on the LCP image only. | p95 photo < 300 ms from the US warm; no 429 on `/media/s/`. |
| C-5 | P1 | Some store pages STALE; first visit to a product is a MISS (1.5 s). | Pre-build the top 300 products at deploy, inside the ISR write budget (`monitoring.md` §1); state page-cache writes in the commit. | Top 300 answer HIT right after a deploy. |
| C-6 | P2 | "Preloaded but not used" CSS warnings on every page (3 files on /checkout). | Find the over-included CSS (likely the `@info` parallel route) and split. | No preload warnings on /, /food, a product, /checkout. |
| C-7 | P2 | Tap targets: "Skip to content" 32×16, "FAQ" 20×32, map credit 85×15. | ≥ 44 × 44 on touch. | Lighthouse a11y: no tap-target or contrast failures. |

---

## 5. Workstream D: search (fast, never a 500)
Files: `apps/web/features/search/`, `apps/web/app/(store)/search/`, one new migration (`20261030090000_search.sql` is the current function).

| ID | Sev | Problem (evidence) | Fix | Acceptance |
|---|---|---|---|---|
| D-1 | **P0** | `/search?q=saree` **500 after 90.7 s**; `kurti` no answer in 40 s (2026-11-02: 500 after 11.7 s, retries 1.3–3.1 s; "masala" slowest). Part is INC-1, part is the query. | `EXPLAIN (ANALYZE, BUFFERS)` `store_search_page()` for the 20 most searched words on a production-sized local copy (8,000 listings). Add the missing GIN/trigram indexes; cap counts ("1,000+"); `set local statement_timeout = '3s'` in the function; the page catches the timeout and shows partial results or "Try a shorter search" with status 200/503, never the error page. | Top 20 < 400 ms in the DB, < 800 ms end-to-end from the US; a forced timeout shows the friendly page. |
| D-2 | P1 | Search is always `no-store`. | Cache common queries 5 min at the CDN (`s-maxage=300`), keyed by normalised query + filters (no user data on the page). | Second `/search?q=saree` within 5 min = HIT. |
| D-3 | P2 | "xyzqq" → "0 pieces", nothing else. | Suggest popular states, categories and searches. | Visual check. |

---

## 6. Workstream E: the domain (what's done, what's left)
Files: `apps/web/next.config.js`, `apps/web/middleware.ts`, `apps/web/lib/env.ts`, `apps/web/app/layout.tsx`, `apps/web/app/sitemap.xml/route.ts` + `apps/web/app/sitemaps/sitemap-data.ts` (was `app/sitemap.ts`), `apps/web/app/robots.ts`, product/state `page.tsx` metadata, `docs/ops.md`, `scripts/domain-check.mjs`.

**Done and checked 2026-11-03:** DNS on Cloudflare, records DNS-only (no `cf-ray`; keep it so: with the orange cloud
every visitor's IP becomes Cloudflare's and `lib/rate-limit.ts` would throttle all customers together). Apex A records
to Vercel, `www` CNAME to Vercel, certificate valid, `http` → `https` 308. `NEXT_PUBLIC_SITE_URL` is the domain
(robots and sitemap list `https://indianwholesaleclub.com`). Email DNS as in L-2.

**Wave 2 (agent E, 2026-11-03, not deployed):** E-1 in code (`apps/web/middleware.ts` + `apps/web/lib/legacy-move.ts`:
pages on the hosts in `LEGACY_HOSTS` → 308 to the domain, a first browser visit carries the bag in `#bag=`; API,
media, auth, Next files and POSTs served), `docs/ops.md` §Going live on the domain, `scripts/domain-check.mjs`;
D-2's CDN rule; E-2a canonicals; E-2b product and state metadata + product JSON-LD; E-2d sitemap index + parts
(CDN-kept, no page-cache writes); E-3 Stripe CSP hosts from Stripe's guide + `/api/csp-report`. E-2c waits for the
founder. Needs the founder: Vercel domain redirect off, `LEGACY_HOSTS`, then `node scripts/domain-check.mjs`.

| ID | Sev | Problem | Fix | Acceptance |
|---|---|---|---|---|
| E-1 | **P0** | DOM-1: whole-host redirect from vercel.app. | After the founder turns Vercel's domain redirect off: middleware sends only **GET page requests** on the vercel.app host to the domain with **308**, and serves `/api/*`, `/media/*`, `/auth/*`, `/_next/*` as they are. Carry the bag in the fragment (`#bag=<base64 of variantId:qty>`, never the query string); the domain's bag reads it once, merges, clears it. Write §"Going live on the domain" in `docs/ops.md` (DOM-1, L-2, L-3, L-8, L-9, C-4 as one checklist) and `scripts/domain-check.mjs` that requests every row of §0's table and fails on a regression. | `curl -X POST vercel.app/api/webhooks/stripe` → 400 "Missing signature" (served, not redirected); `GET vercel.app/food` → 308 to the domain with the bag; `node scripts/domain-check.mjs --legacy=<old host>` green. |
| E-2a | P1 | No `canonical` on Home, product or state pages (only See all / 7-day have one): the vercel.app copy competes in search. | `alternates.canonical` on every store page from `siteUrl()`. | View source on a product shows the domain's canonical. |
| E-2b | P1 | **Product pages have no meta description, no `og:image`, no JSON-LD** (checked on the poshak). WhatsApp shares show nothing; Google shows no price. | `description` from the listing summary; `openGraph` (photo, title, price); JSON-LD `Product` + `offers` (USD, availability) and `BreadcrumbList`. No shop or source in any of it (D-003). | Facebook sharing debugger and Google Rich Results pass on 3 products. |
| E-2c | P1 | **FOUNDER.** Site description still `TODO(founder)` (`app/layout.tsx:10`). | Founder approves the line. | No `TODO(founder)` on customer pages (`pnpm launch:check`). |
| E-2d | P2 | Sitemap is one ~1.9 MB file. | `generateSitemaps` in batches of 5,000, `lastModified`. | Search Console reads every part. |
| E-3 | P1 | **CSP vs Stripe.** `next.config.js:152-157` allows `https://js.stripe.com` for scripts/frames and `api.stripe.com` for connect only. Stripe's current guide also lists `https://*.js.stripe.com` (scripts, frames) and more hosts for Link, Apple/Google Pay and 3DS. Blocked hosts = blank card frame (A-1) or a broken 3DS challenge. HSTS on apex has `includeSubDomains; preload`, `www` doesn't. | Compare with Stripe's CSP page (fetch it, don't guess) and add exactly what Payment Element, Express Checkout, Link and 3DS need; `media.indianwholesaleclub.com` in `img-src` if C-4 lands; a `report-to`/`report-uri` endpoint (F-3). **Don't submit to the HSTS preload list** until every subdomain works over HTTPS. | Payment step, Apple Pay, Google Pay, Link and a 3DS challenge with **zero CSP violations** in the console (test mode, local build). |

---

## 7. Workstream F: backend, payments ledger, monitoring (last, as asked)
Files: `apps/web/app/api/webhooks/`, `apps/web/app/api/health/`, `apps/web/lib/logger.ts`, `apps/web/lib/supabase/`, `apps/web/features/checkout/finalize.ts` (after A merges), `packages/db/src/server/checkout.ts`, a new migration.

| ID | Sev | Problem | Fix | Acceptance |
|---|---|---|---|---|
| F-0 | **P0** | INC-1: no time limit on any server database call; a slow database means 90 s requests and Vercel function time burned. | A `fetch` with `AbortSignal.timeout(8000)` passed to the server Supabase clients (store, service), so every read fails fast; store pages fall back to their cached copy / a friendly "busy, try again" (status 503, `Retry-After: 30`). Checkout and orders answer 503 with a message the client shows (A-2/A-3). | With a local DB paused (`docker pause`), `/api/health` answers in ≤ 9 s with `degraded`; `/api/checkout` 503 with a message; no request over 10 s. |
| F-1 | **P0** | **A webhook claim never expires.** `claimWebhookEvent` inserts into `webhook_events` before finalizing; `releaseWebhookEvent` runs only in the `catch`. If the function is killed (timeout, like INC-1) between the two, every Stripe retry returns `duplicate: true` and the **order is never created** for a paid customer. | Claim with a status and a time: `processing` + `claimed_at`; a claim older than 2 min is taken over by the retry; mark `done` only after finalize succeeds. Migration + `packages/db` change + SQL test. | SQL test: a stale `processing` claim is re-claimed; a `done` one isn't. Kill the handler after the claim locally → the next `stripe events resend` creates the order. |
| F-2 | **P0** | **No safety net for paid-without-order.** There's no sweep of pending checkouts; if both the browser and the webhook fail, nobody notices. | A cron route (Vercel Cron or the existing Supabase timer that calls `iwc_site_url`, `ops.md` §Email timer) every 10 min: pending checkouts older than 10 min → ask Stripe for the PaymentIntent → `succeeded` without an order → `finalizeOrder(…, 'sweep')`; still failing → alert (F-3). | Local: pay, block `/api/orders` and the webhook, wait for the sweep → order created and alert row written. |
| F-3 | P0 | Refunds made in the Stripe dashboard, **disputes** and failed payments are never seen; failed reconciliations go only to logs Hobby keeps ~1 hour. | Handle `charge.refunded` (mark refunded, email the customer), `charge.dispute.created` (alert the founder **immediately**), `payment_intent.payment_failed` (log, clear the pending checkout). Every `recordFailedReconciliation`, `stripe.webhook_failed` and sweep failure also posts to `ADMIN_ALERT_WEBHOOK_URL` (a Slack/Discord/Telegram hook the founder sets) and shows as a red count on the admin's Today page. | `stripe trigger charge.dispute.created` locally → alert + log; forced mismatch → one alert, one admin row. |
| F-4 | P1 | No error tracking in the browser or server. | Sentry free tier (or a Vercel log drain on Pro) with email/address/phone scrubbed; CSP `report-to`; alerts: checkout start failures > 3 in 10 min, any 5xx on `/api/orders` or the webhook, search 5xx. | A thrown test error shows with route and release. |
| F-5 | P1 | `/api/health` hangs with the database (90 s) and nothing watches it. | F-0's time limit; `select 1`-cheap read; a free uptime monitor (UptimeRobot / Better Stack) every 5 min on `/`, `/food`, a product, `/api/health`, and a HEAD on the webhook (expects 405), alerting the founder's phone. | Monitor green; a forced failure pages within 10 min. |
| F-6 | P1 | No idempotency key (A-5) and no metadata linking a payment to an order. | `metadata: { source: 'iwc', checkout_hash }` on create; the order number added after finalize, so support finds an order from Stripe. | A paid order is searchable by number in Stripe. |
| F-7 | P1 | Dependencies. | `pnpm audit --prod`, fix high/critical, Dependabot security updates on. | 0 high/critical. |
| F-8 | P2 | **FOUNDER** + accountant: sales tax (Stripe Tax deferred) once a state's economic-nexus threshold is passed. | Monthly sales by state in admin Insights. | n/a |
| F-9 | P2 | **FOUNDER** + customs broker: FDA Prior Notice for food (`ops.md` §Compliance). | Out of code scope. | n/a |

---

## 8. Workstream G: tests (runs alongside, owns `apps/web/e2e/` only)
Write the tests first, so each fails until its fix lands.
1. Browse: Home → state → product → option → add → bag → quantity → remove → empty.
2. Price consistency (B-1): 10 multi-price products, shown = bag line = checkout line.
3. Happy path `4242…`: number on success, bag cleared, outbox row.
4. 3DS approve/fail (`4000 0027 6000 3184`), decline (`…0002`), insufficient funds (`…9995`).
5. Faults (A-2/A-3/A-4): `/api/orders` 500, 504 HTML, abort, 30 s delay; `/api/checkout` 504 → never stuck.
6. Webhook-only: close the tab after confirm → webhook creates the order (`stripe listen`).
7. Killed webhook after claim (F-1) → retry creates the order.
8. Sold out while paying → full refund and the right message.
9. Double click on Pay and Continue → one PaymentIntent, one order.
10. Phone 375 × 812 runs of 1, 3, 4, plus Add to bag visible without scrolling (B-2).
11. Search: top 20 queries 200 within 1 s locally; forced timeout → friendly page (D-1).
12. `@axe-core/playwright` on Home, /food, a product, bag, checkout: 0 serious/critical.
13. Flake budget: whole suite `--repeat-each=10` green before calling it done.

---

## 9. Manual matrix (a person, on the live domain, real devices)
| Device | Browser | Flows |
|---|---|---|
| iPhone (iOS 17+) | Safari | browse, search, Apple Pay purchase, 3DS, order lookup, sign-in code email |
| Android mid-range | Chrome | scroll smoothness on Home, Google Pay purchase, sign-up + sign-in code email |
| Windows laptop | Chrome, Edge | full card checkout, account, saved addresses, returns request |
| Mac | Safari, Firefox | full checkout, info pages, contact email link works |
| Android app (installed build) | n/a | browse, sign in, pay while signed in → order shows in the account (DOM-1) |

**First real payment on the domain** (after INC-1 and DOM-1): the founder buys one cheap food piece with their own
card, then checks the order in the admin, the confirmation email (inbox, not spam, from `orders@`), Stripe → the
webhook delivery **200 on the domain endpoint**, then refunds it from `/admin/refund` and checks `charge.refunded`
reached the order (F-3).

---

## 10. Subagent split (no two agents edit the same files)
| Agent | Workstream | Owns | Wave |
|---|---|---|---|
| A | Checkout and payment reliability | `features/checkout/` (not `finalize.ts`), `app/api/checkout/`, `app/api/orders/` | 1 |
| B | Product page, cards, bag | `features/catalog/`, `features/cart/`, the product route, `packages/shared` (sizes, title case) | 1 |
| C | Home and phone speed | `features/home/`, `features/shell/`, `app/globals.css` | 1 |
| D | Search | `features/search/`, the search routes, one migration | 1 |
| F0 | DB time limits + webhook claim (F-0, F-1, F-2) | `lib/supabase/`, `app/api/health/`, `app/api/webhooks/`, `packages/db/src/server/checkout.ts`, one migration, the cron route | 1 (P0, small) |
| G | Tests | `apps/web/e2e/` | 1–3 |
| E | Domain, SEO, headers | `next.config.js`, `middleware.ts`, `lib/env.ts`, `sitemap.ts`, `robots.ts`, `layout.tsx`, product/state metadata (coordinate with B on the product route: E edits only `generateMetadata`), `docs/ops.md`, `scripts/domain-check.mjs` | 2 |
| F | Monitoring and ledger (F-3 … F-7) | `lib/logger.ts`, `features/checkout/finalize.ts` (after A merges), admin Today count | 3 |

Two migrations in wave 1 (D and F0): give them timestamps one minute apart and merge D first.

**Prompt for each agent** (fill in the letter):
> You are agent X for IWC's launch. Read `CLAUDE.md`, then `docs/launch-qa-plan.md` §0 and your workstream. Work only
> in the paths §10 gives agent X, on branch `qa/X-…` from the frozen commit. P0 first, then P1. For any FOUNDER item,
> add the question to `docs/questions.md` and skip the change. Every fix needs its acceptance test passing and
> `node scripts/check.mjs typecheck lint test` green (plus `build e2e` for UI work if port 3000 is free). Never touch
> production, `.env` files or the Deploy workflow. Finish with: item ID → fixed / skipped (why) / needs the founder.

---

## 11. Launch-day runbook and rollback
**Now:** INC-1, DOM-1, L-1, L-3. **T-2 days:** waves 1–3 merged, `node scripts/check.mjs` green 3 times, FOUNDER answers
in, L-1 … L-9 done, `pnpm launch:check --url=<production DB URL> --allow-remote` ends "Ready to launch".
**T-1:** Deploy workflow (migrations, then the website), the manual matrix, a manual Supabase backup.
**Watch 2 hours after each deploy:** Stripe webhook deliveries all 200, Vercel 5xx = 0, outbox empty, alerts none,
`/api/health` < 1 s.

**Rollback:** Vercel → Deployments → the previous one → **Promote**. A bad migration is fixed with a new migration,
never by editing an applied one. The old Stripe endpoint stays (disabled, not deleted) for 7 days.

## 12. Definition of done
- [ ] INC-1 resolved: `/api/health` < 1 s for 24 h; no request over 10 s in the logs.
- [ ] DOM-1: webhook deliveries 200 on the domain endpoint; signed-in app orders link to accounts.
- [ ] Every P0 fixed with its acceptance test passing; every P1 fixed or with the founder's written "later".
- [ ] Lighthouse mobile from the US: Home, /food, a product ≥ 85 Performance, ≥ 95 Accessibility, LCP < 2.5 s, CLS < 0.05.
- [ ] Search: top 20 < 800 ms end-to-end, no 5xx in 24 h.
- [ ] e2e green 10 times in a row; manual matrix signed off.
- [ ] A real payment on the domain: order, email in the inbox, webhook 200, refund reflected.
- [ ] `/contact` shows `support@indianwholesaleclub.com`; Stripe public details complete.
- [ ] Uptime checks, error tracking and dispute alerts reach the founder's phone.
