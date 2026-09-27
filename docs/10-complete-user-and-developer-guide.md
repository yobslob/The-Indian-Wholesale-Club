# 10 - Complete User & Developer Manual: ROOT Platform

> Comprehensive reference guide covering all environment variables, monorepo architecture, storefront, mobile application, admin dashboard, stealth logistics engine, and API routes.

---

## 1. System Overview & Architecture

**ROOT** is a full-stack, enterprise-grade e-commerce apparel platform operating as a cross-border direct-to-consumer brand. It presents a 100% US-native aesthetic and domestic logistics experience while fulfilling precision-crafted garments.

### Monorepo Map

```text
root/
├── apps/
│   ├── web/                    # Next.js 15 (App Router, Tailwind CSS, Shadcn UI)
│   │   ├── app/                # Public storefront, checkout, customer portal, admin dashboard
│   │   ├── components/         # Reusable React components (layout, catalog, product, cart, admin)
│   │   └── lib/                # Stripe, Supabase, Resend, and stealth logistics engines
│   └── app/                    # Expo SDK 52 / React Native (NativeWind, Expo Router 4)
│       ├── app/                # File-based navigation ((tabs), product/[id], bag/checkout, etc.)
│       ├── components/ui/      # NativeWind mobile primitives (cards, selectors, timelines, headers)
│       └── lib/                # Zustand stores (cart, wishlist) and catalog queries
├── packages/
│   ├── shared/                 # Shared TypeScript models, Zod validation schemas, utils, constants
│   │   ├── src/types/          # Supabase PostgreSQL types, order models, tracking models
│   │   ├── src/schemas/        # Zod validation schemas (address, checkout, admin)
│   │   ├── src/utils/          # Currency formatters, slugs, stealth-sanitizer engine
│   │   └── tests/              # Automated unit and integration test suites
│   ├── typescript-config/      # Base, Next.js, and React Native tsconfig definitions
│   └── eslint-config/          # Shared linting rules (import sorting, strict code standards)
├── supabase/
│   ├── migrations/             # 4 PostgreSQL migrations (13 tables, RLS policies, triggers, storage)
│   └── seed.sql                # Baseline production seed data (products, variants, categories, promos)
└── docs/                       # Technical specifications, phase roadmaps, runbooks
```

---

## 2. Complete Environment Variables Dictionary

All environment variables are declared in `.env.example` at the repository root. Copy this file to `.env` or set them in your hosting environment (Vercel, Supabase, Expo EAS).

### Configuration Matrix

| Variable                             | Target Apps   | Description                                                | Example / Default                                         | Required in Prod?     |
| ------------------------------------ | ------------- | ---------------------------------------------------------- | --------------------------------------------------------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | `apps/web`    | Public URL of your Supabase project instance               | `https://xyzcompany.supabase.co`                          | **Yes**               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | `apps/web`    | Public Anon key for client-side queries protected by RLS   | `eyJhbGciOi...`                                           | **Yes**               |
| `SUPABASE_SERVICE_ROLE_KEY`          | `apps/web`    | Secret service role key for admin operations bypassing RLS | `eyJhbGciOi...`                                           | **Yes** (Server-only) |
| `DATABASE_URL`                       | Backend / CLI | Direct PostgreSQL connection string for migrations         | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Optional (local dev)  |
| `EXPO_PUBLIC_SUPABASE_URL`           | `apps/app`    | Public Supabase URL exposed to the mobile app bundle       | `https://xyzcompany.supabase.co`                          | **Yes** (Mobile)      |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`      | `apps/app`    | Public Anon key exposed to the mobile app bundle           | `eyJhbGciOi...`                                           | **Yes** (Mobile)      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `apps/web`    | Public Stripe key for mounting Stripe Elements in checkout | `pk_test_...` or `pk_live_...`                            | **Yes**               |
| `STRIPE_SECRET_KEY`                  | `apps/web`    | Secret Stripe key for server-side PaymentIntent operations | `sk_test_...` or `sk_live_...`                            | **Yes**               |
| `STRIPE_WEBHOOK_SECRET`              | `apps/web`    | Secret signature for validating incoming Stripe webhooks   | `whsec_...`                                               | **Yes**               |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`        | `apps/web`    | Public key for optional secondary international gateway    | `rzp_test_...`                                            | Optional              |
| `RAZORPAY_KEY_SECRET`                | `apps/web`    | Secret key for secondary gateway verification              | `secret_test_...`                                         | Optional              |
| `RESEND_API_KEY`                     | `apps/web`    | API key for transactional email dispatch via Resend        | `re_test_...` or `re_live_...`                            | **Yes**               |
| `TRACKING_PROXY_API_URL`             | `apps/web`    | Ingestion endpoint for carrier updates                     | `http://localhost:3000/api/tracking`                      | Optional              |
| `TRACKING_PROXY_API_KEY`             | `apps/web`    | Secret token to authenticate carrier telemetry webhooks    | `dev_proxy_secret`                                        | **Yes**               |
| `NEXT_PUBLIC_APP_URL`                | `apps/web`    | Canonical base domain used for SEO canonicals and sitemaps | `http://localhost:3000` or `https://rootapparel.com`      | **Yes**               |

