-- =============================================================================
-- D-187, the simple store, part 1 of 3: the new rules. Food is 7 delivery days, clothing and home & gifts 12 – 16,
-- a delivery day is a business day (Monday to Friday); a bag with food and other pieces always ships as two
-- (except outside the 48 states and DC: one, 12 – 16); free shipping from $49.99 on every bag; the bulk saving and
-- the heavy-item discount stay at $99.99 (their own setting). Orders already placed keep their promised dates (INV-6).
-- The next two migrations move the store reads off the 7-day set, then drop what went. This one drops nothing a live
-- reader needs, so the website running before the Deploy finishes keeps working.
-- Shims the old website (minutes, until its deploy) and the old Android app read are marked TODO(D-187).
-- Cost (D-147): one integer column and two small ones on pricing_settings, one short text on pickups. Fewer
-- full-catalogue reads: a settings save no longer re-prices every listing. No page-cache or egress change.
-- =============================================================================

-- A price must not move in this release (founder, §10 Y-2). The paused formula goes below, so only beta pricing is
-- allowed through. The pre-check (simple-store-plan §6) shows this before the Deploy.
do $$
begin
  if not coalesce((select beta_pricing from public.pricing_settings where id = 1), false) then
    raise exception 'simple store: beta_pricing is off; removing the full price formula would re-price the store (D-187, D-128)';
  end if;
end $$;

