-- =============================================================================
-- The Amazon → door pilot price (D-109, replaces D-075's formula while the pilot runs). Pieces are bought on Amazon
-- India, repacked and sent door to door by courier, so a price is:
--   India cost  = Amazon price (₹) × (1 + India handling %)
--   landed ($)  = India cost ÷ effective rate + item kg × shipping allocation (₹/kg ÷ effective rate)
--   price       = (landed × (1 + margin %) + card fee per payment) ÷ (1 − card fee %), up to .29 / .49 / .79 / .99
-- The effective rate stays the day's rate less the safety buffer (D-075). Air freight, billed weight, broker, export kg,
-- duty, US handling, US delivery and the returns allowance are no longer used (kept for the retailer model, D-005).
-- The minimum order (orders below it cannot check out) is stored here; checkout enforces it.
-- =============================================================================

alter table public.pricing_settings
  add column india_handling_pct numeric(5, 2) check (india_handling_pct >= 0),
  add column ship_alloc_paise_per_kg integer check (ship_alloc_paise_per_kg >= 0),
  add column min_order_cents integer check (min_order_cents >= 0);

-- Cents → up to the next price ending in .29, .49, .79 or .99.
create function public._price_ending(p_cents numeric)
returns integer
language sql immutable set search_path = public, pg_temp as $$
  select (c / 100 * 100 + (select min(e) from unnest(array[29, 49, 79, 99]) e where e >= c % 100))::integer
  from (select ceil(p_cents)::integer as c) x;
$$;

create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_rate numeric;
  v_landed numeric;
begin
  select * into s from public.pricing_settings where id = 1;
  if p_shop_paise is null or p_weight_g is null or s.fx_inr_per_usd is null or s.fx_buffer_pct is null
     or s.india_handling_pct is null or s.ship_alloc_paise_per_kg is null or s.margin_pct is null
     or s.card_fee_pct is null or s.card_fee_fixed_cents is null then
    return null;
  end if;
  v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
  v_landed := p_shop_paise * (1 + s.india_handling_pct / 100) / v_rate        -- paise ÷ (₹ per $) = cents
              + s.ship_alloc_paise_per_kg * p_weight_g / 1000.0 / v_rate;
  return public._price_ending((v_landed * (1 + s.margin_pct / 100) + s.card_fee_fixed_cents) / (1 - s.card_fee_pct / 100));
end $$;

revoke all on function public._price_ending(numeric) from public, anon, authenticated;

-- The founder's pilot numbers (D-109). This update reprices every automatic price (pricing_settings_reprice).
update public.pricing_settings set
  india_handling_pct = 10,
  ship_alloc_paise_per_kg = 146100,
  margin_pct = 50,
  fx_buffer_pct = 4,
  card_fee_pct = 3.4,
  card_fee_fixed_cents = 30,
  shipping_flat_cents = 0,
  free_shipping_min_cents = 14999,
  min_order_cents = 14999
where id = 1;
-- Those are the founder's numbers now, not Claude's placeholders (D-047).
delete from public.pricing_estimates
where setting in ('margin_pct', 'fx_buffer_pct', 'card_fee_pct', 'card_fee_fixed_cents', 'india_handling_paise',
                  'freight_cents_per_kg', 'volumetric_pct', 'broker_cents_per_shipment', 'shipment_kg', 'duty_pct',
                  'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct');
