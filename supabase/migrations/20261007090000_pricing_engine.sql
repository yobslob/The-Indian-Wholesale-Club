-- =============================================================================
-- The pricing engine (D-075, D-069, D-070): an admin enters the shop price in ₹ (and a weight); the customer price in $
-- follows from every cost, the margin and the card fees, and is recomputed whenever a setting or the exchange rate
-- changes. The exchange rate is fetched every day (ECB reference rate via Frankfurter). Pilot numbers are high-end
-- placeholders (D-069), listed in docs/pilot-numbers.md.
--
-- Price of one piece (all in cents). The margin applies to the goods only; every logistics cost is recovered at cost,
-- and the costs of a whole shipment or parcel follow the piece's weight (a spice packet doesn't pay like a lehenga):
--   rate        = market ₹ per $ × (1 − fx buffer)                         a weaker rupee than today's, to be safe
--   goods       = shop price ₹ ÷ rate;  india = India handling ₹ ÷ rate      pickup, local transport, packing
--   billed kg   = weight × volumetric % ÷ 1000                              what airlines charge for
--   freight     = air freight $/kg × billed kg                              standard: Mumbai → US airport (D-070)
--   broker      = customs broker per shipment ÷ shipment kg × billed kg      the export's fixed costs, by weight
--   duty        = (goods + india) × duty %                                   on the value at export
--   last mile   = max(minimum, US last mile $/kg × weight in kg)            standard ships free, so the price carries it
--   logistics   = india + freight + broker + duty + US warehouse handling + last mile
--   before fees = (goods × (1 + margin %) + logistics) × (1 + returns allowance %)
--   price       = (before fees + card fee fixed) ÷ (1 − card fee %), rounded UP to the next $x.99
-- Weight: the heaviest active variant's weight, else the category's typical packed weight.
-- =============================================================================

alter table public.pricing_settings
  add column fx_buffer_pct numeric(5, 2) check (fx_buffer_pct between 0 and 50),
  add column fx_auto boolean not null default true,
  add column fx_updated_at timestamptz,
  add column fx_source text,
  add column india_handling_paise integer check (india_handling_paise >= 0),
  add column volumetric_pct numeric(6, 2) check (volumetric_pct >= 100),
  add column broker_cents_per_shipment integer check (broker_cents_per_shipment >= 0),
  add column shipment_kg numeric(8, 2) check (shipment_kg > 0),
  add column us_handling_cents integer check (us_handling_cents >= 0),
  add column us_last_mile_cents_per_kg integer check (us_last_mile_cents_per_kg >= 0),
  add column us_last_mile_min_cents integer check (us_last_mile_min_cents >= 0),
  add column returns_allowance_pct numeric(5, 2) check (returns_allowance_pct between 0 and 100),
  add column card_fee_pct numeric(5, 2) check (card_fee_pct between 0 and 20),
  add column card_fee_fixed_cents integer check (card_fee_fixed_cents >= 0),
  add column express_base_cents integer check (express_base_cents >= 0),
  add column express_courier_cents_per_kg integer check (express_courier_cents_per_kg >= 0),
  add column express_min_kg numeric(5, 2) check (express_min_kg > 0);

-- Which costs are still Claude's placeholders (D-047's labels): the new ones can be labelled too.
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct', 'card_fee_pct',
  'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg', 'express_days_min',
  'express_days_max', 'cycle_days', 'fast_offer_cents'));

-- A changed value loses its estimate label (any column), unless the estimates loader or the rate fetch wrote it.
create or replace function public._pricing_estimate_replaced() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  if coalesce(current_setting('iwc.loading_estimates', true), '') = 'on' then
    return new;
  end if;
  delete from public.pricing_estimates e where (v_new -> e.setting) is distinct from (v_old -> e.setting);
  return new;
end $$;

-- The loader now also replaces Claude's older estimates (never the founder's own numbers).
create or replace function public._load_pricing_estimates(p_estimates jsonb, p_checked_on date)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item jsonb;
  v_settable boolean;
  v_filled integer := 0;
begin
  perform set_config('iwc.loading_estimates', 'on', true);
  for v_item in select value from jsonb_array_elements(p_estimates)
  loop
    -- Only the settings that may carry an estimate label (the pricing_estimates check).
    if v_item ->> 'setting' not in (
      'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
      'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
      'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct', 'card_fee_pct',
      'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg', 'express_days_min',
      'express_days_max', 'cycle_days', 'fast_offer_cents') then
      raise exception 'unknown_setting:%', v_item ->> 'setting' using errcode = 'P0001';
    end if;
    execute format('select %I is null from public.pricing_settings where id = 1', v_item ->> 'setting') into v_settable;
    v_settable := v_settable or exists (select 1 from public.pricing_estimates where setting = v_item ->> 'setting');
    if v_settable then
      execute format('update public.pricing_settings set %I = $1 where id = 1', v_item ->> 'setting')
        using (v_item ->> 'value')::numeric;
      insert into public.pricing_estimates (setting, source, source_url, checked_on)
      values (v_item ->> 'setting', v_item ->> 'source', v_item ->> 'url', p_checked_on)
      on conflict (setting) do update
        set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;
      v_filled := v_filled + 1;
    end if;
  end loop;
  perform set_config('iwc.loading_estimates', '', true);
  return v_filled;
