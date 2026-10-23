-- =============================================================================
-- D-154 step 2: running two shipments (the admin). An order's shipments (20261023120000) now ship, arrive, move
-- their dates and are cancelled one by one; the order follows them.
--  - ship_shipment / deliver_shipment: each with its carrier and tracking number and its own customer email. A 7-day
--    shipment goes door to door by courier from the hub (like Express, D-070): it ships once its pieces are at the hub.
--    So does any shipment of an order without a cycle (the pilot, D-115): until now such an order could never be
--    marked shipped (ship_order wanted an arrived cycle). An order in a cycle ships once its export has arrived. ship_order / deliver_order keep working for an order of one
--    shipment (the Orders list's bulk ship), and refuse an order of two (each is shipped from the order page).
--  - The order is Shipped once nothing is left to send, Delivered once everything sent has arrived. A shipment left
--    with no piece to send (every piece unavailable or refunded) is cancelled by itself.
--  - change_shipment_window: the delay notice (D-008) for one shipment; the customer may keep it or cancel that
--    shipment for its share back (cancel_after_delay). The order's window spans its shipments.
--  - Cancels (D-072, the plan's cases 23 – 24): once the hub has bought a 7-day shipment's pieces, the order can no
--    longer be cancelled as a whole (food cannot go back); its other shipment can, until it leaves India
--    (admin_cancel_shipment, with its pieces, its share of the discount, the tax and its Shipping share back).
--  - The India desk: admin_to_order marks 7-day pieces with their buy-by (2 hours) and ship-by (the next day) times;
--    admin_quick_watch counts the 7-day shipments open and at risk for Today.
--  - The customer-safe order (guest_order_lookup, store_my_order) lists its shipments: speed, dates, status,
--    tracking and which pieces. Nothing about shops or weights (D-003).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. An event can belong to one shipment; its email says which.
-- -----------------------------------------------------------------------------
alter table public.order_events add column shipment_id uuid references public.order_shipments (id) on delete set null;

-- Latest before: 20261006090000_customer_messages.
create or replace function public._queue_order_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.email_outbox (kind, recipient, payload)
  select 'order_update', o.email,
         jsonb_build_object('orderNumber', o.order_number, 'eventId', new.id, 'kind', new.kind)
         || coalesce((select jsonb_build_object('shipment', sh.seq) from public.order_shipments sh
                      where sh.id = new.shipment_id), '{}'::jsonb)
  from public.orders o where o.id = new.order_id;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------
create function public._live_shipments(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.order_shipments where order_id = p_order and status <> 'cancelled';
$$;

-- A shipment's pieces are bought once the desk ordered one from its shop or it is at the hub.
create function public._shipment_bought(p_shipment uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.order_items oi join public.pickups p on p.order_item_id = oi.id
    where oi.shipment_id = p_shipment and oi.status = 'active' and (p.ordered_at is not null or p.status <> 'pending'));
$$;

create function public._quick_bought(p_order uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.order_shipments sh
                 where sh.order_id = p_order and sh.kind = 'quick' and sh.status <> 'cancelled'
                   and public._shipment_bought(sh.id));
$$;

-- What may still be cancelled on its own: an open shipment of a paid order with another shipment still travelling;
-- a 7-day one only until its pieces are bought, the other until it leaves India.
create function public._shipment_cancellable(p_shipment uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select sh.status = 'open' and o.payment_status in ('paid', 'partially_refunded')
           and o.status not in ('cancelled', 'refunded') and public._live_shipments(o.id) > 1
           and case when sh.kind = 'quick' then not public._shipment_bought(sh.id) else public._in_india(o) end
    from public.order_shipments sh join public.orders o on o.id = sh.order_id
    where sh.id = p_shipment), false);
$$;

-- A shipment's refund: its pieces after their share of the discount, its Shipping share and their share of the tax
-- (the item rule of D-042, for a group). The last shipment still travelling gets everything left. The customer's own
-- cancel keeps the cancel fee once a piece is at the hub (D-072; 0 in the pilot).
create function public._shipment_refund_cents(p_shipment uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_reason not in ('customer_request', 'our_fault') then null
    when public._live_shipments(o.id) <= 1 then greatest(o.total_cents - o.refunded_cents - f.fee, 0)
    else greatest(least(
      o.total_cents - o.refunded_cents,
      g.goods + sh.shipping_cents
      + case when o.subtotal_cents - o.discount_cents + o.shipping_cents > 0
             then round(o.tax_cents::numeric * (g.goods + sh.shipping_cents)
                        / (o.subtotal_cents - o.discount_cents + o.shipping_cents))::integer
             else 0 end) - f.fee, 0)
  end
  from public.order_shipments sh
  join public.orders o on o.id = sh.order_id
  cross join public.pricing_settings s
  cross join lateral (
    select coalesce(sum(i.total_price_cents
                        - case when o.subtotal_cents > 0
                               then round(o.discount_cents::numeric * i.total_price_cents / o.subtotal_cents)::integer
                               else 0 end), 0)::integer as goods
    from public.order_items i where i.shipment_id = sh.id and i.status in ('active', 'unavailable')) g
  cross join lateral (
    select case when p_reason = 'customer_request' and exists (
                  select 1 from public.order_items i join public.pickups p on p.order_item_id = i.id
                  where i.shipment_id = sh.id and i.status = 'active' and p.status = 'picked')
                then round(g.goods * coalesce(s.cancel_fee_pct, 0) / 100)::integer else 0 end as fee) f
  where sh.id = p_shipment and s.id = 1;
$$;

-- The order follows its shipments: one left with nothing to send is cancelled; Shipped once nothing is left to send,
-- Delivered once everything sent has arrived (with the latest tracking on the order, as the single one was).
create function public._settle_order(p_order uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status public.order_status;
  v_last public.order_shipments;
begin
  update public.order_shipments sh set status = 'cancelled'
   where sh.order_id = p_order and sh.status = 'open'
     and not exists (select 1 from public.order_items i where i.shipment_id = sh.id and i.status = 'active');
  select status into v_status from public.orders where id = p_order;
  if v_status in ('pending_payment', 'cancelled', 'refunded', 'delivered')
     or exists (select 1 from public.order_shipments where order_id = p_order and status = 'open') then
    return;
  end if;
  select * into v_last from public.order_shipments
   where order_id = p_order and status in ('shipped', 'delivered')
   order by shipped_at desc nulls last, seq desc limit 1;
  if not found then
    return;
  end if;
  update public.orders
     set status = case when exists (select 1 from public.order_shipments where order_id = p_order and status = 'shipped')
                       then 'shipped' else 'delivered' end::public.order_status,
         carrier = v_last.carrier, tracking_number = v_last.tracking_number
   where id = p_order;
end $$;

create function public._order_item_settles() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public._settle_order(new.order_id);
  return new;
end $$;
create trigger order_items_settle_shipments
  after update of status on public.order_items
  for each row when (old.status is distinct from new.status)
  execute function public._order_item_settles();

-- An order of one shipment: its window is the shipment's (moves, faster-delivery offers, admin window changes).
create function public._order_window_to_shipment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public._live_shipments(new.id) = 1 then
    update public.order_shipments
       set est_delivery_from = new.est_delivery_from, est_delivery_to = new.est_delivery_to
     where order_id = new.id and status <> 'cancelled'
       and new.est_delivery_from is not null and new.est_delivery_to is not null;
  end if;
  return new;
end $$;
create trigger orders_window_to_shipment
  after update of est_delivery_from, est_delivery_to on public.orders
  for each row when (old.est_delivery_from is distinct from new.est_delivery_from
                     or old.est_delivery_to is distinct from new.est_delivery_to)
  execute function public._order_window_to_shipment();

-- -----------------------------------------------------------------------------
-- 3. Ship and deliver, one shipment at a time
-- -----------------------------------------------------------------------------
create function public.ship_shipment(p_shipment uuid, p_carrier text, p_tracking text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sh public.order_shipments;
  v_order public.orders;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_carrier, ''))) not between 2 and 40
     or length(btrim(coalesce(p_tracking, ''))) not between 4 and 60 then
    raise exception 'invalid_tracking' using errcode = 'P0001';
  end if;
  select o.* into v_order from public.orders o join public.order_shipments sh on sh.order_id = o.id
   where sh.id = p_shipment for update of o;
  select * into v_sh from public.order_shipments where id = p_shipment for update;
  if not found or v_sh.status <> 'open' then
    raise exception 'shipment_not_open' using errcode = 'P0001';
  end if;
  -- From the hub (a 7-day shipment by courier, D-154; Express, D-070; any order without a cycle, the made-to-order
  -- pilot, D-115, whose second shipment leaves "when its pieces have reached the hub"): once its pieces are there.
  -- An order in a cycle ships once its export has arrived, as before.
  if v_sh.kind = 'quick' or v_order.cycle_id is null then
    if v_order.status not in ('confirmed', 'collecting', 'packed', 'in_transit', 'arrived') or exists (
         select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
         where oi.shipment_id = p_shipment and oi.status = 'active' and p.status = 'pending') then
      raise exception 'express_not_picked' using errcode = 'P0001';
    end if;
  elsif v_order.status <> 'arrived' then
    raise exception 'order_not_arrived' using errcode = 'P0001';
  end if;
  update public.order_shipments
     set status = 'shipped', carrier = btrim(p_carrier), tracking_number = btrim(p_tracking), shipped_at = now()
   where id = p_shipment;
  insert into public.order_events (order_id, shipment_id, kind, visible_to_customer, actor)
  values (v_order.id, p_shipment, 'shipped', true, auth.uid());
  perform public._settle_order(v_order.id);
end $$;

create function public.deliver_shipment(p_shipment uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select order_id into v_order from public.order_shipments where id = p_shipment;
  perform 1 from public.orders where id = v_order for update;
  update public.order_shipments set status = 'delivered' where id = p_shipment and status = 'shipped';
  if not found then
    raise exception 'order_not_shipped' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, shipment_id, kind, visible_to_customer, actor)
  values (v_order, p_shipment, 'delivered', true, auth.uid());
  perform public._settle_order(v_order);
end $$;

-- An order of one shipment, as before (latest before: 20261007120000_tax_and_express); two are shipped one by one.
create or replace function public.ship_order(p_order uuid, p_carrier text, p_tracking text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_open uuid[];
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_carrier, ''))) not between 2 and 40
     or length(btrim(coalesce(p_tracking, ''))) not between 4 and 60 then
    raise exception 'invalid_tracking' using errcode = 'P0001';
  end if;
  select array_agg(id order by seq) into v_open from public.order_shipments where order_id = p_order and status = 'open';
  if coalesce(cardinality(v_open), 0) = 0 then
    raise exception 'order_not_arrived' using errcode = 'P0001';
  elsif cardinality(v_open) > 1 then
    raise exception 'order_has_two_shipments' using errcode = 'P0001';
  end if;
  perform public.ship_shipment(v_open[1], p_carrier, p_tracking);
