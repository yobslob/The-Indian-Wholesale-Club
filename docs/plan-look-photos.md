# Plan: every colour, pack and style shows its own photos

*Written 2026-11-07 by Claude, using the repo at `optimize/lighter-site` and the shops' page formats. Status: **Phases 1 to 4 built (D-194), nothing released and nothing run on production. The
page sample is still to do: it is now the first dry run of Phase 3.** §8's defaults are in use. For the agent that carries it out: read all of it before starting. Each phase can
ship by itself and leaves the store working.*

The founder, verbatim (2026-11-07), to be filed with `/record-answer` as the next D-number once §8 is answered:
> "We have a greater problem to solve in many of the products: 1. In clothing most products have different colors, but on
> clicking it is showing the same photo on the card. 2. In food, many products have a single piece chocolate double piece
> chocolate or a family pack but on all clicks it only shows what was scraped. 3. In home n decor, almost all pieces are
> singular but there could be some which have variety but singular set of photos. […] this solution should not affect any
> part of the rest of the website in any way, the customer's experience should be seamless(I have hardly got my website on
> its feet again, don't shake it)"

---

## 1. The problem in one paragraph

A listing's photos belong to the whole listing. When a customer picks "Maroon" instead of "Navy", or "Family pack"
instead of "Single", on the product page or in a card's + picker, the photos stay the same. The bag line and the card
also keep the listing's main photo. The customer can't see what they are buying.

## 2. What the code already has (checked, not assumed)

| Fact | Where |
|---|---|
| `product_media.variant_id uuid references product_variants` **exists since the baseline**, nullable, cascade delete | `supabase/migrations/20260928000001_iwc_baseline.sql` l. 252 |
| The store view already exposes it: `store_media` selects `m.variant_id` | `20261109090100_simple_reads.sql` l. 12 |
| `store_product_page()` already sends every photo with its `variant_id`, and every variant with its `options`, to the product page | `20261111090100_subcategories_popular_packs.sql` (`'media'`, `'variants'`) |
| The sourcing runner **already tags some photos**: the page's first 8 photos go in untagged, then one photo per item that has its own image (`v.image`), tagged through `item_key → product_sources.variant_id` | `packages/shared/src/sourcing/auto/listing.ts` l. 288–296, `worker_sourcing_media` |
| Which readers give a per-item image: Shopify (`featured_image`), Zepto / Instamart (`variant.images`), grocery readers, Savana (`goodsThumb`, a thumbnail). **Amazon gives none** (`amazonVariants` passes no image), Myntra's other colours are read from their own pages and tagged (corrected by Phase 0: 845 tagged photos), Flipkart's other values are read for price only | `packages/shared/src/sourcing/variants.ts`, `auto/readers/*.ts` |
| The bookmarklet takes Amazon's `colorImages` = the **selected colour's** photos only | `packages/shared/src/sourcing/bookmarklet.ts` l. 44 |
| The gallery ignores `variant_id`: main photo + 3 small, in `is_primary, sort_order` order; tagged photos just show up as extra photos | `apps/web/features/catalog/product-gallery.tsx` |
| The gallery and the picker are **siblings** on the server page: the picked variant lives inside `AddToCart` and the gallery can't see it | `app/(store)/states/[region]/[product]/page.tsx`, `features/catalog/add-to-cart.tsx` |
| The card's + reads its options from `/api/card-options` (CDN, 5 min). Cached pages carry no options (D-145, `slim-cards.ts`) | `app/api/card-options/route.ts`, `packages/db/src/store/index.ts` `getCardOptions*` |
| `_store_card_options()` is also embedded in `store_browse` cards → **don't change it** (it would grow cached pages) | `20261111090100_…` l. 453, 487 |
| The bag stores `imagePath` per line, set by the client when the piece is added (today the listing's main photo) | `features/cart/store.ts`, `add-to-cart.tsx` l. 103, `card-options.ts` `bagLine()` |
| Store pages pick up new photo rows within their own refresh; the photo redo already relies on this and asks for **no page-cache write** | `tools/photo-redo/README.md` l. 50 |
| Duplicate-picture check (PSNR ≥ 27 dB at 256²) and `pictureGroups` / `sharpest` already exist | D-142, `packages/shared` `same-picture.ts`, `tools/sourcing-runner/src/photos.ts` |
| The runner already has a per-run photo-space cap: `--photo-gb` | `tools/sourcing-runner/src/budget.ts` (D-171) |

**So:** some listings (Shopify, quick-commerce food, Savana) probably **already have** per-variant photos stored and
just aren't shown. Amazon (most clothing colours, most food packs, home) has none stored. §5 Phase 0 measures how many
of each.

## 3. Solutions considered

| # | Approach | Fixes | R2 cost | Risk to the live store | Verdict |
|---|---|---|---|---|---|
| A | **Show what's already tagged**: the product page swaps the gallery to the picked look's photos (client-side, data already in the page) | listings that already have tagged photos | 0 | very low: product page only, no migration | **Do first (Phase 1)** |
| B | **Card + bag**: `/api/card-options` adds each option's photo; the + picker and the bag line use it | the card complaint, the bag thumbnail | 0 | low: one CDN-cached API answer grows ~60 B per option; nothing in the page cache | **Do (Phase 2)** |
| C | **Backfill**: the runner re-reads each multi-look listing's source page **once** and stores **one** photo per look that's missing one | Amazon clothing colours, Amazon food packs, home styles | ~70 KB per added photo (two AVIF copies) | low: worker-only migration, runs off the site, pages pick it up on their own refresh | **Do (Phase 3), capped** |
| D | Capture per-look photos at import going forward (runner + bookmarklet + admin) | new listings | same per photo | low | **Do (Phase 4)** |
| E | Full gallery for every look (4–8 photos per colour, a child page visit per colour) | best detail | 5–8× C; ~3–5 GB for clothing alone | high bot-block risk; blows R2 | **No**. Allow a 2nd photo per look only for clothing (§8 Q1) |
| F | Merge Myntra's colour siblings (each colour is its own style id) into one listing | Myntra "colours" | 0 now, data surgery | high: slugs, sources, orders, reviews, SEO | **No.** Myntra listings already show the right photo for their one colour |
| G | Hotlink the shop's photos for extra looks | 0 storage | 0 | breaks D-003 (customers must never load a shop's address) | **Forbidden** |
| H | Recolour one photo with AI per colour | 0 page loads | same as C | dishonest (D-004 spirit, D-100: real photo first); colours wrong | **No** |
| I | Store only the 640 px copy for look photos | ~45% less per photo | lower | breaks the fixed two-copy contract (D-141): `StorePhoto` asks for 1200 | **No** |
| J | A new table `look_photos` or a `look` column | — | — | a migration on a hot table; not needed | **No**: `variant_id` + the look rule in §4 is enough |

