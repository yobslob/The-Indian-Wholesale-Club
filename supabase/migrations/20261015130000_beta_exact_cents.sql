-- =============================================================================
-- D-127, amended: the beta's prices to the cent, no ending. The founder: "don't round up the numbers, I need the original
-- numbers, so i get to see margin as 20, 20, 20, 20, 40, 40, 40, 40 … like this".
--   price = food: cost × 1.20 · clothing: cost ÷ 0.60 · home & gifts: cost ÷ 0.50, rounded to the nearest cent
-- (was: up to the next .29/.49/.69/.79/.99). The full formula behind beta_pricing = false still ends as D-126.
-- =============================================================================

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
  -- D-127: the beta formula, fixed in code: shop ₹ + 10% India handling + ₹2,000 a kg of flight, at the day's rate
  -- (no buffer); food +20% on that cost, clothing 40% and home & gifts 50% of the price; to the cent (D-127: no
  -- price ending in the beta, so the margin shows as it is)
  if s.beta_pricing then
    if p_shop_paise is null or p_weight_g is null or s.fx_inr_per_usd is null or s.fx_inr_per_usd <= 0 then
      return null;
    end if;
    v_cost := (p_shop_paise * 1.10 + 200000 * p_weight_g / 1000.0) / s.fx_inr_per_usd;
    return round(case p_type when 'food' then v_cost * 1.20
                             when 'home' then v_cost / 0.50
                             else v_cost / 0.60 end)::integer;
  end if;
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

  -- D-126: food in its margin band (no safety floor, no small-food shelf): the bag's Shipping covers what a piece
  -- cannot (D-125), so no bag loses
  if p_type = 'food' and s.food_margin_max_pct is not null then
    return public._band_price(v_cost, v_margin, s.food_margin_max_pct);
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
    -- D-125: the guard on everything the shelf price carries (goods and its courier share), and no step under it
    v_guard_goods := greatest((v_goods + v_ship * s.small_food_ship_share_pct / 100 + v_min_cents) / greatest(0.05, 1 - v_cut),
                              (v_goods + v_ship * s.small_food_ship_share_pct / 100) / greatest(0.05, 1 - v_cut - v_min_pct / 100));
    v_base := greatest(v_goods * (1 + v_margin / 100) + v_ship * s.small_food_ship_share_pct / 100, v_guard_goods);
    if v_base <= s.small_food_ceiling_cents then
      v_step := least(s.small_food_floor_cents
                        + greatest(0, ceil((v_base - s.small_food_floor_cents - 1e-9) / 100))::integer * 100,
                      s.small_food_ceiling_cents);
      return least(v_step, greatest(s.small_food_floor_cents, v_recipe));
    end if;
  end if;
  return v_recipe;
end $function$;

-- Reprice every automatic listing and option with the beta's exact prices (pricing_settings_reprice runs on any update).
update public.pricing_settings set beta_pricing = true where id = 1;
