-- =============================================================================
-- Sales tax by delivery state (D-073, replaces D-033's flat 8%) and express by courier (D-070).
--  - tax_rates: one row per state where IWC is registered, with which tax classes it taxes. No row = no tax. New
--    Jersey (registered) taxes general goods at 6.625% and exempts clothing, footwear and food.
--  - checkout_context(variant_ids, promo, state): adds each variant's tax class and courier cost (never its weight,
--    INV-1), the state's tax rule, and express as courier pricing (per order + the pieces' courier costs, at least
--    the minimum) with a window counted from today (D-048, D-070). Replaces the two-argument version.
--  - Express orders leave the cycle: no cycle, a window from the order date, pickups created at once (pickups.cycle_id
--    is now optional), shipped by courier from India (ship_order allows it once every piece is picked). The cutoff,
--    the export documents and the arrival check-off only see cycle pickups.
--  - Cancelling refunds the tax (D-073; D-042's "we keep the tax" is not lawful where tax was collected).
-- =============================================================================

create table public.tax_rates (
  state char(2) primary key check (state = upper(state)),
  rate_pct numeric(6, 3) not null check (rate_pct between 0 and 20),
  taxes_clothing boolean not null default false,
  taxes_food boolean not null default false,
  taxes_general boolean not null default true,
  source text not null,
  checked_on date not null
);
alter table public.tax_rates enable row level security;
create policy admin_all on public.tax_rates for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.tax_rates from anon, authenticated;
grant select, insert, update, delete on public.tax_rates to authenticated;

insert into public.tax_rates (state, rate_pct, taxes_clothing, taxes_food, taxes_general, source, checked_on) values
  ('NJ', 6.625, false, false, true,
   'New Jersey 6.625%, no local rates; clothing, footwear and most food are exempt (NJ Division of Taxation; '
   || 'TaxCloud 2026). IWC is registered here (D-073). Confirm with an accountant.', date '2026-10-06');

-- -----------------------------------------------------------------------------
-- Checkout context
-- -----------------------------------------------------------------------------
drop function public.checkout_context(uuid[], text);
create function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null, p_state text default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path,
               'tax_class', c.tax_class,
               -- What the courier charges to carry one piece (express, D-070): a price, never the weight itself (INV-1).
               'courier_cents', ceil(coalesce(pv.weight_g, c.default_weight_g, 1000) / 1000.0
                                     * coalesce((select s.express_courier_cents_per_kg from public.pricing_settings s
                                                 where s.id = 1), 0))::integer)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      join public.product_variants pv on pv.id = v.id
      join public.products pr on pr.id = p.id
      join public.categories c on c.id = pr.category_id
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
    'tax', (
      select jsonb_build_object('state', t.state, 'rate_pct', t.rate_pct, 'taxes_clothing', t.taxes_clothing,
                                'taxes_food', t.taxes_food, 'taxes_general', t.taxes_general)
      from public.tax_rates t where t.state = upper(trim(p_state))),
    'express', (
      select jsonb_build_object('base_cents', s.express_base_cents,
                                'min_courier_cents', ceil(s.express_min_kg * s.express_courier_cents_per_kg)::integer,
                                'est_delivery_from', current_date + s.express_days_min,
                                'est_delivery_to', current_date + s.express_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.express_base_cents is not null and s.express_courier_cents_per_kg is not null
        and s.express_min_kg is not null and s.express_days_min is not null and s.express_days_max is not null)
  );
$$;
revoke all on function public.checkout_context(uuid[], text, text) from public, anon, authenticated;
grant execute on function public.checkout_context(uuid[], text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Express orders leave the cycle (D-070)
-- -----------------------------------------------------------------------------
alter table public.pickups alter column cycle_id drop not null;

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
  v_from date;
  v_to date;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
begin
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;

  if v_method = 'express' then
    -- Courier from Mumbai to the door, outside the cycle: the window counts from today.
    if v_settings.express_days_min is null or v_settings.express_days_max is null
       or v_settings.express_base_cents is null or v_settings.express_courier_cents_per_kg is null then
      raise exception 'express_unavailable' using errcode = 'P0001';
    end if;
    v_from := current_date + v_settings.express_days_min;
    v_to := current_date + v_settings.express_days_max;
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
    case when v_method = 'express' then null else v_cycle.id end,
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

  -- Express (D-070), or a late payment joining a collecting cycle (D-065): the pieces go on a pickup list now.
  if v_method = 'express' or v_late then
    insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
    select oi.id, case when v_method = 'express' then null else v_cycle.id end, p.vendor_id, oi.variant_id,
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
end $$;

-- An express order ships by courier from India once every piece is picked (no cycle, no arrival); others as before.
create or replace function public.ship_order(p_order uuid, p_carrier text, p_tracking text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_carrier, ''))) not between 2 and 40
     or length(btrim(coalesce(p_tracking, ''))) not between 4 and 60 then
    raise exception 'invalid_tracking' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'order_not_arrived' using errcode = 'P0001';
  end if;
  if v_order.shipping_method = 'express' and v_order.cycle_id is null then
    if v_order.status not in ('confirmed', 'collecting') or exists (
         select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
         where oi.order_id = p_order and oi.status = 'active' and p.status = 'pending') then
      raise exception 'express_not_picked' using errcode = 'P0001';
    end if;
  elsif v_order.status <> 'arrived' then
    raise exception 'order_not_arrived' using errcode = 'P0001';
  end if;
  update public.orders set status = 'shipped', carrier = btrim(p_carrier), tracking_number = btrim(p_tracking)
   where id = p_order;
  insert into public.order_events (order_id, kind, visible_to_customer, actor)
  values (p_order, 'shipped', true, auth.uid());
end $$;

-- D-073: a cancelled order gets its tax back too (both reasons); the founder's cancel fee comes with D-072's rules.
create or replace function public._cancel_refund_cents(p_order uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_reason in ('customer_request', 'our_fault') then o.total_cents - o.refunded_cents end
  from public.orders o where o.id = p_order;
$$;
