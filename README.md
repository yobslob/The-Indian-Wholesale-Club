# The Indian Wholesale Club (IWC)

A US storefront (web + iOS/Android app) for the clothing and spices of India's regions.
Monorepo: Next.js web · Expo app · Supabase · Stripe.

- **Start here:** [`CLAUDE.md`](CLAUDE.md), the project rules, map and doc index (for people and for Claude).
- **Docs:** [`docs/`](docs/) · status: [`docs/plan/current.md`](docs/plan/current.md)

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
