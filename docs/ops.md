# Ops: environments, env vars, database, deploy, compliance

## Environments
| Env | Web | DB | Notes |
|---|---|---|---|
| dev | `pnpm dev` on the founder's machine | **local Supabase** (Docker) via `apps/web/.env.local`; the hosted dev project has the same schema since 2026-09-29 (D-013) | `next build` reads the DB since R5 (static pages), so the DB it points at must have the new schema |
| prod | Vercel (since 2026-10-06; the domain waits on Q-9) | a separate Supabase project in us-east-1 (North Virginia) | hosted in the US (D-003). The Android app is built by EAS; iOS waits for an Apple Developer account |

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
only on a commit whose CI run is green. Its secrets (`SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`,
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

## Demo round (D-078)
The first cycle runs as a demo on the placeholder catalogue of five states, then everything is removed again.
1. **Photos (once, on the founder's machine):** `pnpm demo:photos` fills `catalogue/photos/` with public-domain
   stand-ins (museum collections and stock product photos, Openverse; paced to its 200 searches a day and cached).
   Look at them; put any photo to drop in `catalogue/demo-photo-exclude.txt` (its id is in the folder's `source.json`),
   delete that folder and run it again.
2. **Stripe test mode:** on Vercel set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` to the **test** keys and
   `STRIPE_WEBHOOK_SECRET` to the signing secret of a **test-mode** webhook endpoint (`<site>/api/webhooks/stripe`,
   `payment_intent.succeeded`), then redeploy. The app: the EAS variable `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the test
   key, then a new build.
3. **Load:** `pnpm demo:load --url=<production DB URL> --api=https://<ref>.supabase.co --service-key=<service role key>
   --allow-remote` (a dry run), then again with `--apply`: the catalogue of Delhi, Maharashtra, Kerala, Assam and Punjab,
   the photos, labelled demo reviews from eight demo reviewer accounts, demo mode on (the banner on every page).
4. Run the demo cycle as usual (admin: open a cycle with real dates; testers pay with card 4242 4242 4242 4242).
5. **Clear:** `pnpm demo:clear` with the same flags (a dry run counts what goes), then with `--apply`: every placeholder
   product with its photos and reviews, every order containing one, the placeholder shops, the demo reviewers, the demo
   state photos; demo mode off. Then switch Vercel and the app back to the **live** Stripe keys and webhook secret.

## Clearing the placeholder catalogue (D-108, D-110)
The 2,880 placeholder listings of the master catalogue (D-108) are removed with `pnpm demo:clear --url=<production DB
URL> --api=https://<ref>.supabase.co --service-key=<service role key> --allow-remote` (a dry run that counts), then
again with `--apply`. It removes every placeholder product with its photos, sizes and reviews, the orders that
contain one, the placeholder shops, and turns demo mode off; real and imported listings stay. The loader itself was
removed (D-110): pilot listings now come from **Import from shops** (`/admin/import`, `admin.md`).

## Photo worker (D-101, D-103; the founder runs every step on production)
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

## Sourcing runner (D-118; the founder runs every step on production)
Auto-sourcing and the weekly price and stock check run on a PC **in India** by `tools/sourcing-runner` (its README has
setup and running). For production, once:
1. The worker account (above) works; the role `worker` can also run the `worker_sourcing_*` functions and add photos
   to a listing the runner made (`data-model.md`).
2. `tools/sourcing-runner/.env` (you write it, never committed): `IWC_SUPABASE_URL`, `IWC_SUPABASE_ANON_KEY`,
   `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`; optionally `IWC_SOURCING_PROFILE` (the browser profile folder),
   `IWC_SOURCING_CHANNEL` (`chrome`, `msedge`, `chromium`) and `IWC_SOURCING_HEADLESS` (`1` = no window).
3. `pnpm sourcing setup`, then the hub's address on every shop that opens (Blinkit, Zepto, Instamart, BigBasket: the
   address; Amazon, Flipkart, Myntra: the pincode). Then the targets: Admin → Import → Auto-sourcing → Add targets from
   a CSV (the state bestseller list).
4. Task Scheduler runs `pnpm sourcing run` daily (README). When the PC is off nothing is added or checked; listings keep
   their last checked price and stock, and the admin page shows the last run.

## Weight estimator, clothing classes, food and home weights, liquids (D-131 – D-135; the founder runs them on production)
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
GitHub `yobslob/The-Indian_Wholesale-Club`, branch `main` (D-014). Claude commits in `C:\kod\root` and the founder pushes.
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
