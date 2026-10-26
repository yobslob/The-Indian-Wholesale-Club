# Ops: environments, env vars, database, deploy, compliance

## Accounts and limits (D-147)
| Service | What runs there | Plan and the limits that matter | Since |
|---|---|---|---|
| **Vercel** (new account, Hobby) | the website `apps/web`, region `iad1`; the deploy hook the daily deploy calls | a month: 200,000 page-cache (ISR) writes (8 KB units, as the dashboard counted them on 2026-10-21), 1M function invocations, 4 h active CPU, 360 GB-h memory, 100 GB fast data transfer, 10 GB origin transfer, 5,000 image transformations (unused: no resizer, D-140); runtime logs kept 1 hour. Vercel's terms keep Hobby to non-commercial use (a site taking payments is commercial): the founder chose to stay on it for now (D-145) | 2026-10-21 |
| **Supabase** (new project, free) | Postgres (every listing, order, account), Auth, Realtime, pg_cron timers, Vault | 500 MB database, 1 GB storage (holds only uploads for the minutes before their move to R2), 5 GB egress, 50,000 monthly active users; a free project pauses after a week without requests | 2026-10-21 |
| **Cloudflare R2** (bucket `iwc-photos`) | every photo as two AVIF copies, read through `/media/s/` on the site (D-141) | 10 GB stored, 1M writes and 10M reads a month free, no charge for traffic | 2026-10-20 |
| **GitHub** `yobslob/The-Indian-Wholesale-Club` | the code, CI (`ci.yml`), the Deploy and Daily website deploy workflows | Actions minutes of the free plan | 2026-09-23 |
| **Stripe**, **Resend**, **EAS** | payments (live keys), emails (test sender until Q-9), the Android build | per use | 2026-10-06 |

**History (why there are new accounts):** production started on 2026-10-06 on the first Vercel account and Supabase
project. Within two weeks the free limits ran out: Vercel's image optimisation (5,000 a month; photos answered 402 on
2026-10-18), then its page-cache writes (208K of 200K by 2026-10-21: every admin edit and each of about 70 deploys
rewrote all 5,852 product pages and the 2 MB state pages), and Supabase's storage (7.9 GB of photos against 1 GB) with
its egress (the photo move). The fixes: no resizer, fixed AVIF copies (D-140); photos in Cloudflare R2 (D-141); each
picture once (D-142); narrow refreshes, a daily deploy and card options on demand (D-145). Then the site moved to a new
Vercel account and a new Supabase project (§Moving to new Vercel or Supabase accounts), both starting near zero. The
old accounts are not used any more; keep their dumps outside the repo until the new ones have run a month.
**This time, by design:** every limit has a monthly budget at about half the free plan and a weekly check
(`monitoring.md`); a change that would add page-cache writes, egress or database size says so in its commit.

## Environments
| Env | Web | DB | Notes |
|---|---|---|---|
| dev | `pnpm dev` on the founder's machine | **local Supabase** (Docker) via `apps/web/.env.local` | `next build` reads the DB (static pages), so the DB it points at must have the schema. `apps/web/.env` still points at the first hosted dev project (D-013), unused since local Supabase |
| prod | the new Vercel account (`the-indian-wholesale-club.vercel.app`; the domain waits on Q-9) | the new Supabase project | hosted in the US (D-003). The Android app is built by EAS; iOS waits for an Apple Developer account |