-- Every settings save re-priced the whole catalogue through this trigger (and this migration's own updates would).
-- Since D-128 the formula is fixed in code; only the two home weight-guess settings can still move a price.
drop trigger if exists pricing_settings_reprice on public.pricing_settings;
create trigger pricing_settings_reprice
  after update of home_est_g_per_rupee, home_est_min_g on public.pricing_settings
  for each statement execute function public._reprice_on_settings();

-- ---------------------------------------------------------------- the delivery day

-- Monday to Friday, counted from p_day; a weekend start counts from the Friday before (Sat + 1 = Mon, Fri + 7 = the
-- Tuesday after next). packages/shared/src/domain/delivery.ts addBusinessDays() is its twin, tested on the same cases.
create function public._add_business_days(p_day date, p_days integer) returns date
language sql immutable
as $$
  select case
    when p_days <= 0 then p_day
    else p_day - f.back + (p_days / 5) * 7 + (p_days % 5)
         + case when f.dow + (p_days % 5) > 5 then 2 else 0 end
  end
  from (select least(extract(isodow from p_day)::integer, 5) as dow,
               greatest(extract(isodow from p_day)::integer - 5, 0) as back) f;
$$;
revoke all on function public._add_business_days(date, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------- settings

alter table public.pricing_settings
  add column food_delivery_days_min smallint check (food_delivery_days_min between 0 and 60),
  add column food_delivery_days_max smallint check (food_delivery_days_max between 0 and 60),
  add column bulk_saving_from_cents integer check (bulk_saving_from_cents >= 0),
  add constraint food_delivery_days_order check (food_delivery_days_max >= food_delivery_days_min);

alter table public.pricing_settings rename column pilot_delivery_days_min to delivery_days_min;
alter table public.pricing_settings rename column pilot_delivery_days_max to delivery_days_max;
alter table public.pricing_settings rename constraint pilot_delivery_days_order to delivery_days_order;
alter table public.pricing_settings rename constraint pricing_settings_pilot_delivery_days_min_check to pricing_settings_delivery_days_min_check;
alter table public.pricing_settings rename constraint pricing_settings_pilot_delivery_days_max_check to pricing_settings_delivery_days_max_check;

update public.pricing_settings
   set food_delivery_days_min = 7, food_delivery_days_max = 7,
       delivery_days_min = 12, delivery_days_max = 16,
       free_shipping_min_cents = 4999,
       bulk_saving_from_cents = 9999
 where id = 1;

-- ---------------------------------------------------------------- shipments: food and the rest

alter table public.order_shipments drop constraint order_shipments_kind_check;
update public.order_shipments set kind = 'food' where kind = 'quick';  -- dates untouched (INV-6)
alter table public.order_shipments
  add constraint order_shipments_kind_check check (kind in ('food', 'standard', 'express'));

-- ---------------------------------------------------------------- the shop outlives the vendor

alter table public.products alter column vendor_id drop not null;
alter table public.pickups alter column vendor_id drop not null;
-- A pickup placed before this release keeps the shop it was bought from, even if its listing moves on.
alter table public.pickups add column site text;

alter table public.products disable trigger products_set_updated_at;
update public.products p
   set source_site = coalesce(v.online_site, v.shop_name)
  from public.vendors v
 where v.id = p.vendor_id and p.source_site is null;
alter table public.products enable trigger products_set_updated_at;

alter table public.pickups disable trigger pickups_set_updated_at;
update public.pickups pk
   set site = coalesce(v.online_site, v.shop_name)
  from public.vendors v
 where v.id = pk.vendor_id and pk.site is null;
alter table public.pickups enable trigger pickups_set_updated_at;

-- ---------------------------------------------------------------- orders waiting for a cycle's cutoff

-- No cutoff will come for them any more, so their pieces go on the buy list now. Status, dates and emails untouched.
insert into public.pickups (order_item_id, variant_id, quantity, shop_price_paise)
select oi.id, oi.variant_id, oi.quantity, p.shop_price_paise
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
 where o.status in ('confirmed', 'collecting') and oi.status = 'active' and oi.variant_id is not null
   and not p.is_us_stock
   and not exists (select 1 from public.pickups x where x.order_item_id = oi.id);

-- ---------------------------------------------------------------- prices: beta only

-- D-128, unchanged: adjusted cost = shop ₹ ÷ 0.90; shipping = weight g × ₹2; ÷ the category's divisor (food 0.80,
-- clothing 0.60, home & gifts 0.50); ÷ a fixed ₹92 a dollar; to the cent. In paise: g × 200; paise ÷ 92 = cents.
create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
returns integer
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_cost numeric;
begin
  if p_shop_paise is null or p_weight_g is null then
    return null;
  end if;
  v_cost := (p_shop_paise / 0.90 + 200 * p_weight_g) / 92;
  return round(v_cost / case p_type when 'food' then 0.80 when 'home' then 0.50 else 0.60 end)::integer;
end $$;

create or replace function public._order_item_snapshot() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v record;
begin
  select coalesce(pv.shop_price_paise, p.shop_price_paise) as shop_paise, pv.weight_g, pv.weight_source, p.price_auto
    into v
    from public.product_variants pv join public.products p on p.id = pv.product_id
   where pv.id = new.variant_id;
  new.shop_price_paise := coalesce(new.shop_price_paise, v.shop_paise);
  new.weight_g := coalesce(new.weight_g, v.weight_g);
  new.weight_source := coalesce(new.weight_source, v.weight_source);
  new.inr_per_usd := coalesce(new.inr_per_usd, 92);  -- D-128: a fixed ₹92 a dollar
  new.pricing_rule := coalesce(new.pricing_rule, case when v.price_auto is false then 'hand' else 'beta' end);
  return new;
end $$;

-- ---------------------------------------------------------------- what a bag ships as

create or replace function public._bag_shipments(p_items jsonb, p_discount_cents integer default 0,
                                                 p_state text default null, p_line1 text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.pricing_settings;
  v_on boolean;
  v_reach boolean;
  v_goods numeric;
  v_food_goods numeric;
  v_grams numeric;
  v_food_grams numeric;
  v_food_ids uuid[];
  v_other boolean;
  v_india boolean;
  v_billed numeric;
  v_shipping integer := 0;
  v_share integer := 0;
begin
  select * into s from public.pricing_settings where id = 1;
  v_on := s.food_delivery_days_min is not null and s.food_delivery_days_max is not null;
  v_reach := (p_state is null or upper(trim(p_state)) not in
               ('AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'FM', 'MH', 'PW', 'AA', 'AE', 'AP'))
             and (p_line1 is null
                  or p_line1 !~* '(^|[^a-z])(p[. ]*o[. ]*box|post office box|apo|fpo|dpo)([^a-z]|$)');
  select coalesce(sum(x.q * x.price), 0),
         coalesce(sum(x.q * x.price) filter (where x.food), 0),
         coalesce(sum(x.q * x.g) filter (where not x.us), 0),
         coalesce(sum(x.q * x.g) filter (where x.food), 0),
         coalesce(array_agg(x.id) filter (where x.food), '{}'),
         coalesce(bool_or(not x.food), false),
         coalesce(bool_or(not x.us), false)
    into v_goods, v_food_goods, v_grams, v_food_grams, v_food_ids, v_other, v_india
    from (select sv.id, least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99) as q, sv.price_cents as price,
                 pr.is_us_stock as us,
                 coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0)
                   * case when pr.product_type = 'food' then coalesce(s.food_billed_pct, 100) / 100.0 else 1 end as g,
                 v_on and pr.product_type = 'food' and not pr.is_us_stock as food
            from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]' end) i
            join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
            join public.product_variants pv on pv.id = sv.id
            join public.products pr on pr.id = pv.product_id
           where coalesce((i ->> 'quantity')::integer, 0) > 0) x;
  if v_india then
    -- the courier bills at least 1 kg, then by the half kg
    v_billed := ceil(greatest(v_grams / 1000.0, 1) * 2) / 2;
    v_shipping := case when s.shipping_cents_per_kg is not null then round(v_billed * s.shipping_cents_per_kg)::integer
                       else coalesce(s.small_order_shipping_cents, 0) end;
    if v_reach and v_food_goods > 0 and v_other and v_grams > 0 then
      v_share := round(v_shipping * v_food_grams / v_grams)::integer;
    end if;
  end if;
  return jsonb_build_object(
    'days_min', case when v_on then s.food_delivery_days_min end,
    'days_max', case when v_on then s.food_delivery_days_max end,
    'food_cents', round(v_food_goods - case when v_goods > 0
                                            then least(greatest(coalesce(p_discount_cents, 0), 0), v_goods) * v_food_goods / v_goods
                                            else 0 end)::integer,
    'food_variant_ids', to_jsonb(v_food_ids),
    'food_only', v_reach and v_food_goods > 0 and not v_other,
    'split', v_reach and v_food_goods > 0 and v_other,
    'outside', v_food_goods > 0 and not v_reach,
    'billed_grams', case when v_india then round(v_billed * 1000)::integer else 0 end,
    'shipping_cents', v_shipping,
    'food_shipping_cents', v_share);
end $$;

create or replace function public.store_next_delivery()
returns table (order_by timestamptz, est_delivery_from date, est_delivery_to date)
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  -- order_by: TODO(D-187): drop when app <next version> is the minimum (its schema requires the key)
  select null::timestamptz, public._add_business_days(current_date, s.delivery_days_min),
         public._add_business_days(current_date, s.delivery_days_max)
  from public.pricing_settings s
  where s.id = 1 and s.delivery_days_min is not null and s.delivery_days_max is not null;
$$;

create or replace function public.store_bag_charges(p_items jsonb, p_discount_cents integer default 0,
                                                    p_state text default null, p_line1 text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.pricing_settings;
  v_ship jsonb;
  v_from_india boolean;
  v_next record;
  v_heavy record;
  v_food_from date;
  v_food_to date;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  v_ship := public._bag_shipments(p_items, p_discount_cents, p_state, p_line1);
  v_from_india := (v_ship ->> 'billed_grams')::integer > 0;
  select * into v_next from public.store_next_delivery() limit 1;
  v_food_from := public._add_business_days(current_date, s.food_delivery_days_min);
  v_food_to := public._add_business_days(current_date, s.food_delivery_days_max);
  select coalesce(sum(sv.heavy_cents * least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99)), 0)::integer as cents,
         coalesce(jsonb_agg(sv.id) filter (where sv.heavy_cents > 0), '[]'::jsonb) as ids
    into v_heavy
    from jsonb_array_elements(p_items) i
    join public.store_variants sv on sv.id::text = i ->> 'variant_id';
  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'bulk_saving_from_cents', s.bulk_saving_from_cents,
    'shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'past_line_cents', 0,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0),
    'shown_shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    -- heavy-item shipping (founder 2026-10-24): the bag's heavy pieces' other half, and what comes off it from $99.99
    'heavy_cents', v_heavy.cents,
    'heavy_line_off_pct', coalesce(s.heavy_line_off_pct, 0),
    'heavy_ids', v_heavy.ids,
    -- no weights on a customer surface (D-003): the billed kg and the weight share stay in the database
    'shipments', (v_ship - 'food_variant_ids' - 'billed_grams' - 'food_shipping_cents')
                 -- TODO(D-187): drop when app <next version> is the minimum (its bag parses these keys)
                 || jsonb_build_object('quick_cents', v_ship -> 'food_cents', 'quick_only', v_ship -> 'food_only',
                                       'min_cents', null, 'gap_cents', null),
    'food_ids', coalesce(v_ship -> 'food_variant_ids', '[]'::jsonb),
    'quick_ids', coalesce(v_ship -> 'food_variant_ids', '[]'::jsonb),  -- TODO(D-187): drop when app <next version> is the minimum
    'dates', jsonb_build_object(
      'food_from', v_food_from,
      'food_to', v_food_to,
      'quick_from', v_food_from,  -- TODO(D-187): drop when app <next version> is the minimum
      'quick_to', v_food_to,      -- TODO(D-187): drop when app <next version> is the minimum
      'standard_from', v_next.est_delivery_from,
      'standard_to', v_next.est_delivery_to));
