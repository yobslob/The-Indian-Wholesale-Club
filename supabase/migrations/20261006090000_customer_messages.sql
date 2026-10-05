-- =============================================================================
-- C5, customer messages (flows.md §7, §7b, §8; D-008, D-042, B-20):
--  - Every customer-visible order update queues an email: a trigger on order_events adds an 'order_update' row to
--    email_outbox (the order confirmation keeps its own row, from the server). The email is built from the
--    customer-safe order shape only (D-003).
--  - The outbox is sent every minute by pg_cron through pg_net, calling the website's outbox job, once the founder
--    has stored the site URL and the job's secret in Supabase Vault (docs/ops.md). Without them it does nothing.
--  - Delays (D-008): after the delivery window changes, the customer may keep the order or cancel it for a full
--    refund until it ships in the US: keep_after_delay(), cancel_after_delay(). Their choice is an order event.
--  - Self-service cancel before cutoff (D-042): the website's server calls cancel_order() as the service role.
--  - store_my_order() and guest_order_lookup() add 'actions': what the customer may do now, with the amounts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Emails for order updates
-- -----------------------------------------------------------------------------
create function public._queue_order_email() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.email_outbox (kind, recipient, payload)
  select 'order_update', o.email, jsonb_build_object('orderNumber', o.order_number, 'eventId', new.id, 'kind', new.kind)
  from public.orders o where o.id = new.order_id;
  return new;
end $$;

create trigger order_events_queue_email
  after insert on public.order_events
  for each row when (new.visible_to_customer and new.kind <> 'order_confirmed')
  execute function public._queue_order_email();

-- -----------------------------------------------------------------------------
-- Refund amounts: one place for the rule (D-042), callable inside other functions without the caller check.
-- -----------------------------------------------------------------------------
create function public._cancel_refund_cents(p_order uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case p_reason
           when 'customer_request' then greatest(o.total_cents - o.tax_cents - o.refunded_cents, 0)
           when 'our_fault' then o.total_cents - o.refunded_cents
         end
  from public.orders o where o.id = p_order;
$$;

create or replace function public.cancel_refund_cents(p_order uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select public._cancel_refund_cents(p_order, p_reason)
  where public.is_admin() or coalesce(auth.role(), '') = 'service_role';
$$;

-- -----------------------------------------------------------------------------
-- Delays (D-008): open from a window change until the customer decides or the order ships.
-- -----------------------------------------------------------------------------
create function public._delay_open(p_order uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select o.status in ('confirmed', 'collecting', 'packed', 'in_transit', 'arrived')
           and (select e.kind from public.order_events e
                where e.order_id = o.id and e.kind in ('delivery_window_changed', 'delay_kept')
                order by e.created_at desc, (e.kind = 'delay_kept') desc
                limit 1) = 'delivery_window_changed'
    from public.orders o where o.id = p_order), false);
$$;

create function public.keep_after_delay(p_order uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  perform 1 from public.orders where id = p_order for update;
  if not public._delay_open(p_order) then
    raise exception 'no_open_delay' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (p_order, 'delay_kept', false, 'the customer keeps the order with the new estimate');
end $$;

-- A delay is our fault, so everything is refunded (D-042). Pieces not collected yet go back to stock; pieces already
-- collected stay with IWC and are flagged for the admin (what happens to them is Q-31).
create function public.cancel_after_delay(p_order uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected integer;
  v_item record;
  v_kept integer := 0;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  perform 1 from public.orders where id = p_order for update;
  if not public._delay_open(p_order) then
    raise exception 'no_open_delay' using errcode = 'P0001';
  end if;
  v_expected := public._cancel_refund_cents(p_order, 'our_fault');
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;

  for v_item in select oi.id, oi.variant_id, oi.quantity, p.id as pickup_id, p.status as pickup_status
                from public.order_items oi left join public.pickups p on p.order_item_id = oi.id
                where oi.order_id = p_order and oi.status = 'active' and oi.variant_id is not null
  loop
    if v_item.pickup_status is null or v_item.pickup_status = 'pending' then
      delete from public.pickups where id = v_item.pickup_id;
      perform public._set_stock_context('released', 'order', p_order, 'cancelled after a delay');
      update public.product_variants set qty_reserved = qty_reserved - v_item.quantity where id = v_item.variant_id;
      perform public._set_stock_context(null, null, null, null);
    else
      v_kept := v_kept + v_item.quantity;
    end if;
  end loop;
  update public.order_items set status = 'refunded' where order_id = p_order and status <> 'refunded';

  update public.orders
     set status = 'cancelled',
         refunded_cents = refunded_cents + p_amount_cents,
         payment_status = case when refunded_cents + p_amount_cents = total_cents
                               then 'refunded' else 'partially_refunded' end::public.payment_status
   where id = p_order;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (p_order, 'order_cancelled', true, 'cancelled after a delay, refund ' || coalesce(p_refund_ref, '?'));
  if v_kept > 0 then
    insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
    values (p_order, 'note', false, v_kept || ' collected piece(s) stay with us: decide what to do with them (Q-31)');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- What the customer may do on their order now (shown on the order page, website and app)
-- -----------------------------------------------------------------------------
create function public._order_actions(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'can_cancel', o.status = 'confirmed',
    'cancel_refund_cents', case when o.status = 'confirmed'
                                then public._cancel_refund_cents(o.id, 'customer_request') end,
    'delay_open', public._delay_open(o.id),
    'delay_refund_cents', case when public._delay_open(o.id) then public._cancel_refund_cents(o.id, 'our_fault') end)
  from public.orders o where o.id = p_order;
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
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
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
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- -----------------------------------------------------------------------------
-- The outbox timer: every minute, if an email is due and the Vault holds the site URL and the job's secret.
-- -----------------------------------------------------------------------------
create function public._kick_email_outbox()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'pending' and next_attempt_at <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'iwc_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'iwc_outbox_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/internal/email-outbox',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule('iwc-email-outbox', '* * * * *', 'select public._kick_email_outbox()');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public._queue_order_email(), public._cancel_refund_cents(uuid, text), public._delay_open(uuid),
  public.keep_after_delay(uuid), public.cancel_after_delay(uuid, integer, text), public._order_actions(uuid),
  public._kick_email_outbox() from public, anon, authenticated;
grant execute on function public.keep_after_delay(uuid), public.cancel_after_delay(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public._cancel_refund_cents(uuid, text), public._delay_open(uuid), public._order_actions(uuid)
  to service_role;
