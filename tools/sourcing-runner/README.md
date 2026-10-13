# Sourcing runner (D-118)

Finds listings for the admin's **targets** ("Himachali rajma", Himachal Pradesh, food) on the Indian shops the
founder named, adds only pieces that reach the hub within the delivery limit (3 days), and checks every sourced
listing's price and stock again each week. It runs on a PC **in India** whose browser has the hub's address set on
each shop: quick-commerce shops (Blinkit, Zepto, Instamart, BigBasket) show prices and stock only for an address, and
Amazon and Flipkart print their delivery dates for it.

It signs in as the **worker** account (role `worker`, never a service key) and uses only the `worker_sourcing_*`
database functions. Nothing on the internet depends on this machine: when it is off, nothing is added or checked,
and the admin sees the last run's date in **Admin → Import → Auto-sourcing**.

| File             | What                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------- |
| `src/main.ts`    | `setup`, `run`, `try`                                                                   |
| `src/find.ts`    | one target: search every shop, pick, read pages, add listings with variants and backups |
| `src/check.ts`   | the weekly check of due listings, each page read once                                   |
| `src/shops.ts`   | how each shop is searched and read                                                      |
| `src/pages.ts`   | what is read inside a shop's page                                                       |
| `src/browser.ts` | the browser profile and one lane per shop (pages one after another, shops side by side) |
| `src/photos.ts`  | copies a new listing's photos into IWC's storage                                        |
| `src/db.ts`      | the worker's database functions and photo uploads                                       |

The matching, delivery, variant and listing rules are in `packages/shared/src/sourcing/auto` (tested there).

## Setup (once)

1. The repo with its packages installed (`pnpm install` at the root) and **Google Chrome** on the PC.
2. **The worker account:** the photo worker's account works (`docs/ops.md` §Photo worker), or a new Supabase user
   whose `profiles.role` is `worker`.
3. **Settings** in `tools/sourcing-runner/.env` (not in git; the founder writes it): `IWC_SUPABASE_URL`,
   `IWC_SUPABASE_ANON_KEY` (the public anon key), `IWC_WORKER_EMAIL`, `IWC_WORKER_PASSWORD`; optionally
   `IWC_SOURCING_PROFILE` (the browser profile folder, default `%USERPROFILE%\iwc-sourcing-profile`),
   `IWC_SOURCING_CHANNEL` (`chrome`, `msedge` or `chromium`) and `IWC_SOURCING_HEADLESS=1`.
4. **The hub's address on every shop:** `pnpm sourcing setup` opens Blinkit, Zepto, Instamart, BigBasket, Amazon,
   Flipkart and Myntra. On each, set the delivery location to the hub (Amazon and Flipkart: the pincode is enough),
   then close the browser. Do it again if the hub moves.

## Run

```
pnpm sourcing run              the checks that are due, then the queued targets
pnpm sourcing run --checks     only the checks
pnpm sourcing run --targets    only the targets
pnpm sourcing try "kasuri methi" --type food    a dry run: what it would add (nothing is written)
```

It logs to the console and `sourcing.log`. Each shop gets one page at a time with a pause of 2.5–4 seconds between
pages; the shops run side by side. How long a full run takes is not measured yet (first run at the hub).

To run it every day: Task Scheduler → Create Task → "Daily" at a quiet hour, action `cmd.exe` with arguments
`/c pnpm sourcing run` and "Start in" `C:\kod\root`, "Run only when user is logged on" (the browser opens
off-screen).

## When a shop changes

Shops change their pages. The run log shows each shop's pages and failures, and the admin page shows each shop's
last good run and last error. A shop that fails can be switched off in the admin while its reader is fixed
(`src/pages.ts`, `src/shops.ts`, or the parsers in `packages/shared/src/sourcing/auto/readers`). Zepto and Instamart
are read by the shape of their data (unverified until the first run at the hub).
