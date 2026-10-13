-- =============================================================================
-- D-119: the pilot price in two recipes, a profit guard on every piece, and the bulk saving.
--
--  Clothing and home & gifts (the founder's formula, D-119):
--    cost   = (shop ₹ ÷ shop divisor + weight g ÷ 100 × shipping ₹ per 100 g) ÷ effective rate
--    price  = cost ÷ (1 − margin), the margin tapering from the type's margin on cheaper pieces down to its lowest
--             margin on the most expensive ones (linear between two costs, in cents)
--  Food (the food tuner):
--    cost   = (shop ₹ + fee per piece) × (1 + India handling %) ÷ effective rate
--             + billed kg × the courier rate card spread over a typical food parcel ÷ effective rate
--    price  = cost × (1 + food margin)
--  Every piece, then:
--    guard  = the price at which the margin still pays US duty (on what the customer pays) and the card fee and
--             leaves the type's minimum profit, in dollars and as a % of the price; a price below it is lifted to it
--    price  = up to .29 / .49 / .79 / .99
--  The effective rate stays the day's rate less the safety buffer (D-075).
--  The bulk saving (bags from the free-shipping line up) is worked out by checkout from two settings that
--  store_bag_charges() hands to the bag, the pill and checkout alike.
-- Replaces D-109 / D-112's formula; ship_alloc_paise_per_kg stays as a column but no price reads it any more.
-- =============================================================================

alter table public.pricing_settings
  -- clothing and home & gifts
  add column shop_divisor numeric(4, 3) check (shop_divisor > 0 and shop_divisor <= 1),
  add column ship_paise_per_100g integer check (ship_paise_per_100g >= 0),
  add column margin_clothing_min_pct numeric(5, 2) check (margin_clothing_min_pct >= 0 and margin_clothing_min_pct < 95),
  add column margin_home_min_pct numeric(5, 2) check (margin_home_min_pct >= 0 and margin_home_min_pct < 95),
  add column taper_clothing_from_cents integer check (taper_clothing_from_cents >= 0),
  add column taper_clothing_to_cents integer check (taper_clothing_to_cents >= 0),
  add column taper_home_from_cents integer check (taper_home_from_cents >= 0),
  add column taper_home_to_cents integer check (taper_home_to_cents >= 0),
  -- food
  add column food_fee_paise integer check (food_fee_paise >= 0),
  add column food_parcel_kg numeric(5, 2) check (food_parcel_kg >= 1),
  add column food_billed_pct numeric(6, 2) check (food_billed_pct >= 50),
  -- the courier rate card (food's shipping; also the profit check's real costs)
  add column courier_first_kg_paise integer check (courier_first_kg_paise >= 0),
  add column courier_next_kg_paise integer check (courier_next_kg_paise >= 0),
  add column parcel_fixed_paise integer check (parcel_fixed_paise >= 0),
  -- the profit guard
  add column duty_clothing_pct numeric(5, 2) check (duty_clothing_pct >= 0 and duty_clothing_pct < 80),
  add column duty_food_pct numeric(5, 2) check (duty_food_pct >= 0 and duty_food_pct < 80),
  add column duty_home_pct numeric(5, 2) check (duty_home_pct >= 0 and duty_home_pct < 80),
  add column min_profit_clothing_cents integer check (min_profit_clothing_cents >= 0),
  add column min_profit_food_cents integer check (min_profit_food_cents >= 0),
  add column min_profit_home_cents integer check (min_profit_home_cents >= 0),
  add column min_profit_pct numeric(5, 2) check (min_profit_pct >= 0 and min_profit_pct < 50),
  add column min_profit_food_pct numeric(5, 2) check (min_profit_food_pct >= 0 and min_profit_food_pct < 50),
  add column guard_card_fee_pct numeric(5, 2) check (guard_card_fee_pct >= 0 and guard_card_fee_pct < 20),
  -- the bulk saving
  add column bulk_saving_pct numeric(5, 2) check (bulk_saving_pct >= 0 and bulk_saving_pct <= 50),
  add column bulk_saving_cap_cents integer check (bulk_saving_cap_cents >= 0);

-- The order keeps its bulk saving beside the discount it is part of (like the retailer charges inside shipping).
alter table public.orders
  add column bulk_saving_cents integer not null default 0
    check (bulk_saving_cents >= 0 and bulk_saving_cents <= discount_cents);

-- -----------------------------------------------------------------------------
-- The margin of a clothing or home piece: the type's margin up to `from` cents of cost, its lowest margin from `to`
-- cents, a straight line between. No lowest margin or no range = no taper.
-- -----------------------------------------------------------------------------
create function public._tapered_margin(p_cost numeric, p_hi numeric, p_lo numeric, p_from integer, p_to integer)
returns numeric
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_lo is null or p_from is null or p_to is null or p_to <= p_from or p_cost <= p_from then p_hi
    when p_cost >= p_to then p_lo
    else p_hi + (p_lo - p_hi) * (p_cost - p_from) / (p_to - p_from)
  end;
$$;

-- -----------------------------------------------------------------------------
-- The price of one piece (cents). Null while a setting its recipe needs is missing (D-047: nothing defaulted); the
-- guard's own numbers count as 0 when empty, so an empty guard never blocks a price.
-- -----------------------------------------------------------------------------
create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_rate numeric;
  v_cost numeric;
  v_price numeric;
  v_margin numeric;
  v_alloc numeric;
  v_duty numeric;
  v_min_cents numeric;
  v_min_pct numeric;
  v_cut numeric;
  v_guard numeric;
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
    -- the rate card spread over a typical food parcel, per kg (paise)
    v_alloc := (s.courier_first_kg_paise + (s.food_parcel_kg - 1) * s.courier_next_kg_paise
                + coalesce(s.parcel_fixed_paise, 0)) / s.food_parcel_kg;
    v_cost := (p_shop_paise + coalesce(s.food_fee_paise, 0)) * (1 + s.india_handling_pct / 100) / v_rate
              + v_alloc * p_weight_g * coalesce(s.food_billed_pct, 100) / 100 / 1000 / v_rate;
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

  -- The guard: what is left after duty and the card fee must be at least the minimum profit.
  v_cut := (v_duty + coalesce(s.guard_card_fee_pct, 0)) / 100;
  v_guard := greatest((v_cost + v_min_cents) / greatest(0.05, 1 - v_cut),
                      v_cost / greatest(0.05, 1 - v_cut - v_min_pct / 100));
  return public._price_ending(greatest(v_price, v_guard));
end $$;

-- -----------------------------------------------------------------------------
-- The bag's charges now also carry the bulk saving's two numbers (the saving itself follows from the subtotal).
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
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0));
end $$;

