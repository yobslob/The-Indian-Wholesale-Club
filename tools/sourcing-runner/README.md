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
pnpm sourcing classes          only clothing by class (D-132): no browser, no shops, nothing added
pnpm sourcing food [--all]     only food's net weights (D-133, D-135: the label's net quantity): no browser, nothing added
pnpm sourcing liquids [--dry]  only the liquid check (D-135): liquids archived and shown as coming soon; no browser
pnpm sourcing home [--dry]     only home weights from each option's own page (D-134; --dry writes home-weights.csv,
                               --all reads weights already read, --limit 200 takes more listings than 40)
pnpm sourcing run --type clothing --shops nishorama.com    one type (and one shop) only; two terminals can run
pnpm sourcing run --type food                              at once: each claims only its own targets and checks,
                               uses its own browser profile (the main one copied the first time, so the hub's
                               addresses carry over) and tags its lines in sourcing.log ([food], [clothing ...])
pnpm sourcing run --weights    only new clothing by class (D-132, by the name rules) and the weights listings
                               lack (D-129), home from its own pages (D-134), the liquid check (D-135), then food's
                               net weights (D-135);
                               every full run ends with them too
pnpm sourcing try "kasuri methi" --type food    a dry run: what it would add (nothing is written)
pnpm sourcing try "kurta set women" --type clothing --shops myntra.com --min 600 --max 1600 --listings 10
                                                 the same for one shop and a price band (D-121)
pnpm sourcing doctor           tests the road to IWC's database and the worker sign-in
```

Indian ISPs have answered Supabase's addresses wrongly before (Jio, Airtel and ACT in early 2026; Node says only
"fetch failed"). When the normal road fails, the runner looks Supabase up over HTTPS at Cloudflare or Google and
carries on, and says so in the log. `doctor` shows which step fails: this network's DNS, public DNS, HTTPS, sign-in.

It logs to the console and `sourcing.log`. Each shop gets one page at a time with a pause of 2.5–4 seconds between
pages; the shops run side by side. How long a full run takes is not measured yet (first run at the hub).
Amazon and Flipkart searches use the shop's own price filter for a target's band and read one result page per 10
listings it wants, up to four (D-137). Run one runner per product type across all machines: targets are shared out,
but two runners of one type would both re-check the same listings.

To run it every day: Task Scheduler → Create Task → "Daily" at a quiet hour, action `cmd.exe` with arguments
`/c pnpm sourcing run` and "Start in" `C:\kod\root`, "Run only when user is logged on" (the browser opens
off-screen).

## When a shop changes

Shops change their pages. The run log shows each shop's pages and failures, and the admin page shows each shop's
last good run and last error. A shop that fails can be switched off in the admin while its reader is fixed
(`src/pages.ts`, `src/shops.ts`, or the parsers in `packages/shared/src/sourcing/auto/readers`). Zepto and Instamart
are read by the shape of their data (unverified until the first run at the hub).
