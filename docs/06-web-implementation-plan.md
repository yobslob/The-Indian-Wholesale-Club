# Web Implementation Plan

## 1. Route Map

### Public Routes

| Route Path           | Page Component        | Data Fetching       | Auth   | SEO Metadata Focus                                           |
| -------------------- | --------------------- | ------------------- | ------ | ------------------------------------------------------------ |
| `/`                  | `HomePage`            | ISR (Revalidate 1h) | Public | Title, Desc, Open Graph, Twitter Cards, Organization JSON-LD |
| `/shop`              | `ShopPage`            | SSR (Query Params)  | Public | Title, Desc, Canonical, BreadcrumbList                       |
| `/category/[slug]`   | `CategoryPage`        | ISR (Revalidate 1h) | Public | Title, Desc, Canonical, BreadcrumbList                       |
| `/product/[slug]`    | `ProductDetailPage`   | ISR (Revalidate 1h) | Public | Title, Desc, Product Schema JSON-LD, BreadcrumbList          |
| `/cart`              | `CartPage`            | Client/SSR          | Public | NoIndex (to prevent duplicate crawling)                      |
| `/checkout`          | `CheckoutPage`        | Client/SSR          | Public | NoIndex                                                      |
| `/checkout/success`  | `OrderSuccessPage`    | SSR                 | Public | NoIndex                                                      |
| `/order-status/[id]` | `OrderStatusPage`     | SSR                 | Public | NoIndex                                                      |
| `/search`            | `SearchPage`          | Client/SSR          | Public | Title, Desc, WebSite SearchAction JSON-LD                    |
| `/about`             | `AboutPage`           | SSG                 | Public | Title, Desc, Open Graph                                      |
| `/contact`           | `ContactPage`         | SSG                 | Public | Title, Desc                                                  |
| `/faq`               | `FaqPage`             | SSG                 | Public | Title, Desc, FAQPage JSON-LD                                 |
| `/shipping-returns`  | `ShippingReturnsPage` | SSG                 | Public | Title, Desc                                                  |
| `/privacy`           | `PrivacyPolicyPage`   | SSG                 | Public | Title, Desc                                                  |
| `/terms`             | `TermsPage`           | SSG                 | Public | Title, Desc                                                  |
| `/size-guide`        | `SizeGuidePage`       | SSG                 | Public | Title, Desc                                                  |

### Account Routes (Protected)

| Route Path             | Page Component         | Data Fetching | Auth      | SEO Metadata Focus |
| ---------------------- | ---------------------- | ------------- | --------- | ------------------ |
| `/account`             | `AccountDashboardPage` | SSR / Client  | Protected | NoIndex            |
| `/account/orders`      | `OrderHistoryPage`     | SSR / Client  | Protected | NoIndex            |
| `/account/orders/[id]` | `OrderDetailPage`      | SSR / Client  | Protected | NoIndex            |
| `/account/addresses`   | `SavedAddressesPage`   | SSR / Client  | Protected | NoIndex            |
| `/account/wishlist`    | `WishlistPage`         | SSR / Client  | Protected | NoIndex            |
| `/account/settings`    | `ProfileSettingsPage`  | SSR / Client  | Protected | NoIndex            |

### Auth Routes

