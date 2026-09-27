-- =============================================================================
-- IWC baseline schema (roadmap R3, D-020). Replaces the 13 pre-IWC migrations
-- (recoverable from git tag `pre-restructure`).
--
-- Intent + invariants: docs/data-model.md (INV-1..INV-9), docs/flows.md.
-- Target: Supabase Postgres 15 (keep syntax PG15-compatible).
-- Money is always integer: USD in *_cents, INR in *_paise (INV-9).
-- Customer surfaces read ONLY store_* views/functions (D-017); every base table
-- holding vendor / cost / operations data is admin-only under RLS (D-003).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Types
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'admin');
create type public.ops_desk as enum ('us', 'india');                          -- D-007
create type public.product_type as enum ('clothing', 'spice');                -- D-002
create type public.content_status as enum ('draft', 'approved');              -- D-019
create type public.product_status as enum ('draft', 'live', 'paused', 'archived');
create type public.vendor_status as enum ('prospect', 'active', 'paused');
create type public.cycle_status as enum (                                     -- flows.md §1
  'open', 'collecting', 'packed', 'exported', 'arrived', 'fulfilling', 'closed');
create type public.order_status as enum (                                     -- flows.md §8
  'pending_payment', 'confirmed', 'collecting', 'packed', 'in_transit', 'arrived',
  'shipped', 'delivered', 'cancelled', 'refunded');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.fulfilment_mode as enum ('order_first');                    -- D-024
create type public.order_item_status as enum ('active', 'unavailable', 'refunded');
create type public.pickup_status as enum ('pending', 'picked', 'unavailable');
create type public.stock_reason as enum ('listed', 'adjusted', 'reserved', 'released', 'picked', 'unavailable');
create type public.discount_type as enum ('percentage', 'fixed');

-- -----------------------------------------------------------------------------
-- 2. Generic helpers
-- -----------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. People, admin access, settings
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text,
  phone text,
  role public.app_role not null default 'customer',
  desk public.ops_desk,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_desk_admin_only check (desk is null or role = 'admin')
);

-- Second gate for admin access (D-006, INV-7): the role alone is not enough.
-- Mirrors ADMIN_EMAILS on the server; both must agree.
create table public.admin_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- dev_preview = show placeholder products + draft region text in store_* views.
-- Only supabase/seed/demo.sql (dev) sets it to true (INV-8).
insert into public.app_settings (key, value) values ('dev_preview', 'false'::jsonb);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_emails a on a.email = lower(p.email)
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create function public.dev_preview() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'dev_preview'), false);
$$;

-- New auth user -> customer profile. Never trusts metadata for the role.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, lower(new.email), new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  full_name text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  zip_code text not null check (zip_code ~ '^\d{5}(-\d{4})?$'),
  country char(2) not null default 'US' check (country = 'US'),
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

