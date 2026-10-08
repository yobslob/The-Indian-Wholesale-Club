# app: every customer screen of the app, on the approved website decisions

**Surface:** `apps/app/app/` customer screens: `(customer)/index` (Home), `explore`, `bag`, `saved`, `profile`, `region/[slug]`,
`product/[region]/[slug]`, `browse`, `checkout`, `order/[number]`, `order/lookup`, `addresses`, `auth/*` · **Status:**
approved D-095 (2026-10-08), not built yet

## The job
The app is the same shop in the hand: it follows every approved website page (D-079 – D-094), adapted to what a phone
app does natively (tabs instead of header icons, a back bar on pushed screens, bottom sheets, Stripe's PaymentSheet).

## Founder's direction (2026-10-08)
"now the app screens can be done in one go, all the pages, i believe you" (after D-083: the app gets its own pass after
the website).

## Design (round 1), screen by screen
- **Shell (D-079):** cream tab bar Home · Explore · Bag · Saved · Profile, Karla labels, a short brand-colour bar over
  the active tab, the bag count as a brand pill; tab roots have a large title in Syne (D-080 headings), pushed screens a
  back bar. Cinzel stays for the hero name, state names and product titles. The demo banner (D-078) on Home and checkout.
- **Home (D-079, D-080):** the photo full screen under the status bar with the name on the white wall; then Just listed
  (cards with the + on the photo) and Pick your home (map, find your state, stamps in pages of 6 from 7, names).
- **Explore (D-083, D-084, D-085):** search and the States · Clothing · Spices switch, as today; States are the stamps
  and the coming-soon names; Clothing and Spices are rows with See all; a search shows the count with the words, matching
  states as stamps and the pieces, and on no results the open states.
- **Region (D-081):** photo, greeting, the name in Cinzel, tagline, story, jump pills, New arrivals, Picked for you as a
  row inside its box, the category rows.
- **Product (D-082):** the big photo with three small ones under it, the info, reviews as a row; any photo opens the
  full-screen viewer (swipe, count, ×); the buy bar slides up once Add to bag is out of view. **Write a review** opens
  the D-090 form as a bottom sheet in the app (today it opens the website). *Interpretation (proposed).*
- **Browse (D-084):** the Filter bar that shrinks to a round icon once scrolled; the filter panel from the right.
- **Bag tab (D-086):** photos, − 1 +, Subtotal and Checkout; an empty bag shows the stamps and Just listed. In the app the
  bag is its own tab, so there is no bag panel.
- **Checkout (D-087):** phone (+1 and the flag) → delivery (name, email, ZIP with the city filled in, street) → payment;
  the bag bar at the top; payment in Stripe's PaymentSheet (native); the thank-you screen with the pieces.
- **Order (D-088):** the status card with the timeline, the pieces with photos; Track an order as the lookup card.
- **Saved tab (D-089):** the cards with a filled heart that removes; signed out, the sign-in card.
- **Profile tab (D-089, D-091, D-092):** signed in, pill tabs Orders · Addresses · Your details (Saved is its own tab),
  then Track an order, About us & help, Sign out; signed out, the sign-in card (show password, forgot password, email
  code) and the same links. About us & help opens the D-092 glass sheet with the seven tabs.
- **Errors (D-093):** "Something went wrong", the same line, Try again.

## Needs
None new. Sample data as in the website mockups.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the direction above | first proposal |
| 2026-10-08 | — | "approved" | approved as D-095 |
