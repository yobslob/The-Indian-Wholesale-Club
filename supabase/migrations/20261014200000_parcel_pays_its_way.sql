-- =============================================================================
-- D-125: no bag can lose money. Every piece carries its whole cost in its price again (the founder's formula, D-119:
-- its weight on the courier, duty, card fee, margin), and a parcel that its pieces cannot pay for pays the rest in
-- Shipping.
--
-- Where D-120 – D-124 went wrong: they took part of the food's flight out of its price (the small-food shelf at 50%,
-- then 70%, then 30%) and made Shipping free from $149.99 up, so on a food-heavy bag past the line nobody paid the
-- flight. And the fixed $18.79 never paid for a small parcel: any parcel costs the courier's first kg (₹2,242) and the
-- box and customs clearance (₹1,050), about $34, even for one 100 g masala.
--
--  - Prices: food carries its whole courier share again (`food_ship_share_pct` empty = 100%). The small-food shelf
--    keeps a light, cheap piece on $1.99 / $2.99 / $3.99 only when its whole cost fits under the step; it never sells
--    a piece below its cost (a piece whose cost is above the top step keeps its recipe).
--  - Shipping, worked out per bag in store_bag_charges() from what the database knows (INV-1: only cents leave it):
--      what the bag's pieces leave after their shop cost, duty, card fee and returns  (their contribution)
--      against the parcel's real courier: first kg + each further half kg + box and clearance, on its billed weight
--    Below the free-shipping line a bag pays at least $18.79, more when its pieces cannot pay for the parcel (a single
--    masala, a couple of snacks). From the line up Shipping is struck through and free: the pieces' prices carry the
--    flight there. A bag past the line that still could not pay for itself (none of the profit check's bags) pays the
--    rest as Shipping (`past_line_cents`), so no bag ever loses.
-- Latest store_bag_charges before this: 20261014180000_food_weight_charge (its food weight is no longer used: with
-- the whole share in the prices it is always 0).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- The price of one piece: the small-food shelf never sells under cost (D-125). Otherwise as D-122.
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

-- -----------------------------------------------------------------------------
-- The bag's charges (D-125): the parcel pays its way.
-- -----------------------------------------------------------------------------
create or replace function public.store_bag_charges(p_items jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_from_india boolean;
  v_rate numeric;
  v_kg numeric := 0;
  v_goods numeric := 0;            -- what the bag's pieces sell for (cents)
  v_contribution numeric := 0;     -- what they leave after shop cost, duty, card fee and returns (cents)
  v_courier numeric;
  v_keep numeric;                  -- of each dollar the customer pays, what is left after the card fee and returns
  v_need numeric;                  -- what Shipping must bring for the bag not to lose (cents; ≤ 0: nothing)
  v_need_past numeric;             -- the same past the line, after the bulk saving
  v_bulk numeric := 0;
  v_shipping integer := 0;
  v_past integer := 0;
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

  if v_from_india then
    v_shipping := coalesce(s.small_order_shipping_cents, 0);
    if s.fx_inr_per_usd is not null and s.fx_buffer_pct is not null and s.courier_first_kg_paise is not null
       and s.courier_next_kg_paise is not null then
      v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
      v_keep := 1 - coalesce(s.guard_card_fee_pct, 0) / 100 - 0.02;
      select coalesce(sum(x.q * x.g * case when x.t = 'food' then coalesce(s.food_billed_pct, 100) / 100 else 1 end), 0) / 1000.0,
             coalesce(sum(x.q * x.price), 0),
             coalesce(sum(x.q * (x.price * (v_keep - case x.t when 'food' then coalesce(s.duty_food_pct, 0)
                                                               when 'home' then coalesce(s.duty_home_pct, 0)
                                                               else coalesce(s.duty_clothing_pct, 0) end / 100)
                                 - (x.shop * 1.03 + case x.t when 'food' then coalesce(s.food_fee_paise, 0)
                                                             when 'home' then 6000 else 4000 end) / v_rate)), 0)
        into v_kg, v_goods, v_contribution
        from (select least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99) as q, sv.price_cents as price,
                     coalesce(pv.shop_price_paise, pr.shop_price_paise, 0) as shop, pr.product_type as t,
                     coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0) as g
                from jsonb_array_elements(p_items) i
                join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
                join public.product_variants pv on pv.id = sv.id
                join public.products pr on pr.id = pv.product_id
               where not pr.is_us_stock) x;
      -- the courier bills at least 1 kg, then by the half kg (as the profit check)
      v_courier := (s.courier_first_kg_paise
                    + greatest(ceil(greatest(v_kg, 1) * 2) / 2 - 1, 0) * s.courier_next_kg_paise
                    + coalesce(s.parcel_fixed_paise, 0)) / v_rate + coalesce(s.card_fee_fixed_cents, 30);
      v_need := (v_courier - v_contribution) / greatest(v_keep, 0.5);
      if v_need > v_shipping then
        v_shipping := public._price_ending(v_need);
      end if;
      if s.free_shipping_min_cents is not null and v_goods >= s.free_shipping_min_cents then
        v_bulk := least(coalesce(s.bulk_saving_cap_cents, 0),
                        (v_goods - s.free_shipping_min_cents) * coalesce(s.bulk_saving_pct, 0) / 100);
        v_need_past := (v_courier - v_contribution + v_bulk) / greatest(v_keep, 0.5);
        if v_need_past > 0 then
          v_past := public._price_ending(v_need_past);
        end if;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'shipping_cents', v_shipping,
    'past_line_cents', v_past,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0));
end $$;

-- Food carries its whole flight in its price again (D-119); the shelf the same. This reprices every listing.
update public.pricing_settings set food_ship_share_pct = null, small_food_ship_share_pct = 100 where id = 1;