-- -----------------------------------------------------------------------------
-- 4. Places + catalog
-- -----------------------------------------------------------------------------
create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  sort_order integer not null default 0,
  is_live boolean not null default false,
  greeting_native text,
  greeting_script text check (greeting_script ~ '^[A-Z][a-z]{3}$'),   -- ISO 15924, e.g. 'Taml'
  greeting_latin text,
  greeting_meaning text,
  languages text[] not null default '{}',
  tagline text,
  story text,
  hero_image_path text,
  accent_color text check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  content_status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  product_type public.product_type not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  parent_id uuid,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_type),
  -- a child category always has its parent's product type
  foreign key (parent_id, product_type) references public.categories (id, product_type)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  owner_name text,
  phone text,
  whatsapp text,
  email text,
  address text,
  town text,
  region_id uuid not null references public.regions (id) on delete restrict,
  payment_method text,                        -- D-029
  payment_reference text,
  licences jsonb not null default '{}'::jsonb check (jsonb_typeof(licences) = 'object'),  -- GSTIN, FSSAI, FDA reg.
  status public.vendor_status not null default 'prospect',
  notes text,
  photo_path text,
  is_placeholder boolean not null default false,
  onboarded_at timestamptz,
  onboarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_region_idx on public.vendors (region_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  product_type public.product_type not null,
  region_id uuid not null references public.regions (id) on delete restrict,
  category_id uuid not null,
  vendor_id uuid not null references public.vendors (id) on delete restrict,   -- admin only
  summary text,
  description text,
  story text,
  craft text,
  -- customer-safe attributes only (fibre/care, ingredients/allergens/shelf life);
  -- shape validated per product_type by zod (packages/shared, R4)
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  price_cents integer not null check (price_cents > 0),
  shop_price_paise integer check (shop_price_paise >= 0),                    -- admin only
  origin_town text,                                                          -- admin only
  has_origin_label boolean not null default false,                           -- ops.md §Compliance
  status public.product_status not null default 'draft',
  is_placeholder boolean not null default false,
  published_at timestamptz,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(craft, '') || ' ' || coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, product_type) references public.categories (id, product_type),
  -- D-032: spices stay unpublished until Q-10 (FDA facility + labels) is answered.
  constraint products_spice_not_live check (not (product_type = 'spice' and status = 'live'))
);
create index products_region_idx on public.products (region_id);
create index products_category_idx on public.products (category_id);
create index products_vendor_idx on public.products (vendor_id);
create index products_live_idx on public.products (region_id, product_type) where status = 'live';
create index products_search_idx on public.products using gin (search);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  label text not null,
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  price_cents integer check (price_cents > 0),
  weight_g integer check (weight_g > 0),
  qty_listed integer not null default 0 check (qty_listed >= 0),
  qty_reserved integer not null default 0 check (qty_reserved >= 0),
  qty_confirmed_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variants_reserved_le_listed check (qty_reserved <= qty_listed)      -- INV-3
);
create index product_variants_product_idx on public.product_variants (product_id);

-- Public, realtime-friendly mirror of availability (D-010). Kept in sync by trigger.
create table public.variant_availability (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  available integer not null,
  updated_at timestamptz not null default now()
);
create index variant_availability_product_idx on public.variant_availability (product_id);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_media_product_idx on public.product_media (product_id);
create unique index product_media_one_primary on public.product_media (product_id) where is_primary;

-- -----------------------------------------------------------------------------
-- 5. Stock ledger (INV-3, INV-4)
-- -----------------------------------------------------------------------------
create table public.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  reason public.stock_reason not null,
  delta_listed integer not null default 0,
  delta_reserved integer not null default 0,
  ref_type text,
  ref_id uuid,
  actor uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint stock_movements_nonzero check (delta_listed <> 0 or delta_reserved <> 0)
);
create index stock_movements_variant_idx on public.stock_movements (variant_id, created_at);

-- Stock context for the current transaction: the reason/reference the ledger
-- trigger records. Set by the stock functions below, cleared after each use.
create function public._set_stock_context(p_reason public.stock_reason, p_ref_type text, p_ref_id uuid, p_note text)
returns void language sql as $$
  select set_config('iwc.stock_reason', coalesce(p_reason::text, ''), true),
         set_config('iwc.stock_ref_type', coalesce(p_ref_type, ''), true),
         set_config('iwc.stock_ref_id', coalesce(p_ref_id::text, ''), true),
         set_config('iwc.stock_note', coalesce(p_note, ''), true);
$$;

-- Reservations may only move through the order/pickup functions, never by hand.
create function public.guard_reserved_changes() returns trigger
language plpgsql as $$
begin
  if new.qty_reserved is distinct from old.qty_reserved
     and coalesce(current_setting('iwc.stock_reason', true), '') not in ('reserved', 'released', 'picked', 'unavailable') then
    raise exception 'qty_reserved can only change through order/pickup functions (INV-3)'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger product_variants_guard_reserved
  before update of qty_reserved on public.product_variants
  for each row execute function public.guard_reserved_changes();

