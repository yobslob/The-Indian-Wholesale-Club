# Monitoring: is production efficient, fast and resilient? (D-147)

The loop: **look** (on a fixed rhythm, below) → **notice** (a number past its line) → **fix** the same week (a bug or
a weak spot is a commit, verified as `engineering.md` says) → **write it down** (`status.md`; a new rule in
`decisions.md`). Every check here only reads: nothing changes production. The founder runs the dashboard checks;
Claude can run the repo checks and read what the founder pastes.

## 1. Budgets: about half of each free limit (`ops.md` §Accounts and limits)
A number past its **budget** is a warning (look for the cause that week); past the **line**, act the same day.
| Service | What to read (where) | Budget a month | Line (act) | Usual causes when it climbs |
|---|---|---|---|---|
| Vercel | ISR writes (Usage → ISR) | 100,000 | 150,000 | bulk edits of many live listings, many deploys in a day, a page that changes on every request; check that D-145's narrow refreshes still hold (`features/admin/refresh-listings.ts`) |
| Vercel | Function invocations (Usage → Functions) | 500,000 | 750,000 | a bot crawling search or `/api/browse` (rate limits; robots.txt keeps polite ones off `/search` since D-160), an uncached page, the uptime ping set too often |
| Vercel | Active CPU | 2 h | 3 h | a slow server render (see §3), image work on the server (there should be none) |
| Vercel | Fast data transfer / origin transfer | 50 GB / 5 GB | 75 GB / 7.5 GB | photos served without the CDN (`x-vercel-cache` should say HIT, `ops.md` §Photos) |
| Vercel | Image transformations | 0 | 1,000 | someone added `next/image` with Vercel's loader (D-140 forbids it) |
| Supabase | Database size (Reports → Database) | 250 MB (78 MB of catalogue on 2026-10-21) | 400 MB | `stock_movements`, `search_queries` (B-23) or `rate_limit_hits` growing without a clean-up; search's `product_search` grows with the catalogue (about 0.5 KB a listing with its index, D-160) |
| Supabase | Egress (Usage) | 2.5 GB | 4 GB | photos read from Supabase instead of R2, the photo move or the weight tools reading everything at once, big admin exports |
| Supabase | Storage | 100 MB | 500 MB | uploads not moved to R2 (`pnpm photos:move -- --clean` lists and removes them) |
| Supabase | Monthly active users | 25,000 | 40,000 | real growth: good news, plan the paid tier |
| Cloudflare R2 | Storage (R2 → bucket → Metrics) | 6 GB (about 4 GB in use) | 9 GB | repeats kept (D-142), originals stored, copies of deleted listings or photos (`pnpm photos:redo audit` lists them; `--delete` removes them). What deletes them as it goes: a photo or album photo removed in admin, a re-import's replaced photos, a state's replaced main photo, the redo's replaced photos (its sweep, 10 min later) and its stale publishes, a copy whose twin failed to write, a runner listing whose photos could not be attached |
| Cloudflare R2 | Class A (writes) / Class B (reads) | 500K / 5M | 900K / 9M | reads that miss Vercel's CDN |
| GitHub | Actions minutes (Settings → Billing) | 1,000 | 1,600 | CI runs the full `check.mjs` on every push to `main` (up to 45 min allowed, usually far less; a private repository gets 2,000 free minutes): batch commits, push once a day |

