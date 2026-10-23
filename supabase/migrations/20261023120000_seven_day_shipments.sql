-- =============================================================================
-- D-154 (founder, 2026-10-23, the 7-day study and build plan), step 1: shipments in the database.
--  - pricing_settings: quick_delivery_min_cents (the 7-day line, $49.99: 7-day pieces worth it, after the promo, ship
--    on their own in the 7-day days, and a bag of only them ships free), shipping_cents_per_kg ($18.62 a billed kg),
--    quick_delivery_paused (a day the hub cannot buy: no 7-day pieces anywhere, placed orders keep their dates); the
--    normal (pilot) window becomes 12 – 16 days.
--  - _bag_shipments(): the one rule for the bag, checkout and create_order: which pieces are a 7-day shipment, the
--    gap to the line, the bag's billed kg and its Shipping (one parcel, the whole bag; split by weight).
--  - store_bag_charges(): Shipping = $18.62 × the billed kg (at least 1 kg, by the half kg, food at its billed %), the
--    same figure struck through when free (it grows with the bag); the top-up (D-125, D-126) and the fixed small-order
--    Shipping stop deciding it. Retailer charges, the bulk saving and Express are unchanged. Adds 'shipments'.
--  - order_shipments: an order has one or two shipments (its pieces, dates, Shipping share, tracking, status);
--    existing orders get one each, carrying their tracking.
-- Tests: shipments.test.sql, bag_charges.test.sql.
-- =============================================================================

alter table public.pricing_settings
  add column quick_delivery_min_cents integer check (quick_delivery_min_cents between 0 and 10000000),
  add column shipping_cents_per_kg integer check (shipping_cents_per_kg between 0 and 100000),
  add column quick_delivery_paused boolean not null default false;
comment on column public.pricing_settings.quick_delivery_min_cents is
  'D-154: the 7-day line: 7-day pieces worth this after the promo ship on their own in the 7-day days; a bag of only them ships free.';
comment on column public.pricing_settings.shipping_cents_per_kg is
  'D-154: Shipping = this × the bag''s billed kg (at least 1 kg, by the half kg, food at food_billed_pct), one parcel.';
comment on column public.pricing_settings.quick_delivery_paused is
  'D-154: a day the hub cannot buy: no 7-day pieces anywhere; placed orders keep their dates.';
update public.pricing_settings
   set quick_delivery_min_cents = 4999, shipping_cents_per_kg = 1862,
       pilot_delivery_days_min = 12, pilot_delivery_days_max = 16
 where id = 1;

-- The 7-day listings, as 20261022120000_seven_day_delivery, none while 7-day delivery is paused.
create or replace function public._quick_listings() returns table (id uuid)
language sql stable as $$
  select p.id
  from public.products p
  where p.status = 'live' and not p.is_us_stock
    and not (select s.quick_delivery_paused from public.pricing_settings s where s.id = 1)
    and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
    and not exists (
      select 1
      from public.product_variants v
      left join public.product_sources ps on ps.id = v.source_id
      left join public.sourcing_shops sh on sh.site = coalesce(ps.site, p.source_site)
      where v.product_id = p.id and v.is_active and not coalesce(sh.quick_delivery, false))
$$;
revoke all on function public._quick_listings() from public, anon, authenticated;

create table public.order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seq smallint not null check (seq in (1, 2)),
  kind text not null check (kind in ('quick', 'standard', 'express')),
  est_delivery_from date,
  est_delivery_to date,
  -- its share of the order's Shipping (one parcel's figure, shared by weight; the two add up)
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  status text not null default 'open' check (status in ('open', 'shipped', 'delivered', 'cancelled')),
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id, seq),
  constraint order_shipments_window check (est_delivery_to >= est_delivery_from)
);
alter table public.order_items add column shipment_id uuid references public.order_shipments (id) on delete set null;
create index order_items_shipment_idx on public.order_items (shipment_id);

alter table public.order_shipments enable row level security;
create policy admin_read on public.order_shipments for select to authenticated using (public.is_admin());
revoke all on public.order_shipments from anon, authenticated;
grant select on public.order_shipments to authenticated;   -- writes only through create_order and the admin

-- Every order so far is one shipment, carrying its dates, Shipping and tracking.
insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents, status,
                                    carrier, tracking_number, created_at)
select o.id, 1, case when o.shipping_method = 'express' then 'express' else 'standard' end,
       o.est_delivery_from, o.est_delivery_to, o.shipping_cents,
       case when o.status = 'delivered' then 'delivered'
            when o.status in ('cancelled', 'refunded') then 'cancelled'
            when o.status = 'shipped' then 'shipped' else 'open' end,
       o.carrier, o.tracking_number, o.created_at