### Automated Fallback & Sandbox Mode

If `STRIPE_SECRET_KEY` or `RESEND_API_KEY` are not set during local testing:

- **Stripe**: The checkout flow automatically activates a built-in **Test Simulator** with 1-click test cards, allowing complete end-to-end checkout and order generation without live API keys.
- **Resend**: The email pipeline logs the formatted HTML receipt to stdout without crashing.
- **Supabase**: If disconnected, both web and mobile automatically fall back to rich canonical seed catalog data.

---

## 3. Getting Started & Local Development

### Prerequisites

- **Node.js**: `v20.x` or later (`node -v`)
- **pnpm**: `v9.x` (`npm install -g pnpm`)
- **Expo Go** (optional for testing mobile app on physical iOS/Android device)

### Quick Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd root

# 2. Install all dependencies across monorepo
pnpm install

# 3. Create local environment file
cp .env.example .env

# 4. Start full development stack (Web + Mobile)
pnpm dev
```

### Running Individual Apps

```bash
# Start Web Storefront only (http://localhost:3000)
pnpm --filter web dev

# Start Mobile App Metro Bundler (Expo CLI)
pnpm --filter app dev

# Run automated tests across monorepo
pnpm test

# Run strict TypeScript typecheck across monorepo
pnpm turbo typecheck

# Run strict ESLint verification across monorepo
pnpm turbo lint

# Build production bundle for Web
pnpm --filter web build
```

---

## 4. Web Storefront User & Developer Guide

### 4.1 Navigation & Browsing

- **Homepage (`/`)**: Features an editorial hero banner, featured categories grid, trending essentials showcase, brand story, and newsletter subscription form.
- **Catalog Page (`/shop` & `/category/[slug]`)**:
  - Filter by category (`Men`, `Women`, `Accessories`, `Shirts`, `Pants`, `Dresses`).
  - Sort by `Price: Low to High`, `Price: High to Low`, `Newest`, or `Featured`.
  - Responsive multi-attribute filter sidebar.
- **Command-K Search Modal**:
  - Press `Ctrl + K` (Windows/Linux) or `Cmd + K` (Mac) anywhere on the site to trigger the instant search dialog.
  - Type terms like _"Oxford"_, _"Tee"_, _"Chino"_, or _"Tote"_ for live results.

### 4.2 Product Detail Page (PDP) (`/product/[slug]`)

- Multi-angle high-resolution photography gallery.
- Interactive **Color Swatches** and **Size Selector** (`XS` to `XXL`).
- Real-time stock indicator (displays _"In Stock"_ or _"Only X left"_).
- Tabbed specifications: Description, Fabric & Fit, and Shipping & Returns.
- **Add to Cart** with visual bounce animation on the header shopping bag.

### 4.3 Shopping Bag & Cart Drawer

- Click the bag icon in the top header to open the slide-out **Cart Drawer**.
- **Free Shipping Progress Meter**:
  - Live progress bar tracking the **$75.00 threshold**.
  - Automatically notifies when qualified for free standard delivery.
- Inline quantity stepper (`+` / `-`) and item removal.

### 4.4 Checkout Flow (`/checkout`)

A 3-step checkout state machine optimized for US conversion:

1. **Shipping**: Full Name, Email (for receipt), Street Address, City, State (2-letter code), 5-digit US ZIP Code.
2. **Delivery Speed**:
   - **Standard Shipping**: 5–7 business days via regional partner network ($5.99, or **FREE** on orders over $75).
   - **Express Priority**: 2–3 business days ($12.99).
3. **Payment**:
   - Real Stripe Elements card input (when live keys are configured).
   - Simulated Test Card Mode for sandbox testing (pre-filled `4242...`).

### 4.5 Promotional Codes

Enter promo codes at cart or checkout:

- `WELCOME10`: 10% discount on order subtotal.
- `ROOT20`: 20% discount on order subtotal.
- `STEALTH15`: 15% discount on order subtotal.
- `FREESHIP`: Grants free shipping on orders meeting threshold.

### 4.6 Guest Order Lookup & Tracking

- **Order Lookup (`/order-lookup`)**: Customers enter their Order Number (`ORD-XXXXX`) and Email to view their order without logging in.
- **Order Status Page (`/order-status/[id]`)**: Displays the stealth milestone tracking timeline.

---

## 5. Mobile App (Expo / React Native) Guide

The mobile application is built with **Expo SDK 52**, **Expo Router 4**, and **NativeWind** (Tailwind for React Native).

### 5.1 Bottom Tab Navigation

The app features 5 persistent bottom tabs:

1. **Shop (`(tabs)/index.tsx`)**: Editorial hero banner, horizontal category pills, featured drops 2-column grid, and brand philosophy card.
2. **Search (`(tabs)/search.tsx`)**: Real-time search bar, trending tag pills, sort filters, and live product grid.
3. **Bag (`(tabs)/bag.tsx`)**: Shopping bag with free shipping meter, line items with quantity steppers, promo code entry, delivery selection, and dynamic badge count on the tab bar.
4. **Wishlist (`(tabs)/wishlist.tsx`)**: Saved pieces grid with real-time toggle synchronization and "Move to Bag" actions.
5. **Profile (`(tabs)/profile.tsx`)**: Customer card, active shipment spotlight with stealth tracking button, address book link, and customer care options.

### 5.2 Deeper Stack Screens

- **Product Detail (`/product/[id]`)**: Full-screen image showcase, color swatch picker with checkmarks, size pill selector, tabbed garment specifications, and sticky bottom "ADD TO BAG" action.
- **Category Listing (`/category/[id]`)**: Filtered collection view with sorting.
- **Mobile Checkout (`/bag/checkout`)**: Multi-step checkout with US shipping address form, delivery tier selection, and card / Apple Pay simulation.
- **Order Confirmation (`/bag/confirmation`)**: Receipt breakdown with stealth delivery assurance notice and link to track parcel.
- **Mobile Order Tracking (`/profile/orders/[id]`)**: Live vertical milestone timeline with domestic partner routing indicators.

### 5.3 Running Mobile on Emulators / Devices

```bash
# Start Expo development server
cd apps/app
pnpm dev