## 2. The site's health: what "behaving well" means
| Area | Healthy when | How it is checked |
|---|---|---|
| Up | `/api/health` answers `{"status":"healthy"}` | an uptime service every 10 minutes (§5); it also keeps the free Supabase project awake |
| Speed | cached store pages answer in ≤ 100 ms and ship ≤ 150 KB first-load JS (D-011, `engineering.md` §Performance); on the live site Home, a state, See all and a product page load in under 2 s on a phone | `node scripts/check.mjs http` (local production build) weekly; the live pages in Chrome's Lighthouse (mobile) monthly |
| Photos | every photo from `/media/s/…avif`, a second request `x-vercel-cache: HIT` | `CHECK_LIVE_SITE=<site> node scripts/check.mjs http`; `curl -I` on one photo twice |
| Payments | every paid Stripe payment has its order; no row in `failed_reconciliations` unresolved | Admin → Today (payments to check); Stripe → Payments vs Admin → Orders weekly |
| Emails | nothing pending for more than 10 minutes | Admin → Today (stuck emails); query D below |
| Timers | the three pg_cron jobs ran in the last hour | query C below |
| Exchange rate | refreshed today (D-075) | query E; Admin → Settings (the exchange rate) |
| Errors | Today shows no new server errors, or each is understood | Admin → Today; query F (Vercel keeps runtime logs only 1 hour on Hobby, so `admin_error_events` is the record) |
| Catalogue | Weights to check, Drafts and Names to tidy stay small; no live listing without a weight | Admin → Products tabs; query G |
| Sourcing | the runner's last run is under a day old when it should run daily | Admin → Import → Auto-sourcing (last run) |

