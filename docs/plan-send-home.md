# Plan: Send home, a small gift to someone in India with every order (handoff for the next agent)

*Written 2026-11-24 by Claude from the repo at `main` (e4d4e19) and the founder's idea of the same day. Status: **nothing
built.** Read all of it, then `CLAUDE.md`. Each phase ships alone and leaves the store working. The mockups (the bag's
card for a first-time and a returning sender, the "Who's it for?" sheet, the thank-you postcard, what the loved one sees,
the account page, the India desk's queue) are on the founder's design canvas:
https://claude.ai/artifact/PPDQVX9wz4tQYutoDDh9DK. §4 describes them in words, so the canvas is a picture of this plan
and not a second source of rules. Where they differ, this plan holds.*

The founder, verbatim (2026-11-24), to be filed with `/record-answer` as the next D-number (written D-new below) before Phase 1:
> "The idea is that more than 90% of indians in us have their parents, siblings or loved ones living in India. Now
> whenever someone places an order, let's say $84 so we can make that order of $89, then we show that send $4 to your
> loved ones(to someone doing it for the first time, to [name] for someone who's done it before), now $4 is nothing to
> them but Rs 368 are a lot to someone in India, It should be shown and designed in a sleek way of advertisement. Now
> design it and make a plan. don't stress to much on the legal side as it is handled by the iwc lawyer, just design
> creatively."

His changes to the first mockups, verbatim (2026-11-24, file them in the same D-entry):
> "the card is just too big everything else is perfect just make the texts in the card smaller and by default keep the
> send button on home total should be 89, but give a proper button for the user to remove this. rest is good. also we
> shouldn't be using wine color it is showing danger. make designs like how they're done on the home page's get 10% off
> bohni style"

And then, verbatim (2026-11-24, the same D-entry; where it differs from the message above, this one holds):
> "green looks trash, keep the old designs, instead of just round up to $89, write 4$ and in designed subtext
> write,"round up to $89" so it keeps consistency and doesn't confuse anyone. In the space of "who's it for and remove
> button", write Maa, Papa, Didi, Someone Else (all four work like what "who's it for" was doing and then put a little
> cross on the upper corner of the card to remove it.) and make design better no need to make the first bag one this
> big, rest all sizes , texts and designs are good."

And last, verbatim (2026-11-24, the same D-entry; where it differs from both messages above, this one holds):
> "the bag card is just too big everything else is perfect just make the texts in the card smaller and by default keep
> the send button on home total should be 89, but give a proper button for the user to remove this. rest is good. also
> we shouldn't be using wine color in the bag, it is showing danger, so let's only put the border in wine in bag only.
> instead of just round up to $89, write 4$ and in designed subtext write,"round up to $89" so it keeps consistency and
> doesn't confuse anyone. In the space of "who's it for and remove button", write Maa, Papa, Didi, Someone Else (all
> four work like what "who's it for" was doing and then put a little cross on the upper corner of the card to remove
> it.) remove 4$ from who's it for card, only show in rupees there. also remove the line "added to this payment, not
> part of the delivery.""

File it with this reading (Claude's, proposed): $84 → $89 is a gift of $5; the founder's "$4 → ₹368" is ₹92 a dollar, the
same fixed rate as beta pricing (D-128). The default amount is the **round-up** (§2 rule 3): a bag of $85.00 rounds up
to $89 with a $4 gift, a bag of $84.00 with a $5 gift. Q-65 asks him to confirm.

---

## 1. The idea in one paragraph

Almost every customer has someone at home in India. $4 is a coffee in New Jersey and ₹368 in Kochi. At the bag, under
the pieces and above the bill, a small light card with a wine border and a stitched edge shows the trade: **$4 → ₹368**. The
gift is **already added** (the bag total reads $89, not $85), with a little × in the card's corner to remove it; the
first time, the customer taps Maa, Papa, Didi or Someone else and a short sheet asks (Maa, Papa, Didi…), their UPI ID and a 30-letter line. After payment the India desk sends the
rupees by UPI with the customer's line as the UPI note, marks it sent with the UPI reference, and the customer gets
"₹368 reached Maa". Next time the card says **"Send $4 to Maa"** and the account keeps the running total, "₹2,944 sent
home". Nothing about prices, the free line, coupons, coins, tax or shipping changes: the gift sits beside the goods,
never inside them.

## 2. The rules (binding once D-new is filed)

1. **Words:** a **loved one** is a person in India the customer sends to (`loved_ones`); a **home gift** is one order's
   gift to one loved one (`home_gifts`). Customer copy says "Send home", "Sent home", "your people at home". Add both
   terms to `docs/product.md` §Glossary (don't use: tip, donation, remittance, transfer in customer copy).
2. **Beside the goods, never inside them** (non-negotiable 5, D-128, D-140 rule 0.2): the gift is its own line in the
   bill, after Sales tax and before Total, and part of the one Stripe payment. It never counts toward the $49.99 free
   line, the $99.99 bulk saving, a coupon's minimum, coins or the struck Shipping figure; it is never taxed (`TODO(lawyer)`
   if the lawyer says otherwise); `quoteCheckout` adds it to the total last. Invoice A shows it as "Sent home (not a
   purchase)"; invoices B and C, Insights' revenue and the price sheet leave it out.