## 4. The chosen design

### 4.1 A new glossary word: **look**
A **look** is what a variant looks like: its `options` **without `size`**. So:
- clothing: `colour` (+ `style` when present). Navy-S, Navy-M, Navy-L are one look.
- food: `pack` / `flavour` / `style` ("Single", "Family pack", "Mango"). Each is its own look.
- home & gifts: `colour` / `style` / `pack`.

A photo belongs to a look through `product_media.variant_id`. **A photo tagged to Navy-M belongs to every Navy
variant.** That's why the schema needs no change for linking. Untagged photos (`variant_id is null`) are shared.

Add `look` to `docs/product.md` §Glossary (code: `lookKey()`, `photosForLook()`; customer copy: never shown as a word;
don't use: "variant photo", "swatch" for the concept).

### 4.2 One pure module, shared by web, API and runner
`packages/shared/src/domain/looks.ts` (pure, unit-tested, < 120 lines):
- `lookKey(options, productType): string`: stable key of `options` minus `size` (sorted keys, `displayOption`-normalised
  values, lower-case). `''` for a listing with one look.
- `looksOf(variants)`: the distinct looks in variant order. A listing "has looks" when there are ≥ 2.
- `photosForLook(media, variants, look)`: **the gallery rule**
  1. the look's own photos (tagged to any variant of that look), in `sort_order`;
  2. then the shared (untagged) photos, in today's order;
  3. **if the look has no photo of its own → exactly today's order, all photos.** Never empty, never worse than today.
  Photos of *other* looks are left out of that look's gallery and viewer.
- `initialLook(variants, media)`: the look of the main photo when one of its variants is in stock, else the look of
  the variant `AddToCart` picks today (first in stock). Both the gallery and `AddToCart` use this, so the server
  render and hydration match and **the first paint is the same as today** for almost every listing.
- `lookPhoto(look, media, variants): storage_path | null`: the look's first own photo (for cards and the bag).

### 4.3 What the customer sees (and what they must not notice)
- **Product page:** tapping a colour or pack chip fades the main photo to that look's photo (opacity, 150 ms; none with
  `prefers-reduced-motion`). The small photos and the viewer follow. The photo box keeps its size, so nothing moves on
  the page (CLS 0). The look's first photo starts loading on `pointerdown` / hover of its chip, so the swap is instant.
  Picking a **size** never changes the photos. A look without its own photo keeps the photos as they are.
