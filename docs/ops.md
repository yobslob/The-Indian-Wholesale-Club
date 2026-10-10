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
| `SUPABASE_TEST_DB_URL` | `scripts/db-test.mjs` | optional; defaults to local Supabase. Non-local hosts are refused unless `--allow-remote` is passed (never do that against production) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | payments (test-mode keys in dev) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_OUTBOX_CRON_SECRET` | web | email + outbox job (`POST /api/internal/email-outbox` with `Authorization: Bearer <secret>`; without email keys, emails wait in the outbox). The sender's domain must be verified in Resend (Q-9). For local tests before that, Resend accepts `onboarding@resend.dev` as the sender, delivering only to the Resend account's own address |
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