## Environment variables
Names only. Values live in `.env` files that are **never committed**. The templates are `apps/web/.env.example` and `apps/app/.env.example`.
Reading `process.env.X` for a variable not listed here = add it here in the same commit.
| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | web server only | service client for webhooks/jobs. Never in client code |
| `CHECK_LIVE_SITE` | `scripts/check.mjs` (`http` step) | optional: the live site's address; the step then fails when its first /clothing photo does not answer 200 (D-140) |
| `SUPABASE_TEST_DB_URL` | `scripts/db-test.mjs` | optional; defaults to local Supabase. Non-local hosts are refused unless `--allow-remote` is passed (never do that against production) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | payments (test-mode keys in dev) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_OUTBOX_CRON_SECRET` | web | email + outbox job (`POST /api/internal/email-outbox` with `Authorization: Bearer <secret>`; without email keys, emails wait in the outbox). The sender's domain must be verified in Resend (Q-9). For local tests before that, Resend accepts `onboarding@resend.dev` as the sender, delivering only to the Resend account's own address |
| `PHOTO_STORE_S3_URL`, `PHOTO_STORE_KEY_ID`, `PHOTO_STORE_SECRET`, `PHOTO_STORE_PUBLIC_URL` (`PHOTO_STORE_REGION`, default `auto`) | web (server only) | the photo store, Cloudflare R2 (D-141, §Photos). Without them photos stay in Supabase's storage (local development). Locally, Supabase's own S3 endpoint can stand in: the `web-photo-store` preview in `.claude/launch.json` |
| `VERCEL_ENV` | web (build) | set by Vercel; a `production` build without `PHOTO_STORE_PUBLIC_URL` stops (§Photos) |
| `ADMIN_EMAILS` | web server | admin email allowlist (D-006, INV-7) |
| `ADMIN_ALERT_WEBHOOK_URL` | web server | optional ops alerts |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | web | absolute URLs |
| `NEXT_PUBLIC_CONTACT_EMAIL` | web | support address shown on /contact and in emails (Q-9). `CONTACT_EMAIL` is no longer read since R5 |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | app | app clients |
No longer read by any code (safe to delete from your own `.env` files): `CARRIER_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, `TRACKING_PROXY_API_URL`, `TRACKING_PROXY_API_KEY`, `DIRECT_URL`, `DATABASE_URL`, `CONTACT_EMAIL`.

**Pointing the web app at local Supabase:** create `apps/web/.env.local` (never committed; Next.js reads it before `.env`)
with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the local `anon key` / `service_role key` printed by
`npx supabase status`. Delete the file to go back to the hosted project.

**Running the app (dev, since R6):** copy `apps/app/.env.example` to `apps/app/.env` (never committed). A phone can't reach
the computer's `127.0.0.1`, so both addresses use the computer's LAN IP (`ipconfig` → IPv4 address): Supabase
`http://<LAN IP>:54321` with the local anon key, and the website `http://<LAN IP>:3000` (`pnpm --filter web dev`, which
serves checkout for the app). In development a local address in that file (localhost or a LAN IP) follows the
computer Metro is served from (`apps/app/lib/local-host.ts`), so a new Wi-Fi network or hotspot needs no edit; the Metro
terminal prints the addresses in use (`[iwc] Supabase: …`). Phone and computer on the same Wi-Fi; Windows may ask to allow Node.js and Docker on private
networks. Stripe: the same test publishable key as the web. Then `pnpm --filter app dev` and open it in Expo Go.
The app pins `@stripe/stripe-react-native` to the version Expo Go carries for SDK 52 (the JavaScript and Expo Go's native
module must match; B-9). After changing dependencies or `.npmrc`, start with `npx expo start --clear` (in `apps/app`) so
Metro drops its cache. The app's web target is not used (customers get the Next.js website); test on a phone.

**Email timer (C5, migration 17):** pg_cron calls the outbox job every minute through pg_net, but only after two Supabase
Vault secrets exist in that database (SQL editor, once per database; the values are never committed):
`select vault.create_secret('<site URL>', 'iwc_site_url');` and `select vault.create_secret('<EMAIL_OUTBOX_CRON_SECRET>',
'iwc_outbox_secret');`. The site URL is the deployed site for the hosted database, and `http://host.docker.internal:3000`
for the local one (the database runs in Docker). Without them, emails still go out right after the website's own
actions; those from the app's admin screens and the automatic cutoff wait for the timer. The same timer refreshes the
website's cached store pages after a cycle closes by itself (D-068): without the Vault secrets they show the past "order
by" time for up to 5 minutes after a cutoff (checkout itself always prices the real cycle).

