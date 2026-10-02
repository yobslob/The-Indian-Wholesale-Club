-- =============================================================================
-- C4, cycles close and open by themselves (flows.md §1, D-045, D-063, D-065):
--  - pricing_settings.cycle_days: the days between two cutoffs (D-063). Never defaulted (D-047); while it is unset
--    the next cycle copies the gap between the last two cutoffs.
--  - _next_cycle_dates(cycle): the next cycle's cutoff, estimated export and estimated arrival, each moved forward by
--    that step (again, if the result is already in the past). No row when there is nothing to copy from.
--  - roll_cycles(): an open cycle past its cutoff closes (pickups created, as an admin cutoff does) and the next one
--    opens with those dates. Run every minute by pg_cron, and first thing in create_order, so no order ever joins a
--    cycle after its cutoff, whatever the timer does. An admin's cutoff opens the next cycle the same way, and records
--    the real closing time as the cutoff.
--  - The storefront and checkout show the cycle an order would really join: the open one, or, in the minute between
--    its cutoff and the roll, the one that is about to open (D-008: the window shown is the window stored).
--  - create_order (D-065): a payment priced before a cutoff that lands just after it joins the cycle that just closed,
--    with its pickups, while that cycle is still collecting; later than that it is refused ('cycle_closed') and the
--    server refunds it, because the window shown can no longer be kept.
-- =============================================================================

alter table public.pricing_settings
  add column cycle_days integer check (cycle_days between 1 and 90);

