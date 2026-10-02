-- =============================================================================
-- C4, moving orders between cycles and the faster-delivery offer (flows.md §6b, D-045, D-064):
--  - order_moves: every move of an order to another cycle (admin-only). An order moves whole, all its pieces, since
--    it reaches the customer as one parcel (interpretation, proposed).
--  - move_order(order, cycle, note): mirrors what happened physically. Pieces already on a pickup list move with the
--    order; an order that had none gets them when it joins a cycle past its cutoff. Moving LATER changes the promised
--    window through the INV-6 path, with a customer-visible event (D-008). Moving EARLIER changes nothing the
--    customer sees yet.
--  - confirm_move_shipped(move): the admin confirms the piece really left with that export. For an earlier move, the
--    customer is then offered the earlier window for pricing_settings.fast_offer_cents (D-064); while that is unset,
--    no offer is made.
--  - accept_fast_offer(move, payment_intent): service only, after the server verified the payment with Stripe. The
--    window moves to the one offered.
--  - When the order ships in the US, an open offer lapses and a customer who did not take it is told it came sooner.
--  - store_my_order() and guest_order_lookup() add 'offer' (price and window only, D-003).
-- =============================================================================

alter table public.pricing_settings
  add column fast_offer_cents integer check (fast_offer_cents > 0);

create type public.move_offer_status as enum ('none', 'offered', 'accepted', 'lapsed');

create table public.order_moves (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_cycle_id uuid not null references public.cycles (id) on delete restrict,
  to_cycle_id uuid not null references public.cycles (id) on delete restrict,
  earlier boolean not null,
  note text,
  moved_by uuid references public.profiles (id) on delete set null,
  moved_at timestamptz not null default now(),
  shipped_confirmed_at timestamptz,
  offer_status public.move_offer_status not null default 'none',
  offer_cents integer check (offer_cents > 0),
  offer_from date,
  offer_to date,
  payment_intent_id text unique,
  decided_at timestamptz,
  constraint order_moves_cycles_differ check (from_cycle_id <> to_cycle_id),
  constraint order_moves_offer_complete check (
    offer_status = 'none' or (offer_cents is not null and offer_from is not null and offer_to >= offer_from))
);
create index order_moves_order_idx on public.order_moves (order_id);
create index order_moves_to_cycle_idx on public.order_moves (to_cycle_id);

alter table public.order_moves enable row level security;
create policy admin_read on public.order_moves for select to authenticated using (public.is_admin());
revoke all on public.order_moves from anon, authenticated;
grant select on public.order_moves to authenticated;   -- writes only through the functions below