## Database workflow (from R3)
- Schema changes = a new file in `supabase/migrations/`. Never edit an applied migration.
- After every schema change: `npx supabase db reset`, then **`pnpm db:types`** (writes `packages/db/src/database.types.ts`,
  UTF-8), then commit it. Never edit that file by hand.
- **Local DB (Docker Desktop running):** `npx supabase start` once, then `npx supabase db reset` rebuilds it from
  migrations + seeds (`supabase/config.toml` `[db.seed]`: regions, categories, demo). Studio: http://127.0.0.1:54323.
- **DB tests:** `node scripts/check.mjs db` (= reset + `scripts/db-test.mjs`). It refuses non-local databases (the reset only ever touches local Supabase).
- **E2E tests:** `node scripts/check.mjs build e2e`. Once per machine: `pnpm --filter web exec playwright install chromium`.
  They read `apps/web/.env.local` (local Supabase URL + anon + service-role keys; Stripe **test** keys for the checkout
  flow) and refuse a non-local database or a live Stripe key. They add two accounts to the local database
  (`e2e-admin@iwc.test`, `e2e-customer@iwc.test`), test orders, and archived test products; `check.mjs db` resets it.
- **Hosted dev DB reset (done 2026-09-29 by the founder):** the hosted dev project now has the new schema and the seeds.
  To reset it again (allowed for dev, D-013; the founder runs it, Claude never does):
  `npx supabase link --project-ref <dev project ref>` (once), then `npx supabase db reset --linked`. This drops everything
  in the hosted dev DB and applies `supabase/migrations/`. The CLI output lists which seed files it ran (`--no-seed` skips
  them); the seeds include the dev demo data (placeholders, `dev_preview` on). Never run it against production.
- **Local admin in one step:** `pnpm dev:admin <email> <password> [us|india]` (`scripts/dev-admin.mjs`, local database only)
- **Launch check (C8):** `pnpm launch:check` lists what still blocks going live (estimates, settings, placeholder or demo
  data, unapproved state text, a dev cycle, the timers and Vault settings, stuck emails, open launch questions,
  TODO(founder) markers on customer pages). Read-only. For production: `pnpm launch:check --url=<db url> --allow-remote`.
- **Pricing estimates (D-047, C6):** `pnpm dev:estimates` loads Claude's researched estimates (`supabase/seed/estimates.sql`,
  each with its source and date) into the local database without a reset, filling only empty settings; a local reset
  loads them too. For the hosted dev database, run that file in the SQL editor. In production the pilot runs on them
  (D-069): `pnpm prod:seed` loads them once with the regions and categories (below), and Settings shows each as a
  placeholder until the founder saves their own number.
  creates or refreshes the account with the role and the `admin_emails` row. Run it again after every `check.mjs db`
  (the reset deletes local accounts). The website also needs the email in `ADMIN_EMAILS` in `apps/web/.env.local`.
- Admin bootstrap (after the person has signed up once): `insert into admin_emails (email) values ('<email>')` and
  `update profiles set role = 'admin', desk = 'us' | 'india' where email = '<email>'`, **and** add the email to the
  `ADMIN_EMAILS` env var. All three are required (INV-7). The app guard enforces role + env since R3 (the old
  code accepted either one).

## Deploy (to be finalised, Q-9)
Manual only (D-044): Actions → **Deploy** → Run workflow, type `deploy`. It pushes new migrations to the production
Supabase project (never the seeds), triggers the Vercel deploy hook and starts EAS builds (no store submission). Run it
only on a commit whose CI run is green. **The website alone** deploys once a day (D-145): Actions → **Daily website
deploy** runs at 09:00 UTC, and when `main` changed in the last day and that commit's CI run is green it calls the Vercel
deploy hook (Run workflow on it deploys now). `apps/web/vercel.json` turns off Vercel's own deploy on every push, so a
push to `main` reaches customers by the next morning. A change that needs a new migration still waits for the Deploy
workflow, run first. The Deploy workflow's secrets (`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD`, `VERCEL_DEPLOY_HOOK_URL`, `EXPO_TOKEN`) belong to production and are set only once it exists.
**CI** (`ci.yml`) runs `node scripts/check.mjs` on every push and pull request to `main`, on a local Supabase inside the
runner. Optional secrets: `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_TEST_SECRET_KEY` (test keys only, for the checkout flow).
The old `NEXT_PUBLIC_SUPABASE_*` / `NEXT_PUBLIC_APP_URL` CI secrets are no longer read (B-15).

