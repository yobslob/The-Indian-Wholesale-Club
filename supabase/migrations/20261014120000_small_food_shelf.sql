-- =============================================================================
-- D-120: small food on a shelf of whole-dollar steps ($1.99, $2.99, $3.99).
--
-- D-119's food recipe gives a masala packet its full share of a parcel's courier, so a ₹100 / 100 g packet came out
-- at $4.29 and a 200 g one near $7.29. The founder: they belong between $1.99 and $3.99. A small bag pays its courier
-- through the small-order charges ($18.79 + $1.99, D-112), so a light, cheap food piece now carries only part of its
-- shipping share:
--    goods  = (shop ₹ + fee) × (1 + India handling %) ÷ effective rate          (as D-119)
--    ship   = billed kg × the rate card over a food parcel ÷ effective rate     (as D-119)
--    base   = goods × (1 + food margin) + ship × shipping share %, at least the guard on the goods alone
--    price  = up to the next whole-dollar step from the bottom one, at most the top one; never dearer than the
--             piece's own D-119 price (raised to the bottom step)
-- Small food = a food piece (each variant on its own) whose shop price and weight are within the shelf's limits.
-- Every other piece is priced exactly as D-119. An empty shelf number turns the shelf off.
-- Latest pricing functions before this: 20261014090000_pilot_pricing_two_recipes.
-- =============================================================================

alter table public.pricing_settings
  add column small_food_max_shop_paise integer check (small_food_max_shop_paise >= 0),
  add column small_food_max_g integer check (small_food_max_g > 0),
  add column small_food_ship_share_pct numeric(5, 2)
    check (small_food_ship_share_pct >= 0 and small_food_ship_share_pct <= 100),
  add column small_food_floor_cents integer check (small_food_floor_cents > 0),
  add column small_food_ceiling_cents integer check (small_food_ceiling_cents > 0),
  add constraint pricing_settings_small_food_shelf check (small_food_ceiling_cents >= small_food_floor_cents);

create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
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
    v_cost := v_goods + v_ship;
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
end $$;

-- The shelf's limits and shipping share are Claude's proposals and carry the estimate label (D-047); the steps are
-- the founder's.
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
  'small_food_max_shop_paise', 'small_food_max_g', 'small_food_ship_share_pct'));

-- The founder's steps and Claude's limits (D-120). This update reprices every automatic price
-- (pricing_settings_reprice), variants included.
update public.pricing_settings set
  small_food_max_shop_paise = 20000,
  small_food_max_g = 250,
  small_food_ship_share_pct = 50,
  small_food_floor_cents = 199,
  small_food_ceiling_cents = 399
where id = 1;

-- After the update: changing a setting clears its label (migration 24's trigger), so the labels go on last.
insert into public.pricing_estimates (setting, source, source_url, checked_on) values
  ('small_food_max_shop_paise', 'Claude (D-120): a masala or snack packet costs ₹40 – ₹200 on Blinkit, Zepto and Amazon', null, '2026-10-14'),
  ('small_food_max_g', 'Claude (D-120): masala and snack packets run 50 – 250 g; heavier packs keep their recipe', null, '2026-10-14'),
  ('small_food_ship_share_pct', 'Claude (D-120): a small bag''s courier is paid by the small-order charges, so a packet carries half its share', null, '2026-10-14')
on conflict (setting) do update set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;
