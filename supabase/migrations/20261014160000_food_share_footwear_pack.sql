-- =============================================================================
-- D-122: food priced in step with its weight; footwear at a pair's packed weight; the pack size on food cards.
--
--  - Food carried its full share of a parcel's courier, so 400 g of bhujia came out at four times 200 g ($2.99 on the
--    small-food shelf, $11.29 above it) and 1 kg at $27.49. Every food piece now carries the same share of its
--    courier cost (`food_ship_share_pct`, 70%), and the small-food shelf the same share: 200 g $3.99, 400 g $8.49,
--    1 kg $20.49 (₹55 / ₹100 / ₹230). The rest of a small bag's courier is paid by the small-order charges (D-112).
--  - Footwear without its own weight was priced at 1 kg; a pair of juttis or slippers with its box is about 600 g.
--  - store_browse also returns `all_total` (every piece of the type: the states' counts each include the all-India
--    pieces, so adding them up overcounts, and a type with only all-India pieces looked empty).
--  - Cards (store_home, state pages, product pages, browse) carry `pack`: a food piece's pack size ("200 g"), from its
--    cheapest option's pack, else from its name. The pack size is printed on the pack: not operations information.
-- =============================================================================

alter table public.pricing_settings
  add column food_ship_share_pct numeric(5, 2) check (food_ship_share_pct >= 0 and food_ship_share_pct <= 100);
CREATE OR REPLACE FUNCTION public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type product_type)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.pricing_settings;
  v_rate numeric;
  v_cost numeric;
  v_goods numeric;
  v_ship numeric;
  v_price numeric;
  v_margin numeric;
  v_alloc numeric;
  v_duty numeric;
  v_min_cents numeric;
  v_min_pct numeric;
  v_cut numeric;
  v_guard numeric;
  v_guard_goods numeric;
  v_recipe integer;
  v_base numeric;
  v_step integer;
begin
  select * into s from public.pricing_settings where id = 1;
  if p_shop_paise is null or p_weight_g is null or s.fx_inr_per_usd is null or s.fx_buffer_pct is null then
    return null;
  end if;
  v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);

  if p_type = 'food' then
    v_margin := coalesce(s.margin_food_pct, s.margin_pct);
    if v_margin is null or s.india_handling_pct is null or s.courier_first_kg_paise is null
       or s.courier_next_kg_paise is null or s.food_parcel_kg is null then
      return null;
    end if;
    v_alloc := (s.courier_first_kg_paise + (s.food_parcel_kg - 1) * s.courier_next_kg_paise
                + coalesce(s.parcel_fixed_paise, 0)) / s.food_parcel_kg;
    v_goods := (p_shop_paise + coalesce(s.food_fee_paise, 0)) * (1 + s.india_handling_pct / 100) / v_rate;
    v_ship := v_alloc * p_weight_g * coalesce(s.food_billed_pct, 100) / 100 / 1000 / v_rate;
    -- D-122: the same share of its courier for every weight (empty = the full share, as D-119)
    v_cost := v_goods + v_ship * coalesce(s.food_ship_share_pct, 100) / 100;
    v_price := v_cost * (1 + v_margin / 100);
    v_duty := coalesce(s.duty_food_pct, 0);
    v_min_cents := coalesce(s.min_profit_food_cents, 0);
    v_min_pct := coalesce(s.min_profit_food_pct, s.min_profit_pct, 0);
  else
    if s.shop_divisor is null or s.ship_paise_per_100g is null then
      return null;
    end if;
    v_cost := (p_shop_paise / s.shop_divisor + s.ship_paise_per_100g * p_weight_g / 100.0) / v_rate;
    if p_type = 'home' then
      v_margin := public._tapered_margin(v_cost, coalesce(s.margin_home_pct, s.margin_pct), s.margin_home_min_pct,
                                         s.taper_home_from_cents, s.taper_home_to_cents);
      v_duty := coalesce(s.duty_home_pct, 0);
      v_min_cents := coalesce(s.min_profit_home_cents, 0);
    else
      v_margin := public._tapered_margin(v_cost, coalesce(s.margin_clothing_pct, s.margin_pct),
                                         s.margin_clothing_min_pct, s.taper_clothing_from_cents,
                                         s.taper_clothing_to_cents);
      v_duty := coalesce(s.duty_clothing_pct, 0);
      v_min_cents := coalesce(s.min_profit_clothing_cents, 0);
    end if;
    if v_margin is null then
      return null;
    end if;
    v_price := v_cost / greatest(0.05, 1 - v_margin / 100);
    v_min_pct := coalesce(s.min_profit_pct, 0);
  end if;

  -- The guard (D-119): what is left after duty and the card fee must be at least the minimum profit.
  v_cut := (v_duty + coalesce(s.guard_card_fee_pct, 0)) / 100;
  v_guard := greatest((v_cost + v_min_cents) / greatest(0.05, 1 - v_cut),
                      v_cost / greatest(0.05, 1 - v_cut - v_min_pct / 100));
  v_recipe := public._price_ending(greatest(v_price, v_guard));

  -- The small-food shelf (D-120).
  if p_type = 'food' and s.small_food_max_shop_paise is not null and s.small_food_max_g is not null
     and s.small_food_ship_share_pct is not null and s.small_food_floor_cents is not null
     and s.small_food_ceiling_cents is not null
     and p_shop_paise <= s.small_food_max_shop_paise and p_weight_g <= s.small_food_max_g then
    v_guard_goods := greatest((v_goods + v_min_cents) / greatest(0.05, 1 - v_cut),
                              v_goods / greatest(0.05, 1 - v_cut - v_min_pct / 100));
    if v_guard_goods <= s.small_food_ceiling_cents then
      v_base := greatest(v_goods * (1 + v_margin / 100) + v_ship * s.small_food_ship_share_pct / 100, v_guard_goods);
      v_step := least(s.small_food_floor_cents
                        + greatest(0, ceil((v_base - s.small_food_floor_cents - 1e-9) / 100))::integer * 100,
                      s.small_food_ceiling_cents);
      return least(v_step, greatest(s.small_food_floor_cents, v_recipe));
    end if;
  end if;
  return v_recipe;