## Going live the first time (the founder runs every step; Claude never touches production)
1. **Supabase:** create the production project in a US region. Database → Extensions: `pg_cron` and `pg_net` are
   created by the migrations. Auth → URL configuration: the site URL.
2. **GitHub → Settings → Secrets → Actions:** `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
   `VERCEL_DEPLOY_HOOK_URL` (and `EXPO_TOKEN` once the app is built, step 9).
3. **Vercel:** import the repo, root directory `apps/web`, region US (Washington, D.C., `iad1`). Environment variables:
   every web row of the table above with **production** values: the production Supabase URL and keys, Stripe **live**
   keys, `RESEND_*`, a new long random `EMAIL_OUTBOX_CRON_SECRET` (never a dev one), `ADMIN_EMAILS`, the site URLs (the
   `*.vercel.app` address until the domain, Q-9). Create a deploy hook (Settings → Git → Deploy Hooks) for step 2.
4. **Deploy:** Actions → Deploy → `deploy` (migrations to production, then the Vercel build). The first build reads the
   empty catalogue; that is fine.
5. **Data, once:** `pnpm prod:seed --url=<production DB URL> --allow-remote` (dry run), then again with `--apply`: the 36
   states (text as drafts), the categories and the pilot numbers. Never `seed/demo.sql`; the placeholder catalogue only
   through the demo round (below).
6. **Vault (SQL editor):** the two `vault.create_secret` lines of §Email timer, with the production site URL and the
   same secret as `EMAIL_OUTBOX_CRON_SECRET`.
7. **Stripe:** add the webhook endpoint `<site>/api/webhooks/stripe` for the live account (event `payment_intent.succeeded`) and put its signing secret in
   `STRIPE_WEBHOOK_SECRET` on Vercel (redeploy).
8. **In the admin:** sign up, then the admin bootstrap of §Database workflow; approve and switch on the launch states
   (Regions); fill Settings → Business and compliance details; open the first cycle with real dates; list products.
   The first admin account: Supabase → Authentication → Users → Add user → Create new user (tick "Auto Confirm User"),
   then in the SQL editor (the email in lowercase) `insert into public.admin_emails (email, note) values ('<email>', 'founder');` and
   `update public.profiles set role = 'admin', desk = 'us' where id = (select id from auth.users where email = '<email>');`,
   and the same email in `ADMIN_EMAILS` on Vercel (redeploy). Sign in at `<site>/admin`. Supabase → Authentication →
   URL configuration: the site URL is the production website, so sign-up and password emails link there.
   `pnpm launch:check --url=<production DB URL> --allow-remote` must then end "Ready to launch".
   **Sign-in emails (D-091, B4):** in the hosted project's Authentication settings, add `<production website>/**` to
   the Redirect URLs (the reset link comes back to `/auth/callback`), and paste the two templates from
   `supabase/templates/`: `sign-in-code.html` into **Magic Link** (subject "Your sign-in code"; it must show
   `{{ .Token }}`, the six digits) and `reset-password.html` into **Reset Password** (subject "Set a new password").
   Their wording is a draft (D-059 voice); local Supabase reads them from `supabase/config.toml`.
9. **The app** is not on Vercel: EAS builds it (the Deploy workflow's last job, Android only until there is an Apple
   Developer account). EAS cloud builds never see `apps/app/.env`: the four public settings live in the EAS
   "production" environment, set once from `apps/app` (`eas login` first):
   `eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value <production Supabase URL>`,
   then the same for `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the production anon key), `EXPO_PUBLIC_API_URL` (the production
   website) and `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (the live publishable key). All four are public by design (they ship
   inside the app). The Deploy workflow's `android_profile` input picks `preview` (an APK to install on a phone from the
   EAS build page) or `production` (an AAB for Google Play). The app's id is `com.indianwholesaleclub.app` (`app.json`,
   set by the founder on 2026-10-07); Google Play never lets it change after the first upload.

## Moving to new Vercel or Supabase accounts (the founder runs every step; done 2026-10-21/22)
The code names no account: everything comes from the variables above, the GitHub secrets and the Vault. A move is
those values, nothing in the repo. Both providers' free-plan terms apply to the new accounts too (Vercel's Hobby plan
is for non-commercial use). The old account used 208K of Vercel's 200K page-cache writes by 2026-10-21, mostly
whole-store refreshes and deploys rewriting 2 MB state pages; D-145 cuts both, so a new account should stay under.
**Vercel (about 30 minutes, a few minutes offline):**
1. Old account: `vercel env pull C:\iwc\vercel-prod.env --environment=production` (outside the repo: the file holds
   every production secret), or copy each
   Production variable from Settings → Environment Variables.
2. New account (Hobby). Import the GitHub repo: root directory `apps/web`, framework Next.js. If Vercel says the
   GitHub account is linked to another Vercel account, disconnect it in the old one (Account Settings →
   Authentication) first. Paste every variable of step 1 as Production. Settings → Functions → region `iad1`.
3. Settings → Git → Deploy Hooks → create one; put its URL in GitHub → Settings → Secrets → `VERCEL_DEPLOY_HOOK_URL`.
4. Deploy. Check the new `*.vercel.app` address: Home, a state, a product page, a photo (`/media/s/…`), `/admin`.
5. Keep the same address: delete the old project, then in the new one Settings → Domains → add
   `the-indian-wholesale-club.vercel.app`. If the name is not free, the new address must replace the old one in:
   `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_APP_URL` (redeploy), the Stripe webhook endpoint, Supabase → Authentication
   → URL configuration (site URL and Redirect URLs), the Vault's `iwc_site_url` (below), the EAS `EXPO_PUBLIC_API_URL`.
**Supabase (1 – 2 hours; only if the old project would be restricted):** the photos are in R2, so its storage holds
nothing to move. Supabase's guide "Backup and restore using the CLI" (Platform → Migrating within Supabase):
1. New account and project, US East. Its database password and connection string (Connect → Session pooler).
2. Stop changes: no imports, the sourcing runner off, for the hour.
3. `npx supabase db dump --db-url <old> -f roles.sql --role-only`, then `-f schema.sql`, then
   `-f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"`, and the migration
   history: `npx supabase db dump --db-url <old> -f history.sql --data-only --schema supabase_migrations`.
4. From the folder holding the four files (outside the repo: `data.sql` holds every account and address):
   `psql --single-transaction --variable ON_ERROR_STOP=1 --file roles.sql --file schema.sql --command "SET session_replication_role = replica" --file data.sql --command "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text); truncate supabase_migrations.schema_migrations" --file history.sql --command "NOTIFY pgrst, 'reload schema'" --dbname <new>`.
   One transaction: any error undoes it all and the new database stays empty (on 2026-10-21 `history.sql` alone
   failed, its table does not exist in a new project, and the build then said `store_home` was missing; a second time
   its rows were already there from `migration repair`, hence the truncate). Checked on a
   local Supabase 17 the same day: 8,032 listings, 82 migrations, the Realtime tables, about 5 seconds.
5. What no dump carries, in the SQL editor of the new project: the three timers,
   `select cron.schedule('iwc-roll-cycles', '* * * * *', 'select public.roll_cycles()');`,
   `select cron.schedule('iwc-email-outbox', '* * * * *', 'select public._kick_email_outbox()');`,
   `select cron.schedule('iwc-fx-refresh', '*/10 * * * *', 'select public._fx_refresh()');`; and the Vault (its key stays
   with the old project): the two `vault.create_secret` lines of §Email timer, with the new site URL.
