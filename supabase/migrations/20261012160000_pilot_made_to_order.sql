-- =============================================================================
-- D-115: the pilot is made to order. As soon as a piece sells it is bought from the shop and sent to the US, so there
-- is no cycle and no cutoff: a standard order's delivery window is today + the pilot's delivery days (12 – 18, the
-- founder's numbers, in Settings), and its pieces go on the pickup list at once, like express (D-070).
-- With both pilot days empty the cycle model (D-008) applies again, unchanged.
-- =============================================================================

alter table public.pricing_settings
  add column pilot_delivery_days_min integer check (pilot_delivery_days_min between 0 and 120),
  add column pilot_delivery_days_max integer check (pilot_delivery_days_max between 0 and 120),
  add constraint pilot_delivery_days_order check (pilot_delivery_days_max >= pilot_delivery_days_min);

-- The window the store shows (home, product pages, checkout): in the pilot, today + its days and no "order by".
create or replace function public.store_next_delivery()
 returns table(order_by timestamp with time zone, est_delivery_from date, est_delivery_to date)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select null::timestamptz, current_date + s.pilot_delivery_days_min, current_date + s.pilot_delivery_days_max
  from public.pricing_settings s
  where s.id = 1 and s.pilot_delivery_days_min is not null and s.pilot_delivery_days_max is not null
  union all
  (select c.cutoff_at,
          c.est_arrival_on + s.domestic_days_min,
          c.est_arrival_on + s.domestic_days_max
   from public._store_cycle() c
   cross join public.pricing_settings s
   where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null
     and (s.pilot_delivery_days_min is null or s.pilot_delivery_days_max is null))
  limit 1;
$function$;

-- Orders: a standard order in the pilot needs no cycle (latest before: 20261007120000_tax_and_express).
create or replace function public.create_order(p_order jsonb)
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
begin
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;
  -- D-115: in the pilot every piece is bought as soon as it sells; no cycle, the window counts from today.
  v_made_to_order := v_method = 'standard'
    and v_settings.pilot_delivery_days_min is not null and v_settings.pilot_delivery_days_max is not null;

  if v_method = 'express' then
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
    join public.regions r on r.id = p.region_id
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
  if v_late then
    update public.orders set status = 'collecting' where id = v_order.id;
    insert into public.order_events (order_id, kind, visible_to_customer)
    values (v_order.id, 'preparing', true);
  end if;

  return query select v_order.id, v_order.order_number;
end $function$;

-- The founder's pilot numbers (D-115). Standard shipping is free (D-041; small bags pay their charges, D-112): a
-- missing value would keep checkout closed.
update public.pricing_settings set
  pilot_delivery_days_min = 12,
  pilot_delivery_days_max = 18,
  shipping_flat_cents = coalesce(shipping_flat_cents, 0)
where id = 1;