end $$;

create or replace function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null, p_state text default null)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path,
               'tax_class', c.tax_class,
               'courier_cents', 0)  -- TODO(D-187): drop after the release (the old website's schema requires it)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      join public.products pr on pr.id = p.id
      join public.categories c on c.id = pr.category_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    -- §10 Y-3: every line asked about, in the order asked, also when it is no longer on sale: what is left and whether
    -- it can be bought, with its photo and words, so checkout can offer Remove or Keep n before payment.
    'stock', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', a.id,
               'on_sale', coalesce(pv.is_active and pr.status = 'live' and (not pr.is_placeholder or public.dev_preview()), false),
               'available', case when pv.is_active and pr.status = 'live' and (not pr.is_placeholder or public.dev_preview())
                                 then greatest(pv.qty_listed - pv.qty_reserved, 0) else 0 end,
               'product_name', pr.name,
               'label', pv.label,
               'image_path', (select m.storage_path from public.product_media m where m.product_id = pr.id
                               order by m.is_primary desc, m.sort_order limit 1))
             order by a.n)
      from unnest(p_variant_ids) with ordinality a(id, n)
      left join public.product_variants pv on pv.id = a.id
      left join public.products pr on pr.id = pv.product_id), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents)
      from public.promo_codes c
      where nullif(trim(p_promo_code), '') is not null
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents,
                                'bulk_saving_from_cents', s.bulk_saving_from_cents,
                                'min_order_cents', s.min_order_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    -- A bag with food: the food shipment's window (the bag's charges say whether the bag has one)
    'food_delivery', (
      select jsonb_build_object('est_delivery_from', public._add_business_days(current_date, s.food_delivery_days_min),
                                'est_delivery_to', public._add_business_days(current_date, s.food_delivery_days_max))
      from public.pricing_settings s
      where s.id = 1 and s.food_delivery_days_min is not null and s.food_delivery_days_max is not null),
    'tax', (
      select jsonb_build_object('state', t.state, 'rate_pct', t.rate_pct, 'taxes_clothing', t.taxes_clothing,
                                'taxes_food', t.taxes_food, 'taxes_general', t.taxes_general)
      from public.tax_rates t where t.state = upper(trim(p_state))),
    -- A bag of only pieces already in the US ships from the warehouse at once: today + the US delivery days (D-072).
    'us_delivery', (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null
        and cardinality(p_variant_ids) > 0
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and not pr.is_us_stock)),
    -- TODO(D-187): drop after the release (the old website's schema requires 'express'; it reads 'quick_delivery')
    'quick_delivery', (
      select jsonb_build_object('est_delivery_from', public._add_business_days(current_date, s.food_delivery_days_min),
                                'est_delivery_to', public._add_business_days(current_date, s.food_delivery_days_max))
      from public.pricing_settings s
      where s.id = 1 and s.food_delivery_days_min is not null and s.food_delivery_days_max is not null),
    'express', null
  );
$$;

create or replace function public.store_policy() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'bulk_saving_from_cents', s.bulk_saving_from_cents,
    'min_order_cents', s.min_order_cents,
    -- clothing and home & gifts, and food: in delivery days (D-187)
    'delivery_days_min', s.delivery_days_min,
    'delivery_days_max', s.delivery_days_max,
    'food_delivery_days_min', s.food_delivery_days_min,
    'food_delivery_days_max', s.food_delivery_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
    -- TODO(D-187): drop when app <next version> is the minimum (it hides its 7-day store on these)
    'express_days_min', null,
    'express_days_max', null,
    'quick_delivery_days_min', null,
    'quick_delivery_days_max', null,
    'quick_delivery_min_cents', null,
    'quick_delivery_on', false,
    'cancel_fee_pct', s.cancel_fee_pct,
    'return_claim_days', s.return_claim_days,
    'return_tiers', coalesce((
      select jsonb_agg(jsonb_build_object('days', t.days, 'kept_pct', t.pct) order by t.days)
      from (values (s.return_tier1_days, s.return_tier1_pct), (s.return_tier2_days, s.return_tier2_pct),
                   (s.return_tier3_days, s.return_tier3_pct)) t (days, pct)
      where t.days is not null and t.pct is not null), '[]'::jsonb),
    'tax', coalesce((
      select jsonb_agg(jsonb_build_object('state', r.state, 'rate_pct', r.rate_pct, 'clothing', r.taxes_clothing,
                                          'food', r.taxes_food, 'general', r.taxes_general)
                       order by r.state)
      from public.tax_rates r), '[]'::jsonb))
  from public.pricing_settings s
  where s.id = 1;
$$;

-- ---------------------------------------------------------------- the order

create or replace function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_method public.shipping_method;
  v_from date;
  v_to date;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
  v_food_only boolean;
  v_split boolean;
  v_ship jsonb;
  v_first uuid;
  v_second uuid;
  v_food_share integer;