-- -----------------------------------------------------------------------------
-- The next cycle's dates (D-063)
-- -----------------------------------------------------------------------------
create function public._next_cycle_dates(p_cycle public.cycles)
returns table (cutoff_at timestamptz, est_export_on date, est_arrival_on date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_step interval;
  v_steps integer;
begin
  select make_interval(days => s.cycle_days) into v_step from public.pricing_settings s where s.id = 1;
  if v_step is null then
    select p_cycle.cutoff_at - c.cutoff_at into v_step
    from public.cycles c
    where c.cutoff_at < p_cycle.cutoff_at and c.id <> p_cycle.id
    order by c.cutoff_at desc
    limit 1;
  end if;
  if v_step is null or v_step < interval '1 day' then
    return;
  end if;

  -- One step, or as many as it takes to land in the future (D-063 interpretation).
  v_steps := greatest(1, floor(extract(epoch from now() - p_cycle.cutoff_at) / extract(epoch from v_step))::integer + 1);
  return query select p_cycle.cutoff_at + v_step * v_steps,
                      (p_cycle.est_export_on + v_step * v_steps)::date,
                      (p_cycle.est_arrival_on + v_step * v_steps)::date;
end $$;

-- The cycle a new order would join right now (see the header).
create function public._store_cycle()
returns table (cutoff_at timestamptz, est_arrival_on date)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.cutoff_at, c.est_arrival_on from public.cycles c where c.status = 'open' and c.cutoff_at > now()
  union all
  select n.cutoff_at, n.est_arrival_on
  from public.cycles c
  cross join lateral public._next_cycle_dates(c) n
  where c.status = 'open' and c.cutoff_at <= now()
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Closing and opening
-- -----------------------------------------------------------------------------

-- flows.md §4 step 1, without the caller check (callers check). The cutoff becomes the real closing time.
create function public._cutoff_cycle(p_cycle uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  update public.cycles set status = 'collecting', cutoff_at = least(cutoff_at, now())
   where id = p_cycle and status = 'open';
  if not found then
    raise exception 'cycle_not_open' using errcode = 'P0001';
  end if;

  insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
  select oi.id, p_cycle, p.vendor_id, oi.variant_id, oi.quantity, p.shop_price_paise
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where o.cycle_id = p_cycle and o.status = 'confirmed' and oi.status = 'active';
  get diagnostics v_count = row_count;

  update public.orders set status = 'collecting' where cycle_id = p_cycle and status = 'confirmed';

  insert into public.order_events (order_id, kind, visible_to_customer)
  select id, 'preparing', true from public.orders where cycle_id = p_cycle and status = 'collecting'
    and not exists (select 1 from public.order_events e where e.order_id = orders.id and e.kind = 'preparing');

  return v_count;
end $$;

-- Opens the cycle after p_cycle with its dates moved forward (D-063). Returns the new id, or null when there is
-- nothing to copy the step from or a cycle is already open (INV-5).
create function public._open_next_cycle(p_cycle uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_from public.cycles;
  v_next record;
  v_code text;
  v_n integer := 1;
  v_id uuid;
begin
  select * into v_from from public.cycles where id = p_cycle;
  if not found or exists (select 1 from public.cycles where status = 'open') then
    return null;
  end if;
  select * into v_next from public._next_cycle_dates(v_from);
  if not found then
    return null;
  end if;

  v_code := to_char(v_next.cutoff_at at time zone 'UTC', 'YYYY-MM-DD');
  while exists (select 1 from public.cycles where code = v_code) loop
    v_n := v_n + 1;
    v_code := to_char(v_next.cutoff_at at time zone 'UTC', 'YYYY-MM-DD') || '-' || v_n;
  end loop;

  insert into public.cycles (code, status, cutoff_at, est_export_on, est_arrival_on, notes)
  values (v_code, 'open', v_next.cutoff_at, v_next.est_export_on, v_next.est_arrival_on,
          'Opened by itself when ' || v_from.code || ' closed (D-063). Check the dates.')
  returning id into v_id;
  return v_id;
end $$;

-- Closes the open cycle once its cutoff has passed and opens the next. Returns how many cycles closed (0 or 1).
create function public.roll_cycles()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  select id into v_id from public.cycles where status = 'open' and cutoff_at <= now() for update;
  if not found then
    return 0;
  end if;
  perform public._cutoff_cycle(v_id);
  perform public._open_next_cycle(v_id);
  return 1;
end $$;

-- An admin's cutoff (flows.md §4 step 1) now also opens the next cycle (D-045).
create or replace function public.cutoff_cycle(p_cycle uuid)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_count integer;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  v_count := public._cutoff_cycle(p_cycle);
  perform public._open_next_cycle(p_cycle);
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- What customers see before paying (D-008, D-035)
-- -----------------------------------------------------------------------------
create or replace function public.store_next_delivery()
returns table (order_by timestamptz, est_delivery_from date, est_delivery_to date)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.cutoff_at,
         c.est_arrival_on + s.domestic_days_min,
         c.est_arrival_on + s.domestic_days_max
  from public._store_cycle() c
  cross join public.pricing_settings s
  where s.domestic_days_min is not null
    and s.domestic_days_max is not null;
$$;

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
      from public._store_cycle() c cross join public.pricing_settings s
      where s.id = 1
        and s.express_shipping_cents is not null
        and s.express_days_min is not null and s.express_days_max is not null)
  );
$$;

-- -----------------------------------------------------------------------------
-- create_order: as in migration 4, plus the roll and the late payment (D-065)
-- -----------------------------------------------------------------------------
create or replace function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cycle public.cycles%rowtype;
  v_shown public.cycles%rowtype;
  v_priced_at timestamptz;
  v_late boolean := false;
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
  -- Never join a cycle after its cutoff, even if the timer has not run yet.
  perform public.roll_cycles();

  select * into v_cycle from public.cycles where status = 'open' for update;
  if not found then
    raise exception 'no_open_cycle' using errcode = 'P0001';
  end if;

  -- D-065: the cycle whose window the customer saw is the first to close after they were priced.
  select created_at into v_priced_at from public.pending_orders
   where payment_intent_id = p_order ->> 'payment_intent_id';
  if v_priced_at is not null then
    select * into v_shown from public.cycles where cutoff_at > v_priced_at order by cutoff_at limit 1 for update;
    if found and v_shown.id <> v_cycle.id then
      if v_shown.status <> 'collecting' then
        raise exception 'cycle_closed' using errcode = 'P0001';
      end if;
      v_cycle := v_shown;
      v_late := true;
    end if;
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

  -- D-065: joining a cycle that is already collecting means its pieces join the pickup list now.
  if v_late then
    insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
    select oi.id, v_cycle.id, p.vendor_id, oi.variant_id, oi.quantity, p.shop_price_paise
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id;
    update public.orders set status = 'collecting' where id = v_order.id;
    insert into public.order_events (order_id, kind, visible_to_customer)
    values (v_order.id, 'preparing', true);
  end if;

  return query select v_order.id, v_order.order_number;
end $$;

-- -----------------------------------------------------------------------------
-- Privileges: the helpers and the roll are internal (service role and the scheduler only).
-- -----------------------------------------------------------------------------
revoke all on function public._next_cycle_dates(public.cycles), public._store_cycle(), public._cutoff_cycle(uuid),
  public._open_next_cycle(uuid), public.roll_cycles() from public, anon, authenticated;
grant execute on function public._next_cycle_dates(public.cycles), public._store_cycle(), public._cutoff_cycle(uuid),
  public._open_next_cycle(uuid), public.roll_cycles() to service_role;

-- -----------------------------------------------------------------------------
-- The timer: every minute (where pg_cron exists: local Supabase and hosted; skipped elsewhere).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('iwc-roll-cycles', '* * * * *', 'select public.roll_cycles()');
  end if;
end $$;
