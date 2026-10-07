# Design pass: one page at a time

Started 2026-10-07 by the founder: every page is designed again in turn: website (desktop and phone widths), the app's
customer screens, and the admin on web and app. This folder is that work. The system it builds on (tokens, fonts,
voice, motion, accessibility) is `docs/design.md`; the earlier approved mockup is `design/mockups/` (D-050 – D-055).

## How a page goes through the pass
1. **Brief:** copy `_template/brief.md` to `design/pages/<id>/brief.md`. Fill in the page's job, what it shows (from
   `docs/storefront.md` or `docs/admin.md`), what exists today (the route file), and the founder's direction in their own words.
2. **Mockup:** `design/pages/<id>/mockup.html`, static HTML on the same tokens (`packages/tokens/tokens.js` values as
   CSS variables). One file shows every size the page has (see Sizes). Placeholder data is marked, and text the founder
   still has to write uses `.tbd` from `design/mockups/shared/mockup.css`.
3. **Review:** served by the `mockups` launch entry (root `design/`, see below) and screenshotted at each size. The
   founder's notes go into the brief's "Rounds" log until they say it is approved.
4. **Approved:** filed as a decision (`/record-answer`), the register below set to "approved" with the D-id.
5. **Built:** the code changes in a separate step, checked with `node scripts/check.mjs`, then "built" here with the commit.

Status words: `—` not started · `brief` · `mockup` (in review, round n) · `approved D-xxx` · `built <commit>`.

## Rules that hold for every page
- Non-negotiables in `CLAUDE.md`: no operations info on customer pages (D-003), honest origin (D-004), invisible admin
  (D-006), delivery dates only from cycle data (D-008), money as integers.
- No invented copy, prices, dates or policy (D-012). Copy follows the voice rule (D-059) and is `draft` until approved.
- Light only on customer surfaces (D-050). WCAG 2.2 AA, 44 px touch targets, `prefers-reduced-motion` respected.
- The page's data is what the `store_*` read already gives. A design that needs new data says so in its brief
  ("Needs"), and that becomes a decision or a question before it is built.

## Sizes
| Surface | Sizes shown in the mockup |
|---|---|
| Website (customer) | 1440 desktop · 1024 small laptop / tablet landscape · 768 tablet · 390 phone |
| App (customer and admin) | 390 × 844 phone frame (and 430 for large phones where the layout changes) |
| Web admin | 1440 desktop · 390 phone (admins work on phones, `docs/admin.md`) |

## Page register
Order is a suggestion: shared pieces first, then the paths a customer walks most.

### 0. Shared pieces (used by every page)
| id | Piece | Code today | Status |
|---|---|---|---|
| `web-shell` | Website header, nav, search entry, bag count, footer | `apps/web/features/shell/` | — |
| `app-shell` | App tab bar, screen header, toasts | `apps/app/app/(customer)/_layout.tsx` | — |
| `cards` | Product card, region stamp, sideways row with See all, pills | `apps/web/features/catalog/`, `apps/app/features/catalog/` | — |
| `admin-shell` | Web admin nav and page frame; app admin tabs | `apps/web/features/admin/ui.tsx`, `apps/app/app/admin/(tabs)/_layout.tsx` | — |
| `emails` | Customer emails (one layout, every message) | `apps/web/lib/email/` | — |

### 1. Website, customer (`apps/web/app/(store)/`)
| id | Route | Status |
|---|---|---|
| `web-home` | `/` | — |
| `web-states` | `/states` | — |
| `web-region` | `/states/[region]` | — |
| `web-product` | `/states/[region]/[product]` | — |
| `web-browse` | `/clothing`, `/spices` | — |
| `web-search` | `/search` | — |
| `web-bag` | `/cart` | — |
| `web-checkout` | `/checkout`, `/checkout/success` | — |
| `web-order` | `/orders/lookup`, `/orders/[number]` | — |
| `web-account` | `/account`, `/account/orders`, `/account/addresses`, `/account/saved` | — |
| `web-review` | `/account/reviews/[productId]` | — |
| `web-auth` | `/login`, `/signup` | — |
| `web-info` | `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | — |
| `web-404` | not found and error pages | — |

### 2. App, customer (`apps/app/app/`)
| id | Screen | Status |
|---|---|---|
| `app-home` | `(customer)/index` | — |
| `app-explore` | `(customer)/explore` | — |
| `app-region` | `region/[slug]` | — |
| `app-product` | `product/[region]/[slug]` | — |
| `app-browse` | `browse` | — |
| `app-bag` | `(customer)/bag` | — |
| `app-checkout` | `checkout` | — |
| `app-saved` | `(customer)/saved` | — |
| `app-profile` | `(customer)/profile`, `addresses` | — |
| `app-order` | `order/[number]`, `order/lookup` | — |
| `app-auth` | `auth/login`, `auth/signup` | — |

### 3. Web admin (`apps/web/app/admin/`)
| id | Route | Status |
|---|---|---|
| `admin-login` | `/admin/login` | — |
| `admin-today` | `/admin` | — |
| `admin-orders` | `/admin/orders`, `/admin/orders/[id]` | — |
| `admin-cycles` | `/admin/cycles`, `/admin/cycles/[id]`, `/admin/cycles/[id]/documents` | — |
| `admin-listings` | `/admin/listings` | — |
| `admin-catalog` | `/admin/catalog`, `/admin/catalog/[id]` | — |
| `admin-vendors` | `/admin/vendors` | — |
| `admin-payouts` | `/admin/payouts` | — |
| `admin-regions` | `/admin/regions`, `/admin/regions/[id]` | — |
| `admin-reviews` | `/admin/reviews` | — |
| `admin-returns` | `/admin/returns` | — |
| `admin-customers` | `/admin/customers` | — |
| `admin-promotions` | `/admin/promotions` | — |
| `admin-insights` | `/admin/insights` | — |
| `admin-settings` | `/admin/settings` | — |

### 4. App admin (`apps/app/app/admin/`)
| id | Screen | Status |
|---|---|---|
| `appadmin-today` | `(tabs)/index` | — |
| `appadmin-orders` | `(tabs)/orders`, `order/[id]` | — |
| `appadmin-cycles` | `(tabs)/cycles`, `cycle/[id]` | — |
| `appadmin-listings` | `(tabs)/listings`, `listing/new` | — |
| `appadmin-payouts` | `(tabs)/payouts` | — |
| `appadmin-vendors` | `(tabs)/vendors` | — |

## Viewing the mockups
The `mockups` entry in `.claude/launch.json` serves `design/` on port 4321, so the old mockup is at
`/mockups/index.html` and a page here at `/pages/<id>/mockup.html`.
