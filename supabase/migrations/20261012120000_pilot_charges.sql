-- =============================================================================
-- D-111: the pilot's margin by product type, and small-order charges instead of a smallest order.
--  * Margin on the landed cost by type (founder): clothing 50%, food 25%, home & gifts 60%. `margin_pct` stays the
--    fallback for a type without its own number (and the retailer model's margin, D-005).
--  * A bag below the free-shipping line (free_shipping_min_cents, $149.99) is not refused any more (D-109's minimum
--    goes): it pays "Shipping" (what one courier parcel of its weight costs beyond the shipping already inside the
--    item prices) and "Retailer charges" (the shop's delivery to the hub and the packing of one parcel), both with the
--    low small-order margin. From the line up both show struck through as free: the item prices carry the costs.
--  * Courier cost of one parcel, from the founder's quoted rates incl. 18% GST: ₹2,242 up to 1 kg, then ₹678.50 for
--    each further kg started (1 kg ₹2,242 · 2 kg ₹2,921 · 3 kg ₹3,599 · 4 kg ₹4,278 · 5 kg ₹4,956).
-- `store_bag_charges(items)` works the charges out where the weights are (never sent out, INV-1); the bag, the
-- free-delivery bar and checkout all ask it.
-- =============================================================================

alter table public.pricing_settings
  add column margin_clothing_pct numeric(5, 2) check (margin_clothing_pct >= 0),
  add column margin_food_pct numeric(5, 2) check (margin_food_pct >= 0),
  add column margin_home_pct numeric(5, 2) check (margin_home_pct >= 0),
  add column courier_first_kg_paise integer check (courier_first_kg_paise >= 0),
  add column courier_next_kg_paise integer check (courier_next_kg_paise >= 0),
  add column small_order_margin_pct numeric(5, 2) check (small_order_margin_pct >= 0),
  add column parcel_handling_paise integer check (parcel_handling_paise >= 0);

-- The part of an order's shipping_cents that was retailer charges (admin view of the split; the order total is
-- unchanged: subtotal - discount + shipping + tax, where shipping includes it).
alter table public.orders
  add column retailer_charge_cents integer not null default 0
    check (retailer_charge_cents >= 0 and retailer_charge_cents <= shipping_cents);

-- -----------------------------------------------------------------------------
-- The price formula with the product type's margin (D-109's formula otherwise unchanged).
-- -----------------------------------------------------------------------------
create function public._auto_price_cents(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
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
     or s.india_handling_pct is null or s.ship_alloc_paise_per_kg is null or v_margin is null
     or s.card_fee_pct is null or s.card_fee_fixed_cents is null then
    return null;
  end if;
  v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
  v_landed := p_shop_paise * (1 + s.india_handling_pct / 100) / v_rate        -- paise ÷ (₹ per $) = cents
              + s.ship_alloc_paise_per_kg * p_weight_g / 1000.0 / v_rate;
  return public._price_ending((v_landed * (1 + v_margin / 100) + s.card_fee_fixed_cents) / (1 - s.card_fee_pct / 100));
end $$;

-- The two-argument form is the price without a type: the general margin.
create or replace function public._auto_price_cents(p_shop_paise integer, p_weight_g integer)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select public._auto_price_cents(p_shop_paise, p_weight_g, null::public.product_type);
$$;

create or replace function public._reprice_products(p_product uuid default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  update public.products p
     set price_cents = n.price
    from (select x.id, public._auto_price_cents(x.shop_price_paise, public._pricing_weight_g(x.id), x.product_type) as price
          from public.products x
          where x.price_auto and (p_product is null or x.id = p_product)) n
   where p.id = n.id and n.price is not null and p.price_cents is distinct from n.price;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public._reprice_on_product() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.price_auto then
    new.price_cents := coalesce(
      public._auto_price_cents(new.shop_price_paise,
        coalesce((select max(v.weight_g) from public.product_variants v where v.product_id = new.id and v.is_active),
                 (select c.default_weight_g from public.categories c where c.id = new.category_id)),
        new.product_type),
      new.price_cents);
  end if;
  return new;
end $$;
-- A product that changes type changes margin.
drop trigger products_auto_price on public.products;
create trigger products_auto_price
  before insert or update of shop_price_paise, category_id, price_auto, product_type on public.products
  for each row execute function public._reprice_on_product();

-- The preview takes the type (its margin); the old two-argument form goes so there is one door.
drop function public.admin_price_preview(integer, integer);
create function public.admin_price_preview(p_shop_paise integer, p_weight_g integer, p_type public.product_type)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return public._auto_price_cents(p_shop_paise, p_weight_g, p_type);
end $$;

-- New listings are priced with their type's margin (latest: 20261007090000_pricing_engine).
create or replace function public.admin_create_listing(p_listing jsonb)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_variant jsonb;
  v_n integer := 0;
  v_price integer := nullif(p_listing ->> 'price_cents', '')::integer;
  v_shop integer := nullif(p_listing ->> 'shop_price_paise', '')::integer;
  v_weight integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_vendor from public.vendors
   where id = nullif(p_listing ->> 'vendor_id', '')::uuid and status = 'active';
  if not found then
    raise exception 'vendor_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_listing -> 'variants', '[]'::jsonb)) <> 'array' then
    raise exception 'variants_must_be_a_list' using errcode = 'P0001';
  end if;
  if v_price is null then
    select coalesce(max(nullif(v ->> 'weight_g', '')::integer),
                    (select default_weight_g from public.categories where id = (p_listing ->> 'category_id')::uuid))
      into v_weight
    from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) v;
    v_price := public.admin_price_preview(v_shop, v_weight, (p_listing ->> 'product_type')::public.product_type);  -- the admin-checked door
    if v_price is null then
      raise exception 'price_needed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, price_auto, status, created_by)
  values (v_vendor.id, v_vendor.region_id, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          v_price, v_shop, nullif(p_listing ->> 'price_cents', '') is null, 'draft', auth.uid())
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            (v_variant ->> 'qty')::integer, now(), v_n);
  end loop;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Small-order charges for a bag: [{variant_id, quantity}] (at most 50 lines). Pieces already in the US (D-072) are