end $$;

-- -----------------------------------------------------------------------------
-- Categories: the typical packed weight (when a piece has none) and the tax class (D-073)
-- -----------------------------------------------------------------------------
create type public.tax_class as enum ('clothing', 'food', 'general');
alter table public.categories
  add column default_weight_g integer check (default_weight_g > 0),
  add column tax_class public.tax_class;
update public.categories set tax_class = case when product_type = 'spice' then 'food' else 'clothing' end::public.tax_class;
alter table public.categories alter column tax_class set not null;
-- New categories take the class from their type; an admin changes it for taxable ones (accessories, fabrics, sweets).
create function public._category_tax_class() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.tax_class := coalesce(new.tax_class, case when new.product_type = 'spice' then 'food' else 'clothing' end::public.tax_class);
  return new;
end $$;
create trigger categories_tax_class before insert on public.categories
  for each row execute function public._category_tax_class();
revoke all on function public._category_tax_class() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- Business and compliance details (D-074): text the founder fills; placeholders until then
-- -----------------------------------------------------------------------------
create table public.business_details (
  key text primary key check (key ~ '^[a-z_]+$'),
  label text not null,
  value text not null default '',
  is_placeholder boolean not null default true,
  group_name text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.business_details enable row level security;
create policy admin_all on public.business_details for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.business_details from anon, authenticated;
grant select, update on public.business_details to authenticated;

-- The details the founder fills (D-074), each a placeholder until saved.
insert into public.business_details (key, label, group_name, sort_order, value) values
  ('exporter_name', 'Exporter name', 'Exporter (India)', 1, 'TO FILL'),
  ('exporter_address', 'Exporter address', 'Exporter (India)', 2, 'TO FILL'),
  ('exporter_iec', 'IEC (Importer-Exporter Code)', 'Exporter (India)', 3, 'TO FILL'),
  ('exporter_gstin', 'GSTIN', 'Exporter (India)', 4, 'TO FILL'),
  ('importer_name', 'Importer of record', 'Importer of record (US)', 1, 'TO FILL'),
  ('importer_address', 'Importer address', 'Importer of record (US)', 2, 'TO FILL'),
  ('importer_ein', 'EIN', 'Importer of record (US)', 3, 'TO FILL'),
  ('customs_bond', 'Customs bond (single entry or continuous)', 'Importer of record (US)', 4, 'TO FILL'),
  ('customs_broker', 'Customs broker', 'Shipping documents', 1, 'TO FILL'),
  ('forwarder', 'Air freight forwarder', 'Shipping documents', 2, 'TO FILL'),
  ('incoterm', 'Incoterm', 'Shipping documents', 3, 'FCA Mumbai airport'),
  ('hs_clothing', 'HS codes for clothing (by category)', 'Shipping documents', 4, 'TO FILL'),
  ('hs_spices', 'HS codes for spices (by category)', 'Shipping documents', 5, 'TO FILL'),
  ('fda_registration', 'FDA food facility registration (each maker)', 'Spices (FDA)', 1, 'TO FILL'),
  ('fda_us_agent', 'FDA US agent', 'Spices (FDA)', 2, 'TO FILL'),
  ('fsvp_importer', 'FSVP importer', 'Spices (FDA)', 3, 'TO FILL'),
  ('label_maker', 'English labels made by', 'Spices (FDA)', 4, 'TO FILL'),
  ('support_email', 'Support email (Q-9)', 'Contact', 1, 'TO FILL'),
  ('us_return_address', 'US return address (D-071)', 'Contact', 2, 'TO FILL');

-- Spices go live only after the founder switches this on (D-032, D-074).
alter table public.pricing_settings add column spices_cleared boolean not null default false;

-- The old rule (no spice ever live) becomes: no spice live until spices are cleared. Same error name for callers.
alter table public.products drop constraint products_spice_not_live;
create function public._spices_cleared_check() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.product_type = 'spice' and new.status = 'live'
     and not coalesce((select spices_cleared from public.pricing_settings where id = 1), false) then
    raise exception 'products_spice_not_live: spices are not cleared yet (Settings, D-074)' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger products_spices_cleared
  before insert or update of status, product_type on public.products
  for each row execute function public._spices_cleared_check();
revoke all on function public._spices_cleared_check() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The price
-- -----------------------------------------------------------------------------
-- Automatic unless an admin sets the price by hand. The column defaults to manual so code that inserts a product with a
-- price keeps it; admin_create_listing() turns it on when no price is given, and every existing product with a ₹ price
-- switches to automatic below.
alter table public.products add column price_auto boolean not null default false;

-- The weight a price uses: the heaviest active variant, else the category's typical weight.
create function public._pricing_weight_g(p_product uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select max(v.weight_g) from public.product_variants v where v.product_id = p_product and v.is_active),
    (select c.default_weight_g from public.products p join public.categories c on c.id = p.category_id
     where p.id = p_product));
