# info: About us, How it works, FAQ, Contact, Shipping & returns, Privacy, Terms (website)

**Surface:** website `/about`, `/how-it-works`, `/faq`, `/contact`, `/shipping-returns`, `/privacy`, `/terms` (linked
from the header's About us and the footer) · **Code:** `apps/web/app/(store)/<page>/page.tsx` (shipping-returns and faq
read `store_policy()`) · **Status:** approved D-092 (2026-10-08), not built yet

## The page's job
Answer the questions people have before and after buying, without taking them away from what they were looking at.

## What it shows today (D-070 – D-076)
Seven separate pages. How it works, FAQ, Shipping & returns, Privacy and Terms are Claude drafts awaiting approval (their
numbers come from `store_policy()`); About and Contact say they are being written. Content in `content.js` is copied
from production on 2026-10-08 (the FAQ cut to its first entries for the mockup).

## Founder's direction (2026-10-08)
"In the info pages I don't really need a whole new page to open, I just need a glass tab which opens on the same
page(whichever page it is clicked on) with a cross button"

## Design (round 1)
- **A glass panel over the current page**, opened by About us (header, side menu) and the footer's info links: frosted
  glass (a soft blur of the page behind, D-080) with the page dimmed a little, the text in a readable column, and a ×
  in the corner. Escape, × or a click on the page outside close it; it opens and closes with the same short fade and lift.
- **Tabs in the panel** for all seven (About us · How it works · FAQ · Shipping & returns · Contact · Privacy · Terms), so
  one opens the next without closing; FAQ answers open and close with + / −.
- **Phones:** the same glass as a sheet that rises from the bottom (about 90 % of the screen), × at its top.
- **Addresses kept:** each info page keeps its own URL (emails, checkout notes, search engines and legal links need
  them). Opening a tab updates the URL and Back closes the panel; visiting a URL directly opens Home with that panel
  showing. *Interpretation (proposed).*

## Needs
- The founder's About and Contact text (Q-9 for the contact email); approval of the drafts.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the direction above | first proposal |
| 2026-10-08 | 2 | "need the cross to be smaller, rest approved move on" | a 32 px × (44 px tap area); approved as D-092 |
