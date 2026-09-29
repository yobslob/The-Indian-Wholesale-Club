# Ops: environments, env vars, database, deploy, compliance

## Environments
| Env | Web | DB | Notes |
|---|---|---|---|
| dev | `pnpm dev` on the founder's machine | **local Supabase** (Docker) via `apps/web/.env.local`; the hosted dev project has the same schema since 2026-09-29 (D-013) | `next build` reads the DB since R5 (static pages), so the DB it points at must have the new schema |
| prod | not set up yet. Vercel is the likely host, US region (Q-9) | a separate Supabase project in a US region | hosted in the US (D-003) |

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
serves checkout for the app). Phone and computer on the same Wi-Fi; Windows may ask to allow Node.js and Docker on private
networks. Stripe: the same test publishable key as the web. Then `pnpm --filter app dev` and open it in Expo Go.
The app pins `@stripe/stripe-react-native` to the version Expo Go carries for SDK 52 (the JavaScript and Expo Go's native
module must match; B-9). After changing dependencies or `.npmrc`, start with `npx expo start --clear` (in `apps/app`) so
Metro drops its cache. The app's web target is not used (customers get the Next.js website); test on a phone.

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
| Sales tax | US state sales tax obligations | flat 8% estimate (D-033). The tax kept on customer cancellations (D-042) needs an accountant's OK (Q-19) |
| Privacy | privacy policy + terms for a US site | info pages (founder input needed) |