3. **The amount:** the card opens on the **round-up**: the gift that brings the bag total to the next whole dollar ending
   in 9, at least $3 (else the 9 after it): $85.00 → $4.00, $84.00 → $5.00, $87.40 → $11.60. Then **$9**, **$19** and
   **Other** ($1 up to `send_home_max_cents`). Once added, the gift is fixed in dollars: a bag that changes later, or the
   tax joining at checkout, never moves it (the round-up chip relabels only while nothing is added). `TODO(founder): Q-65`.
4. **The rupees are promised at payment:** ₹ = dollars × `send_home_inr_per_usd`, rounded to the rupee, stored on the
   gift with the rate (`inr_paise`, `inr_per_usd`). What the card shows is what Maa receives; the desk pays exactly that.
   **Empty rate = the feature is off everywhere** (D-047: nothing defaulted), so it ships dark.
5. **Only in the US for now:** the card shows for the `us` market only (orders do not open abroad yet, D-197, Q-61). Never
   in the hidden $1 payment page (D-188).
6. **The first time vs. again** (the founder's own words): with no loved one saved, the card reads "Send $4 to your loved
   ones." over the chips Maa, Papa, Didi, Someone else. With one, "Send $4 to Maa" with Maa's chip picked and any
   others beside it, "Someone else" last. Signed-in
   customers' loved ones live in the database; a guest's last one lives on the device only (localStorage, wrapped in
   try/catch), never on the server without an account.
7. **On by default, easy to take off** (founder, 2026-11-24): every bag with the feature on starts with the round-up gift
   added, so the bag total already includes it ($85.00 → $89.00) and so do the checkout button and Pay. A **little ×
   in the card's top-right corner** removes it (drawn 26 px, its tap area 44 px, `aria-label="Remove the gift"`);
   removed, the card shrinks to one line, "₹368 for your loved ones at home? **Add $4**", and stays removed for the rest
   of this bag (until an order is placed or the bag empties). Checkout's bill line has **Remove** too. A first-time gift
   has no loved one yet: tapping Checkout opens the "Who's it for?" sheet first, whose last line is **Remove the gift and
   continue**; payment never opens with an unnamed gift. Account → Your people at home has "Add Send home to my bag" (on
   by default; off = the card starts removed). One card in the bag only: nothing in the bag panel, product pages or
   Home. *Claude flagged (as with the struck prices, D-140) that a charge added before the customer asks can draw
   complaints and card disputes, and some states treat it as a pre-checked add-on; the founder chose it, and the lawyer
   reviews it.*
8. **No operations info** (non-negotiable 1, D-003): the customer and the loved one never see who on the India desk paid,
   from which account, or the cost of the rate. The UPI payer's name is whatever IWC's Indian account is called.
9. **Honest:** the card never says when the money lands unless the founder sets it (`TODO(founder): Q-66`); until then
   it says "straight into their UPI". The thank-you page and order page show the gift's real status: **Paid → Sending →
   In her UPI** (or "Couldn't send: refunded").
10. **Payout is by hand first, from a phone** (D-007, the India desk): `/admin/send-home` lists gifts to send, oldest
    first, each with a **Pay in my UPI app** button (`upi://pay?pa=<upi>&pn=<name>&am=<rupees>&cu=INR&tn=<note>`, which
    opens the desk's own UPI app on a phone with everything filled in), Copy for the UPI ID, a field for the UPI
    reference (UTR) and **Mark sent**. A payouts API comes only in Phase 3, when the founder picks one.
11. **Held when it could be fraud:** a stolen card's chargeback arrives weeks after the rupees left. A gift on a
    customer's **first paid order** waits `send_home_hold_hours` (Settings; empty = 0) in **On hold** before it joins To
    send; any open dispute on the customer (`payment_disputes`) holds every gift of theirs. `send_home_max_cents` caps one
    gift; `send_home_month_cap_cents` caps one customer's month (both empty = $100 and no monthly cap until the founder
    sets them, Q-65).
12. **Cancelling and refunds** (D-042, D-072): an order cancelled before its gift is sent cancels the gift too and
    refunds it with the order. Once sent, a gift is not refunded by an order cancel, a return or a partial refund: those
    refund goods only (`TODO(founder): Q-66`). **Couldn't send** (wrong UPI, a closed account) refunds the gift alone in
    Stripe at once and emails the customer.
13. **Words are drafts** (D-012, D-019, D-059 voice: short, plain, frank, no "authentic", "rich", "vibrant"): every line
    in §4 is Claude's draft until the founder approves it; they live in one file (`features/send-home/words.ts`) so he
    can change them in one place.
14. **Speed and limits** (non-negotiable 6): the bag, checkout and account are already dynamic, so no page-cache writes
    are added. The card is one small client component with no new dependency (target ≤ 4 KB gzipped); its only
    motion is the sewing arc, CSS on an inline SVG, off for `prefers-reduced-motion`. The database grows by two small tables. Say both in the commits.
15. **Mobile web first** (D-190): design and test at 390 px first; the app follows in Phase 4.

## 3. What the code already has (checked at e4d4e19)

| Fact | Where |
|---|---|
| The bag page, its lines, bill and checkout button | `apps/web/features/cart/cart-view.tsx`, `bag-lines.tsx`, `bill-card.tsx` |
| The bag's bill is the server's own sum, run in the browser | `features/cart/use-bag-bill.ts` → `quoteCheckout` (`packages/shared/src/domain/checkout.ts`), `billOf` (`domain/bill.ts`) |
| The bag's contents (client store) | `features/cart/store.ts` |
| Checkout request, server pricing and the stored checkout | `features/checkout/pricing.ts` (`checkoutRequestSchema`), `checkout-session.ts`, `pending_orders` |
| One PaymentIntent per visit, moved on re-price | `features/checkout/payment-intent.ts` |
| The order is created from the stored checkout by device, webhook or sweep | `features/checkout/finalize.ts`, `create_order` (`docs/flows.md` §3) |
| Thank-you page and its running stitch | `features/checkout/checkout-success.tsx`, `stitch.tsx` |
| Order page, cancel and refunds | `features/orders/order-view.tsx`, `actions.ts`; `docs/flows.md` §7b; `app/admin/refund` |
| Saved addresses for signed-in customers (the pattern loved ones follow) | `features/checkout/saved-details.ts`, `saved-addresses.tsx` (D-114) |
| Account pages | `app/(store)/account/(profile)` |
| Prices abroad and the market | `features/shell/market.tsx` (`useMoney`, `data-market`) |
| Settings: one list drives the page and its save; empty = not decided | `features/admin/settings-fields.ts`, table `pricing_settings` |
| Emails go through the outbox | `email_outbox`, `docs/storefront.md` §Emails |
| Disputes are recorded | `payment_disputes` (`docs/flows.md` §3 step 6) |
| Tokens: brand `#7A2E23`, canvas `#F4EFE6`, paper `#FBF8F3`; fonts Cinzel (display), Syne (headings), Karla | `packages/tokens/tokens.js`, `apps/web/app/fonts.ts` |
| IDs | D-new is the next free D-number; Q-65 – Q-67 (§8) are already in `docs/questions.md`; latest migration `20261125090000_recipes_publish_all.sql` |

## 4. The design (canvas: https://claude.ai/artifact/PPDQVX9wz4tQYutoDDh9DK)

**Look in the bag** (founder: "only put the border in wine in bag only": a wine fill reads as danger there). The card
is light: `paper` `#FBF8F3`, a 1.5 px **brand** (`#7A2E23`) border, radius 20 px, and a thin dashed line sewn 5 px inside
it (`#7A2E23` at 35%), so it still reads as a label stitched onto the page. Text in `ink` and `ink-muted`; the only
other colour is the sewing gold `#C9973F` (the arc and arrow, decoration only) and a dark gold `#8A5A00` for the
handwritten note (AA on paper). Wine is never a fill, a text colour or the bill line's colour in the bag. Small text:
kicker 10 px, tracked, `ink-muted`; headline Syne 600, 16 px; the rupees Cinzel 700, 22 px, `ink`; body 12 – 13 px;
amount chips 44 px tall in a row of four (the $4 chip 1.5× wider), the person chips 40 px in a row of four; picked
chips get the brand border (1.5 px) on `canvas`, the others a `line` border. The amount and the rupees are joined by a
48 px gold dashed arc that sews itself on a 2.4 s loop (stroke-dashoffset, still with reduced motion). Add one token,
`gift-thread` `#C9973F` (decoration only, kept out of the text-contrast test). Outside the bag (the thank-you
postcard, the account panel) the wine-and-gold look of the first mockups stays. No photos, no emoji, no gradient.

**4.1 The bag, first time** (artboard 1). Under the bag's one-line summary, above the bill, already added:
- × in the top-right corner (rule 7). "SEND HOME · ADDED" and "Send $4 to your loved ones".
- The trade on one line: "$4" → the sewing arc → "₹368" and "straight into their UPI".
- Amount chips **$4** (picked) · **$9** · **$19** · **Other**, every chip's main text a plain amount so none reads
  differently; inside the $4 chip, under "$4", a handwritten subtext "round up to $89" (Caveat 600, 14 px, `#8A5A00`;
  the figure is the bag's own round-up total, and the subtext sits in whichever chip is the round-up). Picking a chip
  changes the $, the ₹, the bill line and the totals at once. Other opens a number field ($1 – max).
- A dashed divider, then four chips with no label above them: **Maa · Papa · Didi · Someone else** (dashed). They are
  "Who's it for?": each opens 4.2 with that relation already picked; Someone else opens it with none.
- No small print under the chips (the founder removed "Added to this payment. Not part of free delivery."; the bill's
  own line says what it is).
- The bill shows "Sent home · ₹368 $4.00" in the bill's normal colours and Bag total $89.00; Checkout reads $89.00.
- Removed (×): one line on the same light card, "₹368 for your loved ones at home?" and an outlined **Add $4**; the
  bill line goes and the totals drop back.

**4.2 Who's it for?** (artboard 2, a bottom sheet on phones, a dialog on wide screens). "SEND ₹368 HOME" kicker, "Who's it
for?", relation chips **Maa · Papa · Dadi · Nani · Bhaiya · Didi · Someone else** (also Dada, Nana in the list: the
chips fill the "What do you call them?" field, which the customer can change: "Amma", "Mummy", "Chachu"); **Their UPI ID
or UPI number** (validated: a UPI ID `name@handle`, or a 10-digit Indian mobile starting 6 – 9; Phase 3 adds the name
check the mockup shows, "Registered to L*** M***"); **Where's home?** (optional: the 36 regions, used on the postcard);
**A line for them** (30 letters, shows in their UPI app); **Remember Maa for my next order** (signed in: saved; guest:
this device). Rupees only on this sheet, never dollars (founder): the
button reads **Send ₹368 to Maa**, the name field's hint "Next time your bag will say "Send to Maa"."; under the button **Remove the gift and continue**. Opens from a name on the card
(that relation picked) or, for an unnamed gift, from Checkout.

**4.3 The bag, again** (artboard 3). Already added for the last loved one sent to, on the same light card as 4.1: the × in the
corner, the initial in a gold-ringed circle ("M"), "SEND HOME · ADDED", **"Send $4 to Maa"**; the trade "$4 → ₹368 into her UPI"; "Last time: ₹460 on
Nov 2." (from the last sent gift; "Nothing sent to Papa yet." for a saved one never sent) and **Change amount** (opens
the amount chips and their note); then, under the dashed divider, the saved loved ones as chips in the same row of four (Maa
picked · Papa · Didi) and **Someone else** (opens 4.2). The bill shows "Sent home · ₹368 to Maa $4.00" and $89.00. × and Add answer in
the same frame (D-140 rule 0.1); the server prices it again at checkout.