-- INV-4: every change to qty_listed / qty_reserved writes exactly one ledger row.
create function public.log_stock_movement() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d_listed integer;
  d_reserved integer;
begin
  if tg_op = 'INSERT' then
    d_listed := new.qty_listed;
    d_reserved := new.qty_reserved;
  else
    d_listed := new.qty_listed - old.qty_listed;
    d_reserved := new.qty_reserved - old.qty_reserved;
  end if;
  if d_listed = 0 and d_reserved = 0 then
    return new;
  end if;
  insert into public.stock_movements (variant_id, reason, delta_listed, delta_reserved, ref_type, ref_id, actor, note)
  values (
    new.id,
    coalesce(nullif(current_setting('iwc.stock_reason', true), ''),
             case when tg_op = 'INSERT' then 'listed' else 'adjusted' end)::public.stock_reason,
    d_listed,
    d_reserved,
    nullif(current_setting('iwc.stock_ref_type', true), ''),
    nullif(current_setting('iwc.stock_ref_id', true), '')::uuid,
    auth.uid(),
    nullif(current_setting('iwc.stock_note', true), '')
  );
  return new;
end $$;

create trigger product_variants_log_stock
  after insert or update of qty_listed, qty_reserved on public.product_variants
  for each row execute function public.log_stock_movement();

create function public.sync_variant_availability() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.variant_availability (variant_id, product_id, available, updated_at)
  values (new.id, new.product_id,
          case when new.is_active then new.qty_listed - new.qty_reserved else 0 end, now())
  on conflict (variant_id) do update
    set product_id = excluded.product_id, available = excluded.available, updated_at = now();
  return new;
end $$;

create trigger product_variants_sync_availability
  after insert or update on public.product_variants
  for each row execute function public.sync_variant_availability();

create function public.is_product_visible(p_product uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product and p.status = 'live' and (not p.is_placeholder or public.dev_preview())
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. Pricing settings + cycles (flows.md §1)
-- -----------------------------------------------------------------------------
-- Single row. All values start NULL on purpose: they are business numbers the
-- founder sets in the admin (CLAUDE.md: never invent prices/fees/times).
create table public.pricing_settings (
  id smallint primary key default 1 check (id = 1),
  fx_inr_per_usd numeric(10, 4) check (fx_inr_per_usd > 0),
  freight_cents_per_kg integer check (freight_cents_per_kg >= 0),
  duty_pct numeric(5, 2) check (duty_pct >= 0),
  margin_pct numeric(5, 2) check (margin_pct >= 0),
  domestic_days_min integer check (domestic_days_min >= 0),
  domestic_days_max integer check (domestic_days_max >= 0),
  stale_listing_days integer check (stale_listing_days > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint pricing_domestic_days_order check (domestic_days_max >= domestic_days_min)
);
insert into public.pricing_settings (id) values (1);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status public.cycle_status not null default 'open',
  cutoff_at timestamptz not null,
  est_export_on date,
  est_arrival_on date not null,
  exported_at timestamptz,
  arrived_at timestamptz,
  closed_at timestamptz,
  awb text,
  forwarder text,
  freight_cents integer check (freight_cents >= 0),
  duty_cents integer check (duty_cents >= 0),
  fx_inr_per_usd numeric(10, 4) check (fx_inr_per_usd > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycles_arrival_after_cutoff check (est_arrival_on >= (cutoff_at at time zone 'UTC')::date)
);
create unique index cycles_one_open on public.cycles ((status)) where status = 'open';   -- INV-5

-- -----------------------------------------------------------------------------
-- 7. Orders
-- -----------------------------------------------------------------------------
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value >= 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_percentage_max check (discount_type <> 'percentage' or discount_value <= 100),
  constraint promo_uses_within_max check (max_uses is null or uses_count <= max_uses)
);

-- IWC-YYMMDD-<10 hex> (40 bits of randomness, not enumerable)
create function public.generate_order_number() returns text
language sql volatile as $$
  select 'IWC-' || to_char(now() at time zone 'UTC', 'YYMMDD') || '-'
         || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
$$;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.generate_order_number(),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  status public.order_status not null default 'confirmed',
  cycle_id uuid references public.cycles (id) on delete restrict,             -- admin only
  fulfilment_mode public.fulfilment_mode not null default 'order_first',
  est_delivery_from date,
  est_delivery_to date,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency char(3) not null default 'USD' check (currency = 'USD'),          -- D-036
  promo_code_id uuid references public.promo_codes (id) on delete set null,
  payment_intent_id text unique,
  payment_status public.payment_status not null default 'pending',
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  tracking_number text,
  carrier text,
  notes text,                                                                -- admin only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches check (total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents),
  constraint orders_window_order check (est_delivery_to >= est_delivery_from)
);
create index orders_user_idx on public.orders (user_id);
create index orders_cycle_idx on public.orders (cycle_id);
create index orders_created_idx on public.orders (created_at desc);