- **Card + picker:** choosing a colour in the + picker shows that colour's photo on the picker's thumbnail and on the
  card while the picker is open (§8 Q2). It goes back when the picker closes without adding.
- **Bag:** the line shows the look's photo (`imagePath` = `lookPhoto() ?? primary_image_path`). Lines already in
  customers' bags are unchanged.
- **Nothing else changes:** Home, state pages, See all, search, the album, prices, stock, checkout, coupons, emails and
  the admin's existing screens.

## 5. Budgets (D-147, `docs/monitoring.md` §1) — check them before every phase

| Resource | Today | This plan may add | Hard stop |
|---|---|---|---|
| **Cloudflare R2 storage** | **8.39 GB of 10 GB free** (already past the 6 GB budget line; the 9 GB line is close) | **≤ 0.5 GB** across all backfill runs ≈ 7,000 photos at ~70 KB | the founder reads **9.3 GB** on the dashboard → stop all runs |
| R2 Class A (writes) | — | 2 per stored photo (two copies) ≈ 14K | far under 1M/month |
| Supabase DB size | 250 MB budget | ~7,000 `product_media` rows × ~250 B ≈ 2 MB | — |
| **Supabase memory / CPU** | **already over** (1.57 of 1.4 GB, an outage on 2026-11-04) | small paged reads only: ≤ 25 listings per plan call, one insert call per listing, a pause between listings | run only at a quiet US hour; stop on any statement timeout |
| Supabase egress | 2.5 GB budget | plan rows only (no photo bytes go through Supabase) | — |
| Vercel page-cache writes | Pro since 2026-11-07; still treat as limited | **no explicit refresh**: product pages pick up new rows on their own refresh (as the photo redo); cached cards unchanged (no card field added) | never call a refresh for > 100 listings at once (it refreshes the whole store, D-145) |
| Vercel functions | — | `/api/card-options` unchanged in count; the answer is a bit bigger and CDN-cached | — |
| Product page JS | ≤ 150 KB first load (engineering.md) | ≤ +2 KB (a tiny store + `looks.ts`) | `check.mjs http` / `bundle` must pass |

R2 rough sum (Phase 0 replaces these with real counts): clothing listings with looks × extra looks × 70 KB +
food multi-pack listings × extra packs × 70 KB + home. If Phase 0's sum is over 0.5 GB, do clothing first, then food
packs whose photos differ (the duplicate check drops identical pack photos), then home. Ask before going past the cap.

**Optional headroom (Phase 0b, report only):** list R2 objects under `products/` that no row points at (abandoned
uploads under `products/drafts/`, paths replaced by re-imports: "Known leftovers" in `status.md`). Deleting is free
in R2, but **delete nothing without the founder's yes**, and leave a 7-day grace for cached pages.

## 6. Phases

Each phase: a branch from `main`, small commits that say what and why plus cost lines (CLAUDE.md), `/check`, then the
founder merges. **Release one phase at a time, at a quiet hour.** A deploy empties the page cache.

