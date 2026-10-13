-- =============================================================================
-- D-118: auto-sourcing. The founder gives a target ("Himachali rajma", Himachal Pradesh, food / rice-flours-and-staples);
-- the sourcing runner (tools/sourcing-runner, a PC in India whose browser has the hub's address set) searches the
-- enabled shops, keeps only pieces that reach the hub within `max_delivery_days`, and adds the best ones as listings
-- with their variants (colours, sizes, flavours, packs) and every shop that sells them as a source. Each week it reads
-- every source again: prices and stock follow the shop, the cheapest in-stock source within the delivery limit is the
-- one the India desk orders from, and a price that jumps beyond the guard is held for an admin.
-- All of it is admin/worker-only (D-003): no store_* view or function reads these tables or columns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Settings (one row). max_delivery_days is the founder's "2–3 days" (D-118); the rest are Claude's first numbers,
-- editable in the admin.
-- -----------------------------------------------------------------------------
create table public.sourcing_settings (
  id smallint primary key default 1 check (id = 1),
  max_delivery_days smallint not null default 3 check (max_delivery_days between 0 and 15),
  listings_per_target smallint not null default 3 check (listings_per_target between 1 and 10),
  check_every_days smallint not null default 7 check (check_every_days between 1 and 30),
  qty_per_variant smallint not null default 5 check (qty_per_variant between 0 and 99),
  targets_per_run smallint not null default 40 check (targets_per_run between 1 and 500),
  -- A shop price that rises more than this or falls more than that since the last check is held for an admin.
  max_rise_pct smallint not null default 60 check (max_rise_pct between 5 and 1000),
  max_drop_pct smallint not null default 50 check (max_drop_pct between 5 and 95),
  -- New listings go live by themselves when their details are complete (otherwise they wait as drafts).
  auto_publish boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
insert into public.sourcing_settings (id) values (1);

-- -----------------------------------------------------------------------------
-- The shops the runner searches. `reader` picks the runner's code for the shop; `delivery_days` is used only when a
-- page shows no delivery estimate (null: such a piece is never added). Amazon and Flipkart ship from sellers all over
-- India, so their pages must show the estimate; the founder named the others as 2–3-day shops (D-118).
-- -----------------------------------------------------------------------------
create table public.sourcing_shops (
  site text primary key check (site ~ '^[a-z0-9.-]+$'),
  label text not null,
  reader text not null check (reader in ('amazon', 'flipkart', 'myntra', 'shopify', 'blinkit', 'bigbasket',
                                         'zepto', 'instamart')),
  product_types public.product_type[] not null,
  delivery_days smallint check (delivery_days between 0 and 30),
  is_enabled boolean not null default true,
  sort_order smallint not null default 0,
  last_ok_at timestamptz,
  last_error text,
  last_error_at timestamptz
);
insert into public.sourcing_shops (site, label, reader, product_types, delivery_days, sort_order) values
  ('blinkit.com', 'Blinkit', 'blinkit', '{food,home}', 3, 10),
  ('zepto.com', 'Zepto', 'zepto', '{food,home}', 3, 20),
  ('swiggy.com', 'Instamart', 'instamart', '{food,home}', 3, 30),
  ('bigbasket.com', 'BigBasket', 'bigbasket', '{food,home}', 3, 40),
  ('amazon.in', 'Amazon India', 'amazon', '{clothing,food,home}', null, 50),
  ('flipkart.com', 'Flipkart', 'flipkart', '{clothing,food,home}', null, 60),
  ('myntra.com', 'Myntra', 'myntra', '{clothing}', 3, 70),
  ('oyela.in', 'Oyela', 'shopify', '{clothing}', 3, 80),
  ('nishorama.com', 'Nishorama', 'shopify', '{clothing}', 3, 90),
  ('offduty.in', 'Offduty', 'shopify', '{clothing}', 3, 100);

-- -----------------------------------------------------------------------------
-- Targets: what to find, for which state and category.
-- -----------------------------------------------------------------------------
create type public.sourcing_target_status as enum ('queued', 'searching', 'found', 'none', 'paused');

create table public.sourcing_targets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  -- what the shops are searched for, and the words a title must contain ("rajma|kidney beans"); null = the query's
  query text not null check (length(query) between 2 and 120),
  must_match text check (length(must_match) <= 300),
  product_type public.product_type not null,
  category_id uuid not null,
  region_id uuid not null references public.regions (id) on delete cascade,
  tier smallint check (tier between 1 and 3),
  status public.sourcing_target_status not null default 'queued',
  found_count smallint not null default 0,
  note text,
  claimed_at timestamptz,
  searched_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  foreign key (category_id, product_type) references public.categories (id, product_type)
);
create unique index sourcing_targets_name_key on public.sourcing_targets (region_id, lower(name));
create index sourcing_targets_queue_idx on public.sourcing_targets (status, tier, created_at);

-- Which target a listing was found for (admin only).
alter table public.products
  add column sourcing_target_id uuid references public.sourcing_targets (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Sources: every shop item a variant can be ordered as. `item_key` is the shop's id for the exact item (an ASIN, a
-- Flipkart pid, a Blinkit product id, a Shopify variant id, a Myntra sku); null for a listing imported by hand before
-- D-118, matched by the variant's label until the first check fills it in.
-- -----------------------------------------------------------------------------
create table public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  site text not null check (length(site) between 3 and 120),
  page_url text not null check (page_url ~ '^https://' and length(page_url) <= 2000),
  item_url text not null check (item_url ~ '^https://' and length(item_url) <= 2000),
  item_key text check (length(item_key) between 1 and 200),
  price_paise integer check (price_paise > 0),
  mrp_paise integer check (mrp_paise > 0),
  in_stock boolean,
  delivery_days smallint check (delivery_days between 0 and 60),
  checked_at timestamptz,
  fail_count smallint not null default 0,
  last_error text,
  -- set when a check held this source: the new price waits for an admin
  review text check (review in ('price_rise', 'price_drop')),
  review_price_paise integer check (review_price_paise > 0),
  created_at timestamptz not null default now()
);
create unique index product_sources_item_key on public.product_sources (site, item_key) where item_key is not null;
create index product_sources_product_idx on public.product_sources (product_id);
create index product_sources_variant_idx on public.product_sources (variant_id);
create index product_sources_review_idx on public.product_sources (created_at) where review is not null;

