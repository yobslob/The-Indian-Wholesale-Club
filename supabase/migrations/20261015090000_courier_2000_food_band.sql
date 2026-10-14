-- =============================================================================
-- D-126: the courier's new rate, and food in a strict margin band. The founder: "the shipping will be changed from
-- 1460 to 2000" (₹ per kg); "lower the food margins to sharp strict 17-20% … and still pack food tighter"; "change
-- the round off to 29, 49, 69, 79, 99".
--
--  * Prices end in .29, .49, .69, .79 or .99 (was .29/.49/.79/.99): every price, every type.
--  * The courier: ₹2,000 per kg, everything in (no first-kg premium, no per-parcel fee), still billed by the half kg
--    from 1 kg. Clothing and home & gifts carry ₹200 per 100 g (was ₹146).
--  * Clothing's margin 42% (lowest 35% on the dearest pieces), home & gifts' 50% (lowest 40%), so their prices stay
--    about where they were.
--  * Food packed tighter: billed at 110% of its label (was 140%).
--  * Food in a band, 17–20% on its cost: the price is the first ending at or above +17%; when that passes +20% (a cheap
--    piece, where one ending is a big step), the ending closest to the band, a tie going up. Food no longer goes
--    through the safety floor or the small-food shelf; a piece may leave less than its duty and card fee, and the bag's
--    Shipping (D-125) brings what its parcel still needs, so no bag loses. Empty the band's top to go back.
-- These are Settings: the founder can change any of them; this migration only sets today's numbers.
-- =============================================================================

alter table public.pricing_settings
  add column food_margin_max_pct numeric(5, 2) check (food_margin_max_pct >= 0 and food_margin_max_pct < 100);

-- Cents → up to the next price ending in .29, .49, .69, .79 or .99 (D-126).
create or replace function public._price_ending(p_cents numeric)
returns integer
language sql immutable set search_path = public, pg_temp as $$
  select (c / 100 * 100 + (select min(e) from unnest(array[29, 49, 69, 79, 99]) e where e >= c % 100))::integer
  from (select ceil(p_cents - 1e-9)::integer as c) x;
$$;

-- A price in a margin band on its cost (D-126): the first ending at or above +lo%; past +hi%, the ending closest to
-- the band (the one under it, if nearer; a tie goes up).
create function public._band_price(p_cost numeric, p_lo numeric, p_hi numeric)
returns integer
language plpgsql immutable set search_path = public, pg_temp as $$
declare
  v_lo numeric := p_cost * (1 + p_lo / 100);
  v_hi numeric := p_cost * (1 + greatest(p_hi, p_lo) / 100);
  v_up integer := public._price_ending(v_lo);
  v_down integer;
begin
  if v_up <= v_hi then
    return v_up;
  end if;
  select max(d * 100 + e) into v_down
    from generate_series(greatest(floor(v_hi / 100)::integer - 1, 0), floor(v_hi / 100)::integer) d,
         unnest(array[29, 49, 69, 79, 99]) e
   where d * 100 + e <= v_hi;
  if v_down is null or v_lo - v_down >= v_up - v_hi then
    return v_up;
  end if;
  return v_down;
end $$;
revoke all on function public._band_price(numeric, numeric, numeric) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The price of one piece: food in its band (D-126). Otherwise as D-125.
-- -----------------------------------------------------------------------------
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

-- The founder's numbers (D-126). This update reprices every automatic price (pricing_settings_reprice).
update public.pricing_settings set
  courier_first_kg_paise = 200000, courier_next_kg_paise = 200000, parcel_fixed_paise = 0,
  ship_paise_per_100g = 20000,
  margin_clothing_pct = 42, margin_clothing_min_pct = 35,
  margin_home_pct = 50, margin_home_min_pct = 40,
  margin_food_pct = 17, food_margin_max_pct = 20,
  food_billed_pct = 110
where id = 1;