$$;

-- One piece's price from its shop price and weight; null while any setting it needs is missing.
create function public._auto_price_cents(p_shop_paise integer, p_weight_g integer)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_rate numeric;
  v_goods numeric;
  v_india numeric;
  v_billed_kg numeric;
  v_logistics numeric;
  v_before numeric;
  v_price numeric;
begin
  select * into s from public.pricing_settings where id = 1;
  if p_shop_paise is null or p_weight_g is null or s.fx_inr_per_usd is null or s.fx_buffer_pct is null
     or s.india_handling_paise is null or s.freight_cents_per_kg is null or s.volumetric_pct is null
     or s.broker_cents_per_shipment is null or s.shipment_kg is null or s.duty_pct is null
     or s.us_handling_cents is null or s.us_last_mile_cents_per_kg is null or s.us_last_mile_min_cents is null
     or s.returns_allowance_pct is null or s.margin_pct is null or s.card_fee_pct is null
     or s.card_fee_fixed_cents is null then
    return null;
  end if;
  v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
  v_goods := p_shop_paise / v_rate;                       -- paise ÷ (₹ per $) = cents
  v_india := s.india_handling_paise / v_rate;
  v_billed_kg := p_weight_g * s.volumetric_pct / 100 / 1000.0;
  v_logistics := v_india
                 + s.freight_cents_per_kg * v_billed_kg
                 + s.broker_cents_per_shipment / s.shipment_kg * v_billed_kg
                 + (v_goods + v_india) * s.duty_pct / 100
                 + s.us_handling_cents
                 + greatest(s.us_last_mile_min_cents, s.us_last_mile_cents_per_kg * p_weight_g / 1000.0);
  v_before := (v_goods * (1 + s.margin_pct / 100) + v_logistics) * (1 + s.returns_allowance_pct / 100);
  v_price := (v_before + s.card_fee_fixed_cents) / (1 - s.card_fee_pct / 100);
  return (ceil((v_price + 1) / 100) * 100 - 1)::integer;   -- up to the next $x.99
end $$;