**4.4 Checkout.** No card. The bill (the same `BillCard`) shows the gift line with a small **Remove**. The Pay button's
amount includes it.

**4.5 Thank-you page** (artboard 4). Under "Order placed": a **postcard** tilted −1.2°, paper with a soft shadow, a wine
stamp with the heart and "₹368" in the corner, a postmark ("NJ · USA", the date), "SENT HOME WITH IWC", "₹368 is on its
way to Maa." (Syne 26 px), the customer's line in a handwritten face (Caveat 600, loaded only on this page), "To Maa ·
Kochi, Kerala · UPI 98470·····", and the running stitch as a three-stop track: **Paid → Sending → In her UPI**. Then "We'll
email you the moment it lands, with the UPI reference." and a small wine panel: "Sent home with IWC so far ₹828 · 2 times
to Maa". The bill shows the gift line and "Total paid".

**4.6 What the loved one sees** (artboard 5). Phase 1: their UPI app's own "Received ₹368" with the note "From Yogesh in
USA. <their line>" (the UPI note, ≤ 50 characters: `From <first name> in USA. ` + the line, cut to fit). Phase 3: an
SMS or WhatsApp from IWC: "Yogesh sent you ₹368 from America. Namaste Maa. It's already in your UPI. Sent with love
through The Indian Wholesale Club."