-- The window an order would get from a cycle (its own shipping method's days, D-041).
create function public._window_from(p_order public.orders, p_cycle public.cycles)
returns table (est_from date, est_to date)
language sql stable security definer set search_path = public, pg_temp as $$
  select p_cycle.est_arrival_on + case when p_order.shipping_method = 'express'
                                       then coalesce(s.express_days_min, s.domestic_days_min) else s.domestic_days_min end,
         p_cycle.est_arrival_on + case when p_order.shipping_method = 'express'
                                       then coalesce(s.express_days_max, s.domestic_days_max) else s.domestic_days_max end
  from public.pricing_settings s where s.id = 1;
$$;

-- INV-6: the only writer besides change_delivery_window(). Always leaves a customer-visible event.
create function public._set_window(p_order uuid, p_from date, p_to date, p_kind text, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform set_config('iwc.window_change', 'on', true);
  update public.orders set est_delivery_from = p_from, est_delivery_to = p_to where id = p_order;
  perform set_config('iwc.window_change', '', true);
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (p_order, p_kind, true, p_note, auth.uid());
end $$;

create function public.move_order(p_order uuid, p_to_cycle uuid, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_from public.cycles;
  v_to public.cycles;
  v_earlier boolean;
  v_has_pickups boolean;
  v_status public.order_status;
  v_window record;
  v_id uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order for update;
  if not found or v_order.status not in ('confirmed', 'collecting', 'packed') then
    raise exception 'order_cannot_move' using errcode = 'P0001';
  end if;
  select * into v_from from public.cycles where id = v_order.cycle_id;
  select * into v_to from public.cycles where id = p_to_cycle for update;
  if not found or v_to.status not in ('open', 'collecting', 'packed') then
    raise exception 'cycle_not_accepting' using errcode = 'P0001';
  end if;
  if v_to.id = v_from.id then
    raise exception 'same_cycle' using errcode = 'P0001';
  end if;
  v_earlier := v_to.cutoff_at < v_from.cutoff_at;

  -- The pieces follow the order: moved if already on a pickup list, created if it joins a cycle past its cutoff.
  update public.pickups set cycle_id = v_to.id
   where order_item_id in (select id from public.order_items where order_id = p_order);
  v_has_pickups := found;
  if not v_has_pickups and v_to.status <> 'open' then
    insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
    select oi.id, v_to.id, p.vendor_id, oi.variant_id, oi.quantity, p.shop_price_paise
    from public.order_items oi join public.products p on p.id = oi.product_id
    where oi.order_id = p_order and oi.status = 'active';
    v_has_pickups := true;
  end if;

  -- Its status follows the cycle, so advance_cycle() carries it from here.
  v_status := case v_to.status
                when 'open' then case when v_has_pickups then 'collecting' else 'confirmed' end
                else v_to.status::text
              end::public.order_status;
  update public.orders set cycle_id = v_to.id, status = v_status where id = p_order;
  if v_order.status = 'confirmed' and v_status <> 'confirmed' then
    insert into public.order_events (order_id, kind, visible_to_customer) values (p_order, 'preparing', true);
  end if;

  -- Later: the promised window can no longer hold, so it changes, visibly (D-008, INV-6).
  if not v_earlier then
    select * into v_window from public._window_from(v_order, v_to);
    if v_window.est_to > v_order.est_delivery_to then
      perform public._set_window(p_order, v_window.est_from, v_window.est_to, 'delivery_window_changed', p_note);
    end if;
  end if;

  insert into public.order_moves (order_id, from_cycle_id, to_cycle_id, earlier, note, moved_by)
  values (p_order, v_from.id, v_to.id, v_earlier, p_note, auth.uid())
  returning id into v_id;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (p_order, 'moved_to_cycle', false, v_from.code || ' → ' || v_to.code, auth.uid());
  return v_id;
end $$;

create function public.confirm_move_shipped(p_move uuid)
returns public.move_offer_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_move public.order_moves;
  v_order public.orders;
  v_to public.cycles;
  v_price integer;
  v_window record;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select * into v_move from public.order_moves where id = p_move for update;
  if not found or v_move.shipped_confirmed_at is not null then
    raise exception 'move_not_pending' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = v_move.order_id for update;
  if v_order.cycle_id <> v_move.to_cycle_id then
    raise exception 'move_superseded' using errcode = 'P0001';
  end if;
  select * into v_to from public.cycles where id = v_move.to_cycle_id;
  if v_to.status not in ('exported', 'arrived', 'fulfilling', 'closed') then
    raise exception 'cycle_not_exported' using errcode = 'P0001';
  end if;

  update public.order_moves set shipped_confirmed_at = now() where id = p_move;

  -- D-064: an earlier window is offered for the discounted price, only once it is real and only if it is set.
  select fast_offer_cents into v_price from public.pricing_settings where id = 1;
  select * into v_window from public._window_from(v_order, v_to);
  if v_move.earlier and v_price is not null and v_window.est_to < v_order.est_delivery_to
     and v_order.status not in ('shipped', 'delivered', 'cancelled', 'refunded') then
    update public.order_moves
       set offer_status = 'offered', offer_cents = v_price, offer_from = v_window.est_from, offer_to = v_window.est_to
     where id = p_move;
    insert into public.order_events (order_id, kind, visible_to_customer) values (v_order.id, 'faster_delivery_offer', true);
    return 'offered';
  end if;
  return 'none';
end $$;

-- Service only: the server calls this after Stripe confirmed the payment for the offer (and refunds if it raises).
create function public.accept_fast_offer(p_move uuid, p_payment_intent text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_move public.order_moves;
begin
  select * into v_move from public.order_moves where id = p_move for update;
  if not found or v_move.offer_status <> 'offered' then
    raise exception 'offer_not_open' using errcode = 'P0001';
  end if;
  update public.order_moves set offer_status = 'accepted', payment_intent_id = p_payment_intent, decided_at = now()
   where id = p_move;
  perform public._set_window(v_move.order_id, v_move.offer_from, v_move.offer_to, 'faster_delivery_accepted', null);
end $$;

-- When the order ships in the US: an open offer lapses; a customer who did not take it hears it came sooner (D-064).
create function public._moves_on_shipped() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from public.order_moves
             where order_id = new.id and earlier and shipped_confirmed_at is not null and offer_status <> 'accepted') then
    update public.order_moves set offer_status = 'lapsed', decided_at = now()
     where order_id = new.id and offer_status = 'offered';
    insert into public.order_events (order_id, kind, visible_to_customer) values (new.id, 'arriving_sooner', true);
  end if;
  return new;
end $$;

create trigger orders_moves_on_shipped
  after update of status on public.orders
  for each row when (new.status = 'shipped' and old.status is distinct from 'shipped')
  execute function public._moves_on_shipped();

-- -----------------------------------------------------------------------------
-- What the customer sees of an open offer: its price and window, nothing else (D-003).
-- -----------------------------------------------------------------------------
create function public._order_offer(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('price_cents', m.offer_cents, 'est_delivery_from', m.offer_from,
                            'est_delivery_to', m.offer_to)
  from public.order_moves m
  where m.order_id = p_order and m.offer_status = 'offered'
  order by m.moved_at desc
  limit 1;
$$;

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
    'offer', public._order_offer(o.id)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

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
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb),
    'offer', public._order_offer(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public._window_from(public.orders, public.cycles), public._set_window(uuid, date, date, text, text),
  public.move_order(uuid, uuid, text), public.confirm_move_shipped(uuid), public.accept_fast_offer(uuid, text),
  public._moves_on_shipped(), public._order_offer(uuid) from public, anon, authenticated;
grant execute on function public.move_order(uuid, uuid, text), public.confirm_move_shipped(uuid) to authenticated;
grant execute on function public._window_from(public.orders, public.cycles), public._set_window(uuid, date, date, text, text),
  public.move_order(uuid, uuid, text), public.confirm_move_shipped(uuid), public.accept_fast_offer(uuid, text),
  public._order_offer(uuid) to service_role;
