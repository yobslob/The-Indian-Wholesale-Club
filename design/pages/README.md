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

"Today" screenshots of the website are taken from production (read only) with the repo's Playwright at each width;
they live in the scratchpad, not in the repo.
| Web admin | 1440 desktop · 390 phone (admins work on phones, `docs/admin.md`) |

## Page register
Order (founder, 2026-10-07; D-083): the customer side first, every website page at each size, then one pass over the
app's customer screens, then the admin side. The pass **refines the approved design** (D-050 – D-055, D-077); it does not replace it.

### Part 1: customer side (website at 1440 · 1024 · 768 · 390, and the app)
| # | id | Website (`apps/web/app/(store)/`) | App (`apps/app/app/`) | Status |
|---|---|---|---|---|
| 1 | `shell` | header, nav, demo banner, footer (`features/shell/`) | tab bar, screen header (`(customer)/_layout.tsx`) | approved D-079 |
| 2 | `home` | `/` | `(customer)/index` | approved D-080 |
| 3 | `cards` | product card, region stamp, sideways row + See all, pills | same parts (`features/catalog/`) | settled in `home` (D-080): + on the photo, row as today, stamp pages |
| 4 | `region` | `/states/[region]` | `region/[slug]` | approved D-081 |
| 5 | `product` | `/states/[region]/[product]` | `product/[region]/[slug]` | approved D-082 |
| 6 | `states` | `/states` | `(customer)/explore` (regions part) | approved D-083 (= Home's Pick your home) |
| 7 | `browse` | `/clothing`, `/spices` | `browse`, `(customer)/explore` | approved D-084 |
| 8 | `search` | `/search` | search in `(customer)/explore` | approved D-085 |
| 9 | `bag` | `/cart` | `(customer)/bag` | approved D-086 |
| 10 | `checkout` | `/checkout`, `/checkout/success` | `checkout` | approved D-087 |
| 11 | `order` | `/orders/lookup`, `/orders/[number]` | `order/lookup`, `order/[number]` | approved D-088 |
| 12 | `account` | `/account`, `/account/orders`, `/account/addresses`, `/account/saved` | `(customer)/profile`, `addresses`, `(customer)/saved` | approved D-089 |
| 13 | `review` | `/account/reviews/[productId]` | (opens the website) | approved D-090 |
| 14 | `auth` | `/login`, `/signup` | `auth/login`, `auth/signup` | approved D-091 |
| 15 | `info` | `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` | — | approved D-092 |
| 16 | `errors` | not found, error | error and empty states | approved D-093 |
| 17 | `emails` | customer emails (`lib/email/`) | — | mockup, round 1 |

### Part 2: admin side (web admin at 1440 · 390, and the app's admin mode)
| # | id | Web (`apps/web/app/admin/`) | App (`apps/app/app/admin/`) | Status |
|---|---|---|---|---|
| 18 | `admin-shell` | nav and page frame (`features/admin/ui.tsx`), `/admin/login` | admin tabs (`(tabs)/_layout.tsx`) | — |
| 19 | `admin-today` | `/admin` | `(tabs)/index` | — |
| 20 | `admin-orders` | `/admin/orders`, `/admin/orders/[id]` | `(tabs)/orders`, `order/[id]` | — |
| 21 | `admin-cycles` | `/admin/cycles`, `/admin/cycles/[id]`, `…/documents` | `(tabs)/cycles`, `cycle/[id]` | — |
| 22 | `admin-listings` | `/admin/listings` | `(tabs)/listings`, `listing/new` | — |
| 23 | `admin-catalog` | `/admin/catalog`, `/admin/catalog/[id]` | — | — |
| 24 | `admin-vendors` | `/admin/vendors` | `(tabs)/vendors` | — |
| 25 | `admin-payouts` | `/admin/payouts` | `(tabs)/payouts` | — |
| 26 | `admin-regions` | `/admin/regions`, `/admin/regions/[id]` | — | — |
| 27 | `admin-reviews` | `/admin/reviews` | — | — |
| 28 | `admin-returns` | `/admin/returns` | — | — |
| 29 | `admin-customers` | `/admin/customers` | — | — |
| 30 | `admin-promotions` | `/admin/promotions` | — | — |
| 31 | `admin-insights` | `/admin/insights` | — | — |
| 32 | `admin-settings` | `/admin/settings` | — | — |

## Viewing the mockups
The `mockups` entry in `.claude/launch.json` serves `design/` on port 4321, so the old mockup is at
`/mockups/index.html` and a page here at `/pages/<id>/mockup.html`.