6. Authentication: site URL, Redirect URLs, the two email templates (step 8 of §Going live). Accounts and passwords
   move with the data; everyone signs in again once.
7. New keys everywhere: Vercel `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (redeploy); GitHub secrets `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_DB_PASSWORD`; the hub PC's `tools/sourcing-runner/.env` (and the photo worker's, the weight estimator's)
   `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY`; EAS `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then a
   new app build; `move.env`.
8. Check: `pnpm launch:check --url=<new> --allow-remote`, then one real order (live keys refuse test cards), refunded
   from the admin. Pause the old project a week later.

## Demo round and placeholders (D-078, D-108; done)
Production has no placeholder listings left (checked on the copy of 2026-10-21). The demo round and the placeholder
clearing are in `docs/archive/ops-demo-round.md`; `pnpm demo:load` / `demo:clear` still work against a local database.

## Tools on the founder's machines
Nothing on the website depends on them: when a machine is off, work waits in the database. Each uses the `worker`
account, whose role can only run the `worker_*` functions (`data-model.md`).

### Photo worker (D-101, D-103; the founder runs every step on production)
The AI product photos are made on the founder's laptop by `tools/photo-worker` (its README has setup and running).
For production, once:
1. Supabase dashboard (production) → Authentication → Add user: an email of your choice (e.g. a `+worker` alias)
   and a long password, "Auto confirm". Then SQL editor: `update public.profiles set role = 'worker' where email =
   '<that email>';`. The account can only take photo jobs and use the two photo buckets (`data-model.md`).