from public.orders o;
update public.order_items oi set shipment_id = sh.id
  from public.order_shipments sh where sh.order_id = oi.order_id and sh.seq = 1;

-- D-154: a bag's shipments and Shipping. p_items: [{variant_id, quantity}]; the promo's discount (spread over the
-- pieces by value) counts against the 7-day line; the address, once known, decides last (the 48 states and DC; not
-- Alaska, Hawaii, a territory, the military or a PO box). One parcel: the bag's billed kg × the $ a kg.
create function public._bag_shipments(p_items jsonb, p_discount_cents integer default 0, p_state text default null,
                                      p_line1 text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_on boolean;
  v_reach boolean;
  v_goods numeric;
  v_quick_goods numeric;
  v_grams numeric;
  v_quick_grams numeric;
  v_quick_ids uuid[];
  v_other boolean;
  v_india boolean;
  v_net numeric;
  v_reached boolean;
  v_billed numeric;
  v_shipping integer := 0;
  v_share integer := 0;
begin
  select * into s from public.pricing_settings where id = 1;
  v_on := s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
          and s.quick_delivery_min_cents is not null and not s.quick_delivery_paused;
  v_reach := (p_state is null or upper(trim(p_state)) not in
               ('AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'FM', 'MH', 'PW', 'AA', 'AE', 'AP'))
             and (p_line1 is null
                  or p_line1 !~* '(^|[^a-z])(p[. ]*o[. ]*box|post office box|apo|fpo|dpo)([^a-z]|$)');
  select coalesce(sum(x.q * x.price), 0),
         coalesce(sum(x.q * x.price) filter (where x.quick), 0),
         coalesce(sum(x.q * x.g) filter (where not x.us), 0),
         coalesce(sum(x.q * x.g) filter (where x.quick), 0),
         coalesce(array_agg(x.id) filter (where x.quick), '{}'),
         coalesce(bool_or(not x.quick), false),
         coalesce(bool_or(not x.us), false)
    into v_goods, v_quick_goods, v_grams, v_quick_grams, v_quick_ids, v_other, v_india
    from (select sv.id, least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99) as q, sv.price_cents as price,
                 pr.is_us_stock as us,
                 coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0)
                   * case when pr.product_type = 'food' then coalesce(s.food_billed_pct, 100) / 100.0 else 1 end as g,
                 v_on and exists (select 1 from public._quick_listings() ql where ql.id = pr.id) as quick
            from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]' end) i
            join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
            join public.product_variants pv on pv.id = sv.id
            join public.products pr on pr.id = pv.product_id
           where coalesce((i ->> 'quantity')::integer, 0) > 0) x;
  v_net := v_quick_goods - case when v_goods > 0
                                then least(greatest(coalesce(p_discount_cents, 0), 0), v_goods) * v_quick_goods / v_goods
                                else 0 end;
  v_reached := v_on and v_reach and v_quick_goods > 0 and v_net >= s.quick_delivery_min_cents;
  if v_india then
    -- the courier bills at least 1 kg, then by the half kg
    v_billed := ceil(greatest(v_grams / 1000.0, 1) * 2) / 2;
    v_shipping := case when s.shipping_cents_per_kg is not null then round(v_billed * s.shipping_cents_per_kg)::integer
                       else coalesce(s.small_order_shipping_cents, 0) end;
    if v_reached and v_other and v_grams > 0 then
      v_share := round(v_shipping * v_quick_grams / v_grams)::integer;
    end if;
  end if;
  return jsonb_build_object(
    'days_min', case when v_on then s.quick_delivery_days_min end,
    'days_max', case when v_on then s.quick_delivery_days_max end,
    'min_cents', case when v_on then s.quick_delivery_min_cents end,
    'quick_cents', round(v_net)::integer,
    'quick_variant_ids', to_jsonb(v_quick_ids),
    'quick_only', v_reached and not v_other,
    'split', v_reached and v_other,
    -- how much more of 7-day pieces brings them in 7 days (null: none in the bag, there already, or the address)
    'gap_cents', case when v_on and v_reach and v_quick_goods > 0 and not v_reached
                      then greatest(s.quick_delivery_min_cents - ceil(v_net), 0)::integer end,
    'outside', v_on and v_quick_goods > 0 and not v_reach,
    'billed_grams', case when v_india then round(v_billed * 1000)::integer else 0 end,
    'shipping_cents', v_shipping,
    'quick_shipping_cents', v_share);
end $$;
revoke all on function public._bag_shipments(jsonb, integer, text, text) from public, anon, authenticated;