### Phase 0: measure (read-only, no code shipped)
1. **SQL for the founder to run in Supabase's SQL editor** (read-only; paste the results back). Put them in
   `docs/monitoring.md` §6 as query L (H is search's letter there):
   ```sql
   -- L1. listings with 2+ looks (options without size), by type, and how many already have a photo per look
   with v as (
     select p.id, p.product_type, pv.id as vid, (pv.options - 'size') as look
     from public.products p join public.product_variants pv on pv.product_id = p.id
     where p.status = 'live' and not p.is_placeholder and pv.is_active),
   looks as (select id, product_type, count(distinct look) as n from v group by 1, 2 having count(distinct look) > 1),
   tagged as (
     select v.id, count(distinct v.look) as with_photo
     from v join public.product_media m on m.variant_id = v.vid group by 1)
   select l.product_type, count(*) as listings, sum(l.n) as looks,
          sum(coalesce(t.with_photo, 0)) as looks_with_photo,
          count(*) filter (where coalesce(t.with_photo, 0) = 0) as listings_with_none
   from looks l left join tagged t on t.id = l.id group by 1 order by 1;
   -- L2. tagged photos today, by type and shop
   select p.product_type, coalesce(p.source_site, '(none)') as site, count(*) as tagged_photos
   from public.product_media m join public.products p on p.id = m.product_id
   where m.variant_id is not null and p.status = 'live' group by 1, 2 order by 3 desc;
   -- L3. extra looks still without a photo, by type and shop (the backfill's size)
   with v as (
     select p.id, p.product_type, p.source_site, pv.id as vid, (pv.options - 'size') as look
     from public.products p join public.product_variants pv on pv.product_id = p.id
     where p.status = 'live' and not p.is_placeholder and pv.is_active)
   select product_type, source_site, count(*) as looks_without_photo
   from (select distinct v.id, v.product_type, v.source_site, v.look from v
         where exists (select 1 from v v2 where v2.id = v.id and v2.look <> v.look)
           and not exists (select 1 from v v3 join public.product_media m on m.variant_id = v3.vid
                           where v3.id = v.id and v3.look = v.look)) x
   group by 1, 2 order by 3 desc;
   ```
   (Check the column names against `data-model.md` before handing them over: `source_site`, `is_active`. Run each on
   the local database first.)
2. **Sample 20 source pages** (10 clothing, 10 food; Amazon first) on the founder's machine with the runner's browser,
   no writes. For each, record which of these works (§6 Phase 3 step 2): (a) a per-colour image map in the page's
   twister data, (b) swatch thumbnails that give full size when the size token (`._SS40_`, `._AC_SR38,50_`…) is
   removed, (c) only the child page (`/dp/<ASIN>`) has it. Also note each image's real pixel size.
3. **Phase 0b** (optional): `pnpm photos:orphans`, a new report-only script next to `photos:move`. R2 `ListObjectsV2`
   (Class A, 1 per 1,000 keys) against every stored path (`product_media`, `review_photos`, `home_photos`, region
   photos). It writes `out/orphans-<date>.csv` (key, bytes, last modified) and a total. No deletes.
4. Write the numbers into a "Phase 0 results" table at the end of this file and size Phase 3 from them.

**Done when:** L1–L3 results are in, the 20-page sample says which method works per shop, and the R2 sum for Phase 3 is
known and approved.

### Phase 1: the product page shows the picked look (frontend only, no migration, no R2)
1. `packages/shared/src/domain/looks.ts` (§4.2) + `looks.test.ts`: one look, colour × size, pack-only food, untagged
   only, a look with no photo (today's order exactly), a tag on another size of the same colour, a photo tagged to an
   inactive/missing variant (treated as shared, never dropped), stable keys across option spelling ("navy"/"Navy").
2. `features/catalog/look-store.ts`: a tiny client store (the same library as the bag's `useCart`), keyed by product id:
   `{ look }`. `AddToCart` writes it in `select()`, only when the look changes. No URL change, no navigation.
3. `ProductGallery` takes `variants` as well as `media`. It renders `photosForLook(media, variants, look ?? initialLook)`.
   Server render uses `initialLook`. Crossfade by keying the main `<StorePhoto>` on its path, with an opacity transition
   in CSS. The `priority` main photo stays the first photo of the initial look (LCP unchanged). The viewer gets the same
   list.
4. `AddToCart`: initial variant = first in-stock variant **of `initialLook`** (falls back to today's choice). Preload on
   chip `pointerdown` / `pointerenter`: `new Image()` with the same AVIF `srcSet`/`sizes` `StorePhoto` uses (export a
   helper from `store-photo.tsx`; don't duplicate the URL logic).
5. `AddToCart`'s bag line uses `lookPhoto(...) ?? product.primary_image_path`. Same for `flyToBag`.
6. **Kill switch:** `NEXT_PUBLIC_LOOK_PHOTOS` (anything but `off` = on). Off → the gallery and the bag behave exactly as
   today. The founder sets it in Vercel; the agent never edits `.env` files.
7. Seed: add one placeholder listing (`is_placeholder = true`) with two colours × three sizes and one tagged photo per
   colour, plus one food listing with two packs, to `catalogue/`/the local seed, so e2e can test it.
8. e2e (`customer-*.spec.ts`): pick colour B → the main photo's `src` is B's photo, the page doesn't move
   (bounding box unchanged), the viewer opens on B's photos; pick a size → photo unchanged; a listing without tags →
   identical gallery to `main`. Add to bag → the bag line shows B's photo.
9. Check the app: `apps/app`'s product screen must not break on tagged photos (it already receives them). Write in
   `status.md` "Not built yet" that the app gets the swap in its next build.

**Cost lines for the commit:** page cache: +0 B per page (data already sent); JS: +≤ 2 KB on the product page; R2/DB: 0.
**Done when:** `/check` passes (`docs typecheck lint test build http e2e`), the product page stays inside its budgets,
and a listing that already has tagged photos (find one with L2) swaps correctly on a production-like local build.

### Phase 2: card picker + bag from the card (no migration)
1. `packages/db` `getCardOptions` / `getCardOptionsFor`: alongside the `store_variants` read, read in parallel
   `store_media (variant_id, storage_path, sort_order)` for those products where `variant_id is not null`. Give each
   option `image_path` = its look's first photo, or `null`. `cardOptionSchema` gets `image_path: z.string().nullable().optional()`
   (optional, so older app builds and old cached answers still parse).
2. **Don't touch `_store_card_options()`**: it's inside `store_browse`'s cached cards.
3. `option-picker.tsx` / `quick-add.tsx`: when a colour is chosen, the picker's 48 px thumbnail and (§8 Q2) the card's
   photo show that look's `image_path`. It goes back when the picker closes without adding. Preload the image when the
   chips arrive (they're few). `bagLine()` takes the option's `image_path ?? primary_image_path`.
4. Tests: `card-options.test.ts` (look mapping: a photo tagged to Navy-S shows for Navy-M), the API route's zod output,
   e2e: + on a two-colour card → pick colour → thumbnail changes → add → bag line photo.

**Cost lines:** one more small Supabase read per *uncached* `/api/card-options` call (CDN 5 min); answer +~60 B per
option; page cache 0. **Done when:** `/check` passes and a multi-colour card behaves as §4.3 says.

### Phase 3: backfill the missing look photos (worker-only migration + a runner command)
**Migration** `<timestamp>_look_photos.sql` (worker functions only, no store change, no new table; header with Size /
Egress / Page cache lines like the others; tests in a new look_photos.test.sql under `supabase/tests/`):
- `worker_look_photo_plan(p_type product_type, p_after uuid, p_limit int)`: live, non-placeholder listings of that type
  with ≥ 2 looks and ≥ 1 look without a photo, by id after `p_after`, `p_limit` ≤ 25. Returns `{listings: [{id, name,
  source_url, source_site, photos: [{id, storage_path, variant_id, is_primary}], variants: [{id, options, item_key,
  item_url, site}]}]}` (from `product_sources`). `is_worker()` only.
- `worker_look_photos_add(p_product uuid, p_media jsonb)`: each `{path, variant_id, alt_text, redo?}`. Rules:
  `variant_id` belongs to the listing; path matches `^products/<id>/s/[^/]+$`; ≤ 2 photos per look; ≤ 24 photos per
  listing in all; never `is_primary`; `sort_order` after the listing's last; `redo` as `worker_sourcing_media` allows
  it. Returns the new ids (the runner logs them for undo).
- `worker_look_photo_tag(p_product uuid, p_media uuid, p_variant uuid)`: tags an existing **untagged** photo to the
  look whose picture it is (the default look's gallery, found by the duplicate check). Only if still untagged and the
  variant is the listing's.
- `worker_look_photos_undo(p_media uuid[])`: removes rows this command added (only rows not primary, tagged, of a
  listing that keeps another photo) and returns their paths for the runner to delete from R2.

**Runner command** `pnpm sourcing looks --type clothing|food|home [--limit 200] [--photo-gb 0.2] [--per-look 1]
[--dry-run] [--undo out/looks-<date>.csv]` (`tools/sourcing-runner/src/looks.ts`, README section, `ops.md` §Sourcing
runner):
1. Page through `worker_look_photo_plan` (25 at a time), pausing between listings as the weekly check does. Respect
   `isBlocked`: a blocked shop is skipped for the rest of the run.
2. Read each listing's **source page once** with its shop's reader. Extend `PageRead` with
   `lookImages?: Record<item_key, string[]>`, per shop, using the method the Phase 0 sample proved:
   - **Amazon:** (a) the per-colour image map + colour→ASIN map in the twister data when present; else (b) the swatch
     image with its size token removed; else (c) for pack/size twisters without image swatches (most food packs),
     visit the child `/dp/<ASIN>` and take **only its main image**, at most 4 child pages per listing, through the
     same lanes and limits.
   - **Flipkart:** the other values' pages the runner already reads for price; take their first image.
   - **Shopify / NEWME / Zepto / Instamart / grocery:** the variant's own image, already in the reader.
   - **Savana:** the colour group's image; use the original, not `goodsThumb`, if one exists.
   - **Myntra:** its other colours are already tagged (Phase 0). The looks left are mostly the page's own colour, which needs a tag and no upload; a colour with neither is read from its own page. Don't merge styles (§3 F).
3. Download with the existing `copyPhotos` rules (shop's referer, image types, 2 KB – 10 MB). **Reject images under
   600 px on the short side** (a thumbnail looks broken at 1200 px).
4. Duplicate check (`pictureGroups` / same-picture, D-142) against the listing's stored photos (fetch them from
   `/media/s/…` 640 px, not from Supabase):
   - same as an **untagged** stored photo → `worker_look_photo_tag` (that look is the page's default look). No upload.
   - same as another look's photo → skip ("the shop uses one picture for every pack").
   - new → keep.
5. The photo redo service (D-168), when `ctx.redo` is on: clothing photos go through it as new listings' photos do
   (kids' pieces: cut only, never a face). Otherwise upload unmarked so the photo redo plan picks them up later.
6. Upload through the existing `photo-store.ts` (two AVIF copies). Each byte counts against `--photo-gb`; stop when
   it's spent.
7. `worker_look_photos_add`. Alt text: `<IWC name>, <look label>` (never a shop or brand word, D-003, D-143).
8. Write `out/looks-<type>-<date>.csv`: listing, look, action (`tagged`/`added`/`same-as-other`/`no-image`/
   `too-small`/`blocked`), media id, path, bytes. Print totals and GB used.
9. `--undo <csv>`: `worker_look_photos_undo` for the CSV's added ids, then delete those R2 objects. Tagging can be undone
   by setting the tag back to null (the CSV has the ids).

**Run order and pace:** after Phase 1 is live. Start with `--dry-run --limit 50` per type and show the founder the CSV.
Then clothing in runs of ≤ 200 listings, `--photo-gb 0.15` each, at a quiet US hour. Then food, then home. One type per
machine (as bulk sourcing). After each run: R2 GB on the dashboard, Supabase Reports (memory, slow queries), and 10 of
the CSV's listings opened on the live site.

**Done when:** L3 drops to what's left on purpose (no image, too small, blocked), R2 stays ≤ 8.9 GB (or the cap the
founder sets), and no store page got slower (`check.mjs http`, Lighthouse on two product pages).

### Phase 4: keep it fixed for new listings
1. **Runner (new listings):** the same `lookImages` per shop in `listing.ts`, so each look's photo is tagged at
   import. The page's own gallery is tagged to the **page's own item** (the variant whose `item_key` = the page's
   ASIN/pid), not left untagged, when the listing has ≥ 2 looks. Keep the totals (≤ 8 page photos + ≤ 12 look photos)
   and the duplicate check.
2. **Importer (bookmark, pasted links):** the same logic in `capture.ts` / `variants.ts` (Amazon swatches get an
   `image`). The bookmarklet carries its own code, so `status.md` "Next for the founder" must say: re-add the Add to IWC
   bookmark after the deploy (as D-142 did).
3. **Admin, Products → a listing → Photos:** each photo gets a **For** select: "Every look" or each look's label.
   Saving sets `variant_id` to the first variant of that look, or null. Admin RLS already allows the write; add a
   small RLS-bound function only if a direct update can't be done in one call. A Products filter, **Looks without a
   photo**, uses the same rule as L3, paged as every admin list is (D-140).
4. `docs/admin.md` and `docs/storefront.md` describe the look rule. `docs/data-model.md` notes that `variant_id` on
   `product_media` means "this photo's look".

### Phase 5: release and watch
- Phase 1 and 2 ship with the daily deploy (no migration). The Phase 3 migration goes through the **Deploy workflow,
  which only the founder runs**. It can ship with Phase 1, since it changes nothing customers read.
- The day after each release, and after each backfill run: Vercel ISR writes and functions, Supabase memory/egress,
  R2 GB, Admin → Today errors. Add the numbers to `monitoring.md` §8 with a note.
- Rollback: `NEXT_PUBLIC_LOOK_PHOTOS=off` in Vercel (gallery and bag back to today's behaviour), or Vercel →
  Deployments → previous → Promote. Data: `pnpm sourcing looks --undo <csv>`.

## 7. Rules for the agent (stop and ask before breaking one)
1. **Don't change** prices, pricing functions, stock, checkout, coupons, delivery days, cached card shapes
   (`_store_card_options`, `store_browse`, `store_home`, `store_region_page`), or `slim-cards.ts`.
2. **Never** write to or reset the production database, read production secrets, edit `.env` files, run the Deploy
   workflow or push without asking (CLAUDE.md).
3. No shop address, shop name or brand in any customer-facing photo URL, alt text, API answer or page source (D-003).
4. A look with no photo must look **exactly** like today. Never show an empty gallery or a wrong photo just to fill
   a slot.
5. No new page-cache writes: no `revalidateTag` / refresh calls from this work. If one ever seems necessary, ≤ 100
   listings per call (D-145), and ask first.
6. R2: stay inside the founder's cap. Delete nothing without a CSV the founder approved.
7. Supabase: paged calls only (≤ 25 listings), every statement well inside 8 s (D-146). Stop a run on the first timeout.
8. Use the glossary words; add **look** to it. Cite real D-ids only (`docs-audit` fails on unknown ones). File the
   founder's answers with `/record-answer` before building on them.
9. Each phase ends with `/check` and a `status.md` line (replace, don't append).

## 8. Questions for the founder (defaults used if there's no answer)
| # | Question | Default |
|---|---|---|
| Q1 | Photos per look in the backfill: 1, or 2 for clothing (front + back)? | clothing 1, food 1, home 1. A 2nd for clothing only if R2 allows after the first pass |
| Q2 | Should the **card's** photo change while a colour is chosen in the + picker, or only the picker's thumbnail? | the card's photo too, back on close |
| Q3 | R2 space this work may use | 0.5 GB, hard stop at 9.3 GB total on the dashboard |
| Q4 | After the orphan report (Phase 0b), may unused photos be deleted? | report only, then ask |
| Q5 | Order of the backfill | clothing → food → home & gifts |
| Q6 | Should the URL remember the picked colour (`?colour=navy`) for sharing? | no (later idea; it needs care with the page cache) |

## 9. Later (not in this plan)
- The order email, order tracking and checkout's stock list showing the look's photo (`checkout_context`,
  `store_order_items` read the listing's photo today; changing them is a migration on money paths, so it waits).
- Colour dots on cards in cached lists (they'd add bytes to every cached page; needs a D-145 trade-off).
- The app's product screen and card picker (next app build).
- A 2nd–4th photo per colour if R2 moves to a paid tier.

## Phase 0 results
**These first numbers came from the old database** (the project before D-147), founder 2026-11-09: L1 – L4 and the first runner attempts ran against it. Run L1 – L4 again on the live project (`ttobhpcidixxdteczccv`) before sizing the backfill. Kept below for comparison only. L1 minus its photos equals L3's total in every type, so the three agree.

**L1, listings with 2+ looks**

| Type | Listings | Looks | Looks with a photo | Listings with none |
|---|---|---:|---:|---:|
| Clothing | 506 | 2,241 | 845 (38%) | 209 |
| Food | 1,964 | 6,747 | 742 (11%) | 1,628 |
| Home & gifts | 1,374 | 7,147 | 14 (0.2%) | 1,368 |

**L2, tagged photos today:** Myntra clothing 845; food: Blinkit 376, Zepto 191, BigBasket 166, Swiggy 10; home: Blinkit 9, BigBasket 5.

**L3, looks without a photo:** home Amazon 7,133; food Amazon 5,255, Swiggy 750; clothing Amazon 848, Myntra 298, Savana 250. Total 14,534.

**What it means**
- **Phases 1 and 2 alone** give photos to 845 clothing looks on 297 listings and 742 food looks on 336 listings. Home barely changes.
- **Amazon is the whole backfill:** 13,236 of 14,534 looks. Whether it can be read decides Phase 3, so the sample comes first.
- **R2 sum at ~70 KB a photo.** The page's own look needs a tag and no upload, about one look per listing, so these are upper bounds before the duplicate check:

| Type | New photos at most | Space at most |
|---|---:|---:|
| Clothing | 890 | 0.06 GB |
| Food | 4,041 | 0.28 GB |
| Home & gifts | 5,759 | 0.40 GB |
| All | 10,690 | 0.75 GB |

  Clothing and food fit the 0.5 GB cap with about 0.16 GB left, roughly 2,300 home photos. All three would reach about 9.14 GB from 8.39 GB, under the 9.3 GB stop.
- **Home has 5.2 looks per listing**, though the founder expects most pieces to be singular. Query L4 says what those looks are, before any are stored.

**Real listings checked:** 14 live clothing pages (8 with 2+ looks, 6 with tagged photos). Three were copied to the local database with their real photos, and every colour was tapped on a simulated Pixel 7: each colour with a tagged photo showed that colour, the photo box and the page height never changed. Finding: the page's own colour's photos are untagged, so they stay as small photos under another colour's main photo.

**L4, which option makes the looks** (listings, variants): clothing: colour 1,138, 10,003; style 3, 14. Food: pack 4,081, 8,001; flavour 492, 2,400; style 87, 316; colour 36, 198. Home: colour 940, 5,117; style 510, 2,234; pack 512, 1,703; flavour 1, 3. So home's looks are real colours and styles, not noise.

**The page sample (L5's 27 pages):** not read. The session's safety check refused a script that opened Chrome with its automation flags hidden, so an agent doesn't run it. Running the runner is the founder's call, and the dry run gives the same answers:

```bash
pnpm sourcing looks --type food --site amazon.in --limit 20 --dry-run
```

The CSV's `method` column says which way works per shop. Amazon's colour map and swatches are written from the page's known format and tested on fixtures only, so **go on with real runs only after a dry run**.

**Where the build differs from the plan**
- Phase 4 step 1: the page's own gallery stays untagged on new listings. Tagging it would remove the small photos under other looks, and on a phone that moves the page by 158 px at the first tap. It follows the founder's choice on the small photos (default: keep them).
- Phase 4 step 2: the bookmarklet carries the swatch pictures, but a pasted or bookmarked import still saves only the page's photos. The admin's **For** tags them by hand.
- Phase 4 step 3: the **Looks without a photo** filter on Products isn't built: it needs a new read on a hot table for what query L3 already says.
- Phase 3 step 5: `looks` doesn't call the photo redo service. Its photos go up unmarked, so the redo's plan picks them up later.
- Phase 3 step 2: Flipkart has no missing looks (L3), so it has no reader of its own; item pages cover any later ones.

**First dry run on the live project** (founder 2026-11-09, `pnpm sourcing looks --type food --site amazon.in --limit 20 --dry-run`): 20 Amazon food listings, 105 looks.

| Action | Looks | What it means |
|---|---:|---|
| would-tag | 21 | the listing already has that picture: a tag, no upload (20 the page's own look, 1 an item page) |
| would-add | 36 | a new picture, all from item pages: about 2.5 MB stored at ~70 KB each |
| same-as-other | 20 | the shop shows one picture for several packs: nothing stored |
| no-image | 27 | in 9 listings with 6+ looks, past the 4 item pages a listing may read |
| too-small | 1 | under 600 px |

- **How Amazon food shows a pack:** only on its own item page. The swatch was found once and the colour map never, as expected for packs without pictures in the picker.
- **No robot check** in 20 listings and about 100 pages.
- **The cap:** every no-image is the 4-item-page limit. `--item-pages 8` reads more of them, at one more Amazon page each.
- **Per listing:** about 1.8 new photos, so about 125 KB of R2. The full size waits for L1 – L3 on the live project.

**Still to do:** L1 – L4 on the live project, today's R2 GB, a first real run, the clothing and home dry runs, the orphan report.