begin
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;

  -- The same shipments the bag and checkout showed (_bag_shipments): food in its days, the rest in theirs; a bag with
  -- both is two shipments; outside the 48 states and DC everything is one, in the standard days.
  if jsonb_typeof(p_order -> 'items') = 'array' then
    v_ship := public._bag_shipments(p_order -> 'items', coalesce((p_order ->> 'discount_cents')::integer, 0),
                                    p_order -> 'shipping_address' ->> 'state',
                                    p_order -> 'shipping_address' ->> 'line1');
  end if;
  v_food_only := v_method = 'standard' and coalesce((v_ship ->> 'food_only')::boolean, false);
  v_split := v_method = 'standard' and coalesce((v_ship ->> 'split')::boolean, false);

  if v_method = 'express' then
    -- TODO(D-187): drop after the release. A payment priced with Express before the Deploy still becomes an order,
    -- with the days it was promised (Settings' 15 – 18 until now).
    v_from := current_date + 15;
    v_to := current_date + 18;
  elsif v_food_only then
    v_from := public._add_business_days(current_date, v_settings.food_delivery_days_min);
    v_to := public._add_business_days(current_date, v_settings.food_delivery_days_max);
  else
    if v_settings.delivery_days_min is null or v_settings.delivery_days_max is null then
      raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
    end if;
    v_from := public._add_business_days(current_date, v_settings.delivery_days_min);
    v_to := public._add_business_days(current_date, v_settings.delivery_days_max);
  end if;

  if jsonb_typeof(p_order -> 'items') is distinct from 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'order_has_no_items' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, status, est_delivery_from, est_delivery_to, shipping_method,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promo_code_id, payment_intent_id, payment_status, shipping_address)
  values (
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    'confirmed',
    v_from, v_to, v_method,
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

  -- Variant-id order: every order locks pieces in the same order, so no deadlocks (PR-9).
  for v_item in select value from jsonb_array_elements(p_order -> 'items') order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_unit := (v_item ->> 'unit_price_cents')::integer;

    select v.id, v.label, v.product_id, coalesce(v.price_cents, p.price_cents) as price_cents,
           p.name as product_name, r.name as region_name
      into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.regions r on r.id = p.region_id
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

  -- Every piece from India goes on the buy list at once (D-115). A piece already in the US is not bought (D-072).
  insert into public.pickups (order_item_id, variant_id, quantity, shop_price_paise)
  select oi.id, oi.variant_id, oi.quantity, p.shop_price_paise
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id and not p.is_us_stock;

  -- An order of only US pieces has just moved to the US days (_us_stock_order): its shipment follows the order.
  select o.est_delivery_from, o.est_delivery_to into v_from, v_to from public.orders o where o.id = v_order.id;

  -- The order's shipments. Shipping is one parcel's (the whole bag), shared by weight so the two add up.
  if v_split then
    v_food_share := case when coalesce((v_ship ->> 'shipping_cents')::integer, 0) = 0 then 0
                         else round(v_order.shipping_cents * (v_ship ->> 'food_shipping_cents')::numeric
                                    / (v_ship ->> 'shipping_cents')::numeric)::integer end;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, 'food', public._add_business_days(current_date, v_settings.food_delivery_days_min),
            public._add_business_days(current_date, v_settings.food_delivery_days_max), v_food_share)
    returning id into v_first;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 2, 'standard', v_from, v_to, v_order.shipping_cents - v_food_share)
    returning id into v_second;
    update public.order_items oi
       set shipment_id = case when oi.variant_id in (select jsonb_array_elements_text(v_ship -> 'food_variant_ids')::uuid)
                              then v_first else v_second end
     where oi.order_id = v_order.id;
  else
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, case when v_food_only then 'food' when v_method = 'express' then 'express' else 'standard' end,
            v_from, v_to, v_order.shipping_cents)
    returning id into v_first;
    update public.order_items oi set shipment_id = v_first where oi.order_id = v_order.id;
  end if;

  return query select v_order.id, v_order.order_number;
end $$;

-- ---------------------------------------------------------------- after the order

-- Express orders already placed keep their rule: until the courier leaves.
create or replace function public._in_india(p_order public.orders) returns boolean
language sql immutable
as $$
  select case when p_order.shipping_method = 'express'
              then p_order.status in ('confirmed', 'collecting')
              else p_order.status in ('confirmed', 'collecting', 'packed')
         end;
$$;

create or replace function public._us_stock_order() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order public.orders;
  v_min integer;
  v_max integer;
begin
  select * into v_order from public.orders where id = new.order_id;
  if v_order.status <> 'confirmed' or v_order.shipping_method <> 'standard' then
    return null;
  end if;
  if exists (select 1 from public.order_items oi join public.products p on p.id = oi.product_id
             where oi.order_id = new.order_id and not p.is_us_stock) then
    return null;
  end if;
  select domestic_days_min, domestic_days_max into v_min, v_max from public.pricing_settings where id = 1;
  perform set_config('iwc.window_change', 'on', true);
  update public.orders
     set status = 'arrived',
         est_delivery_from = current_date + coalesce(v_min, 0), est_delivery_to = current_date + coalesce(v_max, 0)
   where id = new.order_id;
  perform set_config('iwc.window_change', '', true);
  return null;
end $$;

-- A food shipment cannot go back once its pieces are bought (D-154).
create function public._food_bought(p_order uuid) returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.order_shipments sh
                 where sh.order_id = p_order and sh.kind = 'food' and sh.status <> 'cancelled'
                   and public._shipment_bought(sh.id));
$$;
revoke all on function public._food_bought(uuid) from public, anon, authenticated;

create or replace function public._order_actions(p_order uuid) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'can_cancel', public._in_india(o) and not public._food_bought(o.id),
    'cancel_refund_cents', case when public._in_india(o) and not public._food_bought(o.id)
                                then public._customer_cancel_cents(o.id) end,
    'delay_open', public._delay_open(o.id),
    'delay_refund_cents', case when public._delay_open(o.id) then public._delay_refund_cents(o.id) end,
    'delay_shipment', case when public._delay_open(o.id)
                           then (select sh.seq from public.order_shipments sh where sh.id = public._delay_shipment(o.id)) end,
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_id', i.id,
               'claim_refund_cents', (select q.refund_cents from public._return_quote(i.id, 'damaged') q),
               'change_of_mind_refund_cents', (select q.refund_cents from public._return_quote(i.id, 'changed_mind') q),
               'requested', exists (select 1 from public.returns r where r.order_item_id = i.id))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id and o.status = 'delivered'), '[]'::jsonb))
  from public.orders o where o.id = p_order;
$$;

create or replace function public._order_shipments_json(p_order uuid) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', sh.seq,
           -- TODO(D-187): drop the 'quick' answer when app <next version> is the minimum (its schema refuses 'food');
           -- @repo/db's schema reads it back as 'food'.
           'kind', case sh.kind when 'food' then 'quick' else sh.kind end,
           'status', sh.status,
           'est_delivery_from', sh.est_delivery_from, 'est_delivery_to', sh.est_delivery_to,
           'shipping_cents', sh.shipping_cents, 'carrier', sh.carrier, 'tracking_number', sh.tracking_number,
           'shipped_at', sh.shipped_at,
           'item_ids', coalesce((select jsonb_agg(i.id order by i.product_name) from public.order_items i
                                 where i.shipment_id = sh.id), '[]'::jsonb))
         order by sh.seq), '[]'::jsonb)
  from public.order_shipments sh where sh.order_id = p_order;
$$;

create or replace function public.store_my_order(p_order_number text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from public.store_order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.store_order_events e where e.order_id = o.id), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