end $function$;

-- A food piece's pack size for its card: its cheapest available option's pack, else the first weight in its name.
create function public._store_pack(p_product uuid, p_name text, p_type public.product_type)
returns text
language sql stable set search_path = public, pg_temp as $$
  select case when p_type = 'food' then coalesce(
    (select sv.options ->> 'pack' from public.store_variants sv
      where sv.product_id = p_product and coalesce(sv.options ->> 'pack', '') <> ''
      order by (sv.available > 0) desc, sv.price_cents, sv.sort_order limit 1),
    regexp_replace(substring(lower(p_name) from '([0-9]+(\.[0-9]+)? ?(kg|gms|gm|g|ml|l))([^a-z]|$)'),
                   '([0-9]) ?(kg|gms|gm|g|ml|l)$', '\1 \2'))
  end;
$$;
revoke all on function public._store_pack(uuid, text, public.product_type) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public._store_product_card(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'pack', public._store_pack(p.id, p.name, p.product_type),
    'available', v.available,
    -- With exactly one variant, max() is that variant.
    'quick_add', case when v.n = 1 and v.available > 0
                      then jsonb_build_object('variant_id', v.one_id, 'label', v.one_label, 'price_cents', v.one_price)
                 end)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$function$;
CREATE OR REPLACE FUNCTION public.store_browse(p_type text, p_region text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    where p.product_type::text = p_type),
  in_region as (select * from typed where p_region is null or region_slug = p_region or region_slug is null),
  shown as (select * from in_region where p_category is null or category_slug = p_category)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    -- D-122: everything of the type (the states' counts each include the all-India pieces)
    'all_total', (select count(*) from typed),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null))
             order by g.region_name)
      from (select region_slug, region_name, count(*) as n from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from in_region group by category_slug, category_name) g),
      '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type))
             order by s.published_at desc nulls last, s.name, s.id)
      from (select * from shown
            order by published_at desc nulls last, name, id   -- id last: pages never repeat or skip a product
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$function$;

-- The numbers (Claude's proposals, labelled until the founder saves their own). Each update reprices every listing.
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct',
  'card_fee_pct', 'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg',
  'express_days_min', 'express_days_max', 'cycle_days', 'fast_offer_cents', 'cancel_fee_pct',
  'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
  'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct',
  'food_fee_paise', 'food_parcel_kg', 'food_billed_pct', 'parcel_fixed_paise',
  'duty_clothing_pct', 'duty_food_pct', 'duty_home_pct',
  'small_food_max_shop_paise', 'small_food_max_g', 'small_food_ship_share_pct',
  'home_est_g_per_rupee', 'home_est_min_g', 'food_ship_share_pct'));

update public.pricing_settings set food_ship_share_pct = 70, small_food_ship_share_pct = 70 where id = 1;
-- only while it still has the first placeholder weight (D-069): a weight the founder set stays
update public.categories set default_weight_g = 600 where slug = 'footwear' and default_weight_g = 1000;

insert into public.pricing_estimates (setting, source, source_url, checked_on) values
  ('food_ship_share_pct', 'Claude (D-122): 70% keeps a bag of food alone near break-even past the free-shipping line and prices 1 kg at about five times 200 g', null, '2026-10-14'),
  ('small_food_ship_share_pct', 'Claude (D-122): the same share as every food piece, so the shelf and the recipe agree', null, '2026-10-14')
on conflict (setting) do update set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;