-- INV-6: the delivery window promised at payment is never silently changed.
create function public.guard_delivery_window() returns trigger
language plpgsql as $$
begin
  if (new.est_delivery_from, new.est_delivery_to) is distinct from (old.est_delivery_from, old.est_delivery_to)
     and old.est_delivery_from is not null
     and coalesce(current_setting('iwc.window_change', true), '') <> 'on' then
    raise exception 'delivery window can only change through change_delivery_window() (INV-6)'
      using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger orders_guard_delivery_window
  before update of est_delivery_from, est_delivery_to on public.orders
  for each row execute function public.guard_delivery_window();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  variant_label text not null,
  region_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  total_price_cents integer not null,
  status public.order_item_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint order_items_total_matches check (total_price_cents = quantity * unit_price_cents)
);
create index order_items_order_idx on public.order_items (order_id);

-- Timeline. Customer-visible rows carry a `kind` the app turns into copy
-- (flows.md §8); internal_note is admin only.
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]+$'),
  visible_to_customer boolean not null default false,
  message text,
  internal_note text,
  actor uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  cycle_id uuid references public.cycles (id) on delete set null,
  amount_paise integer not null check (amount_paise > 0),
  method text not null,
  reference text,
  paid_at timestamptz not null default now(),
  paid_by uuid references public.profiles (id) on delete set null,
  receipt_path text,
  note text,
  created_at timestamptz not null default now()
);
create index vendor_payouts_vendor_idx on public.vendor_payouts (vendor_id);

create table public.pickups (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,
  cycle_id uuid not null references public.cycles (id) on delete restrict,
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  shop_price_paise integer check (shop_price_paise >= 0),
  status public.pickup_status not null default 'pending',
  picked_at timestamptz,
  picked_by uuid references public.profiles (id) on delete set null,
  photo_path text,
  note text,
  payout_id uuid references public.vendor_payouts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickups_payout_only_when_picked check (payout_id is null or status = 'picked')
);
create index pickups_cycle_vendor_idx on public.pickups (cycle_id, vendor_id);

create table public.wishlists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- -----------------------------------------------------------------------------
-- 8. Operations tables (service role only; carried over from the old schema)
-- -----------------------------------------------------------------------------
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table public.pending_orders (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id text not null unique,
  checkout_payload jsonb not null,
  created_at timestamptz not null default now(),
  reconciled_at timestamptz,
  reconciled_by text check (reconciled_by in ('browser', 'webhook'))
);

create table public.failed_reconciliations (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id text not null,
  stripe_event_id text,
  amount_cents integer,
  currency text,
  customer_email text,
  error_reason text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  recipient text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'dead_letter')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_ready_idx on public.email_outbox (next_attempt_at) where status in ('pending', 'processing');

