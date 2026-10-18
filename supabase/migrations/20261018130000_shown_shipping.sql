-- =============================================================================
-- D-140 (design plan F5): a higher struck-through Shipping figure at the free-delivery line, display only. The founder:
-- "we do need to show big numbers as struck through and that is an order" … "don't mess with any pricing, it is
-- fixed the express remains how it is … you put higher prices on shipping when its cut."
--  - pricing_settings.shown_shipping_cents_per_kg: "Shipping shown when free", dollars per kg of the bag (the founder's
--    number, D-012; empty = today's struck figure, the small-order Shipping).
--  - store_bag_charges() adds 'shown_shipping_cents'. Nothing else moves: what is charged below the line, the retailer
--    charges, the bulk saving, Express, every price and the checkout's totals. The figure is never charged, stored on
--    an order or sent to Stripe. Customers see a dollar figure, never grams (D-132).
-- As 20261014200000_parcel_pays_its_way otherwise.
-- =============================================================================

alter table public.pricing_settings
  add column shown_shipping_cents_per_kg integer check (shown_shipping_cents_per_kg between 0 and 100000);

comment on column public.pricing_settings.shown_shipping_cents_per_kg is
  'D-140 (F5): the struck-through Shipping figure once free = the bag''s packed kg × this (cents a kg), at least small_order_shipping_cents. Display only.';

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
  v_raw_kg numeric := 0;           -- the bag's packed weight (for the struck figure only, D-140)
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
             coalesce(sum(x.q * x.g), 0) / 1000.0,
             coalesce(sum(x.q * x.price), 0),
             coalesce(sum(x.q * (x.price * (v_keep - case x.t when 'food' then coalesce(s.duty_food_pct, 0)
                                                               when 'home' then coalesce(s.duty_home_pct, 0)
                                                               else coalesce(s.duty_clothing_pct, 0) end / 100)
                                 - (x.shop * 1.03 + case x.t when 'food' then coalesce(s.food_fee_paise, 0)
                                                             when 'home' then 6000 else 4000 end) / v_rate)), 0)
        into v_kg, v_raw_kg, v_goods, v_contribution
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
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0),
    -- D-140 (F5): the Shipping figure shown struck through once it is free: the bag's packed kg × the founder's $ a kg,
    -- never below the small-order Shipping; null (today's figure) until the setting is filled. Never charged.
    'shown_shipping_cents', case when v_from_india and s.shown_shipping_cents_per_kg is not null then
                              greatest(coalesce(s.small_order_shipping_cents, 0),
                                       round(v_raw_kg * s.shown_shipping_cents_per_kg)::integer) end);
end $$;