revoke all on function public._tapered_margin(numeric, numeric, numeric, integer, integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The new numbers that are Claude's estimates carry the label until the founder saves their own (D-047).
-- -----------------------------------------------------------------------------
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
  'duty_clothing_pct', 'duty_food_pct', 'duty_home_pct'));


-- The founder's numbers (D-119, the final tuner of 2026-10-14). This update reprices every automatic price
-- (pricing_settings_reprice).
update public.pricing_settings set
  shop_divisor = 0.90,
  ship_paise_per_100g = 14600,
  margin_clothing_pct = 50, margin_clothing_min_pct = 38, taper_clothing_from_cents = 2000, taper_clothing_to_cents = 15000,
  margin_home_pct = 60, margin_home_min_pct = 45, taper_home_from_cents = 1500, taper_home_to_cents = 10000,
  margin_food_pct = 25, india_handling_pct = 10, food_fee_paise = 1500, food_parcel_kg = 5, food_billed_pct = 140,
  courier_first_kg_paise = 224200, courier_next_kg_paise = 67850, parcel_fixed_paise = 105000,
  duty_clothing_pct = 22, duty_food_pct = 16, duty_home_pct = 13,
  min_profit_clothing_cents = 400, min_profit_food_cents = 0, min_profit_home_cents = 400,
  min_profit_pct = 8, min_profit_food_pct = 4, guard_card_fee_pct = 2.9,
  bulk_saving_pct = 10, bulk_saving_cap_cents = 2500
where id = 1;

-- After the update: changing a setting clears its label (the trigger of migration 24), so the labels go on last.
insert into public.pricing_estimates (setting, source, source_url, checked_on) values
  ('food_fee_paise', 'Claude (D-119): Blinkit / Zepto / Instamart delivery, handling and small-cart fees, shared by the pieces of one shop order', null, '2026-10-14'),
  ('food_parcel_kg', 'Claude (D-119): about $150 of food (the free-shipping line) weighs 5 – 8 kg billed', null, '2026-10-14'),
  ('food_billed_pct', 'Claude (D-119): listings carry the label''s net weight; glass jars ship near twice it and namkeen is billed on volume', null, '2026-10-14'),
  ('parcel_fixed_paise', 'Claude (D-119): a box, tape and filler (~₹150) plus the courier''s customs clearance of a duty-paid parcel (~₹900)', null, '2026-10-14'),
  ('duty_clothing_pct', 'Claude (D-119): US MFN duty on cotton and synthetic apparel (about 8 – 16%) + India''s 10% Section 301 tariff since 2026-07-24; de minimis suspended', 'https://www.federalregister.gov/documents/2026/06/24/2026-12670/indefinite-suspension-of-the-de-minimis-exemption-for-merchandise-arriving-through-all-modes-other', '2026-10-14'),
  ('duty_food_pct', 'Claude (D-119): US MFN duty on spice mixes, snacks and pickles (about 0 – 10%) + the 10% Section 301 tariff', 'https://www.kotakneo.com/news/global-markets/us-10-percent-tariff-india-forced-labour-section-301-2026/', '2026-10-14'),
  ('duty_home_pct', 'Claude (D-119): US MFN duty on brass and decor (about 3%) + the 10% Section 301 tariff', 'https://www.kotakneo.com/news/global-markets/us-10-percent-tariff-india-forced-labour-section-301-2026/', '2026-10-14')
on conflict (setting) do update set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;