create or replace function public.guest_order_lookup(p_order_number text, p_email text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'email', o.email,
      'customer_status', case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
         else 'preparing' end,
      'est_delivery_from', o.est_delivery_from, 'est_delivery_to', o.est_delivery_to,
      'subtotal_cents', o.subtotal_cents, 'discount_cents', o.discount_cents, 'shipping_cents', o.shipping_cents,
      'tax_cents', o.tax_cents, 'total_cents', o.total_cents, 'currency', o.currency,
      'payment_status', o.payment_status, 'shipping_address', o.shipping_address,
      'tracking_number', o.tracking_number, 'carrier', o.carrier, 'created_at', o.created_at,
      'shipping_method', o.shipping_method, 'refunded_cents', o.refunded_cents),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
               'variant_label', i.variant_label, 'region_name', i.region_name, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'total_price_cents', i.total_price_cents, 'status', i.status,
               'image_path', (select m.storage_path from public.product_media m
                               where m.product_id = i.product_id order by m.is_primary desc, m.sort_order limit 1),
               'made_in_india', coalesce((select p.made_in = 'India' from public.products p where p.id = i.product_id), true))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at,
                                          'shipment', (select sh.seq from public.order_shipments sh where sh.id = e.shipment_id))
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- Every shipment leaves the hub by courier once its pieces are there (D-115, D-154).
create or replace function public.ship_shipment(p_shipment uuid, p_carrier text, p_tracking text) returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_sh public.order_shipments;
  v_order public.orders;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_carrier, ''))) not between 2 and 40
     or length(btrim(coalesce(p_tracking, ''))) not between 4 and 60 then
    raise exception 'invalid_tracking' using errcode = 'P0001';
  end if;
  select o.* into v_order from public.orders o join public.order_shipments sh on sh.order_id = o.id
   where sh.id = p_shipment for update of o;
  select * into v_sh from public.order_shipments where id = p_shipment for update;
  if not found or v_sh.status <> 'open' then
    raise exception 'shipment_not_open' using errcode = 'P0001';
  end if;
  if v_order.status not in ('confirmed', 'collecting', 'packed', 'in_transit', 'arrived') or exists (
       select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
       where oi.shipment_id = p_shipment and oi.status = 'active' and p.status = 'pending') then
    raise exception 'pieces_not_picked' using errcode = 'P0001';
  end if;
  update public.order_shipments
     set status = 'shipped', carrier = btrim(p_carrier), tracking_number = btrim(p_tracking), shipped_at = now()
   where id = p_shipment;
  insert into public.order_events (order_id, shipment_id, kind, visible_to_customer, actor)
  values (v_order.id, p_shipment, 'shipped', true, auth.uid());
  perform public._settle_order(v_order.id);
end $$;

create or replace function public._shipment_cancellable(p_shipment uuid) returns boolean
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select sh.status = 'open' and o.payment_status in ('paid', 'partially_refunded')
           and o.status not in ('cancelled', 'refunded') and public._live_shipments(o.id) > 1
           and case when sh.kind = 'food' then not public._shipment_bought(sh.id) else public._in_india(o) end
    from public.order_shipments sh join public.orders o on o.id = sh.order_id
    where sh.id = p_shipment), false);
$$;

create or replace function public.customer_cancel(p_order uuid, p_amount_cents integer, p_refund_ref text) returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_order public.orders;
  v_expected integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or not public._in_india(v_order) then
    raise exception 'order_left_india' using errcode = 'P0001';
  end if;
  if public._food_bought(p_order) then
    raise exception 'food_bought' using errcode = 'P0001';
  end if;
  v_expected := public._customer_cancel_cents(p_order);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  perform public._unwind_order_pieces(p_order, 'cancelled by the customer before leaving India');
  perform public._record_cancel(p_order, p_amount_cents, 'customer cancel, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- ---------------------------------------------------------------- the admin's buying: by site, no vendor

drop function public.admin_to_order();
create function public.admin_to_order()
returns table (pickup_id uuid, order_id uuid, order_number text, ordered_on timestamptz, product_id uuid,
               product_name text, variant_label text, quantity integer, sold_paise integer, site text, item_url text,
               item_key text, now_paise integer, in_stock boolean, delivery_days smallint, image_path text,
               buy_by timestamptz, ship_by timestamptz)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  -- Food is bought within 2 hours of the order and leaves the hub the next day (D-154, the 7 days depend on it).
  return query
  select pk.id, o.id, o.order_number, o.created_at, p.id, oi.product_name, oi.variant_label, pk.quantity,
         pk.shop_price_paise, coalesce(ps.site, pk.site, p.source_site), coalesce(ps.item_url, p.source_url), ps.item_key,
         ps.price_paise, ps.in_stock, ps.delivery_days,
         (select m.storage_path from public.product_media m where m.product_id = p.id
           order by m.is_primary desc, m.sort_order limit 1),
         case when sh.kind = 'food' then o.created_at + interval '2 hours' end,
         case when sh.kind = 'food' then o.created_at + interval '1 day' end
    from public.pickups pk
    join public.order_items oi on oi.id = pk.order_item_id
    join public.orders o on o.id = oi.order_id
    left join public.order_shipments sh on sh.id = oi.shipment_id
    left join public.product_variants pv on pv.id = pk.variant_id
    left join public.products p on p.id = pv.product_id
    left join public.product_sources ps on ps.id = pk.source_id
   where pk.status = 'pending' and pk.ordered_at is null and oi.status = 'active'
     and o.payment_status in ('paid', 'partially_refunded') and o.status in ('confirmed', 'collecting')
   order by o.created_at, pk.id;
end $$;
revoke all on function public.admin_to_order() from public, anon;
grant execute on function public.admin_to_order() to authenticated;

create function public.admin_food_watch() returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'open', count(*),
      'not_bought', count(*) filter (where o.created_at < now() - interval '2 hours' and exists (
        select 1 from public.order_items oi join public.pickups p on p.order_item_id = oi.id
        where oi.shipment_id = sh.id and oi.status = 'active' and p.status = 'pending' and p.ordered_at is null)),
      'not_shipped', count(*) filter (where o.created_at < now() - interval '1 day'))
    from public.order_shipments sh join public.orders o on o.id = sh.order_id
    where sh.kind = 'food' and sh.status = 'open' and o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('cancelled', 'refunded'));
end $$;
revoke all on function public.admin_food_watch() from public, anon;
grant execute on function public.admin_food_watch() to authenticated;