2. `tools/photo-worker/.env` (you write it, never committed): `IWC_SUPABASE_URL` and `IWC_SUPABASE_ANON_KEY` (the
   production project's public URL and anon key, as in the app), `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`.
3. The chosen house models (6 – 7, D-102) uploaded to `product-media/house-models/<slug>/front.jpg` and `back.jpg` with
   a `house_models` row each (the admin screen comes with V3).
4. Start it with Windows (README, Task Scheduler). When the laptop is off, pieces wait in the queue; nothing breaks.
Locally, `pnpm dev:photo-e2e <front> <back> <close-up> --house=<front>,<back>` makes the worker account, signs in as a
vendor, uploads a piece through the vendor's storage rules and queues its jobs.

### Photo redo (D-163; the founder runs every step on production)
Every listing's photos made again on the laptop: `tools/photo-redo/README.md` (fetch, make, review, publish, and the R2
audit). Once: run the Deploy workflow (migration `20261102090000_photo_redo`), give the laptop the sourcing runner's
`.env` (or `tools/photo-redo/.env` with the same keys), and keep the house models as one folder each in
`C:\kod\iwc-photo-models\house-models\` (`w-1\front.jpg` …; `m-1\` … for men). Start with `--limit 30` per type and look at the review page.

### Sourcing runner (D-118; the founder runs every step on production)
Auto-sourcing and the weekly price and stock check run on a PC **in India** by `tools/sourcing-runner` (its README has
setup and running). For production, once:
1. The worker account (above) works; the role `worker` can also run the `worker_sourcing_*` functions and add photos
   to a listing the runner made (`data-model.md`).
2. `tools/sourcing-runner/.env` (you write it, never committed): `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY`,
   `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`; optionally `IWC_SOURCING_PROFILE` (the browser profile folder),
   `IWC_SOURCING_CHANNEL` (`chrome`, `msedge`, `chromium`). `IWC_SOURCING_HEADLESS` is ignored (D-151): Blinkit's
   Cloudflare blocks headless Chrome, so the runner always opens a window, off-screen.
3. `pnpm sourcing setup`, then the hub's address on every shop that opens (Blinkit, Zepto, Instamart, BigBasket: the
   address; Amazon, Flipkart, Myntra: the pincode). Then the targets: Admin → Import → Auto-sourcing → Add targets from
   a CSV (the state bestseller list).
4. Task Scheduler runs `pnpm sourcing run` daily (README). When the PC is off nothing is added or checked; listings keep
   their last checked price and stock, and the admin page shows the last run.
5. **7-day sources (D-162), once after the Deploy workflow has applied `20261101090000_quick_sources`:** on any PC with
   the repo, `pnpm quick:sources -- --env=C:iwcmove.env --allow-remote` (the same file as `photos:move`:
   `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` of production; it writes nothing and lists how many
   listings would be bought from the quick shops instead of a cheaper backup, a sample with both prices, and sites that
   look like a quick shop but are not marked one), then the same with `--apply` (batches of 100 until none is left;
   safe to run again). New and re-checked listings need nothing: the runner's database functions choose the quick shop.

### Weight estimator, clothing classes, food and home weights, liquids (D-131 – D-135; the founder runs them on production)
`tools/weight-estimator` gives listings a packed weight on the founder's laptop GPU (its README has setup and running).
It uses the worker account and reads `tools/sourcing-runner/.env` when it has no `.env` of its own, so on a laptop with
the runner's settings it works on **production** at once. Once: `winget install Ollama.Ollama`, `ollama pull
qwen2.5:7b`, `ollama pull nomic-embed-text`, `pnpm weights doctor`. Then `pnpm weights run --dry --limit 20` to look,
and `pnpm weights run` (any time; what it wrote stays if it is stopped). Clothing first:
`pnpm weights classes --dry` (open `tools/weight-estimator/clothing-classes.csv`), then `pnpm weights classes`. Food
(D-133, no Ollama needed): `pnpm weights food --dry` (open `tools/weight-estimator/food-weights.csv`), then, after the
Deploy workflow has applied migration `20261016160000_food_weights`, `pnpm weights food` (the replaced weights are kept
in `food-weights-before.jsonl`); the runner does the same at the end of every `pnpm sourcing run`. Home (D-134)
reads shop pages, so it runs in the sourcing runner's browser: `pnpm sourcing home --dry` (open
`tools/sourcing-runner/home-weights.csv`), then `pnpm sourcing home` after the deploy. Liquids (D-135):
`pnpm sourcing liquids --dry`, then `pnpm sourcing liquids` after migration `20261016200000_coming_soon`. Nothing on the
website depends on the laptop.

## Git
GitHub `yobslob/The-Indian-Wholesale-Club`, branch `main` (D-014). Claude commits in `C:\kod\root` and the founder pushes.
Baseline tag `pre-restructure` = the whole pre-IWC codebase (stealth layer included, for reference only).

## Compliance checklist (not legal advice. Confirm with a customs broker / US lawyer)
Recorded because they shape the data model and flows. Each needs an owner before launch.
| Area | Requirement (as understood 2026-09-27) | Where it lands in the product |
|---|---|---|
| Clothing labels | garments need country-of-origin ("Made in India"), fibre-content and care labels. Online listings must say "Imported" (FTC textile rules) | origin line on product pages (D-004). Intake records whether a label is attached |
| Spices (food) | FDA food-facility registration of the maker/packer, FDA Prior Notice for each shipment, importer duties under FSVP, English labels (ingredients, net weight, allergens, origin) | spice listings stay unpublished until Q-10 is answered (D-032). `vendors.licences` stores the numbers |
| Delivery promises | FTC Mail/Internet Order Rule: ship within the stated time (30 days if none stated), delays need customer consent with a refund option | delivery windows + delay flow (D-008, `flows.md` §7) |
| Export from India | the exporting entity needs an IEC (Importer-Exporter Code) | cycle export documents |
| Sales tax | US state sales tax obligations | charged per delivery state where IWC is registered (New Jersey now, `tax_rates`, D-073); every cancel refunds the tax. An accountant should confirm the rates and thresholds |
| Privacy | privacy policy + terms for a US site | info pages (founder input needed) |

## Photos: the photo store (D-140, D-141, D-142)
The move is finished (2026-10-21: 23,412 photos moved, 15,206 repeats dropped; on the copy of 2026-10-21 every listing,
album and state photo has an `s/` path). The steps below stay for a new bucket or account.
Photos live in Cloudflare R2 as two AVIF copies each (640 and 1200 px; engineering.md PR-6), not in Supabase's storage
(1 GB on the free plan; production held 7.9 GB on 2026-10-20) and not through Vercel's image resizer (5,000 a month,
then 402 on 2026-10-18). R2 is free up to 10 GB stored, with no charge for traffic; the photos need about 4 GB.
**Set up once (the founder):**
1. Cloudflare dashboard → R2 → subscribe to the free plan (asks for a card or PayPal; nothing is charged under 10 GB
   a month) → Create bucket `iwc-photos` (Standard storage).
2. The bucket → Settings → Public access → R2.dev subdomain → Allow. Copy its address, `https://pub-<id>.r2.dev`.
3. R2 → Manage API tokens → Create API token: Object Read & Write, this bucket only. Copy the Access Key ID, the
   Secret Access Key and the S3 address, `https://<account-id>.r2.cloudflarestorage.com`.
