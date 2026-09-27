# ROOT — Stealth Apparel E-Commerce Monorepo

> **Production-grade cross-border apparel platform with seamless US-native presentation, direct-to-consumer storefront, native mobile application, admin operations center, and automated stealth logistics engine.**

---

## ⚡ Tech Stack

| Layer               | Technologies                                                                         |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Web Storefront**  | Next.js 15 (App Router), React 19, Tailwind CSS, Shadcn UI primitives, Framer Motion |
| **Mobile App**      | Expo SDK 52, React Native 0.76, Expo Router 4, NativeWind 4, Zustand                 |
| **Monorepo**        | Turborepo, pnpm workspaces, TypeScript 5.6 (strict mode)                             |
| **Database & Auth** | Supabase (PostgreSQL 15), Row-Level Security (RLS), Triggers, Storage                |
| **Payments**        | Stripe Elements & PaymentIntents with automatic Test Mode Simulator                  |
| **Logistics**       | Custom Stealth Origin Sanitizer Proxy (`Carrier Regional Hub` masking)               |
| **Emails**          | Resend with responsive HTML receipt templates and US virtual address footer          |
| **Testing**         | Node.js native test runner (`node:test`, `node:assert`) + `tsx`                      |

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js**: `v20.x` or later (`node -v`)
- **pnpm**: `v9.x` (`npm install -g pnpm`)

### 2. Installation

```bash
# Clone the repository
git clone <repo-url>
cd root

# Install dependencies across all packages
pnpm install

# Copy environment variables template
cp .env.example .env
```

### 3. Run Development Servers

```bash
# Start both Web (localhost:3000) and Mobile (Expo) simultaneously
pnpm dev

# Or start Web storefront only
pnpm --filter web dev

# Or start Mobile app Metro bundler only
pnpm --filter app dev
```

---

## 📂 Project Structure

```text
root/
├── apps/
│   ├── web/                    # Next.js 15 Web Application
│   │   ├── app/                # Storefront, checkout, customer portal, /admin
│   │   ├── components/         # Shared UI, layout, product, cart, admin components
│   │   └── lib/                # Stripe, Supabase, Resend, and logistics engines
│   └── app/                    # Expo SDK 52 / React Native Mobile Application
│       ├── app/                # Expo Router 4 file-based navigation ((tabs), product, bag)
│       ├── components/ui/      # NativeWind mobile components (cards, selectors, timelines)
│       └── lib/                # Zustand cart & wishlist stores, catalog data layer
├── packages/
│   ├── shared/                 # Shared models, Zod validation schemas, utils, test suites
│   ├── typescript-config/      # Base, Next.js, and React Native tsconfig presets
│   └── eslint-config/          # Shared ESLint configuration with strict import sorting
├── supabase/
│   ├── migrations/             # 4 PostgreSQL migrations (13 tables, RLS, triggers)
│   └── seed.sql                # Production seed catalog (products, variants, promos)
└── docs/                       # Comprehensive platform documentation & runbooks
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env`. The platform includes automatic fallback sandboxes so you can browse, add to bag, and complete orders even before configuring external API keys.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Expo (React Native)
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (Email)
RESEND_API_KEY=re_test_...

# Stealth Logistics Proxy
TRACKING_PROXY_API_URL=http://localhost:3000/api/tracking
TRACKING_PROXY_API_KEY=dev_proxy_secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

_For detailed explanations of every variable, see [docs/10-complete-user-and-developer-guide.md](docs/10-complete-user-and-developer-guide.md)._

---

## 🛠️ Monorepo Commands

| Command                | Action                                                  |
| ---------------------- | ------------------------------------------------------- |
| `pnpm dev`             | Start development servers for all workspaces            |
| `pnpm build`           | Build production bundles across all packages            |
| `pnpm test`            | Run automated unit & integration test suites (18 tests) |
| `pnpm turbo typecheck` | Run strict TypeScript compiler verification (0 errors)  |
| `pnpm turbo lint`      | Run strict ESLint verification (0 warnings)             |
| `pnpm format`          | Format entire codebase using Prettier                   |
| `pnpm format:check`    | Verify formatting consistency                           |