create table public.admin_error_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 9. updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'addresses', 'regions', 'categories', 'vendors', 'products',
                           'product_variants', 'cycles', 'promo_codes', 'orders', 'pickups', 'pricing_settings',
                           'app_settings']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
                   t || '_set_updated_at', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Business functions (flows.md). All run in the caller's transaction.
-- -----------------------------------------------------------------------------

-- Next delivery window for the storefront ("Order by <date>", D-035).
-- Returns no row when there is no open cycle or domestic days are not set.
create function public.store_next_delivery()
returns table (order_by timestamptz, est_delivery_from date, est_delivery_to date)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.cutoff_at,
         c.est_arrival_on + s.domestic_days_min,
         c.est_arrival_on + s.domestic_days_max
  from public.cycles c
  cross join public.pricing_settings s
  where c.status = 'open'
    and s.domestic_days_min is not null
    and s.domestic_days_max is not null;
$$;

-- flows.md §3 step 4: create a paid order atomically. Called by the server
-- (service role) only AFTER Stripe verified the payment. Any failure (sold
-- out, price changed, no open cycle, window not configured) raises and
-- nothing is written; the server then refunds/cancels the payment.
create function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cycle public.cycles%rowtype;
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
begin
  select * into v_cycle from public.cycles where status = 'open' for update;
  if not found then
    raise exception 'no_open_cycle' using errcode = 'P0001';
  end if;

  select * into v_settings from public.pricing_settings where id = 1;
  if v_settings.domestic_days_min is null or v_settings.domestic_days_max is null then
    raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'order_has_no_items' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, status, cycle_id, est_delivery_from, est_delivery_to,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promo_code_id, payment_intent_id, payment_status, shipping_address)
  values (
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    'confirmed',
    v_cycle.id,
    v_cycle.est_arrival_on + v_settings.domestic_days_min,
    v_cycle.est_arrival_on + v_settings.domestic_days_max,
    (p_order ->> 'subtotal_cents')::integer,
    coalesce((p_order ->> 'discount_cents')::integer, 0),
    coalesce((p_order ->> 'shipping_cents')::integer, 0),
    coalesce((p_order ->> 'tax_cents')::integer, 0),
    (p_order ->> 'total_cents')::integer,
    nullif(p_order ->> 'promo_code_id', '')::uuid,
    p_order ->> 'payment_intent_id',
    'paid',
    p_order -> 'shipping_address')
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_order -> 'items')
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_unit := (v_item ->> 'unit_price_cents')::integer;

    select v.id, v.label, v.product_id, coalesce(v.price_cents, p.price_cents) as price_cents,
           p.name as product_name, r.name as region_name
      into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.regions r on r.id = p.region_id
    where v.id = (v_item ->> 'variant_id')::uuid
      and v.is_active
      and p.status = 'live'
      and (not p.is_placeholder or public.dev_preview());
    if not found then
      raise exception 'variant_unavailable:%', v_item ->> 'variant_id' using errcode = 'P0001';
    end if;
    if v_unit is distinct from v_variant.price_cents then
      raise exception 'price_mismatch:%', v_variant.id using errcode = 'P0001';
    end if;

    -- INV-3: one conditional statement; fails instead of overselling.
    perform public._set_stock_context('reserved', 'order', v_order.id, null);
    update public.product_variants
       set qty_reserved = qty_reserved + v_qty
     where id = v_variant.id
       and qty_listed - qty_reserved >= v_qty;
    if not found then
      raise exception 'insufficient_stock:%', v_variant.id using errcode = 'P0001';
    end if;
    perform public._set_stock_context(null, null, null, null);

    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label,
                                    region_name, quantity, unit_price_cents, total_price_cents)
    values (v_order.id, v_variant.id, v_variant.product_id, v_variant.product_name, v_variant.label,
            v_variant.region_name, v_qty, v_unit, v_qty * v_unit);
    v_sum := v_sum + v_qty * v_unit;
  end loop;

  if v_sum <> v_order.subtotal_cents then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, visible_to_customer)
  values (v_order.id, 'order_confirmed', true);

  return query select v_order.id, v_order.order_number;
