# Open questions (do not assume answers)

If work depends on one of these: ask the founder, or build it so every answer still works and say so.
When one is answered, move it to `decisions.md` as a new D-entry and delete it here.
Q-1, Q-2, Q-4, Q-6, Q-7, Q-8, Q-11 – Q-14 were answered on 2026-09-28 (D-023 – D-036), Q-16 and Q-17 too (D-041, D-042), Q-15 and Q-20 on 2026-09-29 (D-047, D-045), Q-21, Q-24 and Q-25 on 2026-09-30 (D-052), Q-26 the same day (D-055), Q-23 too (D-056), Q-27 too (D-057), Q-22 too (D-058), Q-28 and Q-29 on 2026-10-01 (D-060, D-061), Q-18 (D-070), Q-5 (D-071), Q-31 (D-072), Q-19 (D-073), Q-10 and Q-30 (D-074) on 2026-10-06. The ones below are facts the
founder doesn't know yet. **None blocks the restructure (R2–R8). All must be answered before launch.**

| ID | Question | Why it matters | Rule until answered |
|---|---|---|---|
| Q-3 | Which US carrier ships orders to customers (USPS / UPS / other)? | label integration (F-1) | admins pick the carrier and type the tracking number; links for USPS, UPS and FedEx (D-066) |
| Q-9 | Domain name and support email (bought at launch, D-046) | emails from the real domain, SEO | Vercel URLs and Resend's test sender until launch (D-046) |
| Q-32 | Should a piece be **held** for a customer while they pay? Today stock is reserved only once the payment has gone through (`create_order`, INV-3): two people can pay for the last piece at the same moment, and the second is refunded in full with "an item sold out while you were paying". Options: (a) keep it so (simplest; the refund is automatic); (b) hold the bag's pieces for a few minutes from "Continue to payment" (how many?), released if the payment doesn't finish; (c) authorise the card first and charge it only once the order exists, so a refused order is a released authorisation, not a refund (fewer payment methods support this). Stripe keeps its processing fee on a refunded payment under standard pricing, so (b) and (c) also avoid paying that fee for nothing | a customer charged and refunded for a piece they can't have; fees on refunds | (a): the payment is refunded in full and the customer told why (flows.md §3 step 5) |
