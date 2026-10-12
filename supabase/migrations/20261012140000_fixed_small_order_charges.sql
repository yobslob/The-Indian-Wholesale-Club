-- =============================================================================
-- D-112: the pilot price without card fees, and fixed small-order charges.
--  * Card fees are inside the type margins (the founder confirmed prices were 60–70¢ high on food and $2–3 on
--    clothing): the piece price is landed × (1 + margin), up to .29 / .49 / .79 / .99. `card_fee_pct` and
--    `card_fee_fixed_cents` stay as columns for the retailer model (D-005) but no pilot price reads them.
--  * Small-order charges do not depend on the bag: Shipping $18.79 and Retailer charges $1.99 (founder) below the
--    free-shipping line, struck through from it up. They replace D-111's courier rates, parcel handling and
--    small-order margin.
-- =============================================================================

alter table public.pricing_settings
  add column small_order_shipping_cents integer check (small_order_shipping_cents >= 0),
  add column small_order_retailer_cents integer check (small_order_retailer_cents >= 0);

-- -----------------------------------------------------------------------------
-- The price formula without card fees (D-109's formula with D-111's type margins otherwise unchanged).
-- -----------------------------------------------------------------------------
create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_margin numeric;
  v_rate numeric;
  v_landed numeric;
begin
  select * into s from public.pricing_settings where id = 1;
  v_margin := coalesce(case p_type when 'clothing' then s.margin_clothing_pct
                                   when 'food' then s.margin_food_pct
                                   when 'home' then s.margin_home_pct end,
                       s.margin_pct);
  if p_shop_paise is null or p_weight_g is null or s.fx_inr_per_usd is null or s.fx_buffer_pct is null
     or s.india_handling_pct is null or s.ship_alloc_paise_per_kg is null or v_margin is null then
    return null;
  end if;
  v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
  v_landed := p_shop_paise * (1 + s.india_handling_pct / 100) / v_rate        -- paise ÷ (₹ per $) = cents
              + s.ship_alloc_paise_per_kg * p_weight_g / 1000.0 / v_rate;
  return public._price_ending(v_landed * (1 + v_margin / 100));
end $$;

-- -----------------------------------------------------------------------------
-- A bag's small-order charges: the two fixed amounts for any bag with a piece coming from India (pieces already in
-- the US, D-072, are not in a parcel). The caller waives them from the free-shipping line up.
-- -----------------------------------------------------------------------------
create or replace function public.store_bag_charges(p_items jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_from_india boolean;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  select exists (
    select 1
    from jsonb_array_elements(p_items) i
    join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
    join public.product_variants pv on pv.id = sv.id
    join public.products pr on pr.id = pv.product_id
    where not pr.is_us_stock and coalesce((i ->> 'quantity')::integer, 0) > 0
  ) into v_from_india;
  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'shipping_cents', case when v_from_india then coalesce(s.small_order_shipping_cents, 0) else 0 end,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end);
end $$;

-- D-111's per-parcel numbers go with the formula that used them.
delete from public.pricing_estimates where setting in ('small_order_margin_pct', 'parcel_handling_paise');
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct',
  'card_fee_pct', 'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg',
  'express_days_min', 'express_days_max', 'cycle_days', 'fast_offer_cents', 'cancel_fee_pct',
  'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
  'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct'));
alter table public.pricing_settings
  drop column courier_first_kg_paise,
  drop column courier_next_kg_paise,
  drop column small_order_margin_pct,
  drop column parcel_handling_paise;

-- The founder's amounts (D-112). Every automatic price follows the new formula.
update public.pricing_settings set small_order_shipping_cents = 1879, small_order_retailer_cents = 199 where id = 1;
select public._reprice_products();
