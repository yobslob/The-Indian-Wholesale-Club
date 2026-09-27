# Ops: environments, env vars, database, deploy, compliance

## Environments
| Env | Web | DB | Notes |
|---|---|---|---|
| dev | `pnpm dev` on the founder's machine | hosted Supabase dev project (may be reset, D-013) | the new schema is built and tested on local Supabase in Docker first (D-031) |
| prod | not set up yet. Vercel is the likely host, US region (Q-9) | a separate Supabase project in a US region | hosted in the US (D-003) |

## Environment variables
Names only. Values live in `.env` files that are **never committed**. The templates are `apps/web/.env.example` and `apps/app/.env.example`.
Reading `process.env.X` for a variable not listed here = add it here in the same commit.
| Variable | Used by | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | Supabase client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | web server only | service client for webhooks/jobs. Never in client code |
| `DATABASE_URL` | scripts | direct Postgres (migrations, seed) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | payments (test-mode keys in dev) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EMAIL_OUTBOX_CRON_SECRET` | web | email + outbox job |
| `ADMIN_EMAILS` | web server | admin email allowlist (D-006, INV-7) |
| `ADMIN_ALERT_WEBHOOK_URL` | web server | optional ops alerts |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | web | absolute URLs |
| `CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_EMAIL` | web | support address (Q-9) |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | app | app clients |
**To remove in R2:** `CARRIER_WEBHOOK_SECRET` (carrier webhook deleted until a US label provider is chosen),
`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (unused), `TRACKING_PROXY_API_URL`, `TRACKING_PROXY_API_KEY` (stealth
layer, D-004), `DIRECT_URL` (unused by code).

## Database workflow (from R3)
- Schema changes = a new file in `supabase/migrations/`. Never edit an applied migration.
- Generate types after every schema change into `packages/db` (the command is added in R4 as a root script).
- Reset dev = apply the baseline + `seed/regions.sql` + `seed/categories.sql` (+ `seed/demo.sql` in dev only).
- R3 builds the new schema on local Supabase (Docker, D-031). The hosted dev DB is wiped to the new schema only in R5, once the app
  code matches (allowed, D-013). Claude still announces it before running.
- Admin bootstrap: set `profiles.role = 'admin'` and `desk` for the founder and COO emails, and list them in `ADMIN_EMAILS`.

## Deploy (to be finalised, Q-9)
`.github/workflows/deploy.yml` (old) pushes migrations, triggers Vercel and runs EAS builds. It gets reviewed in R7. CI runs lint,
typecheck and tests on every push.

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
| Sales tax | US state sales tax obligations | flat 8% estimate (D-033) |
| Privacy | privacy policy + terms for a US site | info pages (founder input needed) |