4. Vercel → the project → Settings → Environment Variables, Production: `PHOTO_STORE_S3_URL` =
   `https://<account-id>.r2.cloudflarestorage.com/iwc-photos`, `PHOTO_STORE_KEY_ID`, `PHOTO_STORE_SECRET`,
   `PHOTO_STORE_PUBLIC_URL` = the r2.dev address. Then run the Deploy workflow (it applies
   `20261020090000_photo_store`). From then on every new photo from the website or the phone goes to R2.
   `PHOTO_STORE_PUBLIC_URL` is read when the site is built (the `/media/s/` route; `turbo.json` passes it to the
   build, whose strict mode drops any variable not listed there): after changing it, deploy again. A production build
   without it stops with an error (until 2026-10-21 it was dropped, and every moved photo answered 404).
5. The hub PC: pull the code; in `tools/sourcing-runner/.env` add `IWC_PHOTO_STORE_S3_URL` (same value),
   `IWC_PHOTO_STORE_KEY_ID`, `IWC_PHOTO_STORE_SECRET`. The runner then writes its photos to R2 itself.
**Move the older photos** (from a computer; every download counts as Supabase egress, 5 GB a month free, so each
run stops at `--max-gb`, default 2.5):
6. A file outside the repo, e.g. `C:\iwc\move.env`, with `NEXT_PUBLIC_SUPABASE_URL` (production),
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API keys) and the four `PHOTO_STORE_*` lines.
7. `pnpm photos:move -- --env=C:\iwc\move.env --allow-remote --dry` (says which database and how many), then
   `pnpm photos:move -- --env=C:\iwc\move.env --allow-remote --review=30` (D-142: reads 30 live listings, changes
   nothing, and puts each photo it would drop beside the one it keeps in `.checks/photo-repeats/`; about 25 MB of
   egress), then `pnpm photos:move -- --env=C:\iwc\move.env --allow-remote`. Most needed first: live listings' main
   photos (1.1 GB), then each live listing whole (4.3 GB), drafts (1.9 GB), archived, album, state and review photos.
   A listing's repeats (Amazon's 500-pixel previews, about a third of the photos) are dropped as it moves: the
   full-size file stays, in the first one's place. It removes moved and dropped photos' old files 10 minutes later
   (cached store pages may name them until then). Check Supabase → Usage → Egress before each run; run again (next
   month if needed) until it moves 0.
8. `pnpm photos:move -- --env=C:\iwc\move.env --allow-remote --clean` downloads nothing: it removes Supabase files no
   row names and older than a day (abandoned uploads, the WebP copies of 2026-10-19; 40 files, 18 MB, on 2026-10-20; it lists 1,000 files a request, about a minute).
**Check:** a store page's photos come from `/media/s/…avif`; `curl -I` the same photo twice shows
`x-vercel-cache: HIT` the second time. If it stays MISS, turn on "honor Cache-Control for external rewrites" in the
Vercel project's settings (projects older than 2026-04-06 have it off). Supabase answers set a cookie, so photos still
in Supabase's storage are never kept by Vercel's CDN. Supabase's "Storage Size" usage is averaged over the billing
period, so it falls over days after the move.
