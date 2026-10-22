# The Indian Wholesale Club (IWC)

A US storefront (web + Android app) for the clothing, food and home goods of India's regions.
Monorepo: Next.js web · Expo app · Supabase · Stripe · photos in Cloudflare R2. Live at
https://the-indian-wholesale-club.vercel.app.

- **Start here:** [`CLAUDE.md`](CLAUDE.md), the project rules, map and doc index (for people and for Claude).
- **Status and next steps:** [`docs/status.md`](docs/status.md) · production checks: [`docs/monitoring.md`](docs/monitoring.md)

## Setup
```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # fill in values
cp apps/app/.env.example apps/app/.env   # fill in values
pnpm dev
```

## Verify (lint, typecheck, tests, build, route timings)
```bash
node scripts/check.mjs            # writes .checks/latest.json
```

Private & proprietary. All rights reserved.
