# Demo round and the placeholder catalogue (archived 2026-10-22: done, production has no placeholders)

From `docs/ops.md`. The scripts (`pnpm demo:photos`, `demo:load`, `demo:clear`) still work for a local or a new
database.

## Demo round (D-078)
The first cycle runs as a demo on the placeholder catalogue of five states, then everything is removed again.
1. **Photos (once, on the founder's machine):** `pnpm demo:photos` fills `catalogue/photos/` with public-domain
   stand-ins (museum collections and stock product photos, Openverse; paced to its 200 searches a day and cached).
   Look at them; put any photo to drop in `catalogue/demo-photo-exclude.txt` (its id is in the folder's `source.json`),
   delete that folder and run it again.
2. **Stripe test mode:** on Vercel set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` to the **test** keys and
   `STRIPE_WEBHOOK_SECRET` to the signing secret of a **test-mode** webhook endpoint (`<site>/api/webhooks/stripe`,
   `payment_intent.succeeded`), then redeploy. The app: the EAS variable `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to the test
   key, then a new build.
3. **Load:** `pnpm demo:load --url=<production DB URL> --api=https://<ref>.supabase.co --service-key=<service role key>
   --allow-remote` (a dry run), then again with `--apply`: the catalogue of Delhi, Maharashtra, Kerala, Assam and Punjab,
   the photos, labelled demo reviews from eight demo reviewer accounts, demo mode on (the banner on every page).
4. Run the demo cycle as usual (admin: open a cycle with real dates; testers pay with card 4242 4242 4242 4242).
5. **Clear:** `pnpm demo:clear` with the same flags (a dry run counts what goes), then with `--apply`: every placeholder
   product with its photos and reviews, every order containing one, the placeholder shops, the demo reviewers, the demo
   state photos; demo mode off. Then switch Vercel and the app back to the **live** Stripe keys and webhook secret.

## Clearing the placeholder catalogue (D-108, D-110)
The 2,880 placeholder listings of the master catalogue (D-108) are removed with `pnpm demo:clear --url=<production DB
URL> --api=https://<ref>.supabase.co --service-key=<service role key> --allow-remote` (a dry run that counts), then
again with `--apply`. It removes every placeholder product with its photos, sizes and reviews, the orders that
contain one, the placeholder shops, and turns demo mode off; real and imported listings stay. The loader itself was
removed (D-110): pilot listings now come from **Import from shops** (`/admin/import`, `admin.md`).