-- A variant's own shop price (a flavour or pack costs its own amount) and the source the India desk orders it from.
alter table public.product_variants
  add column shop_price_paise integer check (shop_price_paise > 0),
  add column source_id uuid references public.product_sources (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Run log
-- -----------------------------------------------------------------------------
create table public.sourcing_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  worker_id uuid references public.profiles (id) on delete set null,
  targets_searched integer not null default 0,
  listings_added integer not null default 0,
  products_checked integer not null default 0,
  prices_changed integer not null default 0,
  stock_changed integer not null default 0,
  held integer not null default 0,
  errors integer not null default 0,
  -- {site: {pages, failed, error}}
  shops jsonb not null default '{}'::jsonb check (jsonb_typeof(shops) = 'object')
);
create index sourcing_runs_recent_idx on public.sourcing_runs (finished_at desc);

-- -----------------------------------------------------------------------------
-- Access: admins read and edit everything here; the worker only through the functions below.
-- -----------------------------------------------------------------------------
alter table public.sourcing_settings enable row level security;
alter table public.sourcing_shops enable row level security;
alter table public.sourcing_targets enable row level security;
alter table public.product_sources enable row level security;
alter table public.sourcing_runs enable row level security;
create policy "admin sourcing settings" on public.sourcing_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin sourcing shops" on public.sourcing_shops for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin sourcing targets" on public.sourcing_targets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin product sources" on public.product_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin sourcing runs" on public.sourcing_runs for select to authenticated using (public.is_admin());
revoke all on public.sourcing_settings, public.sourcing_shops, public.sourcing_targets, public.product_sources,
  public.sourcing_runs from anon;
grant select, update on public.sourcing_settings to authenticated;   -- RLS narrows to admins
grant select, insert, update, delete on public.sourcing_shops, public.sourcing_targets, public.product_sources
  to authenticated;
grant select on public.sourcing_runs to authenticated;
grant all on public.sourcing_settings, public.sourcing_shops, public.sourcing_targets, public.product_sources,
  public.sourcing_runs to service_role;