**4.7 Account → Your people at home** (artboard 6, `/account/people`). A wine panel: "SENT HOME WITH IWC", the lifetime
₹ total (sent gifts only), "7 times since October · $32 from your orders"; a card per loved one (initial, name, city,
masked UPI, "₹2,024 sent · 5 times", Edit); "+ Add someone at home"; History (date · name · status · ₹), statuses
Sending (caution), In her/his UPI (positive), Couldn't send: refunded; the "Offer Send home in my bag" switch. Linked
from the account page and from the postcard.

**4.8 Admin → Send home** (artboard 7, `/admin/send-home`, phone first). Tabs **To send · n**, **On hold · n**, **Sent**,
**Couldn't send**; "Oldest first" and "₹1,196 to send today". Each gift: loved one and city, "for <customer> · <order
number> · paid 2 h ago", ₹ big; the UPI ID in a mono box with **Copy**; the note; **Pay ₹368 in my UPI app**; the UTR field
and **Mark sent**; "Couldn't send (wrong UPI) · refund the $4.00". Today gets a "Send home: n to send" line. The admin
order page shows the gift and its status.

## 5. Data and server

**Migration `<date>_send_home.sql`:**
- `loved_ones`: `id`, `profile_id` (owner, not null), `relation` (`maa`, `papa`, `dadi`, `nani`, `dada`, `nana`, `bhaiya`,
  `didi`, `other`), `call_name` (1 – 20), `upi` (checked format), `region_id` (null ok), `note` (≤ 30), `created_at`,
  `archived_at`. RLS: the owner only; no store view needed (the owner reads their own rows).