---

## 🌟 Key Features

### 🛍️ Web Storefront (`apps/web`)

- **Editorial Homepage**: Hero banner, category grid, trending drops, and brand philosophy.
- **Dynamic Catalog**: Multi-attribute filtering, price/newest sorting, and pagination.
- **Command-K Search Modal**: Instant search dialog accessible anywhere via keyboard shortcut.
- **Interactive PDP**: Multi-angle image viewer, size & color selectors, stock inventory indicators, and care tabs.
- **Slide-out Cart Drawer**: Framer Motion drawer with free shipping progress meter ($75 threshold).
- **Multi-step Checkout (`/checkout`)**: Shipping address validation, delivery tier selection, Stripe Elements, and automatic sandbox test simulator.
- **Promo Codes**: Supported codes include `WELCOME10` (10% off), `ROOT20` (20% off), `STEALTH15` (15% off), and `FREESHIP`.
- **Guest Order Lookup (`/order-lookup`)**: Instant tracking retrieval without mandatory account creation.

### 📱 Native Mobile App (`apps/app`)

- **5 Bottom Tabs**: Shop, Search, Bag, Wishlist, and Profile with dynamic notification badges.
- **NativeWind Design System**: Styled to match ROOT obsidian/zinc minimalist aesthetic.
- **Offline & Instant Demo Preview**: Fallback catalog ensures pristine preview even when disconnected.
- **Mobile Checkout & Confirmation**: Address entry, simulated card/Apple Pay, and order receipts.
- **Mobile Stealth Tracking**: Milestone timeline with domestic routing status.
- **EAS Build Ready**: Configured `eas.json` for development, preview, and production builds.

### 🛡️ Admin Dashboard & Logistics Center (`/admin`)

- **KPI Metrics**: Real-time revenue, order volume, AOV, and low-stock alerts.
- **Order Management**: Status transitions (`processing` → `shipped` → `in_transit` → `delivered`).
- **Stealth Logistics Command Center (`/admin/logistics`)**: Interactive simulator to test and verify carrier origin masking.
- **Inventory Matrix (`/admin/inventory`)**: SKU-level stock adjuster with inline `+` / `-` stepper.
- **Promo Code Suite (`/admin/promo-codes`)**: Create, monitor, and toggle discount codes.
- **Telemetry Health Route (`/api/health`)**: Public status endpoint for external uptime probes.

### 📦 Stealth Logistics Origin Masking

- Sanitization engine intercepts foreign origin markers (`Delhi`, `Mumbai`, `IGI Airport`, customs export scans) and converts them into US domestic partner delivery terminology (`Carrier Regional Hub`, `Package processing at regional hub`, `Shipment in transit`).
- Zero international origin disclosures across tracking pages, customer receipts, or transactional emails.

---

## 📚 Documentation Index

Comprehensive technical documentation is maintained in the [`docs/`](docs/) directory:

1. [01 - Architecture & Monorepo Stack](docs/01-architecture-and-stack.md)
2. [02 - Database Schema & RLS Policies](docs/02-database-schema-and-rls.md)
3. [03 - Design System & Branding Primitives](docs/03-design-system-and-branding.md)
4. [04 - Backend API & Integrations](docs/04-backend-api-and-integrations.md)
5. [05 - Stealth Logistics & Checkout Specification](docs/05-stealth-logistics-and-checkout.md)
6. [06 - Web Storefront Implementation Plan](docs/06-web-implementation-plan.md)
7. [07 - Mobile App Implementation Plan](docs/07-mobile-app-implementation-plan.md)
8. [08 - Roadmap & Milestones](docs/08-roadmap-and-phases.md)
9. [09 - Launch Checklist & Operations Runbook](docs/09-launch-checklist-and-runbook.md)
10. [10 - Complete User & Developer Manual](docs/10-complete-user-and-developer-guide.md)
11. [STATUS - Project Milestone Tracker](docs/STATUS.md)

---

## 📄 License

Private & Proprietary — ROOT Apparel Inc. All rights reserved.
