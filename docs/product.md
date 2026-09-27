# Product: The Indian Wholesale Club (IWC)

Last reviewed 2026-09-27. Every rule cites `decisions.md`. Unknowns live in `questions.md`, not here.

## The problem [D-001, D-022]
Indians living in the US miss home, and specifically the clothing and spices of *their* region. Today they either:
- wait for international couriers, which take a long time and are very expensive for Indians living abroad, or
- ask a relative or friend travelling from India, and carry the feeling of owing them a favour.

## Who it's for [D-001]
- **Primary:** Indians living in the US.
- **Secondary:** US citizens who love India.

## What we sell [D-001, D-002]
- **The feeling of home**, through each region's own clothing and spices.
- **36 regions:** all 28 states and 8 union territories, presented identically. There is no "state vs UT" anywhere in the UI.
- **Product types at launch:** `clothing`, `spice`. New types only by founder decision.

## How it works

**What the customer sees** (the whole customer-side story, D-003):
1. Pick your home region.
2. Browse its clothing and spices, then order and pay in USD.
3. Receive it in the US within the estimated delivery window shown before payment (D-008).

**What happens behind the scenes** (admin only, never on a customer surface, D-003 and D-005):
1. The founder and COO sign up shops in each region and list their pieces as IWC inventory.
2. Customer orders join the current **cycle**.
3. After the cycle's cutoff, the COO collects the ordered pieces from the shops and pays each shopkeeper for what was collected.
4. Everything is packed and exported together, one export every 20–23 days.
5. The founder receives the export in the US and ships each customer's order domestically.

## Team [D-007]
| Person | Side | Owns |
|---|---|---|
| Founder | US | receiving exports, US packing and shipping, customers. Also pitches shops on trips to India |
| COO | India | shops, listings, pickups, shopkeeper payouts, export |

## Brand [D-009]
Name: **The Indian Wholesale Club** (short: IWC). A US-based site, hosted in the US (D-003).
Retail to consumers. "Wholesale Club" is only the name, with no B2B or membership (D-025). Voice and look: `design.md`.

## Principles
1. **Emotion first.** Each region page should feel like that place: its greeting, its colours, its story. (D-002)
2. **Honest.** Real origin (D-004), real delivery windows (D-008).
3. **Seamless for customers.** IWC is the seller, and operations stay invisible (D-003).
4. **Instant.** Speed was the founder's first complaint about the old code (D-011). Budgets are in `engineering.md`.
5. **Built for two operators.** The admin must let two people run everything, often from a phone (D-006, D-007).

## Surfaces [D-006, D-010]
| Surface | Who | Notes |
|---|---|---|
| Web storefront | everyone | `storefront.md` |
| Mobile app (iOS/Android) | everyone | the same app; admin mode unlocks after an admin signs in |
| Web admin `/admin` | founder, COO | hidden, loaded only after admin sign-in (`admin.md`) |
| App admin mode | founder, COO | field jobs: listing with camera, pickups, payouts, US packing |

## Not decided yet (see `questions.md`)
US carrier (Q-3) · returns policy (Q-5) · domain, support email and hosting (Q-9) · spices compliance owner (Q-10).

## Later ideas (not scheduled, founder must approve)
- **"Ask for it from home":** a customer requests an item from a region and the team sources it. This directly replaces asking a relative.
- **Notify me** when a region gets new pieces.
- **Gift boxes** per region.
