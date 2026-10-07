# emails: the customer emails (order confirmed and every order update)

**Surface:** emails sent through `email_outbox` and Resend · **Code:** `apps/web/lib/email/order-confirmation.ts`,
`order-update.ts`, `send.ts` · **Status:** mockup, round 1

## The page's job
Tell the customer what happened to their order in one glance, in the IWC voice, and give them the one next step.

## What they say today (storefront.md §Emails, D-008, D-030, D-042, D-064, D-066, D-071, D-072)
Order confirmed (pieces, totals, address, estimated delivery) · preparing · item unavailable · refund · cancelled ·
return requested / not accepted · new delivery date (with keep or cancel) · faster-delivery offer and its
confirmation · coming sooner · shipped (tracking) · delivered. All plain: system font, black text, a black button,
"Questions? <email>" at the foot. The wording (D-059 drafts, `order-update.ts`) stays as written.

## Founder's direction (2026-10-08, asked as options)
"The IWC look", "Photos of the pieces", "A useful footer". Not chosen: the timeline in status emails.

## Design (round 1)
Email-safe markup (tables, inline styles, 600 px wide, readable at 375):
- **The IWC look:** cream page, the logo text with the gold India outline at the top (sent as an image at build:
  email apps do not draw SVG reliably), headings in Syne and text in Karla where the email app allows web fonts (Apple
  Mail, iOS); Gmail and Outlook fall back to Helvetica / Arial. The button in the brand colour.
- **Photos of the pieces:** a small 3 : 4 photo beside each piece in the confirmation and the item-unavailable email.
- **A useful footer:** Track your order · Shipping & returns · Contact, then "You're getting this because you ordered
  from The Indian Wholesale Club. These emails are about your order only." (draft) and the support email (Q-9).
Every email keeps today's subject and paragraphs; only the frame changes. Nothing operational appears (D-003).

## Needs
- Q-9: the support email and the sending domain.
- The footer line is a draft.

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
