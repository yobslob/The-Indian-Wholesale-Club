-- =============================================================================
-- D-170 (founder 2026-10-31: "also include https://newme.asia/"): NEWME joins the sourcing runner's shops for clothing.
-- Its reader (`newme`, packages/shared/src/sourcing/auto/readers/newme.ts) reads the shop's own page data and lists only
-- pieces whose page says "Country of origin: India" (D-004). Savana, named the same day, is not added: every piece read
-- states "Country of Origin: PRC" (Q-49).
-- delivery_days 3 as Myntra's: each size's own promise ("by Tomorrow" to the hub's pincode) decides; a size that takes
-- NEWME's usual 12 – 14 days counts as out of stock.
-- Size: one shops row. Egress and page cache: none (the admin's shops list only).
-- =============================================================================

alter table public.sourcing_shops drop constraint sourcing_shops_reader_check;
alter table public.sourcing_shops add constraint sourcing_shops_reader_check
  check (reader in ('amazon', 'flipkart', 'myntra', 'shopify', 'blinkit', 'bigbasket', 'zepto', 'instamart', 'newme'));

insert into public.sourcing_shops (site, label, reader, product_types, delivery_days, sort_order)
values ('newme.asia', 'NEWME', 'newme', '{clothing}', 3, 110)
on conflict (site) do nothing;