# Press 'a' in the terminal for Android Emulator
# Press 'i' in the terminal for iOS Simulator
# Press 'w' in the terminal for Web browser preview
# Or scan the QR code using the Expo Go app on your physical iOS/Android device
```

---

## 6. Admin Dashboard & Command Center Guide

Access the admin suite by navigating to:
**`http://localhost:3000/admin`**

_(Note: In development and staging, a built-in Demo Admin Session is active to enable immediate access without manual database authentication setup)._

### 6.1 Overview (`/admin`)

- **Key Performance Indicators**: Total Revenue ($), Lifetime Orders, Average Order Value (AOV), and Pending Shipments.
- **Revenue Analytics**: Interactive SVG revenue chart showing 30-day trends.
- **Recent Orders Table**: Quick overview of newest transactions with status badges.
- **Inventory Alerts**: Automatic notification of items below their low-stock threshold.
- **Stealth Logistics Health**: Real-time status of the origin masking proxy.

### 6.2 Order Management (`/admin/orders` & `/admin/orders/[id]`)

- Filter orders by status: `All`, `Confirmed`, `Processing`, `In Transit`, `Delivered`, `Cancelled`.
- Search by customer email or order reference.
- **Order Detail Modal**:
  - View full itemized line items, variant choices, and customer shipping address.
  - **Status Transitions**: Advance orders along the lifecycle (`processing` → `shipped` → `in_transit` → `out_for_delivery` → `delivered`).
  - Assign or update carrier tracking codes (`USPS...`, `FDX...`).
  - Direct preview link to view the customer-facing tracking page.

### 6.3 Logistics & Stealth Command Center (`/admin/logistics`)

- **Shipments Pipeline**: Visual overview of orders currently in transit.
- **Telemetry Event Stream**: Live feed of latest carrier tracking events.
- **Stealth Tracking Sanitizer Simulator**:
  - Interactive simulator where admins can input dirty carrier strings (e.g. _"Flight departed from IGI Airport Delhi"_, _"Customs export clearance Mumbai"_).
  - Click **"Test Sanitization Engine"** to see the side-by-side comparison of raw input vs sanitized customer-facing output in real-time.

### 6.4 Product Catalog (`/admin/products` & `/admin/products/new`)

- Browse all catalog products with thumbnail previews, base prices, variant counts, and active status switches.
- **Create New Product**: Form with automatic slug generation, category assignment, base/compare-at pricing, image URL gallery, and initial variant generator (SKUs, sizes, colors, initial inventory).
- **Edit Product (`/admin/products/[id]/edit`)**: Modify product details, description, and status.

