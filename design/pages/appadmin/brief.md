# appadmin: the app's admin mode, on the approved web admin (D-096)

**Surface:** `apps/app/app/admin/` (tabs Today, Orders, Cycles, Payouts, Listings, Vendors; `order/[id]`, `cycle/[id]`,
`listing/new`), shown only after the server says `is_admin()` (D-006, D-043) · **Status:** mockup, round 1

## The job
The phone the COO carries to the shops and the founder checks on the move: pickups, listing with the camera, shipping,
paying shops. Same data and rules as the web admin; protected on the server.

## Today (code)
Six tabs (more than a phone tab bar holds comfortably); the same plain lists as the web admin had; times as stored;
refunds are web-only (they need the Stripe secret key on the server, `admin.md`).

## Founder's direction (2026-10-08)
"approved and move on" (after D-096), continuing the pass: the app's admin mode follows the approved web admin.

## Design (round 1)
Everything from D-096 in the app's own patterns:
- **Five tabs:** Today · Orders · Cycle · Listings · More (Payouts, Vendors, View the store, Sign out), with counts of what
  waits as badges; a search button on every tab root opens **quick find**.
- **Times** in the desk's zone with the other beside it; **plain status chips**.
- **Today:** the cycle countdown and progress, Needs attention, the desk's work queue with one big button per job.
- **Orders:** search, chip filters with counts, cards; a long press starts selecting, with a bar for Mark shipped /
  Mark delivered.
- **Order:** chips, pieces with photos and pickup state, the customer with Call / Text, the timeline; the one main action
  at the bottom (e.g. Pack & ship opens a sheet: carrier, tracking, Mark shipped). Refunds stay on the web panel
  (as today), shown as "Refund on the web panel".
- **Cycle:** the progress bar and the next step; pickups by shop (Call, WhatsApp, Map, progress, Picked / Unavailable).
- **Listings:** New (Take photos or many from the gallery, the photo grid, fields, live $ price), Add many (pick many
  photos → drafts, one card each), Drafts / Live / Paused.
- **More → Payouts:** owed per shop, Record payout, which **confirms** in a sheet with the amount (D-096 confirm rule).
- **More → Vendors:** the list and "Add a vendor" as a sheet (shop name, owner, phone / WhatsApp, region, town, payment
  method and reference, photo).

## Needs
None new. Sample data.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the direction above | first proposal |