- `home_gifts`: `id`, `order_id` (unique: one gift per order), `profile_id` (null for a guest), `loved_one_id` (null ok),
  a snapshot (`call_name`, `relation`, `upi`, `region_name`, `note`, `sender_first_name`), `usd_cents` (> 0),
  `inr_per_usd` (numeric), `inr_paise`, `status` (`on_hold` | `to_send` | `sent` | `failed` | `refunded` | `cancelled`),
  `hold_until`, `sent_at`, `sent_by`, `utr`, `failed_reason`, `refund_id`, timestamps. Admin only; customers read
  `store_home_gifts` (own rows: date, call name, ₹, customer status, masked UPI; never `sent_by`, `utr` beyond its last 4,
  `inr_per_usd` or `hold_until`).
- `orders.home_gift_cents` (default 0; part of `total_cents`). `pending_orders` keeps the gift chosen.
- `pricing_settings`: `send_home_inr_per_usd`, `send_home_max_cents`, `send_home_month_cap_cents`, `send_home_hold_hours`;
  a "Send home (D-new)" group in `settings-fields.ts`; empty rate = off (rule 4).
- `create_order` takes the gift: inserts the `home_gifts` row (`on_hold` with `hold_until` when rule 11 says so, else
  `to_send`), in the same transaction, so device, webhook and sweep all make it once.
- `admin_home_gift_sent(id, utr)`, `admin_home_gift_failed(id, reason)` (the route refunds Stripe first, then records:
  the D-042 order of things), `customer_cancel`/`cancel_order` cancel and refund an unsent gift; `store_home_gifts` and
  `store_sent_home_total()` for the account and the postcard. On hold → To send is read at query time (`hold_until <=
  now()` and no open dispute), so no cron.
- SQL tests: RLS (another customer sees nothing), one gift per order, the hold, sent/failed transitions, cancel before
  and after sending, the total never includes an unpaid gift.

**Shared (a new `send-home.ts` in `packages/shared/src/domain/`, pure, unit-tested):** `roundUpGiftCents(totalCents)`, `giftInr(cents,
rate)`, `upiOf(text)` (validate and normalise), `upiNote(firstName, line)` (≤ 50), `upiPayLink(gift)`. `quoteCheckout`
gains `giftCents` (default 0) added after tax; `Bill` gains `homeGiftCents` and `billOf` passes it; `BillCard` draws the
line. Tests: every existing quote is unchanged when `giftCents` is 0 (run the whole suite), and the free line, bulk
saving, coupon minimum and tax ignore the gift.