create or replace function public.admin_sales(p_since timestamptz default null) returns jsonb
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  with sold as (
    select oi.quantity, oi.total_price_cents, coalesce(oi.region_name, 'All states') as region_name, o.id as order_id,
           coalesce(c.name, 'Unknown') as category_name,
           coalesce(p.source_site, 'Unknown') as shop_name
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    where oi.status = 'active'
      and o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('pending_payment', 'cancelled', 'refunded')
      and (p_since is null or o.created_at >= p_since)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object('orders', count(distinct order_id), 'pieces', coalesce(sum(quantity), 0),
                                         'revenue_cents', coalesce(sum(total_price_cents), 0)) from sold),
    'by_region', coalesce((select jsonb_agg(jsonb_build_object('name', region_name, 'pieces', pieces,
                                                               'revenue_cents', revenue) order by revenue desc, region_name)
                           from (select region_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                 from sold group by region_name) g), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', category_name, 'pieces', pieces,
                                                                 'revenue_cents', revenue) order by revenue desc, category_name)
                             from (select category_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                   from sold group by category_name) g), '[]'::jsonb),
    'by_shop', coalesce((select jsonb_agg(jsonb_build_object('name', shop_name, 'pieces', pieces, 'revenue_cents', revenue)
                                          order by revenue desc, shop_name)
                         from (select shop_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                               from sold group by shop_name) g), '[]'::jsonb))
  into v_result;
  return v_result;
end $$;

create or replace function public.admin_order_counts() returns jsonb
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(s.status, s.n)
      from (select o.status, count(*) as n from public.orders o group by o.status) s), '{}'::jsonb));
end $$;

create or replace function public.admin_shop_bill(p_order uuid) returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select id into v_id from public.shop_bills where order_id = p_order;
  if v_id is not null then
    return v_id;
  end if;
  if not exists (select 1 from public.orders where id = p_order) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  insert into public.shop_bills (order_id) values (p_order) returning id into v_id;
  insert into public.shop_bill_lines (bill_id, order_item_id, kind, label, quantity, unit_paise, shop, shop_order_ref, sort_order)
  select v_id, oi.id, 'piece', left(oi.product_name || ' · ' || oi.variant_label, 200), oi.quantity,
         coalesce(case when pk.paid_paise is not null then pk.paid_paise / oi.quantity end,
                  pk.shop_price_paise, oi.shop_price_paise, 0),
         left(coalesce(ps.site, pk.site, p.source_site), 120), pk.shop_order_ref,
         (row_number() over (order by oi.created_at, oi.id))::smallint
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    left join public.pickups pk on pk.order_item_id = oi.id
    left join public.product_sources ps on ps.id = pk.source_id
   where oi.order_id = p_order and oi.status = 'active';
  insert into public.shop_bill_lines (bill_id, kind, label, unit_paise, sort_order)
  values (v_id, 'delivery', 'Delivery', 0, 900);
  return v_id;
end $$;

drop function public.admin_stale_variants();
create function public.admin_stale_variants()
returns table (variant_id uuid, product_id uuid, product_name text, label text, qty_listed integer,
               qty_confirmed_at timestamptz, site text)
language plpgsql stable
set search_path to 'public', 'pg_temp'
as $$
declare
  v_days integer := (select s.stale_listing_days from public.pricing_settings s where s.id = 1);
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if v_days is null then
    return;
  end if;
  return query
    select v.id, p.id, p.name, v.label, v.qty_listed, v.qty_confirmed_at, coalesce(ps.site, p.source_site)
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.product_sources ps on ps.id = v.source_id
    where p.status = 'live' and v.is_active
      and (v.qty_confirmed_at is null or v.qty_confirmed_at < now() - v_days * interval '1 day')
    order by v.qty_confirmed_at nulls first, p.name, v.sort_order;
end $$;
revoke all on function public.admin_stale_variants() from public, anon;
grant execute on function public.admin_stale_variants() to authenticated;

drop function public.admin_price_sheet(public.product_status, boolean, text, public.product_type, uuid, boolean, uuid, uuid, integer, integer);
create function public.admin_price_sheet(p_status public.product_status default null, p_us_stock boolean default false,
                                         p_search text default null, p_type public.product_type default null,
                                         p_region uuid default null, p_no_region boolean default false,
                                         p_category uuid default null, p_site text default null,
                                         p_min_cents integer default null, p_max_cents integer default null)
returns table (name text, product_type public.product_type, shop_price_paise integer, weight_g integer, price_cents integer)
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select p.name, p.product_type, pick.shop, pick.g, p.price_cents
    from public.products p
   cross join lateral (select max(v.weight_g) as g from public.product_variants v
                        where v.product_id = p.id and v.is_active) wmax
   cross join lateral (
     select x.shop, x.g
       from (select 0 as src, v.sort_order as ord, v.shop_price_paise as shop,
                    coalesce(v.weight_g, wmax.g,
                             public._fallback_weight_g(p.product_type, v.shop_price_paise, p.category_id)) as g
               from public.product_variants v
              where v.product_id = p.id and v.is_active and v.shop_price_paise is not null
             union all
             select 1, 0, p.shop_price_paise,
                    coalesce(wmax.g, public._fallback_weight_g(p.product_type, p.shop_price_paise, p.category_id))) x
      order by x.src, public._auto_price_cents(x.shop, x.g, p.product_type) nulls last, x.ord
      limit 1) pick
   where (p_status is null or p.status = p_status)
     and (not coalesce(p_us_stock, false) or p.is_us_stock)
     and (coalesce(trim(p_search), '') = '' or p.search @@ websearch_to_tsquery('simple', trim(p_search)))
     and (p_type is null or p.product_type = p_type)
     and (p_region is null or p.region_id = p_region)
     and (not coalesce(p_no_region, false) or p.region_id is null)
     and (p_category is null or p.category_id = p_category)
     and (p_site is null or p.source_site = p_site)
     and (p_min_cents is null or p.price_cents >= p_min_cents)
     and (p_max_cents is null or p.price_cents <= p_max_cents)
   order by p.updated_at desc, p.id
   limit 20000;
end $$;
revoke all on function public.admin_price_sheet(public.product_status, boolean, text, public.product_type, uuid, boolean, uuid, text, integer, integer) from public, anon;
grant execute on function public.admin_price_sheet(public.product_status, boolean, text, public.product_type, uuid, boolean, uuid, text, integer, integer) to authenticated;