## 3. Resilience: what fails, what customers see, what to do
| Failure | What happens | Detect | Do |
|---|---|---|---|
| Vercel over a free limit | Hobby pauses the project: the site is down until the month resets | §1 budgets; Vercel's usage email | cut the cause; if it is real traffic, the founder decides on Pro (D-145) |
| Supabase over a limit | the project can be restricted (reads fail, the site shows errors) | §1; Supabase's usage email | cut the cause; a paused project: Supabase → Restore |
| Supabase down or slow | cached store pages keep showing (they are built pages); checkout, account and admin fail | uptime ping (`degraded`), Today | wait for Supabase status; nothing to repair in the code |
| R2 down | photos fail where not already in Vercel's CDN | photo check | wait; Vercel's CDN may keep a photo up to a year (`CDN-Cache-Control` in `apps/web/next.config.js`), so most still show |
| Stripe webhook failing | payments arrive without orders | `failed_reconciliations`, Today | fix the endpoint or secret (`ops.md` §Going live step 7); reconcile from Today |
| Email timer not running | emails wait (the site's own actions still send at once) | query C, D | the Vault secrets and `cron.schedule` lines (`ops.md` §Email timer, §Moving step 5) |
| Exchange-rate service down | prices keep the last rate; a jump over 10% is held for an admin (D-075) | query E | nothing; check Settings |
| India PC or laptop off | no new listings, no weekly check; nothing breaks | runner's last run | turn it on; it carries on |
| A bad deploy | the daily deploy took a red commit (it should not: it needs green CI) | the site, the uptime ping | Vercel → Deployments → the previous one → Promote (instant rollback) |
| Data loss | the free plan keeps no downloadable backups | — | monthly: `npx supabase db dump` (roles, schema, data, as `ops.md` §Moving step 3) to a folder outside the repo; keep the last two |

## 4. The rhythm
- **Every day (automatic):** the uptime ping; Today's attention panel when an admin opens the panel.
- **Every Monday, 15 minutes (the founder):** the §1 numbers (Vercel Usage, Supabase Usage and Reports, R2 Metrics,
  GitHub Billing) written into the table at the end of this page; Admin → Today; Products tabs counts; queries A – G
  in Supabase's SQL editor. Anything past a budget: tell Claude with the number and the screen.
- **Every month (first Monday):** `pnpm photos:redo audit` on the laptop (read-only; lists R2 by folder and the listing
  photos no listing shows; if any, `pnpm photos:redo audit --delete` removes those over a day old);
  `node scripts/check.mjs` on the Windows machine (all steps); Lighthouse on Home, a
  state, See all and a product page (mobile); the database dump; `pnpm launch:check --url=<production DB URL>
  --allow-remote` (read-only); the usage month that just ended compared with the one before.
- **After any big change** (a bulk publish, a new sourcing round, a feature): the next day's Vercel ISR writes and
  Supabase egress.

## 5. Set-up once (the founder)
1. Vercel → Settings → Billing / Usage: turn on the usage notifications (50%, 75%, 100%) for the account's email.
2. Supabase → Organization → Billing / Usage: the same email; note the plan's limits page.
3. An uptime service on its free plan (UptimeRobot or Better Stack): HTTP check of
   `https://the-indian-wholesale-club.vercel.app/api/health` every 10 minutes, alert when it is not 200 or its body
   lacks `healthy`. Ten-minute pings are about 4,300 function invocations a month (under 0.5% of the limit).
4. On the Windows machine, `apps/web/.env.local` gets `CHECK_LIVE_SITE=https://the-indian-wholesale-club.vercel.app`
   (`ops.md` §Environment variables), so `check.mjs http` also checks a live photo.

## 6. Queries for Supabase's SQL editor (read-only)
```sql
-- A. size: the database and its biggest tables
select pg_size_pretty(pg_database_size(current_database()));
select relname, pg_size_pretty(pg_total_relation_size(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 10;
-- B. the slowest work (pg_stat_statements): anything over 100 ms on average is a candidate for a fix
select calls, round(mean_exec_time::numeric, 1) as avg_ms, round(total_exec_time::numeric) as total_ms, left(query, 120)
  from pg_stat_statements order by total_exec_time desc limit 15;
-- C. the timers: each should have run in the last hour, none failing
select j.jobname, max(d.start_time) as last_run, count(*) filter (where d.status <> 'succeeded') as failed
  from cron.job j left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '1 day'
 group by j.jobname;
-- D. emails waiting
select status, count(*), min(created_at) from public.email_outbox where status <> 'sent' group by status;
-- E. the exchange rate's last refresh
select max(requested_at) filter (where applied) as last_applied, max(requested_at) as last_try from public.fx_fetches;
-- F. server errors this week, by kind
select event, count(*), max(created_at) from public.admin_error_events where created_at > now() - interval '7 days'
 group by event order by count(*) desc;
-- G. the catalogue's health
select status, count(*) from public.products where not is_placeholder group by status;
select count(*) as live_options_without_weight from public.product_variants v join public.products p on p.id = v.product_id
 where p.status = 'live' and v.is_active and v.weight_g is null;
-- H. search (D-160): how fast (aim: under 100 ms on average), how it answered this week, and the size of its tables
-- (the timer iwc-search-words in C refreshes the vocabulary every 6 hours; a crawl shows as one word searched a lot)
select calls, round(mean_exec_time::numeric, 1) as avg_ms from pg_stat_statements where query ilike '%store_search_page%';
select count(*) as searches, count(*) filter (where results = 0) as found_nothing, count(*) filter (where partial) as some_words,
       count(*) filter (where fixed is not null) as fixed
  from public.search_queries where created_at > now() - interval '7 days';
select pg_size_pretty(pg_total_relation_size('public.product_search')) as product_search,
       pg_size_pretty(pg_total_relation_size('public.search_words')) as words, (select count(*) from public.search_words) as n;
```

## 7. Fixing what is found
- **Severity:** *down or money wrong* (the site, checkout, a price, a charge): the same day · *slow or over a
  budget*: that week · *cosmetic*: with the next batch of work.
- **How:** reproduce it locally (local Supabase, `check.mjs`), fix the cause, add the test that would have caught it,
  verify (`engineering.md` §Testing), commit with what and why; the daily deploy ships it (a migration waits for the
  Deploy workflow). Write the number before and after in `status.md`.
- **Never** to find a cause: reset or write to the production database, or run anything against it that is not
  read-only (CLAUDE.md).

## 8. The weekly numbers (newest first; keep about eight weeks)
| Week of | Vercel ISR writes | Functions | Supabase DB / egress | R2 GB | Actions min | Notes |
|---|---|---|---|---|---|---|
| 2026-10-19 | new account | new account | new project | ~4 | — | the move to the new accounts; numbers start next week |