drop function public.store_bag_charges(jsonb);
-- D-154: the bag's charges. Shipping is one parcel at the $ a kg, the same figure struck through once free (the free
-- line, or a bag of only 7-day pieces worth the 7-day line: 'quick_free'). Retailer charges and the bulk saving as
-- before (D-111, D-119, D-123). The same answer for the bag (no promo, no address yet) and checkout (both known).
create function public.store_bag_charges(p_items jsonb, p_discount_cents integer default 0, p_state text default null,
                                         p_line1 text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_ship jsonb;
  v_from_india boolean;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  v_ship := public._bag_shipments(p_items, p_discount_cents, p_state, p_line1);
  v_from_india := (v_ship ->> 'billed_grams')::integer > 0;
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
    'shipments', v_ship - 'quick_variant_ids');
end $$;
revoke all on function public.store_bag_charges(jsonb, integer, text, text) from public;
grant execute on function public.store_bag_charges(jsonb, integer, text, text) to anon, authenticated;

-- As 20261022120000_seven_day_delivery, with the shipments (D-154).
CREATE OR REPLACE FUNCTION public.create_order(p_order jsonb)
 RETURNS TABLE(order_id uuid, order_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cycle public.cycles%rowtype;
  v_shown public.cycles%rowtype;
  v_priced_at timestamptz;
  v_late boolean := false;
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_method public.shipping_method;
  v_from date;
  v_to date;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
  v_made_to_order boolean;
  v_quick boolean;
  v_split boolean;
  v_ship jsonb;
  v_first uuid;
  v_second uuid;
  v_quick_share integer;
begin
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;
  -- D-115: in the pilot every piece is bought as soon as it sells; no cycle, the window counts from today.
  v_made_to_order := v_method = 'standard'
    and v_settings.pilot_delivery_days_min is not null and v_settings.pilot_delivery_days_max is not null;

  -- D-154: the same shipments the bag and checkout showed (_bag_shipments): 7-day pieces worth the 7-day line after
  -- the promo, to the 48 states or DC, are a shipment of their own in the 7-day days; a bag of only those is all
  -- 7-day (bought at once, as D-148); with other pieces the order is split in two. Express never splits.
  if jsonb_typeof(p_order -> 'items') = 'array' then
    v_ship := public._bag_shipments(p_order -> 'items', coalesce((p_order ->> 'discount_cents')::integer, 0),
                                    p_order -> 'shipping_address' ->> 'state',
                                    p_order -> 'shipping_address' ->> 'line1');
  end if;
  v_quick := v_method = 'standard' and coalesce((v_ship ->> 'quick_only')::boolean, false);
  v_split := v_method = 'standard' and coalesce((v_ship ->> 'split')::boolean, false);

  if v_quick then
    v_from := current_date + v_settings.quick_delivery_days_min;
    v_to := current_date + v_settings.quick_delivery_days_max;
    v_made_to_order := true;
  elsif v_method = 'express' then
    -- Courier from Mumbai to the door, outside the cycle: the window counts from today.
    if v_settings.express_days_min is null or v_settings.express_days_max is null
       or v_settings.express_base_cents is null or v_settings.express_courier_cents_per_kg is null then
      raise exception 'express_unavailable' using errcode = 'P0001';
    end if;
    v_from := current_date + v_settings.express_days_min;
    v_to := current_date + v_settings.express_days_max;
  elsif v_made_to_order then
    v_from := current_date + v_settings.pilot_delivery_days_min;
    v_to := current_date + v_settings.pilot_delivery_days_max;
  else
    -- Never join a cycle after its cutoff, even if the timer has not run yet.
    perform public.roll_cycles();
    -- FOR SHARE: orders run side by side; a cutoff waits until they have committed.
    select * into v_cycle from public.cycles where status = 'open' for share;
    if not found then
      raise exception 'no_open_cycle' using errcode = 'P0001';
    end if;
    -- D-065: the cycle whose window the customer saw is the first to close after they were priced.
    select created_at into v_priced_at from public.pending_orders
     where payment_intent_id = p_order ->> 'payment_intent_id';
    if v_priced_at is not null then
      select * into v_shown from public.cycles where cutoff_at > v_priced_at order by cutoff_at limit 1 for share;
      if found and v_shown.id <> v_cycle.id then
        if v_shown.status <> 'collecting' then
          raise exception 'cycle_closed' using errcode = 'P0001';
        end if;
        v_cycle := v_shown;
        v_late := true;
      end if;
    end if;
    if v_settings.domestic_days_min is null or v_settings.domestic_days_max is null then
      raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
    end if;
    v_from := v_cycle.est_arrival_on + v_settings.domestic_days_min;
    v_to := v_cycle.est_arrival_on + v_settings.domestic_days_max;
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'order_has_no_items' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, status, cycle_id, est_delivery_from, est_delivery_to, shipping_method,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promo_code_id, payment_intent_id, payment_status, shipping_address)
  values (
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    'confirmed',
    case when v_method = 'express' or v_made_to_order then null else v_cycle.id end,
    v_from, v_to, v_method,
    (p_order ->> 'subtotal_cents')::integer,
    coalesce((p_order ->> 'discount_cents')::integer, 0),
    coalesce((p_order ->> 'shipping_cents')::integer, 0),
    coalesce((p_order ->> 'tax_cents')::integer, 0),
    (p_order ->> 'total_cents')::integer,
    nullif(p_order ->> 'promo_code_id', '')::uuid,
    p_order ->> 'payment_intent_id',
    'paid',
    p_order -> 'shipping_address')
  returning * into v_order;

  -- Variant-id order: every order locks pieces in the same order, so no deadlocks (PR-9).
  for v_item in select value from jsonb_array_elements(p_order -> 'items') order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_unit := (v_item ->> 'unit_price_cents')::integer;

    select v.id, v.label, v.product_id, coalesce(v.price_cents, p.price_cents) as price_cents,
           p.name as product_name, r.name as region_name
      into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.regions r on r.id = p.region_id
    where v.id = (v_item ->> 'variant_id')::uuid
      and v.is_active
      and p.status = 'live'
      and (not p.is_placeholder or public.dev_preview());
    if not found then
      raise exception 'variant_unavailable:%', v_item ->> 'variant_id' using errcode = 'P0001';
    end if;
    if v_unit is distinct from v_variant.price_cents then
      raise exception 'price_mismatch:%', v_variant.id using errcode = 'P0001';
    end if;

    -- INV-3: one conditional statement; fails instead of overselling.
    perform public._set_stock_context('reserved', 'order', v_order.id, null);
    update public.product_variants
       set qty_reserved = qty_reserved + v_qty
     where id = v_variant.id
       and qty_listed - qty_reserved >= v_qty;
    if not found then
      raise exception 'insufficient_stock:%', v_variant.id using errcode = 'P0001';
    end if;
    perform public._set_stock_context(null, null, null, null);

    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label,
                                    region_name, quantity, unit_price_cents, total_price_cents)
    values (v_order.id, v_variant.id, v_variant.product_id, v_variant.product_name, v_variant.label,
            v_variant.region_name, v_qty, v_unit, v_qty * v_unit);
    v_sum := v_sum + v_qty * v_unit;
  end loop;

  if v_sum <> v_order.subtotal_cents then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, visible_to_customer)
  values (v_order.id, 'order_confirmed', true);

  -- Express (D-070), a made-to-order pilot piece (D-115), or a late payment joining a collecting cycle (D-065): the
  -- pieces go on a pickup list now.
  if v_method = 'express' or v_made_to_order or v_late then
    insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
    select oi.id, case when v_method = 'express' or v_made_to_order then null else v_cycle.id end, p.vendor_id, oi.variant_id,
           oi.quantity, p.shop_price_paise
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id;
  end if;
  -- D-154: the order's shipments. Shipping is one parcel's (the whole bag), shared by weight so the two add up.
  if v_split then
    v_quick_share := case when coalesce((v_ship ->> 'shipping_cents')::integer, 0) = 0 then 0
                          else round(v_order.shipping_cents * (v_ship ->> 'quick_shipping_cents')::numeric
                                     / (v_ship ->> 'shipping_cents')::numeric)::integer end;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, 'quick', current_date + v_settings.quick_delivery_days_min,
            current_date + v_settings.quick_delivery_days_max, v_quick_share)
    returning id into v_first;
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 2, 'standard', v_from, v_to, v_order.shipping_cents - v_quick_share)
    returning id into v_second;
    update public.order_items oi
       set shipment_id = case when oi.variant_id in (select jsonb_array_elements_text(v_ship -> 'quick_variant_ids')::uuid)
                              then v_first else v_second end
     where oi.order_id = v_order.id;
  else
    insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, shipping_cents)
    values (v_order.id, 1, case when v_quick then 'quick' when v_method = 'express' then 'express' else 'standard' end,
            v_from, v_to, v_order.shipping_cents)
    returning id into v_first;
    update public.order_items oi set shipment_id = v_first where oi.order_id = v_order.id;
  end if;

  if v_late then
    update public.orders set status = 'collecting' where id = v_order.id;
    insert into public.order_events (order_id, kind, visible_to_customer)
    values (v_order.id, 'preparing', true);
  end if;

  return query select v_order.id, v_order.order_number;
end $function$;
