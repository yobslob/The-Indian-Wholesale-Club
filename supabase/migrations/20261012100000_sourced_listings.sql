-- =============================================================================
-- D-110: pilot listings copied from Indian online shops (Myntra, Amazon India, Flipkart, any shop's product page).
-- The admin imports a product page; the listing keeps where it came from, so the price can be checked again and
-- the India desk knows where to order a sold piece. All of it is admin-only (D-003): no store_* view or function
-- reads these columns.
-- =============================================================================

alter table public.products
  add column source_url text check (source_url is null or source_url ~ '^https://'),
  add column source_site text,
  add column source_checked_at timestamptz,
  add column source_in_stock boolean;

-- One listing per source page: importing it again updates that listing instead of making a second one.
create unique index products_source_url_key on public.products (source_url) where source_url is not null;
-- The importer's "check prices" list, oldest check first.
create index products_source_checked_idx on public.products (source_checked_at nulls first) where source_url is not null;

-- An online shop is a vendor like any other (pickups, the cycle's shop cards), one per shop and state, since a vendor
-- belongs to one state (its products take that state). `online_site` is the shop's host ("myntra.com").
alter table public.vendors add column online_site text;
create unique index vendors_online_site_region_key on public.vendors (online_site, region_id) where online_site is not null;