end $$;

-- Latest before: 20261003170000_ship_and_deliver.
create or replace function public.deliver_order(p_order uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sh uuid;
  v_any boolean := false;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  for v_sh in select id from public.order_shipments where order_id = p_order and status = 'shipped' order by seq loop
    perform public.deliver_shipment(v_sh);
    v_any := true;
  end loop;
  if not v_any then
    raise exception 'order_not_shipped' using errcode = 'P0001';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Dates and delays, one shipment at a time (D-008)
-- -----------------------------------------------------------------------------
create function public.change_shipment_window(p_shipment uuid, p_from date, p_to date, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sh public.order_shipments;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'invalid_window' using errcode = 'P0001';
  end if;
  select * into v_sh from public.order_shipments where id = p_shipment;
  if not found or v_sh.status <> 'open' then
    raise exception 'shipment_not_open' using errcode = 'P0001';
  end if;
  perform 1 from public.orders where id = v_sh.order_id for update;
  update public.order_shipments set est_delivery_from = p_from, est_delivery_to = p_to where id = p_shipment;
  perform set_config('iwc.window_change', 'on', true);
  update public.orders o
     set est_delivery_from = w.from_on, est_delivery_to = w.to_on
    from (select min(est_delivery_from) as from_on, max(est_delivery_to) as to_on
          from public.order_shipments where order_id = v_sh.order_id and status <> 'cancelled') w
   where o.id = v_sh.order_id;
  perform set_config('iwc.window_change', '', true);
  insert into public.order_events (order_id, shipment_id, kind, visible_to_customer, internal_note, actor)
  values (v_sh.order_id, p_shipment, 'delivery_window_changed', true, p_note, auth.uid());
end $$;

-- An order of two shipments moves one shipment's dates, not both (latest before: the baseline).
create or replace function public.change_delivery_window(p_order uuid, p_from date, p_to date, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_to < p_from then
    raise exception 'invalid_window' using errcode = 'P0001';
  end if;
  if public._live_shipments(p_order) > 1 then
    raise exception 'order_has_two_shipments' using errcode = 'P0001';
  end if;

  perform set_config('iwc.window_change', 'on', true);
  update public.orders set est_delivery_from = p_from, est_delivery_to = p_to where id = p_order;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  perform set_config('iwc.window_change', '', true);

  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (p_order, 'delivery_window_changed', true, p_note, auth.uid());
end $$;

-- The latest date change, and whether the customer may still answer it: a shipment's while it has not shipped, the
-- order's while the order has not (latest before: 20261006090000_customer_messages).
create function public._delay_shipment(p_order uuid)
returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select e.shipment_id
  from (select x.kind, x.shipment_id from public.order_events x
        where x.order_id = p_order and x.kind in ('delivery_window_changed', 'delay_kept')
        order by x.created_at desc, (x.kind = 'delay_kept') desc limit 1) e
  where e.kind = 'delivery_window_changed' and public._live_shipments(p_order) > 1;
$$;

create or replace function public._delay_open(p_order uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case when public._delay_shipment(o.id) is not null
                then exists (select 1 from public.order_shipments sh
                             where sh.id = public._delay_shipment(o.id) and sh.status = 'open')
                else o.status in ('confirmed', 'collecting', 'packed', 'in_transit', 'arrived') end
           and (select e.kind from public.order_events e
                where e.order_id = o.id and e.kind in ('delivery_window_changed', 'delay_kept')
                order by e.created_at desc, (e.kind = 'delay_kept') desc
                limit 1) = 'delivery_window_changed'
    from public.orders o where o.id = p_order), false);
$$;

create function public._delay_refund_cents(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when public._delay_shipment(p_order) is not null
              then public._shipment_refund_cents(public._delay_shipment(p_order), 'our_fault')
              else public._cancel_refund_cents(p_order, 'our_fault') end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Cancelling one shipment
-- -----------------------------------------------------------------------------
-- Its pieces leave the order as a whole cancel's do (D-072): not yet at the hub, back to the shop's stock; at the hub,
-- a US clearance draft. Its share is refunded; the rest of the order goes on.
create function public._cancel_shipment(p_shipment uuid, p_amount integer, p_why text, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order uuid;
  v_item record;
begin
  select order_id into v_order from public.order_shipments where id = p_shipment for update;
  for v_item in select oi.id, oi.variant_id, oi.quantity, p.id as pickup_id, p.status as pickup_status
                from public.order_items oi left join public.pickups p on p.order_item_id = oi.id
                where oi.shipment_id = p_shipment and oi.status = 'active' and oi.variant_id is not null
  loop
    if v_item.pickup_status = 'picked' then
      perform public._to_clearance(v_item.id, p_why);
    else
      delete from public.pickups where id = v_item.pickup_id;
      perform public._set_stock_context('released', 'order', v_order, p_why);
      update public.product_variants set qty_reserved = qty_reserved - v_item.quantity where id = v_item.variant_id;
      perform public._set_stock_context(null, null, null, null);
    end if;
  end loop;
  update public.order_shipments set status = 'cancelled' where id = p_shipment;
  update public.order_items set status = 'refunded' where shipment_id = p_shipment and status <> 'refunded';
  update public.orders
     set refunded_cents = refunded_cents + p_amount,
         payment_status = case when refunded_cents + p_amount >= total_cents then 'refunded'
                               when refunded_cents + p_amount > 0 then 'partially_refunded'
                               else payment_status end::public.payment_status
   where id = v_order;
  insert into public.order_events (order_id, shipment_id, kind, visible_to_customer, internal_note)
  values (v_order, p_shipment, 'shipment_cancelled', true, p_note);
end $$;

create function public.shipment_cancel_cents(p_shipment uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select public._shipment_refund_cents(p_shipment, p_reason)
  where public.is_admin() and public._shipment_cancellable(p_shipment);
$$;

-- Customer care cancels one shipment (the customer asked, or because of us). Stripe is refunded first, by the server.
create function public.admin_cancel_shipment(p_shipment uuid, p_reason text, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('customer_request', 'our_fault') then
    raise exception 'invalid_cancel_reason' using errcode = 'P0001';
  end if;
  perform 1 from public.orders o join public.order_shipments sh on sh.order_id = o.id
   where sh.id = p_shipment for update of o;
  if not public._shipment_cancellable(p_shipment) then
    raise exception 'shipment_not_cancellable' using errcode = 'P0001';
  end if;
  v_expected := public._shipment_refund_cents(p_shipment, p_reason);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  perform public._cancel_shipment(p_shipment, p_amount_cents, 'shipment cancelled',
                                  p_reason || ', refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- A delay cancel (D-008): the late shipment when there are two, else the whole order as before
-- (latest before: 20261007150000_after_sales).
create or replace function public.cancel_after_delay(p_order uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected integer;
  v_shipment uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  perform 1 from public.orders where id = p_order for update;
  if not public._delay_open(p_order) then
    raise exception 'no_open_delay' using errcode = 'P0001';
  end if;
  v_shipment := public._delay_shipment(p_order);
  v_expected := public._delay_refund_cents(p_order);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  if v_shipment is not null then
    perform public._cancel_shipment(v_shipment, p_amount_cents, 'cancelled after a delay',
                                    'cancelled after a delay, refund ' || coalesce(p_refund_ref, '?'));
    return;
  end if;
  perform public._unwind_order_pieces(p_order, 'cancelled after a delay');
  perform public._record_cancel(p_order, p_amount_cents, 'cancelled after a delay, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- The whole order cannot be cancelled once a 7-day shipment's pieces are bought (latest before: after_sales).
create or replace function public.customer_cancel(p_order uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_expected integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or not public._in_india(v_order) then
    raise exception 'order_left_india' using errcode = 'P0001';
  end if;
  if public._quick_bought(p_order) then
    raise exception 'quick_bought' using errcode = 'P0001';
  end if;
  v_expected := public._customer_cancel_cents(p_order);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  perform public._unwind_order_pieces(p_order, 'cancelled by the customer before leaving India');
  perform public._record_cancel(p_order, p_amount_cents, 'customer cancel, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- Latest before: 20261007150000_after_sales.
create or replace function public._order_actions(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'can_cancel', public._in_india(o) and not public._quick_bought(o.id),
    'cancel_refund_cents', case when public._in_india(o) and not public._quick_bought(o.id)
                                then public._customer_cancel_cents(o.id) end,
    'delay_open', public._delay_open(o.id),
    'delay_refund_cents', case when public._delay_open(o.id) then public._delay_refund_cents(o.id) end,
    'delay_shipment', case when public._delay_open(o.id)
                           then (select sh.seq from public.order_shipments sh where sh.id = public._delay_shipment(o.id)) end,
    'returns', coalesce((
      select jsonb_agg(jsonb_build_object(
               'item_id', i.id,
               'claim_refund_cents', (select q.refund_cents from public._return_quote(i.id, 'damaged') q),
               'change_of_mind_refund_cents', (select q.refund_cents from public._return_quote(i.id, 'changed_mind') q),
               'requested', exists (select 1 from public.returns r where r.order_item_id = i.id))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id and o.status = 'delivered'), '[]'::jsonb))
  from public.orders o where o.id = p_order;
$$;

-- -----------------------------------------------------------------------------
-- 6. The India desk: the 7-day lane on To order, and Today's watch
-- -----------------------------------------------------------------------------
drop function public.admin_to_order();
create function public.admin_to_order()
returns table (
  pickup_id uuid, order_id uuid, order_number text, ordered_on timestamptz, product_id uuid, product_name text,
  variant_label text, quantity integer, sold_paise integer, site text, item_url text, item_key text, now_paise integer,
  in_stock boolean, delivery_days smallint, vendor_name text, image_path text, buy_by timestamptz, ship_by timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  -- D-154: a 7-day piece is bought within 2 hours of the order and leaves the hub the next day.
  return query
  select pk.id, o.id, o.order_number, o.created_at, p.id, oi.product_name, oi.variant_label, pk.quantity,
         pk.shop_price_paise, coalesce(ps.site, p.source_site), coalesce(ps.item_url, p.source_url), ps.item_key,
         ps.price_paise, ps.in_stock, ps.delivery_days, ve.shop_name,
         (select m.storage_path from public.product_media m where m.product_id = p.id
           order by m.is_primary desc, m.sort_order limit 1),
         case when sh.kind = 'quick' then o.created_at + interval '2 hours' end,
         case when sh.kind = 'quick' then o.created_at + interval '1 day' end
    from public.pickups pk
    join public.order_items oi on oi.id = pk.order_item_id
    join public.orders o on o.id = oi.order_id
    left join public.order_shipments sh on sh.id = oi.shipment_id
    left join public.product_variants pv on pv.id = pk.variant_id
    left join public.products p on p.id = pv.product_id
    left join public.product_sources ps on ps.id = pk.source_id
    left join public.vendors ve on ve.id = pk.vendor_id
   where pk.status = 'pending' and pk.ordered_at is null and oi.status = 'active'
     and o.payment_status in ('paid', 'partially_refunded') and o.status in ('confirmed', 'collecting')
   order by o.created_at, pk.id;
end $$;

-- Open 7-day shipments, those not bought within 2 hours, and those not shipped by the next day.
create function public.admin_quick_watch()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'open', count(*),
      'not_bought', count(*) filter (where o.created_at < now() - interval '2 hours' and exists (
        select 1 from public.order_items oi join public.pickups p on p.order_item_id = oi.id
        where oi.shipment_id = sh.id and oi.status = 'active' and p.status = 'pending' and p.ordered_at is null)),
      'not_shipped', count(*) filter (where o.created_at < now() - interval '1 day'))
    from public.order_shipments sh join public.orders o on o.id = sh.order_id
    where sh.kind = 'quick' and sh.status = 'open' and o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('cancelled', 'refunded'));
end $$;
create index order_shipments_open_idx on public.order_shipments (kind) where status = 'open';

-- -----------------------------------------------------------------------------
-- 7. The customer-safe order lists its shipments (emails, the order page)
-- -----------------------------------------------------------------------------
create function public._order_shipments_json(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'seq', sh.seq, 'kind', sh.kind, 'status', sh.status,
           'est_delivery_from', sh.est_delivery_from, 'est_delivery_to', sh.est_delivery_to,
           'shipping_cents', sh.shipping_cents, 'carrier', sh.carrier, 'tracking_number', sh.tracking_number,
           'shipped_at', sh.shipped_at,
           'item_ids', coalesce((select jsonb_agg(i.id order by i.product_name) from public.order_items i
                                 where i.shipment_id = sh.id), '[]'::jsonb))
         order by sh.seq), '[]'::jsonb)
  from public.order_shipments sh where sh.order_id = p_order;
$$;

-- A customer's update says which shipment it is about (a column appended; latest before: the baseline).
create or replace view public.store_order_events as
select e.id, e.order_id, e.kind, e.message, e.created_at,
       (select sh.seq from public.order_shipments sh where sh.id = e.shipment_id) as shipment
from public.order_events e
join public.orders o on o.id = e.order_id
where o.user_id = auth.uid() and e.visible_to_customer;

-- Latest before: 20261008120000_order_item_photos.
create or replace function public.guest_order_lookup(p_order_number text, p_email text)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
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
               'unit_price_cents', i.unit_price_cents, 'total_price_cents', i.total_price_cents, 'status', i.status,
               'image_path', (select m.storage_path from public.product_media m
                               where m.product_id = i.product_id order by m.is_primary desc, m.sort_order limit 1))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at,
                                          'shipment', (select sh.seq from public.order_shipments sh where sh.id = e.shipment_id))
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- Latest before: 20261006090000_customer_messages.
create or replace function public.store_my_order(p_order_number text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from public.store_order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.store_order_events e where e.order_id = o.id), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

-- -----------------------------------------------------------------------------
-- 8. Rights: helpers for the server only; the admin's functions check is_admin() themselves.
-- -----------------------------------------------------------------------------
revoke all on function public._live_shipments(uuid), public._shipment_bought(uuid), public._quick_bought(uuid),
  public._shipment_cancellable(uuid), public._shipment_refund_cents(uuid, text), public._settle_order(uuid),
  public._order_item_settles(), public._order_window_to_shipment(), public._delay_shipment(uuid),
  public._delay_refund_cents(uuid), public._cancel_shipment(uuid, integer, text, text),
  public._order_shipments_json(uuid), public.ship_shipment(uuid, text, text), public.deliver_shipment(uuid),
  public.change_shipment_window(uuid, date, date, text), public.shipment_cancel_cents(uuid, text),
  public.admin_cancel_shipment(uuid, text, integer, text), public.admin_to_order(), public.admin_quick_watch()
  from public, anon, authenticated;
grant execute on function public.ship_shipment(uuid, text, text), public.deliver_shipment(uuid),
  public.change_shipment_window(uuid, date, date, text), public.shipment_cancel_cents(uuid, text),
  public.admin_cancel_shipment(uuid, text, integer, text), public.admin_to_order(), public.admin_quick_watch()
  to authenticated, service_role;
grant execute on function public._delay_shipment(uuid), public._delay_refund_cents(uuid),
  public._order_shipments_json(uuid) to service_role;
