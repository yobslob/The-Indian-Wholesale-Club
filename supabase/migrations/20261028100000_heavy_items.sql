-- Heavy-item shipping (founder, 2026-10-24): "on the heavy cookware such as steel cooker show the price for half the
-- weight considered and then add a new tag as heavy-item shipping which will be added to it at checkout, it won't
-- affect the pricing rules, they remain the same just a new charge will be added as heavy-item shipping only when a
-- heavy cookware which we can't really modify is added". Their answers the same day: the charge is the other half
-- (price + charge = the price D-128's rules give on the whole weight); from the free-shipping line (or the 7-day line)
-- it is "dropped by 20% only (shown as struck-through)"; heavy pieces are "items like steel cooker".
--
--   1. products.heavy_item: a home piece named a cooker is one (now and when it is listed); the admin ticks or unticks
--      any piece.
--   2. Prices: a heavy piece's options are priced on half their weight; each keeps the other half as heavy_cents
--      (the same rules on the whole weight, less the price). _auto_price_cents is untouched.
--   3. pricing_settings.heavy_line_off_pct (20): what comes off the charge from the line.
--   4. store_variants and store_bag_charges carry the charge (a dollar amount, never a weight: D-003).
--   5. orders.heavy_shipping_cents: its part of the order's shipping, like the retailer charges (D-111).
-- Size: two small columns and one per order; no new rows. Egress: one number more per option and bag.

-- 1 -------------------------------------------------------------------------------------------------------------
alter table public.products add column heavy_item boolean not null default false;
comment on column public.products.heavy_item is
  'Heavy-item shipping (founder 2026-10-24): priced on half its weight, the other half charged in the bag as Heavy-item shipping.';

create function public._heavy_item_default() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  -- "items like steel cooker": a home piece named a cooker; the admin ticks any other
  if new.product_type = 'home' and new.name ~* '\mcookers?\M' then
    new.heavy_item := true;
  end if;
  return new;
end $$;
create trigger products_heavy_item before insert on public.products
  for each row execute function public._heavy_item_default();

-- 2 -------------------------------------------------------------------------------------------------------------
alter table public.product_variants add column heavy_cents integer not null default 0 check (heavy_cents >= 0);
comment on column public.product_variants.heavy_cents is
  'A heavy item''s Heavy-item shipping for one: its price on its whole weight less its price on half (0 otherwise).';

-- the weight a price is worked out on: half a heavy piece's (rounded up)
create function public._priced_weight(p_weight_g integer, p_heavy boolean) returns integer
language sql immutable as $$
  select case when p_heavy and p_weight_g is not null then (p_weight_g + 1) / 2 else p_weight_g end
$$;

-- as 20261014140000 (the product's lowest automatic price), a heavy piece on half its weight
create or replace function public._product_auto_price(p_product uuid, p_shop_paise integer, p_category uuid, p_type product_type)
returns integer
language sql stable security definer set search_path to 'public', 'pg_temp' as $function$
  with w as (
    select (select max(v.weight_g) from public.product_variants v
             where v.product_id = p_product and v.is_active) as g,
           coalesce((select x.heavy_item from public.products x where x.id = p_product), false) as heavy
  )
  select coalesce(
    (select min(public._auto_price_cents(v.shop_price_paise,
                                     public._priced_weight(coalesce(v.weight_g, w.g, public._fallback_weight_g(p_type, v.shop_price_paise, p_category)), w.heavy),
                                     p_type))
       from public.product_variants v
      where v.product_id = p_product and v.is_active and v.shop_price_paise is not null),
    public._auto_price_cents(p_shop_paise,
                             public._priced_weight(coalesce(w.g, public._fallback_weight_g(p_type, p_shop_paise, p_category)), w.heavy),
                             p_type))
  from w;
$function$;

-- as 20261014140000, with each option's heavy_cents beside its price
create or replace function public._reprice_products(p_product uuid default null)
returns integer
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_variants integer;
  v_products integer;
begin
  -- variants with their own shop price (manual prices, price_auto off, are left alone)
  update public.product_variants v
     set price_cents = n.price, heavy_cents = n.heavy
    from (select w.id,
                 public._auto_price_cents(w.shop, public._priced_weight(w.g, w.heavy_item), w.product_type) as price,
                 case when w.heavy_item
                      then greatest(public._auto_price_cents(w.shop, w.g, w.product_type)
                                    - public._auto_price_cents(w.shop, public._priced_weight(w.g, true), w.product_type), 0)
                      else 0 end as heavy
            from (select v2.id, v2.shop_price_paise as shop, x.product_type, x.heavy_item,
                         coalesce(v2.weight_g,
                                  (select max(v3.weight_g) from public.product_variants v3
                                    where v3.product_id = x.id and v3.is_active),
                                  public._fallback_weight_g(x.product_type, v2.shop_price_paise, x.category_id)) as g
                    from public.product_variants v2
                    join public.products x on x.id = v2.product_id
                   where x.price_auto and v2.shop_price_paise is not null and (p_product is null or x.id = p_product)) w) n
   where v.id = n.id and n.price is not null
     and (v.price_cents is distinct from n.price or v.heavy_cents is distinct from coalesce(n.heavy, 0));
  get diagnostics v_variants = row_count;

  update public.products p
     set price_cents = n.price
    from (select x.id, public._product_auto_price(x.id, x.shop_price_paise, x.category_id, x.product_type) as price
            from public.products x
           where x.price_auto and (p_product is null or x.id = p_product)) n
   where p.id = n.id and n.price is not null and p.price_cents is distinct from n.price;
  get diagnostics v_products = row_count;
  return v_variants + v_products;
end $function$;

-- ticking or unticking a piece reprices it at once
create function public._reprice_on_heavy() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._reprice_products(new.id);
  return null;
end $$;
create trigger products_heavy_reprice after update of heavy_item on public.products
  for each row when (old.heavy_item is distinct from new.heavy_item) execute function public._reprice_on_heavy();

revoke all on function public._priced_weight(integer, boolean) from public, anon, authenticated;
revoke all on function public._heavy_item_default() from public, anon, authenticated;
revoke all on function public._reprice_on_heavy() from public, anon, authenticated;

update public.products set heavy_item = true where product_type = 'home' and name ~* '\mcookers?\M';

-- 3 -------------------------------------------------------------------------------------------------------------
alter table public.pricing_settings
  add column heavy_line_off_pct numeric(5, 2) default 20 check (heavy_line_off_pct between 0 and 100);
comment on column public.pricing_settings.heavy_line_off_pct is
  'Heavy-item shipping: this % comes off it (shown struck through) once the bag reaches the free-shipping line or the 7-day line (founder 2026-10-24: 20).';

-- 4 -------------------------------------------------------------------------------------------------------------
-- as 20261016160000, with the option's Heavy-item shipping last (a heavy piece that is priced by hand has none)
create or replace view public.store_variants as
 select v.id,
    v.product_id,
    v.label,
    v.options,
    coalesce(v.price_cents, p.price_cents) as price_cents,
    greatest(v.qty_listed - v.qty_reserved, 0) as available,
    v.sort_order,
    case when p.product_type = 'food'::product_type then v.net_qty else null::text end as net_qty,
    case when p.heavy_item and p.price_auto then v.heavy_cents else 0 end as heavy_cents
   from public.product_variants v
     join public.products p on p.id = v.product_id
  where v.is_active and p.status = 'live'::product_status and (not p.is_placeholder or public.dev_preview());

-- as 20261025090000, with the bag's Heavy-item shipping and what comes off it from the line
create or replace function public.store_bag_charges(p_items jsonb, p_discount_cents integer default 0,
                                                    p_state text default null, p_line1 text default null)
returns jsonb
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $function$
declare
  s public.pricing_settings;
  v_ship jsonb;
  v_from_india boolean;
  v_next record;
  v_heavy record;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  v_ship := public._bag_shipments(p_items, p_discount_cents, p_state, p_line1);
  v_from_india := (v_ship ->> 'billed_grams')::integer > 0;
  select * into v_next from public.store_next_delivery() limit 1;
  select coalesce(sum(sv.heavy_cents * least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99)), 0)::integer as cents,
         coalesce(jsonb_agg(sv.id) filter (where sv.heavy_cents > 0), '[]'::jsonb) as ids
    into v_heavy
    from jsonb_array_elements(p_items) i
    join public.store_variants sv on sv.id::text = i ->> 'variant_id';
  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'past_line_cents', 0,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0),
    'shown_shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'quick_free', (v_ship ->> 'quick_only')::boolean,
    -- heavy-item shipping (founder 2026-10-24): the bag's heavy pieces' other half, and what comes off it from the line
    'heavy_cents', v_heavy.cents,
    'heavy_line_off_pct', coalesce(s.heavy_line_off_pct, 0),
    'heavy_ids', v_heavy.ids,
    -- no weights on a customer surface (D-003): the billed kg and the weight share stay in the database
    'shipments', v_ship - 'quick_variant_ids' - 'billed_grams' - 'quick_shipping_cents',
    'quick_ids', coalesce(v_ship -> 'quick_variant_ids', '[]'::jsonb),
    'dates', jsonb_build_object(
      'quick_from', case when v_ship ->> 'days_min' is not null then current_date + (v_ship ->> 'days_min')::integer end,
      'quick_to', case when v_ship ->> 'days_max' is not null then current_date + (v_ship ->> 'days_max')::integer end,
      'standard_from', v_next.est_delivery_from,
      'standard_to', v_next.est_delivery_to));
end $function$;

-- 5 -------------------------------------------------------------------------------------------------------------
alter table public.orders
  add column heavy_shipping_cents integer not null default 0
    check (heavy_shipping_cents >= 0 and heavy_shipping_cents <= shipping_cents);
comment on column public.orders.heavy_shipping_cents is
  'Heavy-item shipping: its part of shipping_cents (after what came off it from the line), kept beside it like retailer_charge_cents.';