**Checkout:** `checkoutRequestSchema` gains `gift: { cents, lovedOneId? | lovedOne: {...}, save } | null`; the server
re-checks the rate, the caps and the UPI, re-prices the gift's rupees itself, stores it in `pending_orders`; the
PaymentIntent amount includes it.

**Emails:** the confirmation shows the gift line and "₹368 is on its way to Maa"; new `home_gift_sent` ("₹368 reached
Maa", with the UTR's last 4 and the postcard's look) and `home_gift_failed` ("We couldn't send ₹368 to Maa. Your $4.00 is
back on your card.").

## 6. Phases (each ships alone; the store works after every one)

**Phase 0: file and ask.** `/record-answer` D-new (the founder's words above, with §2 as "what it means"), ask the founder
Q-65 – Q-67 (already in `docs/questions.md`), the glossary terms, a line in `docs/status.md`. *Done when* the docs audit passes.

**Phase 1: the money path, dark.** Migration, shared logic, `quoteCheckout`/`Bill`, checkout schema and pricing,
`create_order`, Settings group, `/admin/send-home` with Pay in my UPI app, Mark sent, Couldn't send (refund), the admin
order page's gift. No customer card yet; a gift can be made only by a test checkout with the rate set locally. *Done
when* `node scripts/check.mjs` is green, a local Stripe test payment with a $4 gift creates one order with `total_cents`
+400 and one `to_send` gift of ₹368 at rate 92, Couldn't send refunds exactly $4.00 in Stripe test mode, and every
existing checkout test passes unchanged.

**Phase 2: the customer side.** The bag card (4.1, 4.3), the sheet (4.2), checkout's line (4.4), the postcard (4.5),
the order page's gift card, `/account/people` (4.7), the two emails, the guest's device memory, × and Add, and the account
switch. *Done when* at 390 px: a first-time guest's bag opens at $89 with the round-up added, Checkout opens the sheet,
they fill it, pay, see the postcard; "Remove the gift and continue" pays $85; a signed-in customer with Maa saved sees
"Send $4 to Maa" already added; × on the card, Remove at checkout and Add move the total by exactly the gift; each of Maa, Papa, Didi opens the sheet with
that relation picked;
the card never shows with the rate empty, abroad, or on the $1 page; an e2e spec covers the first two; the first-load
JS of `/cart` grows by ≤ 4 KB; Lighthouse accessibility on `/cart` stays ≥ 95.

**Phase 3 (after the founder picks providers):** a payouts API instead of the desk's thumb (Mark sent becomes
automatic, the UPI name check in 4.2), and the SMS or WhatsApp to the loved one (4.6). Not started without his choice.

**Phase 4: the app.** The same card, sheet and postcard in `apps/app`'s bag and thank-you screen, on the same API.

## 7. Measure it (admin Insights, no new tracking service)

Share of paid orders with a gift, the average gift, round-up vs. the other chips, repeat senders (a second gift within
60 days), gifts on hold and couldn't-send per week, and time from paid to sent (target set by the founder). Counted
from `home_gifts` and `orders`, never shown to customers.

## 8. Open questions (ask the founder; file in `docs/questions.md`)

| # | Question | Why it matters | Until answered |
|---|---|---|---|
| Q-65 | **Amounts and the rate:** keep the round-up as the default (your $84 → $89 is a $5 gift, ₹460; $85 → $89 is your $4, ₹368)? The other chips $9 and $19? The rate: ₹92 like beta pricing? If the market rate is lower, IWC pays the difference on every gift, plus Stripe's card fee on the gift's dollars. The cap per gift and per month? | what the card says and what each gift costs IWC | round-up, $9, $19, Other; rate empty (off); $100 per gift, no monthly cap |
| Q-66 | **Promises and refunds:** how soon after payment does the money land (shown on the card if set)? Is a sent gift kept when the order is later cancelled or returned? How many hours does a first order's gift wait (`send_home_hold_hours`)? | the card's promise and the fraud hold | "straight into their UPI", no time; sent gifts kept; 0 hours |
| Q-67 | **Who pays it out:** which Indian account and UPI app the India desk uses (its name shows to Maa as the payer), and later a payouts API and an SMS/WhatsApp sender (Phase 3) | the payer name and Phase 3 | the desk's own UPI by hand |