-- not in the parcel. Returns the free-shipping line and both charges as they would be for this bag (the caller
-- waives them from the line up); zero charges while their settings are not set.
-- -----------------------------------------------------------------------------
create function public.store_bag_charges(p_items jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_weight numeric;
  v_rate numeric;
  v_markup numeric;
  v_courier numeric;
  v_alloc numeric;
  v_shipping integer := 0;
  v_retailer integer := 0;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  select coalesce(sum(least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99)
                      * coalesce(pv.weight_g, c.default_weight_g, 1000)), 0)
    into v_weight
  from jsonb_array_elements(p_items) i
  join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
  join public.product_variants pv on pv.id = sv.id
  join public.products pr on pr.id = pv.product_id
  join public.categories c on c.id = pr.category_id
  where not pr.is_us_stock;

  if v_weight > 0 and s.fx_inr_per_usd is not null and s.fx_buffer_pct is not null and s.card_fee_pct is not null
     and s.small_order_margin_pct is not null then
    v_rate := s.fx_inr_per_usd * (1 - s.fx_buffer_pct / 100);
    v_markup := (1 + s.small_order_margin_pct / 100) / (1 - s.card_fee_pct / 100);
    if s.courier_first_kg_paise is not null and s.courier_next_kg_paise is not null then
      v_courier := s.courier_first_kg_paise + greatest(ceil(v_weight / 1000.0) - 1, 0) * s.courier_next_kg_paise;
      v_alloc := coalesce(s.ship_alloc_paise_per_kg, 0) * v_weight / 1000.0;
      if v_courier > v_alloc then
        v_shipping := public._price_ending((v_courier - v_alloc) / v_rate * v_markup);
      end if;
    end if;
    if coalesce(s.parcel_handling_paise, 0) > 0 then
      v_retailer := public._price_ending(s.parcel_handling_paise / v_rate * v_markup);
    end if;
  end if;
  return jsonb_build_object('free_min_cents', s.free_shipping_min_cents,
                            'shipping_cents', v_shipping, 'retailer_cents', v_retailer);
end $$;

revoke all on function public._auto_price_cents(integer, integer, public.product_type) from public, anon, authenticated;
revoke all on function public.admin_price_preview(integer, integer, public.product_type) from public, anon, authenticated;
grant execute on function public.admin_price_preview(integer, integer, public.product_type) to authenticated, service_role;
revoke all on function public.store_bag_charges(jsonb) from public;
grant execute on function public.store_bag_charges(jsonb) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- The founder's numbers (D-111). The smallest order goes: smaller bags pay the charges instead. This update reprices
-- every automatic price (pricing_settings_reprice). The small-order margin and the parcel handling are Claude's
-- first numbers (proposed in D-111) until the founder saves their own in Settings.
-- -----------------------------------------------------------------------------
update public.pricing_settings set
  margin_clothing_pct = 50,
  margin_food_pct = 25,
  margin_home_pct = 60,
  courier_first_kg_paise = 224200,
  courier_next_kg_paise = 67850,
  small_order_margin_pct = 10,
  parcel_handling_paise = 15000,
  min_order_cents = null
where id = 1;

-- Claude's two first numbers carry the "estimate" label in Settings until the founder saves their own (D-047).
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct',
  'card_fee_pct', 'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg',
  'express_days_min', 'express_days_max', 'cycle_days', 'fast_offer_cents', 'cancel_fee_pct',
  'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
  'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct',
  'small_order_margin_pct', 'parcel_handling_paise'));
insert into public.pricing_estimates (setting, source, checked_on) values
  ('small_order_margin_pct', 'Claude (D-111): a low margin so a small order is not overpriced; the founder asked to keep it low', '2026-10-12'),
  ('parcel_handling_paise', 'Claude (D-111): Amazon India''s delivery fee on small orders (about ₹40 – ₹100) plus a box, tape and labels', '2026-10-12')
on conflict (setting) do update set source = excluded.source, checked_on = excluded.checked_on;