-- A new listing: its state is the admin's (empty = all-India, D-121); the link it is bought from is optional.
create or replace function public.admin_create_listing(p_listing jsonb) returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
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
  if jsonb_typeof(coalesce(p_listing -> 'variants', '[]'::jsonb)) <> 'array' then
    raise exception 'variants_must_be_a_list' using errcode = 'P0001';
  end if;
  if v_price is null then
    select coalesce(max(nullif(v ->> 'weight_g', '')::integer),
                    (select default_weight_g from public.categories where id = (p_listing ->> 'category_id')::uuid))
      into v_weight
    from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) v;
    v_price := public.admin_price_preview(v_shop, v_weight, (p_listing ->> 'product_type')::public.product_type);
    if v_price is null then
      raise exception 'price_needed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.products (region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, price_auto, status, created_by, source_url, source_site)
  values (nullif(p_listing ->> 'region_id', '')::uuid, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          v_price, v_shop, nullif(p_listing ->> 'price_cents', '') is null, 'draft', auth.uid(),
          nullif(p_listing ->> 'source_url', ''), nullif(p_listing ->> 'source_site', ''))
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, weight_source, weight_note,
                                         qty_listed, qty_confirmed_at, sort_order, shop_price_paise)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            case when v_variant ->> 'weight_source' in ('weighed', 'admin', 'shop', 'similar')
                 then v_variant ->> 'weight_source' end,
            nullif(left(coalesce(v_variant ->> 'weight_note', ''), 200), ''),
            (v_variant ->> 'qty')::integer, now(), v_n, nullif(v_variant ->> 'shop_price_paise', '')::integer);
  end loop;
  return v_id;
end $$;

create or replace function public._to_clearance(p_item uuid, p_why text) returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_item public.order_items;
  v_product public.products;
  v_discount numeric;
  v_price integer;
  v_slug text;
  v_id uuid;
  v_weight integer;
begin
  select * into v_item from public.order_items where id = p_item;
  select * into v_product from public.products where id = v_item.product_id;
  if v_product.id is null then
    return null;   -- the product was deleted: nothing to copy
  end if;
  select coalesce(clearance_discount_pct, 0) into v_discount from public.pricing_settings where id = 1;
  v_price := greatest(99, (floor(v_item.unit_price_cents * (1 - v_discount / 100) / 100) * 100 - 1)::integer);
  v_slug := left(v_product.slug, 70) || '-us-' || substr(md5(p_item::text), 1, 6);
  select weight_g into v_weight from public.product_variants where id = v_item.variant_id;

  insert into public.products (slug, name, product_type, region_id, category_id, summary, description, story,
                               craft, attributes, price_cents, price_auto, shop_price_paise, origin_town,
                               has_origin_label, status, is_us_stock, made_in)
  values (v_slug, v_product.name, v_product.product_type, v_product.region_id, v_product.category_id,
          v_product.summary, v_product.description, v_product.story, v_product.craft,
          v_product.attributes, v_price, false, null, v_product.origin_town, v_product.has_origin_label, 'draft', true,
          v_product.made_in)
  returning id into v_id;
  insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at)
  select v_id, upper(v_slug) || '-1', v_item.variant_label, coalesce(v.options, '{}'::jsonb), v_weight, v_item.quantity, now()
  from (select 1) one left join public.product_variants v on v.id = v_item.variant_id;
  insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary)
  select v_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary
  from public.product_media m where m.product_id = v_product.id and m.variant_id is null;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (v_item.order_id, 'note', false,
          v_item.product_name || ' (' || v_item.variant_label || ') → US clearance draft ' || v_slug || ' (' || p_why || ')');
  return v_id;
end $$;

-- ---------------------------------------------------------------- the machines

create or replace function public.worker_description_plan(p_type public.product_type default null, p_after uuid default null,
                                                           p_limit integer default 25)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'type', p.product_type, 'name', p.name, 'category', c.name, 'wears', p.wears,
             'attributes', p.attributes, 'summary', p.summary, 'description', p.description,
             'shop_title', p.shop_title, 'shop', coalesce(sh.label, p.source_site), 'made_in', p.made_in,
             'hash', public._description_hash(p.summary, p.description))
           order by p.id)
      from (select p.* from public.products p
             where (p_type is null or p.product_type = p_type) and not p.is_placeholder and p.status <> 'archived'
               and p.description_redo is null
               and (coalesce(p.description, '') <> '' or coalesce(p.summary, '') <> '')
               and p.id > coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid)
             order by p.id
             limit least(greatest(p_limit, 1), 50)) p
      join public.categories c on c.id = p.category_id
      left join public.sourcing_shops sh on sh.site = p.source_site), '[]'::jsonb);
end $$;

create or replace function public.worker_photo_redo_plan(p_type public.product_type, p_after uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  -- The models are folders on the founder's laptop (D-187): only the listings come from here.
  return jsonb_build_object(
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', p.id, 'name', p.name, 'category', c.slug, 'wears', p.wears,
               'photos', (select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'alt', m.alt_text,
                                                              'main', m.id = public._main_photo(p.id))
                                           order by m.is_primary desc, m.sort_order, m.created_at)
                            from public.product_media m
                           where m.product_id = p.id and public._redo_wanted(m, p.product_type)))
             order by p.id)
        from (select p.* from public.products p
               where p.product_type = p_type and not p.is_placeholder and p.status <> 'archived'
                 and p.id > coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid)
                 and exists (select 1 from public.product_media m
                              where m.product_id = p.id and public._redo_wanted(m, p.product_type))
               order by p.id
               limit least(greatest(p_limit, 1), 200)) p
        join public.categories c on c.id = p.category_id), '[]'::jsonb));
end $$;

