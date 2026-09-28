-- =============================================================================
-- Founder answers of 2026-09-28 (D-041 shipping options, D-042 refunds).
-- 1. Two shipping options: standard (free) and express ($8). Express delivers
--    faster inside the US after the export arrives; its delivery days are NOT
--    decided yet (Q-18), so express stays unavailable until they are set.
-- 2. Orders remember the chosen option and how much was refunded.
-- 3. Refund rules live here, in one place:
--    - a piece unavailable at pickup (our fault, D-030): the item's price plus
--      its share of the tax; the last piece of an order refunds everything left;
--    - cancel at the customer's request (before cutoff): everything except the tax;
--    - cancel because of us (before cutoff): everything.
--    The server refunds through Stripe first, then records it with the
--    functions below, which re-check the amount against these rules.
-- =============================================================================

create type public.shipping_method as enum ('standard', 'express');

alter table public.pricing_settings
  add column express_shipping_cents integer check (express_shipping_cents >= 0),
  add column express_days_min integer check (express_days_min >= 0),
  add column express_days_max integer check (express_days_max >= 0),
  add constraint pricing_express_days_order check (express_days_max >= express_days_min);

comment on column public.pricing_settings.express_shipping_cents is 'Express shipping charge per order (D-041).';
comment on column public.pricing_settings.express_days_min is
  'US delivery days after arrival for express. NULL = not decided (Q-18): express is not offered.';

-- D-041 (founder, 2026-09-28): "for fast express shipping we can show $8 and for normal we can show free".
update public.pricing_settings
   set shipping_flat_cents = 0, free_shipping_min_cents = null, express_shipping_cents = 800
 where id = 1;

alter table public.orders
  add column shipping_method public.shipping_method not null default 'standard',
  add column refunded_cents integer not null default 0,
  add constraint orders_refund_within_total check (refunded_cents between 0 and total_cents);

-- -----------------------------------------------------------------------------
-- Customer read path: the chosen option and refunded amount are the customer's
-- own facts. New columns go at the end (create or replace view keeps the rest).
-- -----------------------------------------------------------------------------
create or replace view public.store_orders as
select o.id, o.order_number, o.email,
       case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'collecting' then 'preparing'
         when 'packed' then 'preparing'
         when 'in_transit' then 'preparing'
         when 'arrived' then 'preparing'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
       end as customer_status,
       o.est_delivery_from, o.est_delivery_to,
       o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.currency,
       o.payment_status, o.shipping_address, o.tracking_number, o.carrier, o.created_at,
       o.shipping_method, o.refunded_cents
from public.orders o
where o.user_id = auth.uid();

create or replace function public.guest_order_lookup(p_order_number text, p_email text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'email', o.email,
      'customer_status', case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
         else 'preparing' end,
      'est_delivery_from', o.est_delivery_from, 'est_delivery_to', o.est_delivery_to,
      'subtotal_cents', o.subtotal_cents, 'discount_cents', o.discount_cents, 'shipping_cents', o.shipping_cents,
      'tax_cents', o.tax_cents, 'total_cents', o.total_cents, 'currency', o.currency,
      'payment_status', o.payment_status, 'shipping_address', o.shipping_address,
      'tracking_number', o.tracking_number, 'carrier', o.carrier, 'created_at', o.created_at,
      'shipping_method', o.shipping_method, 'refunded_cents', o.refunded_cents),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
               'variant_label', i.variant_label, 'region_name', i.region_name, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'total_price_cents', i.total_price_cents, 'status', i.status)
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at)
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- -----------------------------------------------------------------------------
-- Checkout: express is offered only when its price AND its delivery days are set.
-- -----------------------------------------------------------------------------
create or replace function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents)
      from public.promo_codes c
      where nullif(trim(p_promo_code), '') is not null
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    'express', (
      select jsonb_build_object('price_cents', s.express_shipping_cents,
                                'est_delivery_from', c.est_arrival_on + s.express_days_min,
                                'est_delivery_to', c.est_arrival_on + s.express_days_max)
      from public.cycles c cross join public.pricing_settings s
      where c.status = 'open' and s.id = 1
        and s.express_shipping_cents is not null
        and s.express_days_min is not null and s.express_days_max is not null)
  );
$$;

-- create_order: as in the baseline, plus the shipping option (the window uses
-- the express days for express orders; refused while express is not set up).
create or replace function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cycle public.cycles%rowtype;
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_method public.shipping_method;
  v_days_min integer;
  v_days_max integer;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
begin
  select * into v_cycle from public.cycles where status = 'open' for update;
  if not found then
    raise exception 'no_open_cycle' using errcode = 'P0001';
  end if;

  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;
  if v_method = 'express' then
    v_days_min := v_settings.express_days_min;
    v_days_max := v_settings.express_days_max;
    if v_days_min is null or v_days_max is null or v_settings.express_shipping_cents is null then
      raise exception 'express_unavailable' using errcode = 'P0001';
    end if;
  else
    v_days_min := v_settings.domestic_days_min;
    v_days_max := v_settings.domestic_days_max;
    if v_days_min is null or v_days_max is null then
      raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
    end if;
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
    v_cycle.id,
    v_cycle.est_arrival_on + v_days_min,
    v_cycle.est_arrival_on + v_days_max,
    v_method,
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

  for v_item in select value from jsonb_array_elements(p_order -> 'items')
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

  return query select v_order.id, v_order.order_number;
