-- =============================================================================
-- D-123: the bag's charges follow the bag. Food carries 30% of its courier in its price (bhujia 200 g $2.79, 400 g
-- $4.79, 1 kg $10.99); the rest of the food's courier is the bag's **food weight**, part of Shipping at every bag size,
-- 10% less for every $50 of goods, at most 40% less. The parcel's shipping ($18.79) stays as it was: paid below the
-- free-shipping line, struck through from it up. The retailer charges are 1.5% of the goods, at least $0.99 (struck
-- through from the line up, showing what they would be).
--
--   food weight (cents) = Σ food pieces: quantity × kg × the rate card spread over a food parcel × billed % ×
--                         (1 − the food's share in its price) ÷ effective rate
-- The share and the rate card are the same numbers the food's price uses (D-119, D-122), so a change to either moves
-- both together. Worked out here, where the weights are (INV-1): only cents leave the database.
-- Latest store_bag_charges before this: 20261014090000_pilot_pricing_two_recipes.
-- =============================================================================

alter table public.pricing_settings
  add column retailer_pct numeric(5, 2) check (retailer_pct >= 0 and retailer_pct < 20),
  add column food_off_step_cents integer check (food_off_step_cents > 0),
  add column food_off_step_pct numeric(5, 2) check (food_off_step_pct >= 0 and food_off_step_pct <= 100),
  add column food_off_max_pct numeric(5, 2) check (food_off_max_pct >= 0 and food_off_max_pct <= 100);

create or replace function public.store_bag_charges(p_items jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_from_india boolean;
  v_rate numeric;
  v_per_kg numeric;   -- cents per kg of food not already in its price
  v_food numeric := 0;
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

  -- D-123: the food's weight the prices leave out
  if s.fx_inr_per_usd is not null and s.fx_buffer_pct is not null and s.courier_first_kg_paise is not null
     and s.courier_next_kg_paise is not null and s.food_parcel_kg is not null then
    v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
    v_per_kg := (s.courier_first_kg_paise + (s.food_parcel_kg - 1) * s.courier_next_kg_paise
                 + coalesce(s.parcel_fixed_paise, 0)) / s.food_parcel_kg
                * coalesce(s.food_billed_pct, 100) / 100
                * (100 - coalesce(s.food_ship_share_pct, 100)) / 100 / v_rate;
    select coalesce(sum(least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99)
                        * coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0) / 1000.0 * v_per_kg), 0)
      into v_food
      from jsonb_array_elements(p_items) i
      join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
      join public.product_variants pv on pv.id = sv.id
      join public.products pr on pr.id = pv.product_id
     where pr.product_type = 'food' and not pr.is_us_stock;
  end if;

  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'shipping_cents', case when v_from_india then coalesce(s.small_order_shipping_cents, 0) else 0 end,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'food_weight_cents', round(v_food)::integer,
    'food_off_step_cents', s.food_off_step_cents,
    'food_off_step_pct', coalesce(s.food_off_step_pct, 0),
    'food_off_max_pct', coalesce(s.food_off_max_pct, 0),
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0));
end $$;

-- The founder's rule (D-123). This update reprices every food listing (pricing_settings_reprice).
update public.pricing_settings set
  food_ship_share_pct = 30, small_food_ship_share_pct = 30,
  retailer_pct = 1.5, small_order_retailer_cents = 99,
  food_off_step_cents = 5000, food_off_step_pct = 10, food_off_max_pct = 40
where id = 1;

-- The founder chose these numbers (D-123): changing them cleared any estimate label (migration 24's trigger).