end $$;

-- flows.md §4 step 1: close the cycle to new orders and create one pickup per
-- ordered piece. The next cycle is created by an admin with its own dates (D-026).
create function public.cutoff_cycle(p_cycle uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  update public.cycles set status = 'collecting' where id = p_cycle and status = 'open';
  if not found then
    raise exception 'cycle_not_open' using errcode = 'P0001';
  end if;

  insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
  select oi.id, p_cycle, p.vendor_id, oi.variant_id, oi.quantity, p.shop_price_paise
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where o.cycle_id = p_cycle and o.status = 'confirmed' and oi.status = 'active';
  get diagnostics v_count = row_count;

  update public.orders set status = 'collecting' where cycle_id = p_cycle and status = 'confirmed';

  insert into public.order_events (order_id, kind, visible_to_customer)
  select id, 'preparing', true from public.orders where cycle_id = p_cycle and status = 'collecting';

  return v_count;
end $$;

-- flows.md §4 steps 2–4: the COO marks a piece picked or unavailable.
create function public.mark_pickup(p_pickup uuid, p_status public.pickup_status, p_photo_path text default null,
                                   p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pickup public.pickups%rowtype;
  v_order_id uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_status = 'pending' then
    raise exception 'invalid_pickup_status' using errcode = 'P0001';
  end if;

  select * into v_pickup from public.pickups where id = p_pickup for update;
  if not found or v_pickup.status <> 'pending' then
    raise exception 'pickup_not_pending' using errcode = 'P0001';
  end if;

  -- Either way the piece leaves the shop's listed stock and its reservation ends.
  perform public._set_stock_context(p_status::text::public.stock_reason, 'pickup', p_pickup, p_note);
  update public.product_variants
     set qty_listed = qty_listed - v_pickup.quantity,
         qty_reserved = qty_reserved - v_pickup.quantity
   where id = v_pickup.variant_id;
  perform public._set_stock_context(null, null, null, null);

  update public.pickups
     set status = p_status, picked_at = now(), picked_by = auth.uid(),
         photo_path = coalesce(p_photo_path, photo_path), note = coalesce(p_note, note)
   where id = p_pickup;

  if p_status = 'unavailable' then
    -- D-030: refund that item and notify. The refund itself is done by the
    -- server through Stripe, which then marks the item 'refunded'.
    update public.order_items set status = 'unavailable' where id = v_pickup.order_item_id
    returning order_id into v_order_id;
    insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
    values (v_order_id, 'item_unavailable', true, p_note, auth.uid());
  end if;
end $$;

-- flows.md §5: record a payout covering picked, unpaid pickups of one vendor.
-- The amount is computed from the pickups (never typed in).
create function public.record_payout(p_vendor uuid, p_pickups uuid[], p_method text, p_reference text default null,
                                     p_receipt_path text default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_amount integer;
  v_valid integer;
  v_payout uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select count(*), sum(quantity * shop_price_paise)
    into v_valid, v_amount
  from public.pickups
  where id = any (p_pickups) and vendor_id = p_vendor and status = 'picked'
    and payout_id is null and shop_price_paise is not null;

  if v_valid <> coalesce(array_length(p_pickups, 1), 0) or v_valid = 0 then
    raise exception 'invalid_pickups_for_payout' using errcode = 'P0001';
  end if;

  insert into public.vendor_payouts (vendor_id, amount_paise, method, reference, paid_by, receipt_path, note)
  values (p_vendor, v_amount, p_method, p_reference, auth.uid(), p_receipt_path, p_note)
  returning id into v_payout;

  update public.pickups set payout_id = v_payout where id = any (p_pickups);
  return v_payout;
end $$;

-- flows.md §7 / D-008: the only way to change a promised window. Records a
-- customer-visible event so the app can notify (and offer cancellation).
create function public.change_delivery_window(p_order uuid, p_from date, p_to date, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'invalid_window' using errcode = 'P0001';
  end if;

  perform set_config('iwc.window_change', 'on', true);
  update public.orders set est_delivery_from = p_from, est_delivery_to = p_to where id = p_order;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  perform set_config('iwc.window_change', '', true);

  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (p_order, 'delivery_window_changed', true, p_note, auth.uid());
end $$;

-- Promo redemption, guarded by limits + validity (kept from the old schema).
create function public.increment_promo_uses(p_promo uuid)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.promo_codes
     set uses_count = uses_count + 1
   where id = p_promo and is_active
     and (max_uses is null or uses_count < max_uses)
     and (valid_from is null or valid_from <= now())
     and (valid_until is null or valid_until >= now());
  return found;
end $$;

-- -----------------------------------------------------------------------------
-- 11. store_* views: the ONLY customer read path (D-017). They run with the
-- owner's rights and expose whitelisted columns (storefront.md whitelist).
-- -----------------------------------------------------------------------------
create view public.store_regions as
select r.id, r.slug, r.name, r.sort_order, r.is_live, r.hero_image_path, r.accent_color,
       case when r.content_status = 'approved' or public.dev_preview() then r.greeting_native end as greeting_native,
       case when r.content_status = 'approved' or public.dev_preview() then r.greeting_script end as greeting_script,
       case when r.content_status = 'approved' or public.dev_preview() then r.greeting_latin end as greeting_latin,
       case when r.content_status = 'approved' or public.dev_preview() then r.greeting_meaning end as greeting_meaning,
       case when r.content_status = 'approved' or public.dev_preview() then r.tagline end as tagline,
       case when r.content_status = 'approved' or public.dev_preview() then r.story end as story
from public.regions r;

create view public.store_categories as
select c.id, c.product_type, c.slug, c.name, c.parent_id, c.sort_order
from public.categories c
where c.is_active;

create view public.store_products as
select p.id, p.slug, p.name, p.product_type,
       p.region_id, r.slug as region_slug, r.name as region_name,
       p.category_id, c.slug as category_slug, c.name as category_name,
       p.summary, p.description, p.story, p.craft, p.attributes, p.price_cents, p.published_at,
       (select m.storage_path from public.product_media m
         where m.product_id = p.id order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
       p.search
from public.products p
join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

create view public.store_variants as
select v.id, v.product_id, v.label, v.options,
       coalesce(v.price_cents, p.price_cents) as price_cents,
       greatest(v.qty_listed - v.qty_reserved, 0) as available,
       v.sort_order
from public.product_variants v
join public.products p on p.id = v.product_id
where v.is_active and p.status = 'live' and (not p.is_placeholder or public.dev_preview());

create view public.store_media as
select m.id, m.product_id, m.variant_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary
from public.product_media m
join public.products p on p.id = m.product_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- Own orders only. Internal statuses collapse to what customers see (flows.md §8, D-034).
create view public.store_orders as
select o.id, o.order_number, o.email,
       case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'collecting' then 'preparing'
         when 'packed' then 'preparing'
         when 'in_transit' then 'preparing'
         when 'arrived' then 'preparing'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
       end as customer_status,
       o.est_delivery_from, o.est_delivery_to,
       o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.currency,
       o.payment_status, o.shipping_address, o.tracking_number, o.carrier, o.created_at
from public.orders o
where o.user_id = auth.uid();

create view public.store_order_items as
select oi.id, oi.order_id, oi.product_id, oi.product_name, oi.variant_label, oi.region_name,
       oi.quantity, oi.unit_price_cents, oi.total_price_cents, oi.status
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.user_id = auth.uid();

create view public.store_order_events as
select e.id, e.order_id, e.kind, e.message, e.created_at
from public.order_events e
join public.orders o on o.id = e.order_id
where o.user_id = auth.uid() and e.visible_to_customer;

-- -----------------------------------------------------------------------------
-- 12. Row level security
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'admin_emails', 'app_settings', 'addresses', 'regions', 'categories',
                           'vendors', 'products', 'product_variants', 'variant_availability', 'product_media',
                           'stock_movements', 'pricing_settings', 'cycles', 'promo_codes', 'orders',
                           'order_items', 'order_events', 'vendor_payouts', 'pickups', 'wishlists',
                           'webhook_events', 'pending_orders', 'failed_reconciliations', 'email_outbox',
                           'admin_error_events', 'newsletter_subscribers']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Admins (role + allowlist, INV-7) manage every business table.
  foreach t in array array['profiles', 'addresses', 'regions', 'categories', 'vendors', 'products',
                           'product_variants', 'product_media', 'stock_movements', 'pricing_settings', 'cycles',
                           'promo_codes', 'orders', 'order_items', 'order_events', 'vendor_payouts', 'pickups',
                           'wishlists', 'app_settings']
  loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Customers: own profile, addresses, wishlist. Nothing else from base tables (INV-1, INV-2).
create policy profiles_own_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy addresses_own on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlists_own on public.wishlists for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live availability counts are public (realtime), only for visible products.
create policy variant_availability_public on public.variant_availability for select to anon, authenticated
  using (public.is_product_visible(product_id));

-- -----------------------------------------------------------------------------
-- 13. Privileges (Supabase grants everything by default; narrow it down)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Customer read path
grant select on public.store_regions, public.store_categories, public.store_products, public.store_variants,
                public.store_media, public.store_orders, public.store_order_items, public.store_order_events
  to anon, authenticated;
grant select on public.variant_availability to anon, authenticated;
grant execute on function public.store_next_delivery() to anon, authenticated;
-- Functions called inside views / RLS policies run with the CALLER's EXECUTE rights.
grant execute on function public.dev_preview(), public.is_product_visible(uuid) to anon, authenticated;

-- Signed-in users: own rows (RLS) + admin rows (RLS is_admin())
grant select, insert, update, delete on
  public.addresses, public.wishlists,
  public.regions, public.categories, public.vendors, public.products, public.product_variants,
  public.product_media, public.cycles, public.promo_codes, public.orders, public.order_items,
  public.order_events, public.vendor_payouts, public.pickups, public.app_settings
  to authenticated;
grant select, update on public.pricing_settings to authenticated;
grant select on public.stock_movements to authenticated;
grant select on public.profiles to authenticated;
-- Column-level: a user may edit their own name/phone, never role/desk/email.
grant update (full_name, phone) on public.profiles to authenticated;

grant execute on function public.is_admin(), public.cutoff_cycle(uuid),
  public.mark_pickup(uuid, public.pickup_status, text, text),
  public.record_payout(uuid, uuid[], text, text, text, text),
  public.change_delivery_window(uuid, date, date, text)
  to authenticated;

-- Server-only (service role): order creation + promo redemption.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- 14. Storage + realtime
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('product-media', 'product-media', true),   -- product photos (public read via CDN)
  ('vendor-docs', 'vendor-docs', false)        -- shop photos, receipts, licences (admin only)
on conflict (id) do nothing;

create policy "iwc admin read" on storage.objects for select to authenticated
  using (bucket_id in ('product-media', 'vendor-docs') and public.is_admin());
create policy "iwc admin insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('product-media', 'vendor-docs') and public.is_admin());
create policy "iwc admin update" on storage.objects for update to authenticated
  using (bucket_id in ('product-media', 'vendor-docs') and public.is_admin())
  with check (bucket_id in ('product-media', 'vendor-docs') and public.is_admin());
create policy "iwc admin delete" on storage.objects for delete to authenticated
  using (bucket_id in ('product-media', 'vendor-docs') and public.is_admin());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.variant_availability, public.orders;
  end if;
end $$;