### 6.5 Inventory Matrix (`/admin/inventory`)

- SKU-level inventory grid showing product name, SKU, size, color, current stock count, and low-stock warning pills.
- **Inline Stock Adjuster**: Click `+` or `-` directly in the table to modify inventory count in real-time without leaving the page.

### 6.6 Promo Code Manager (`/admin/promo-codes`)

- View active promo codes, discount types (`percentage` vs `fixed`), minimum spend requirements, total usage counts, and expiration dates.
- Create new promotional codes via modal dialog.
- Toggle codes active or inactive instantly.

### 6.7 Customer Accounts & Directory (`/admin/customers`)

- Directory of customer accounts with order counts, lifetime gross spend, and direct contact email links.

### 6.8 Financial Analytics (`/admin/analytics`)

- Gross revenue vs net revenue calculations.
- Category revenue distribution bars.
- Top-selling styles leaderboard.

---

## 7. Stealth Origin Logistics Architecture

To ensure customers perceive ROOT as a 100% domestic US brand, all customer-facing touchpoints conceal international origin markers.

### Origin Sanitization Rules

| Raw Carrier Scans                        | Customer-Facing Sanitized Output               |
| ---------------------------------------- | ---------------------------------------------- |
| `Origin: Delhi Hub`                      | `Origin: Carrier Regional Hub`                 |
| `Export scan completed at IGI Airport`   | `Carrier processing completed at Regional Hub` |
| `International shipment in transit`      | `Shipment in transit to distribution center`   |
| `Customs clearance processed`            | `Package processing at regional hub`           |
| `Import clearance at port of entry`      | `Arrived at regional distribution facility`    |
| `Handover to linehaul transshipment hub` | `Transferring between regional facilities`     |

### Customer-Facing Milestones

1. **Order Confirmed**: Order verified and queued for dispatch.
2. **Processing & Quality Inspection**: Garment multi-point inspection at regional hub.
3. **In Transit**: En route via domestic transit lines.
4. **Out for Delivery**: Assigned to USPS courier for doorstep delivery.
5. **Delivered**: Successfully delivered to customer destination.

---

## 8. Full API Routes Catalog

All backend API routes reside in `apps/web/app/api/`:

| Endpoint                       | Method                 | Description                                                                    |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------------------ |
| `/api/health`                  | `GET`                  | System health check (Supabase DB, Stripe, Resend telemetry)                    |
| `/api/search`                  | `GET`                  | Autocomplete product search with query param `?q=`                             |
| `/api/checkout/create-intent`  | `POST`                 | Validates stock, calculates tax/shipping, creates Stripe PaymentIntent         |
| `/api/checkout/validate-promo` | `POST`                 | Validates promo code and returns discount percentage/amount                    |
| `/api/orders/create`           | `POST`                 | Finalizes order in DB, decrements stock via trigger, queues confirmation email |
| `/api/orders/[id]`             | `GET`                  | Retrieves public order details for tracking status                             |
| `/api/webhooks/stripe`         | `POST`                 | Stripe webhook listener for `payment_intent.succeeded`                         |
| `/api/webhooks/carrier`        | `POST`                 | Carrier webhook ingestion; auto-sanitizes raw tracking telemetry               |
| `/api/admin/stats`             | `GET`                  | Aggregated KPI stats for admin overview                                        |
| `/api/admin/orders`            | `GET`                  | List orders with filtering and pagination                                      |
| `/api/admin/orders/[id]`       | `GET`, `PATCH`         | Retrieve order details or update status / tracking code                        |
| `/api/admin/products`          | `GET`, `POST`          | List all products or create a new product                                      |
| `/api/admin/products/[id]`     | `GET`, `PATCH`         | Retrieve or update a specific product                                          |
| `/api/admin/inventory`         | `GET`, `PATCH`         | List SKU inventory matrix or adjust stock count                                |
| `/api/admin/promo-codes`       | `GET`, `POST`, `PATCH` | Manage promotional discount codes                                              |
| `/api/admin/tracking`          | `POST`                 | Manual tracking event logger with automated origin sanitizer                   |

---

## 9. Quality Assurance & Verification

The repository enforces strict zero-warning standards across TypeScript, ESLint, and automated test runners.

```bash
# 1. Execute all automated unit and integration tests (18 tests)
pnpm turbo test

# 2. Strict TypeScript compilation check across all packages
pnpm turbo typecheck --force

# 3. Strict ESLint verification (0 errors, 0 warnings enforced)
pnpm turbo lint --force

# 4. Production build verification
pnpm turbo build --filter=web --force
```