-- Reprices auto-priced products (all, or one). Returns how many prices changed.
create function public._reprice_products(p_product uuid default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  update public.products p
     set price_cents = n.price
    from (select x.id, public._auto_price_cents(x.shop_price_paise, public._pricing_weight_g(x.id)) as price
          from public.products x
          where x.price_auto and (p_product is null or x.id = p_product)) n
   where p.id = n.id and n.price is not null and p.price_cents is distinct from n.price;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public._reprice_on_settings() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._reprice_products();
  return null;
end $$;
create trigger pricing_settings_reprice
  after update on public.pricing_settings
  for each statement execute function public._reprice_on_settings();

create function public._reprice_on_product() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.price_auto then
    new.price_cents := coalesce(
      public._auto_price_cents(new.shop_price_paise,
        coalesce((select max(v.weight_g) from public.product_variants v where v.product_id = new.id and v.is_active),
                 (select c.default_weight_g from public.categories c where c.id = new.category_id))),
      new.price_cents);
  end if;
  return new;
end $$;
create trigger products_auto_price
  before insert or update of shop_price_paise, category_id, price_auto on public.products
  for each row execute function public._reprice_on_product();

create function public._reprice_on_variant() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._reprice_products(coalesce(new.product_id, old.product_id));
  return null;
end $$;
create trigger product_variants_auto_price
  after insert or update of weight_g, is_active or delete on public.product_variants
  for each row execute function public._reprice_on_variant();

create function public._reprice_on_category() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.products set price_auto = price_auto where category_id = new.id and price_auto;  -- fires the product trigger
  return null;
end $$;
create trigger categories_auto_price
  after update of default_weight_g on public.categories
  for each row execute function public._reprice_on_category();

-- -----------------------------------------------------------------------------
-- The exchange rate, every day (D-075): pg_net asks the ECB rate (via Frankfurter); the next run reads the answer.
-- Refuses implausible numbers (outside 40–250 ₹/$, or a move over 10% in a day) and records them as an error instead.
-- -----------------------------------------------------------------------------
create table public.fx_fetches (
  request_id bigint primary key,
  requested_at timestamptz not null default now(),
  applied boolean not null default false
);
alter table public.fx_fetches enable row level security;   -- no policies: internal
revoke all on public.fx_fetches from anon, authenticated;

create function public._fx_refresh()
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_fetch public.fx_fetches;
  v_body jsonb;
  v_rate numeric;
  v_status integer;
begin
  select * into s from public.pricing_settings where id = 1;
  if not s.fx_auto or to_regclass('net._http_response') is null then
    return 'off';
  end if;

  -- 1. The answer to the last request, if it came back.
  select * into v_fetch from public.fx_fetches where not applied order by requested_at desc limit 1;
  if found then
    execute 'select status_code, content::jsonb from net._http_response where id = $1'
      into v_status, v_body using v_fetch.request_id;
    if v_status = 200 then
      update public.fx_fetches set applied = true where request_id = v_fetch.request_id;
      v_rate := (v_body -> 'rates' ->> 'INR')::numeric;
      if v_rate is null or v_rate not between 40 and 250
         or (s.fx_inr_per_usd is not null and abs(v_rate - s.fx_inr_per_usd) / s.fx_inr_per_usd > 0.10) then
        insert into public.admin_error_events (event, context)
        values ('fx.rate_refused', jsonb_build_object('rate', v_rate, 'current', s.fx_inr_per_usd, 'body', v_body));
        return 'refused';
      end if;
      update public.pricing_settings
         set fx_inr_per_usd = round(v_rate, 4), fx_updated_at = now(),
             fx_source = 'ECB reference rate via Frankfurter, ' || coalesce(v_body ->> 'date', 'today')
       where id = 1;
      return 'applied';
    elsif v_status is not null or v_fetch.requested_at < now() - interval '1 hour' then
      update public.fx_fetches set applied = true where request_id = v_fetch.request_id;  -- failed or lost: ask again
    else
      return 'waiting';
    end if;
  end if;

  -- 2. Ask again once a day.
  if s.fx_updated_at is null or s.fx_updated_at < now() - interval '20 hours' then
    execute $q$select net.http_get('https://api.frankfurter.dev/v1/latest?from=USD&to=INR')$q$ into v_status;
    insert into public.fx_fetches (request_id) values (v_status);
    return 'requested';
  end if;
  return 'fresh';
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('iwc-fx-refresh', '*/10 * * * *', 'select public._fx_refresh()');
  end if;
end $$;

-- Every product with a shop price is priced automatically from now on (D-075); prices follow once the settings exist.
update public.products set price_auto = true where shop_price_paise is not null;

-- A listing without a price is priced automatically (D-075): from the shop price and the heaviest variant weight given
-- (else the category's typical weight). Without the settings or a shop price there is no price: the admin must type one.
create or replace function public.admin_create_listing(p_listing jsonb)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_variant jsonb;
  v_n integer := 0;
  v_price integer := nullif(p_listing ->> 'price_cents', '')::integer;
  v_shop integer := nullif(p_listing ->> 'shop_price_paise', '')::integer;
  v_weight integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_vendor from public.vendors
   where id = nullif(p_listing ->> 'vendor_id', '')::uuid and status = 'active';
  if not found then
    raise exception 'vendor_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_listing -> 'variants', '[]'::jsonb)) <> 'array' then
    raise exception 'variants_must_be_a_list' using errcode = 'P0001';
  end if;
  if v_price is null then
    select coalesce(max(nullif(v ->> 'weight_g', '')::integer),
                    (select default_weight_g from public.categories where id = (p_listing ->> 'category_id')::uuid))
      into v_weight
    from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) v;
    v_price := public.admin_price_preview(v_shop, v_weight);   -- runs as the admin: the admin-checked door
    if v_price is null then
      raise exception 'price_needed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, price_auto, status, created_by)
  values (v_vendor.id, v_vendor.region_id, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          v_price, v_shop, nullif(p_listing ->> 'price_cents', '') is null, 'draft', auth.uid())
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            (v_variant ->> 'qty')::integer, now(), v_n);
  end loop;
  return v_id;
end $$;

-- Admins preview a price on the listing forms (the cost structure stays behind the admin check).
create function public.admin_price_preview(p_shop_paise integer, p_weight_g integer)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return public._auto_price_cents(p_shop_paise, p_weight_g);
end $$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public._pricing_weight_g(uuid), public._auto_price_cents(integer, integer),
  public._reprice_products(uuid), public._reprice_on_settings(), public._reprice_on_product(),
  public._reprice_on_variant(), public._reprice_on_category(), public._fx_refresh()
  from public, anon, authenticated;
revoke all on function public.admin_price_preview(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_price_preview(integer, integer) to authenticated, service_role;