end $$;

-- -----------------------------------------------------------------------------
-- Refund amounts (D-042). The one place these rules are written down.
-- -----------------------------------------------------------------------------

-- A piece unavailable at pickup: its price after its share of any discount, plus
-- its share of the tax charged. The last piece of an order refunds all that is left
-- (so shipping and rounding come back too: a complete refund when nothing ships).
create function public.item_refund_cents(p_item uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when not exists (
      select 1 from public.order_items x
      where x.order_id = i.order_id and x.id <> i.id and x.status in ('active', 'unavailable'))
      then o.total_cents - o.refunded_cents
    else least(
      o.total_cents - o.refunded_cents,
      g.goods + case when o.subtotal_cents - o.discount_cents + o.shipping_cents > 0
                     then round(o.tax_cents::numeric * g.goods
                                / (o.subtotal_cents - o.discount_cents + o.shipping_cents))::integer
                     else 0 end)
  end
  from public.order_items i
  join public.orders o on o.id = i.order_id
  cross join lateral (
    select i.total_price_cents
           - case when o.subtotal_cents > 0
                  then round(o.discount_cents::numeric * i.total_price_cents / o.subtotal_cents)::integer
                  else 0 end as goods) g
  where i.id = p_item
    and (public.is_admin() or coalesce(auth.role(), '') = 'service_role');
$$;

-- Cancelling before cutoff: the customer's own choice keeps the tax; our fault refunds everything.
create function public.cancel_refund_cents(p_order uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case p_reason
           when 'customer_request' then greatest(o.total_cents - o.tax_cents - o.refunded_cents, 0)
           when 'our_fault' then o.total_cents - o.refunded_cents
         end
  from public.orders o
  where o.id = p_order
    and (public.is_admin() or coalesce(auth.role(), '') = 'service_role');
$$;

-- Records a Stripe refund for an unavailable piece (flows.md §4.4, D-030).
create function public.refund_order_item(p_item uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item public.order_items%rowtype;
  v_order public.orders%rowtype;
  v_expected integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_item from public.order_items where id = p_item for update;
  if not found or v_item.status <> 'unavailable' then
    raise exception 'item_not_refundable' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = v_item.order_id for update;
  v_expected := public.item_refund_cents(p_item);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;

  update public.order_items set status = 'refunded' where id = p_item;
  update public.orders
     set refunded_cents = refunded_cents + p_amount_cents,
         payment_status = case when refunded_cents + p_amount_cents = total_cents
                               then 'refunded' else 'partially_refunded' end::public.payment_status,
         status = case when not exists (select 1 from public.order_items x
                                        where x.order_id = v_order.id and x.status in ('active', 'unavailable'))
                       then 'refunded' else status end::public.order_status
   where id = v_order.id;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (v_order.id, 'item_refunded', true, 'refund ' || coalesce(p_refund_ref, '?'), auth.uid());
end $$;

-- Cancels a paid order before its cycle's cutoff (status confirmed): releases the
-- reserved stock, marks the items refunded and records the refund (D-042).
create function public.cancel_order(p_order uuid, p_reason text, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_expected integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('customer_request', 'our_fault') then
    raise exception 'invalid_cancel_reason' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.status <> 'confirmed' then
    raise exception 'order_not_cancellable' using errcode = 'P0001';
  end if;
  v_expected := public.cancel_refund_cents(p_order, p_reason);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;

  for v_item in select id, variant_id, quantity from public.order_items
                where order_id = p_order and status = 'active' and variant_id is not null
  loop
    perform public._set_stock_context('released', 'order', p_order, p_reason);
    update public.product_variants set qty_reserved = qty_reserved - v_item.quantity where id = v_item.variant_id;
    perform public._set_stock_context(null, null, null, null);
  end loop;
  update public.order_items set status = 'refunded' where order_id = p_order and status <> 'refunded';

  update public.orders
     set status = 'cancelled',
         refunded_cents = refunded_cents + p_amount_cents,
         payment_status = case when refunded_cents + p_amount_cents = total_cents
                               then 'refunded' else 'partially_refunded' end::public.payment_status
   where id = p_order;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (p_order, 'order_cancelled', true, p_reason || ', refund ' || coalesce(p_refund_ref, '?'), auth.uid());
end $$;

revoke all on function public.item_refund_cents(uuid), public.cancel_refund_cents(uuid, text),
  public.refund_order_item(uuid, integer, text), public.cancel_order(uuid, text, integer, text)
  from public, anon, authenticated;
-- All four check is_admin() (or the service role) themselves; the amount functions
-- return NULL for anyone else. Admin screens show the amount before refunding.
grant execute on function public.item_refund_cents(uuid), public.cancel_refund_cents(uuid, text),
  public.refund_order_item(uuid, integer, text), public.cancel_order(uuid, text, integer, text)
  to authenticated, service_role;
