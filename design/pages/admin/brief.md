# admin: the web admin (and its phone layout), designed for speed

**Surface:** `apps/web/app/admin/(panel)/*` (Today, Orders, order page, Cycles, Listings, Catalog, Payouts, Vendors,
Regions, Reviews, Returns, Customers, Promotions, Insights, Settings), the app's admin mode follows · **Code:**
`apps/web/features/admin/` (`ui.tsx`, `live-feed.tsx`, forms) · **Status:** mockup, round 1

## The job
Two people run the business on it (D-007): the founder (US desk, laptop and phone) and the COO (India desk, mostly a
phone, in the field). Every screen should answer "what needs doing now" and let it be done in as few taps as possible.
Lightweight (server-rendered, no heavy client code, D-011), plain and dense (`design.md` §Admin look), never shown to
customers (D-006).

## Today (code, 2026-10-08)
- 14 flat links in the nav; nothing shows what is waiting where.
- Every time is printed in UTC.
- Status words are the database's (`collecting / paid`, `in_transit`).
- The order page shows every action at once (move, ship, new date, cancel, note); refunds and cancels are one-click
  links with no confirmation.
- Orders: no search, 200 at most, no way to act on several.
- The cycle page has no sense of progress; pickups are plain lists; the shop's phone is not tappable.
- A new listing needs its URL slug typed by hand; photos, sizes and pieces come on a second page after saving; the
  dollar price is only seen after saving.

## Founder's direction (2026-10-08)
"now let's design the admin higly effieciently so keep your eyes out for everything considerable. The admin panel
should be lightweight yet highly designed productively." Chosen (all offered): grouped nav with counts, quick find
(Ctrl+K), your own time zone, plain status chips; Today as a work queue, Orders search + bulk, order page actions that
apply, confirm money actions; cycle progress bar, pickup checklist by shop, one-step new listing, shop price → live $
price. And: "Also make the uploading easy, so that I can upload multiple photos on gallery grids at once, also the
products listings uploadings."

## Design (round 1)
- **Frame:** a left sidebar grouped by job (Daily: Today, Orders, Cycle, Listings, Payouts · Catalog: Products, Regions,
  Reviews, Promotions · People: Customers, Vendors, Returns · Insights, Settings) with live counts of what is waiting;
  a top bar with **Quick find** (Ctrl+K: orders by number / name / email, products, customers, vendors), the desk's
  clock in both zones and the live dot. On phones: a top bar with the menu, the find button and the page title.
- **Times** in the admin's desk zone (US desk: New Jersey, India desk: India) with the other zone small beside it.
- **Status chips** in plain words and colours (order: Awaiting payment, Confirmed, Collecting in India, Packed in
  India, On the way to the US, Arrived · to ship, Shipped, Delivered, Cancelled, Refunded; payment: Paid, Refunded,
  Part refunded, Failed; pickup: To pick, Picked, Unavailable, Paid to shop).
- **Today:** the open cycle as a countdown to cutoff with its progress and totals; "Needs attention"; the admin's desk
  as a work queue (count, what it is, one button to the work), the other desk smaller; live orders on the side.
- **Orders:** search, status chips with counts, ticked rows get a bulk bar (Mark shipped… opens one tracking line per
  order; Mark delivered), pages of 50.
- **Order page:** the order on the left (pieces with photos and pickup state, customer and address with tap-to-call,
  the timeline in plain words with customer-visible lines marked); on the right only the actions possible now (e.g.
  Arrived: Pack & ship first; then New delivery date, Internal note, Cancel for the customer) and the totals.
- **Money actions confirm:** a box with the exact amount and the email the customer gets.
- **Cycle page:** Open → Collecting → Packed → Exported → Arrived → Fulfilling → Closed as a bar with dates, the one next
  step as the main button; pickups as one card per shop (Call, WhatsApp, "3 of 5 picked", big Picked / Unavailable per
  piece), filters To pick · All · Unavailable.
- **New listing in one step:** the photo grid (drop many at once, drag to reorder, the first is the main photo, alt text
  under each, uploads show progress), name → web address filled in, the type's fields, sizes and pieces, shop price ₹
  with the dollar price shown live (D-075), Save draft / Publish.
- **Add many:** drop a batch of photos; each becomes a draft (drag photos onto another to group them); one table row per
  draft for name, category, shop, shop price (₹ → $ live), pieces; "Create n drafts".
- The other sections take the same frame, chips, tables and confirm boxes (Payouts shown as the example).
*Interpretation (proposed):* "the products listings uploadings" = Add many as above.

## Needs
- The quick find searches orders, products, customers and vendors: a small server search (admin only).
- Data in the mockup is sample.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the direction above | first proposal |