| Route Path         | Page Component       | Data Fetching | Auth                        | SEO Metadata Focus   |
| ------------------ | -------------------- | ------------- | --------------------------- | -------------------- |
| `/login`           | `LoginPage`          | SSG           | Public (Redirect if auth'd) | Title, Desc, NoIndex |
| `/signup`          | `SignupPage`         | SSG           | Public (Redirect if auth'd) | Title, Desc, NoIndex |
| `/forgot-password` | `ForgotPasswordPage` | SSG           | Public (Redirect if auth'd) | Title, Desc, NoIndex |
| `/reset-password`  | `ResetPasswordPage`  | SSR           | Public (Redirect if auth'd) | Title, Desc, NoIndex |

### Admin Routes (Protected, Admin Role)

| Route Path                  | Page Component         | Data Fetching | Auth  | SEO Metadata Focus |
| --------------------------- | ---------------------- | ------------- | ----- | ------------------ |
| `/admin`                    | `AdminDashboardPage`   | SSR / Client  | Admin | NoIndex            |
| `/admin/products`           | `AdminProductsPage`    | SSR / Client  | Admin | NoIndex            |
| `/admin/products/new`       | `AdminNewProductPage`  | SSR / Client  | Admin | NoIndex            |
| `/admin/products/[id]/edit` | `AdminEditProductPage` | SSR / Client  | Admin | NoIndex            |
| `/admin/orders`             | `AdminOrdersPage`      | SSR / Client  | Admin | NoIndex            |
| `/admin/orders/[id]`        | `AdminOrderDetailPage` | SSR / Client  | Admin | NoIndex            |
| `/admin/inventory`          | `AdminInventoryPage`   | SSR / Client  | Admin | NoIndex            |
| `/admin/customers`          | `AdminCustomersPage`   | SSR / Client  | Admin | NoIndex            |
| `/admin/analytics`          | `AdminAnalyticsPage`   | SSR / Client  | Admin | NoIndex            |
| `/admin/promo-codes`        | `AdminPromoCodesPage`  | SSR / Client  | Admin | NoIndex            |
| `/admin/logistics`          | `AdminLogisticsPage`   | SSR / Client  | Admin | NoIndex            |

### API Routes (Next.js Route Handlers)

All server logic lives in `apps/web/app/api/` route handlers — there are **no
Supabase Edge Functions** in this project. Groups:

- **Checkout:** `/api/checkout/create-intent`, `/api/checkout/validate-promo`
- **Orders:** `/api/orders/create`, `/api/orders/[id]`
- **Webhooks:** `/api/webhooks/stripe`, `/api/webhooks/carrier` (both HMAC-verified)
- **Admin:** `/api/admin/*` (9 routes behind `requireAdmin()`)
- **Misc:** `/api/search`, `/api/contact`, `/api/newsletter`, `/api/health`

Full inventory and integration details: `docs/04-backend-api-and-integrations.md` §4.

## 2. App Directory Structure

```text
apps/web/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx                # Includes <Header> and <Footer>
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── page.tsx                  # / (Homepage)
│   │   ├── shop/page.tsx
│   │   ├── category/[slug]/page.tsx
│   │   ├── product/[slug]/page.tsx
│   │   ├── cart/page.tsx
│   │   ├── checkout/
│   │   │   ├── page.tsx
│   │   │   └── success/page.tsx
│   │   ├── order-status/[id]/page.tsx
│   │   ├── search/page.tsx
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── faq/page.tsx
│   │   ├── shipping-returns/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── terms/page.tsx
│   │   └── size-guide/page.tsx
│   ├── (auth)/
│   │   ├── layout.tsx                # Minimal layout without main footer
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (account)/
│   │   ├── layout.tsx                # Includes Account Sidebar navigation
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── page.tsx                  # /account
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── addresses/page.tsx
│   │   ├── wishlist/page.tsx
│   │   └── settings/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx                # Admin dashboard shell (Sidebar, Header)
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── page.tsx                  # /admin
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── inventory/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── promo-codes/page.tsx
│   │   └── logistics/page.tsx
│   ├── global-error.tsx              # Root error boundary
│   ├── layout.tsx                    # Root layout (Fonts, Providers)
│   └── favicon.ico
├── middleware.ts                     # Auth protection and route rewrites
└── components/                       # Shared and feature-specific components
```

## 3. Component Hierarchy Per Route

**Homepage (`/`)**

- `HomePage`
  - `<HeroSection>` (Carousel or prominent static image with CTA)
  - `<FeaturedCategories>` (Grid of category cards)
  - `<TrendingProducts>` (Product slider with TanStack Query)
  - `<BrandStory>` (Text and image block)
  - `<NewsletterSignup>` (Email capture form)

**Category Page (`/category/[slug]`)**

- `CategoryPage`
  - `<CategoryHeader>` (Category title and description)
  - `<div className="flex">`
    - `<FilterSidebar>` (Price, color, size filters via query params)
    - `<div>`
      - `<SortDropdown>` (Price low/high, new arrivals)
      - `<ProductGrid>` (List of `<ProductCard>` components)
      - `<Pagination>` (Page numbers or infinite scroll)

**Product Detail Page (`/product/[slug]`)**

- `ProductDetailPage`
  - `<div className="grid grid-cols-2">`
    - `<ProductGallery>` (Main image viewer + thumbnails via Framer Motion)
    - `<ProductInfo>`
      - `<Breadcrumbs>`
      - `<ProductTitle>` & `<ProductPrice>`
      - `<ReviewsBadge>`
      - `<ColorSelector>`
      - `<SizeSelector>` (With link to `<SizeGuideModal>`)
      - `<AddToCartButton>`
      - `<ProductTabs>` (Description, Details, Shipping, Reviews)
  - `<RelatedProducts>` (Slider of similar items)

**Cart Page (`/cart`)**

- `CartPage`
  - `<h1>Your Cart</h1>`
  - `<div className="grid grid-cols-12">`
    - `<CartItemList className="col-span-8">`
      - `<CartItem>` (Image, details, quantity toggles, remove button)
    - `<CartSummary className="col-span-4">`
      - Subtotal, Tax, Shipping estimate
      - `<PromoCodeInput>`
      - `<CheckoutButton>`
      - `<ContinueShoppingLink>`

**Checkout (`/checkout`)**

- `CheckoutPage`
  - `<CheckoutStepper>` (Indicator: Info -> Shipping -> Payment)
  - `<div className="grid grid-cols-2">`
    - `<div>` (Forms)
      - `<ContactInfoForm>`
      - `<ShippingForm>`
      - `<PaymentForm>` (includes `<StripeElements>`)
    - `<OrderReview>` (Mini cart summary pinned to right)

**Admin Dashboard (`/admin`)**

- `AdminDashboardPage`
  - `<StatsCards>` (Revenue, Orders, Visitors)
  - `<div className="grid">`
    - `<SalesChart>` (Recharts or similar line/bar chart)
    - `<RecentOrders>` (Table view)
  - `<InventoryAlerts>` (Low stock warnings)

## 4. Shared Layout Components

- **`<Header>`**: Sticky top navigation bar. Contains Logo, `<MegaMenu>` for categories, `<SearchBar>` (triggers `<SearchModal>`), `<CartIcon>` (triggers `<CartDrawer>` with count badge), `<UserMenu>` (avatar, login/logout, account links), and a `<MobileHamburger>` for smaller viewports.
- **`<MobileNav>`**: Slide-in navigation drawer for mobile. Contains accordion menus for categories, and links to account/settings.
- **`<Footer>`**: Bottom of the page containing Brand info, secondary navigation links (Help, About), `<NewsletterSignup>`, social media links, payment method icons, and legal links (Privacy, Terms).
- **`<CartDrawer>`**: Slide-in overlay from the right side. Shows current cart items, subtotal, and a quick "Proceed to Checkout" CTA. Uses Framer Motion for smooth enter/exit animations.
- **`<SearchModal>`**: Command-K style search overlay (`cmdk`). Allows instant product, category, and article search with debounced inputs.
- **`<AnnouncementBar>`**: Thin top banner above the Header for global promotions (e.g., "Free shipping on orders over $100").

## 5. State Management Architecture

### Client State (Zustand)

We use Zustand for lightweight, globally accessible client UI state:

- **`useCartStore`**: Manages the local shopping cart state, syncing with localStorage or syncing to the backend for authenticated users. (State: `items`, `addItem()`, `removeItem()`, `updateQuantity()`, `clearCart()`).
- **`useAuthStore`**: Stores the current authenticated user's session details on the client (State: `user`, `session`, `setSession()`, `logout()`).
- **`useUIStore`**: Manages global UI toggles and overlays. (State: `isCartDrawerOpen`, `isSearchModalOpen`, `isMobileNavOpen`, `openCart()`, `closeCart()`, etc.).

### Server State (TanStack Query)

TanStack Query is used for fetching, caching, and updating asynchronous server data:

- **Query Keys Structure**: `['products', { category: 'shirts', sort: 'price_asc' }]`, `['cart']`, `['orders', userId]`.
- **Prefetching**: Use `queryClient.prefetchQuery` in Next.js Server Components or route handlers to seed the cache before client rendering (e.g., prefetching category products).
- **Optimistic Updates**: For operations like adding to cart or toggling a wishlist item, immediately update the query cache and rollback if the mutation fails.

### Server State vs Client State Boundaries

- **Server Components (RSC)**: Fetch initial critical data directly from Supabase/PostgreSQL (e.g., product details, categories). Pass necessary data as props to Client Components.
- **Client Components**: Handle user interactivity, form submissions, and data that requires frequent polling or client-side caching (via TanStack Query).

## 6. SEO Strategy

- **Metadata Generation**: Use Next.js `generateMetadata` in `page.tsx` and `layout.tsx` files to create dynamic titles, descriptions, Open Graph, and Twitter Cards based on route parameters (e.g., product name on PDP).
- **Structured Data (JSON-LD)**: Inject JSON-LD scripts using `<script type="application/ld+json">`.
  - `Product` schema on `/product/[slug]`.
  - `BreadcrumbList` on all nested pages.
  - `Organization` and `WebSite` (with `SearchAction`) on the Homepage.
  - `FAQPage` on `/faq`.
- **Sitemap**: Utilize Next.js `app/sitemap.ts` to dynamically generate a `sitemap.xml` for all static pages, categories, and active products.
- **robots.txt**: Utilize Next.js `app/robots.ts` to disallow crawling of `/account`, `/admin`, `/cart`, and `/checkout`.
- **Canonical URLs**: Ensure canonical tags are generated in metadata to avoid duplicate content penalties, especially on pages with URL parameters (like sorting/filtering on `/shop`).

## 7. Performance Optimization

- **Image Optimization**: Use `next/image` extensively.
  - Host images on Supabase Storage.
  - Configure `remotePatterns` in `next.config.js`.
  - Use `placeholder="blur"` with base64 data URLs for critical images (like hero banners).
  - Define `sizes` attribute for responsive `srcset` generation.
- **Code Splitting**: Next.js App Router inherently supports code splitting. We will also dynamically import heavy client components (like `<StripeElements>` or `<SalesChart>`) using `next/dynamic`.
- **Font Optimization**: Use `next/font/google` (or local) for self-hosting fonts with zero layout shift (automatically adds `size-adjust`).
- **Prefetching**: Leverage Next.js `<Link>` component's default prefetching for visible links. Selectively disable prefetching for heavy or low-probability routes using `prefetch={false}`.
- **Web Vitals Targets**:
  - **LCP (Largest Contentful Paint)** < 2.5s: Prioritize loading the hero image/product image.
  - **FID (First Input Delay) / INP (Interaction to Next Paint)**: Keep main thread unblocked by minimizing heavy synchronous JavaScript.
  - **CLS (Cumulative Layout Shift)** < 0.1: Strictly enforce aspect ratios on product images and avoid dynamic content insertion above the fold without reserved space.

## 8. Error & Loading States

- **Global Error Boundary**: `app/global-error.tsx` catches errors at the root level and provides a generic fallback UI with a "Try again" button.
- **Route-Level Errors**: Feature-specific `error.tsx` files (e.g., in `/app/(public)/product/[slug]`) catch errors specific to that route segment without crashing the whole app.
- **Loading States (Suspense)**: Use `loading.tsx` files in route segments to show immediate loading indicators while Server Components resolve.
  - Use Skeleton UI patterns (via Shadcn UI `Skeleton` component) instead of spinners where possible to reduce perceived load time.
- **404 Page**: A custom `not-found.tsx` at the root (and specifically in `product/[slug]`) to gracefully handle invalid URLs or non-existent database records, offering search and "Return to Shop" links.
- **Offline Fallback**: Implement a basic service worker (via `next-pwa` or similar) to serve an offline fallback page or cached assets when network connectivity drops.