-- The runner's new listing: the site is its shop (no vendor row).
create or replace function public.worker_sourcing_add(p_target uuid, p_listing jsonb) returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.sourcing_settings;
  t public.sourcing_targets;
  v_site text := p_listing ->> 'site';
  v_existing uuid;
  v_id uuid;
  v_slug text := coalesce(p_listing ->> 'slug', '');
  v_shop integer;
  v_weight integer;
  v_price integer;
  v_item jsonb;
  v_n integer;
  v_var uuid;
  v_src uuid;
  v_vars uuid[] := '{}';
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;
  select * into t from public.sourcing_targets where id = p_target and status = 'searching' for update;
  if not found then
    raise exception 'target_not_held' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_listing -> 'variants') is distinct from 'array'
     or jsonb_array_length(p_listing -> 'variants') not between 1 and 60
     or exists (select 1 from jsonb_array_elements(p_listing -> 'variants') x
                 where coalesce(x ->> 'item_key', '') = '' or coalesce((x ->> 'price_paise')::integer, 0) <= 0
                    or coalesce(x ->> 'item_url', '') !~ '^https://' or coalesce(x ->> 'label', '') = '')
     or (select count(distinct x ->> 'item_key') from jsonb_array_elements(p_listing -> 'variants') x)
        <> jsonb_array_length(p_listing -> 'variants')
     or coalesce(v_site, '') = '' or coalesce(p_listing ->> 'page_url', '') !~ '^https://'
     or length(coalesce(p_listing ->> 'name', '')) not between 2 and 120
     or jsonb_typeof(coalesce(p_listing -> 'attributes', '{}'::jsonb)) <> 'object' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;

  select ps.product_id into v_existing
    from public.product_sources ps
   where ps.site = v_site and ps.item_key in (select x ->> 'item_key' from jsonb_array_elements(p_listing -> 'variants') x)
   limit 1;
  if v_existing is null then
    select id into v_existing from public.products where source_url = p_listing ->> 'page_url';
  end if;
  if v_existing is not null then
    return jsonb_build_object('product_id', v_existing, 'created', false);
  end if;

  select coalesce(min((x ->> 'price_paise')::integer) filter (where (x ->> 'in_stock')::boolean),
                  min((x ->> 'price_paise')::integer)),
         max(nullif(x ->> 'weight_g', '')::integer)
    into v_shop, v_weight
    from jsonb_array_elements(p_listing -> 'variants') x;
  v_price := public._auto_price_cents(
    v_shop,
    coalesce(v_weight, nullif(p_listing ->> 'weight_g', '')::integer,
             public._fallback_weight_g(t.product_type, v_shop, t.category_id)),
    t.product_type);
  if v_price is null then
    raise exception 'price_needed' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;
  while exists (select 1 from public.products where slug = v_slug) loop
    v_slug := left(coalesce(p_listing ->> 'slug', 'item'), 70) || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.products (region_id, category_id, product_type, name, slug, summary, description,
                               attributes, price_cents, shop_price_paise, price_auto, status, created_by, source_url,
                               source_site, source_checked_at, source_in_stock, sourcing_target_id)
  values (t.region_id, t.category_id, t.product_type, p_listing ->> 'name', v_slug,
          nullif(left(p_listing ->> 'summary', 300), ''), nullif(left(p_listing ->> 'description', 4000), ''),
          coalesce(p_listing -> 'attributes', '{}'::jsonb), v_price, v_shop, true, 'draft', auth.uid(),
          p_listing ->> 'page_url', v_site, now(), true, t.id)
  returning id into v_id;

  for v_item, v_n in select x, n from jsonb_array_elements(p_listing -> 'variants') with ordinality as e(x, n) loop
    insert into public.product_variants (product_id, sku, label, options, weight_g, weight_source, weight_note,
                                         qty_listed, qty_confirmed_at, sort_order, shop_price_paise, net_qty)
    values (v_id, upper(v_slug) || '-' || v_n, left(v_item ->> 'label', 80),
            case when jsonb_typeof(v_item -> 'options') = 'object' then v_item -> 'options' else '{}'::jsonb end,
            nullif(v_item ->> 'weight_g', '')::integer,
            case when v_item ->> 'weight_source' in ('shop', 'similar')
                      or (v_item ->> 'weight_source' = 'packed' and t.product_type in ('food', 'home'))
                 then v_item ->> 'weight_source' end,
            nullif(left(coalesce(v_item ->> 'weight_note', ''), 200), ''),
            case when (v_item ->> 'in_stock')::boolean then s.qty_per_variant else 0 end, now(), v_n,
            (v_item ->> 'price_paise')::integer,
            case when t.product_type = 'food' then nullif(left(coalesce(v_item ->> 'net_qty', ''), 40), '') end)
    returning id into v_var;
    v_vars := v_vars || v_var;
    insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                        mrp_paise, in_stock, delivery_days, checked_at)
    values (v_id, v_var, v_site, coalesce(nullif(v_item ->> 'page_url', ''), p_listing ->> 'page_url'),
            v_item ->> 'item_url', v_item ->> 'item_key', (v_item ->> 'price_paise')::integer,
            nullif(v_item ->> 'mrp_paise', '')::integer, coalesce((v_item ->> 'in_stock')::boolean, false),
            nullif(v_item ->> 'delivery_days', '')::smallint, now())
    returning id into v_src;
    update public.product_variants set source_id = v_src where id = v_var;
  end loop;

  -- the same piece on other shops: backups the weekly check can switch to
  insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                      mrp_paise, in_stock, delivery_days, checked_at)
  select v_id, v_vars[(b ->> 'variant')::integer], b ->> 'site', b ->> 'page_url', b ->> 'item_url', b ->> 'item_key',
         nullif(b ->> 'price_paise', '')::integer, nullif(b ->> 'mrp_paise', '')::integer,
         coalesce((b ->> 'in_stock')::boolean, false), nullif(b ->> 'delivery_days', '')::smallint, now()
    from jsonb_array_elements(coalesce(p_listing -> 'backups', '[]'::jsonb)) b
   where (b ->> 'variant')::integer between 1 and cardinality(v_vars)
     and coalesce(b ->> 'site', '') <> '' and coalesce(b ->> 'item_key', '') <> ''
     and coalesce(b ->> 'page_url', '') ~ '^https://' and coalesce(b ->> 'item_url', '') ~ '^https://'
  on conflict (site, item_key) where item_key is not null do nothing;

  perform public._sourcing_settle(v_id);
  update public.sourcing_targets set found_count = found_count + 1 where id = p_target;
  return jsonb_build_object('product_id', v_id, 'created', true);
end $$;

-- Food's fast shops still come first when a listing can be bought there (the 7 days depend on it).
create or replace function public._quick_sourceable(p_product uuid) returns boolean
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.pricing_settings s
                  where s.id = 1 and s.food_delivery_days_min is not null and s.food_delivery_days_max is not null)
     and coalesce((
       select bool_and(x.quick)
         from (select ps.variant_id, bool_or(coalesce(sh.quick_delivery, false)) as quick
                 from public.product_sources ps
                 join public.product_variants v on v.id = ps.variant_id
                 left join public.sourcing_shops sh on sh.site = ps.site
                 cross join public.sourcing_settings ss
                where v.product_id = p_product and v.is_active and ss.id = 1
                  and ps.review is null and ps.fail_count < 2 and ps.in_stock and ps.price_paise is not null
                  and coalesce(ps.delivery_days, sh.delivery_days, 0) <= greatest(ss.max_delivery_days, coalesce(sh.delivery_days, 0))
                group by ps.variant_id) x), false)
$$;

create or replace function public._kick_email_outbox() returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'pending' and next_attempt_at <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'iwc_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'iwc_outbox_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/internal/email-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $$;

notify pgrst, 'reload schema';
