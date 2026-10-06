-- =============================================================================
-- After the sale (D-071 returns, D-072 cancels, US clearance stock). Every % and day is a setting (D-069).
--  - US clearance stock: products.is_us_stock marks pieces already in the US warehouse. An order of only such pieces
--    skips the cycle: it is 'arrived' at once (ready to ship), its window today + the US delivery days. The cutoff
--    makes no pickups for them. _to_clearance() turns a returned or cancelled piece into a US clearance listing (a
--    draft at the clearance discount, photos reused) that an admin publishes once the piece is in hand and checked.
--  - Cancel until the order leaves India (D-072): customer_cancel() for confirmed, collecting and packed orders (an
--    express order until its courier leaves). Everything back, minus a cancel fee once pieces are being collected (a
--    setting, 0 by default). Pieces not collected go back to the shop's stock; collected ones go to clearance.
--  - After it left India, only an admin cancels: admin_cancel_after_export() refunds all but the shipping deduction
--    (a setting) and every piece goes to clearance.
--  - Returns (D-071): request_return() (the customer, through the website's server) for a delivered piece: wrong or
--    damaged within the claim window = everything back, its share of shipping included; otherwise unworn pieces by
--    tier of days since delivery, the tier's % kept for fetching. Food is final sale. The amount is fixed when the
--    return is asked for. Admins mark it received (the piece goes to clearance), refunded (Stripe first) or rejected.
--  - _order_actions() tells the order page what the customer may do now, returns included.
-- =============================================================================

alter table public.pricing_settings
  add column cancel_fee_pct numeric(5, 2) check (cancel_fee_pct between 0 and 100),
  add column export_cancel_deduction_pct numeric(5, 2) check (export_cancel_deduction_pct between 0 and 100),
  add column return_claim_days integer check (return_claim_days > 0),
  add column return_tier1_days integer check (return_tier1_days > 0),
  add column return_tier1_pct numeric(5, 2) check (return_tier1_pct between 0 and 100),
  add column return_tier2_days integer check (return_tier2_days > 0),
  add column return_tier2_pct numeric(5, 2) check (return_tier2_pct between 0 and 100),
  add column return_tier3_days integer check (return_tier3_days > 0),
  add column return_tier3_pct numeric(5, 2) check (return_tier3_pct between 0 and 100),
  add column clearance_discount_pct numeric(5, 2) check (clearance_discount_pct between 0 and 95);

-- The new settings can carry placeholder labels too.
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct',
  'card_fee_pct', 'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg',
  'express_days_min', 'express_days_max', 'cycle_days', 'fast_offer_cents', 'cancel_fee_pct',
  'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
  'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct'));

create or replace function public._load_pricing_estimates(p_estimates jsonb, p_checked_on date)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item jsonb;
  v_settable boolean;
  v_filled integer := 0;
  v_allowed text[];
begin
  -- The settings that may carry a placeholder label: exactly the pricing_estimates check.
  select array_agg(m[1]) into v_allowed
  from regexp_matches(pg_get_constraintdef((select oid from pg_constraint
                                            where conname = 'pricing_estimates_setting_check')), '''([a-z0-9_]+)''', 'g') m;
  perform set_config('iwc.loading_estimates', 'on', true);
  for v_item in select value from jsonb_array_elements(p_estimates)
  loop
    if not (v_item ->> 'setting' = any (v_allowed)) then
      raise exception 'unknown_setting:%', v_item ->> 'setting' using errcode = 'P0001';
    end if;
    execute format('select %I is null from public.pricing_settings where id = 1', v_item ->> 'setting') into v_settable;
    v_settable := v_settable or exists (select 1 from public.pricing_estimates where setting = v_item ->> 'setting');
    if v_settable then
      execute format('update public.pricing_settings set %I = $1 where id = 1', v_item ->> 'setting')
        using (v_item ->> 'value')::numeric;
      insert into public.pricing_estimates (setting, source, source_url, checked_on)
      values (v_item ->> 'setting', v_item ->> 'source', v_item ->> 'url', p_checked_on)
      on conflict (setting) do update
        set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;
      v_filled := v_filled + 1;
    end if;
  end loop;
  perform set_config('iwc.loading_estimates', '', true);
  return v_filled;
end $$;

-- -----------------------------------------------------------------------------
-- US clearance stock
-- -----------------------------------------------------------------------------
alter table public.products add column is_us_stock boolean not null default false;

-- Same columns as before, is_us_stock appended (create or replace keeps grants and column order). Customers see
-- "ships now from the US", nothing about where it came from (D-003).
create or replace view public.store_products as
select p.id, p.slug, p.name, p.product_type,
       p.region_id, r.slug as region_slug, r.name as region_name,
       p.category_id, c.slug as category_slug, c.name as category_name,
       p.summary, p.description, p.story, p.craft, p.attributes, p.price_cents, p.published_at,
       (select m.storage_path from public.product_media m
         where m.product_id = p.id order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
       p.search,
       p.is_curated,
       p.is_us_stock
from public.products p
join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- A returned or cancelled piece becomes a clearance listing in the US: a draft (an admin publishes it once the piece is
-- in hand and checked), at the clearance discount off what the customer paid, rounded down to $x.99, photos reused.
create function public._to_clearance(p_item uuid, p_why text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item public.order_items;
  v_product public.products;
  v_discount numeric;
  v_price integer;
  v_slug text;
  v_id uuid;
  v_weight integer;
begin
  select * into v_item from public.order_items where id = p_item;
  select * into v_product from public.products where id = v_item.product_id;
  if v_product.id is null then
    return null;   -- the product was deleted: nothing to copy
  end if;
  select coalesce(clearance_discount_pct, 0) into v_discount from public.pricing_settings where id = 1;
  v_price := greatest(99, (floor(v_item.unit_price_cents * (1 - v_discount / 100) / 100) * 100 - 1)::integer);
  v_slug := left(v_product.slug, 70) || '-us-' || substr(md5(p_item::text), 1, 6);
  select weight_g into v_weight from public.product_variants where id = v_item.variant_id;

  insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, summary, description, story,
                               craft, attributes, price_cents, price_auto, shop_price_paise, origin_town,
                               has_origin_label, status, is_us_stock)
  values (v_slug, v_product.name, v_product.product_type, v_product.region_id, v_product.category_id,
          v_product.vendor_id, v_product.summary, v_product.description, v_product.story, v_product.craft,
          v_product.attributes, v_price, false, null, v_product.origin_town, v_product.has_origin_label, 'draft', true)
  returning id into v_id;
  insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at)
  select v_id, upper(v_slug) || '-1', v_item.variant_label, coalesce(v.options, '{}'::jsonb), v_weight, v_item.quantity, now()
  from (select 1) one left join public.product_variants v on v.id = v_item.variant_id;
  insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary)
  select v_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary
  from public.product_media m where m.product_id = v_product.id and m.variant_id is null;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (v_item.order_id, 'note', false,
          v_item.product_name || ' (' || v_item.variant_label || ') → US clearance draft ' || v_slug || ' (' || p_why || ')');
  return v_id;
end $$;

-- The cutoff makes no pickups for pieces already in the US.
create or replace function public._cutoff_cycle(p_cycle uuid)
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
  where o.cycle_id = p_cycle and o.status = 'confirmed' and oi.status = 'active' and not p.is_us_stock
    and not exists (select 1 from public.pickups x where x.order_item_id = oi.id);
  get diagnostics v_count = row_count;

  update public.orders set status = 'collecting' where cycle_id = p_cycle and status = 'confirmed';

  insert into public.order_events (order_id, kind, visible_to_customer)
  select id, 'preparing', true from public.orders where cycle_id = p_cycle and status = 'collecting'
    and not exists (select 1 from public.order_events e where e.order_id = orders.id and e.kind = 'preparing');

  return v_count;
end $$;

-- An order of only US clearance pieces is ready to ship at once (D-072's clearance sale): no cycle, no pickups.
create function public._us_stock_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_min integer;
  v_max integer;
begin
  select * into v_order from public.orders where id = new.order_id;
  if v_order.status <> 'confirmed' or v_order.shipping_method <> 'standard' then
    return null;
  end if;
  if exists (select 1 from public.order_items oi join public.products p on p.id = oi.product_id
             where oi.order_id = new.order_id and not p.is_us_stock) then
    return null;
  end if;
  select domestic_days_min, domestic_days_max into v_min, v_max from public.pricing_settings where id = 1;
  perform set_config('iwc.window_change', 'on', true);
  update public.orders
     set status = 'arrived', cycle_id = null,
         est_delivery_from = current_date + coalesce(v_min, 0), est_delivery_to = current_date + coalesce(v_max, 0)
   where id = new.order_id;
  perform set_config('iwc.window_change', '', true);
  return null;
end $$;
create trigger order_events_us_stock_order
  after insert on public.order_events
  for each row when (new.kind = 'order_confirmed')
  execute function public._us_stock_order();

-- The product page says when a US piece arrives (store_product_page as in migration 9, ships_from_us added).
create or replace function public.store_product_page(p_region_slug text, p_product_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'product', to_jsonb(p) - 'search' - 'is_curated',
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.sort_order, v.label)
      from public.store_variants v where v.product_id = p.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.sort_order)
      from public.store_media m where m.product_id = p.id), '[]'::jsonb),
    'similar', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.same_region desc, s.published_at desc nulls last, s.name)
      from (select o.id, o.published_at, o.name, (o.region_id = p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id = p.region_id) desc, o.published_at desc nulls last, o.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id = p.region_id and o.is_curated and o.id <> p.id
            order by o.published_at desc nulls last, o.name limit 12) c), '[]'::jsonb),
    'reviews', jsonb_build_object(
      'count', (select count(*) from public.store_reviews r where r.product_id = p.id),
      'average', (select round(avg(r.rating), 1) from public.store_reviews r where r.product_id = p.id),
      'histogram', (select jsonb_build_object(
                      '5', count(*) filter (where r.rating = 5), '4', count(*) filter (where r.rating = 4),
                      '3', count(*) filter (where r.rating = 3), '2', count(*) filter (where r.rating = 2),
                      '1', count(*) filter (where r.rating = 1))
                    from public.store_reviews r where r.product_id = p.id),
      'items', coalesce((
        select jsonb_agg(to_jsonb(r) || jsonb_build_object('photos', coalesce((
                 select jsonb_agg(ph.storage_path order by ph.sort_order)
                 from public.store_review_photos ph where ph.review_id = r.id), '[]'::jsonb))
               order by r.created_at desc)
        from (select * from public.store_reviews r where r.product_id = p.id
              order by r.created_at desc limit 6) r), '[]'::jsonb)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    -- A piece already in the US ships at once: its window is today + the US delivery days, not the cycle's.
    'ships_from_us', case when p.is_us_stock then (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null) end
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$function$
;

-- -----------------------------------------------------------------------------
-- Cancels (D-072)
-- -----------------------------------------------------------------------------
-- Still in India: the export has not left (an express order: its courier has not left).
create function public._in_india(p_order public.orders)
returns boolean
language sql immutable as $$
  select case when p_order.shipping_method = 'express' and p_order.cycle_id is null
              then p_order.status in ('confirmed', 'collecting')            -- the courier has not left
              else p_order.status in ('confirmed', 'collecting', 'packed')  -- the export has not left
         end;
$$;

-- The customer's own cancel amount: everything back, minus the cancel fee once pieces are being collected.
create function public._customer_cancel_cents(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select o.total_cents - o.refunded_cents
         - case when o.status = 'confirmed' and not exists (
                  select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                  where oi.order_id = o.id and p.status = 'picked')
                then 0
                else round((o.subtotal_cents - o.discount_cents) * coalesce(s.cancel_fee_pct, 0) / 100)::integer end
  from public.orders o cross join public.pricing_settings s
  where o.id = p_order and s.id = 1;
$$;

-- Releases what an order still holds: pending pickups and reservations go back to the shop's stock; picked pieces go
-- to US clearance. Every active line becomes refunded.
create function public._unwind_order_pieces(p_order uuid, p_why text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item record;
begin
  for v_item in select oi.id, oi.variant_id, oi.quantity, p.id as pickup_id, p.status as pickup_status,
                       pr.is_us_stock
                from public.order_items oi
                left join public.pickups p on p.order_item_id = oi.id
                left join public.products pr on pr.id = oi.product_id
                where oi.order_id = p_order and oi.status = 'active' and oi.variant_id is not null
  loop
    if v_item.pickup_status = 'picked' then
      perform public._to_clearance(v_item.id, p_why);
    else
      delete from public.pickups where id = v_item.pickup_id;
      perform public._set_stock_context('released', 'order', p_order, p_why);
      update public.product_variants set qty_reserved = qty_reserved - v_item.quantity where id = v_item.variant_id;
      perform public._set_stock_context(null, null, null, null);
    end if;
  end loop;
  update public.order_items set status = 'refunded' where order_id = p_order and status <> 'refunded';
end $$;

create function public._record_cancel(p_order uuid, p_amount integer, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.orders
     set status = 'cancelled',
         refunded_cents = refunded_cents + p_amount,
         payment_status = case when refunded_cents + p_amount >= total_cents then 'refunded'
                               when refunded_cents + p_amount > 0 then 'partially_refunded'
                               else payment_status end::public.payment_status
   where id = p_order;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (p_order, 'order_cancelled', true, p_note);
end $$;

-- The customer's cancel, through the website's server (number + email checked there), until the order leaves India.
create function public.customer_cancel(p_order uuid, p_amount_cents integer, p_refund_ref text)
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
  v_expected := public._customer_cancel_cents(p_order);
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  perform public._unwind_order_pieces(p_order, 'cancelled by the customer before leaving India');
  perform public._record_cancel(p_order, p_amount_cents, 'customer cancel, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- After it left India: customer care only (an admin), the shipping deduction kept, the pieces to clearance.
create function public.admin_cancel_after_export_cents(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, o.total_cents - o.refunded_cents
                     - round((o.subtotal_cents - o.discount_cents) * coalesce(s.export_cancel_deduction_pct, 0) / 100)::integer)
  from public.orders o cross join public.pricing_settings s
  where o.id = p_order and s.id = 1 and public.is_admin()
    and o.status in ('in_transit', 'arrived', 'shipped') and not public._in_india(o);
$$;

create function public.admin_cancel_after_export(p_order uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_expected integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  v_expected := public.admin_cancel_after_export_cents(p_order);
  if v_expected is null then
    raise exception 'order_still_in_india_or_done' using errcode = 'P0001';
  end if;
  if p_amount_cents is distinct from v_expected then
    raise exception 'refund_amount_mismatch:%', v_expected using errcode = 'P0001';
  end if;
  perform public._unwind_order_pieces(p_order, 'cancelled after leaving India');
  perform public._record_cancel(p_order, p_amount_cents, 'cancelled after leaving India, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- A delay cancel (D-008) sends collected pieces to clearance too (D-072, was Q-31).
create or replace function public.cancel_after_delay(p_order uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected integer;
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
  perform public._unwind_order_pieces(p_order, 'cancelled after a delay');
  perform public._record_cancel(p_order, p_amount_cents, 'cancelled after a delay, refund ' || coalesce(p_refund_ref, '?'));
end $$;

-- -----------------------------------------------------------------------------
-- Returns (D-071)
-- -----------------------------------------------------------------------------
create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null unique references public.order_items (id) on delete cascade,
  reason text not null check (reason in ('damaged', 'wrong', 'changed_mind')),
  status text not null default 'requested' check (status in ('requested', 'received', 'refunded', 'rejected')),
  refund_cents integer not null check (refund_cents >= 0),
  kept_pct numeric(5, 2) not null default 0,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  refund_ref text,
  note text
);
create index returns_status_idx on public.returns (status, requested_at);
alter table public.returns enable row level security;
create policy admin_all on public.returns for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.returns from anon, authenticated;
grant select on public.returns to authenticated;   -- writes only through the functions below

create function public._delivered_at(p_order uuid)
returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select max(created_at) from public.order_events where order_id = p_order and kind = 'delivered';
$$;

-- What a return of this piece would refund now, and the % kept; null when it can't be returned (anymore).
create function public._return_quote(p_item uuid, p_reason text)
returns table (refund_cents integer, kept_pct numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_item public.order_items;
  v_order public.orders;
  v_type public.product_type;
  v_days numeric;
  v_goods numeric;
  v_base numeric;
  v_shipping numeric;
  v_kept numeric;
begin
  select * into s from public.pricing_settings where id = 1;
  select * into v_item from public.order_items where id = p_item;
  select * into v_order from public.orders where id = v_item.order_id;
  select product_type into v_type from public.products where id = v_item.product_id;
  if v_item.status <> 'active' or v_order.status <> 'delivered' or public._delivered_at(v_order.id) is null
     or exists (select 1 from public.returns r where r.order_item_id = p_item) then
    return;
  end if;
  v_days := extract(epoch from now() - public._delivered_at(v_order.id)) / 86400;
  -- The piece's price after its share of the discount, plus its share of the tax (as item_refund_cents).
  v_goods := v_item.total_price_cents
             - case when v_order.subtotal_cents > 0
                    then v_order.discount_cents::numeric * v_item.total_price_cents / v_order.subtotal_cents else 0 end;
  v_base := v_goods + case when v_order.subtotal_cents - v_order.discount_cents + v_order.shipping_cents > 0
                           then v_order.tax_cents * v_goods
                                / (v_order.subtotal_cents - v_order.discount_cents + v_order.shipping_cents)
                           else 0 end;
  v_shipping := case when v_order.subtotal_cents - v_order.discount_cents > 0
                     then v_order.shipping_cents * v_goods / (v_order.subtotal_cents - v_order.discount_cents) else 0 end;

  if p_reason in ('damaged', 'wrong') then
    if s.return_claim_days is null or v_days > s.return_claim_days then
      return;
    end if;
    refund_cents := least(round(v_base + v_shipping)::integer, v_order.total_cents - v_order.refunded_cents);
    kept_pct := 0;
    return next;
    return;
  end if;
  -- A change of mind: unworn clothing only (food is final sale), by tier of days since delivery.
  if p_reason <> 'changed_mind' or v_type <> 'clothing' then
    return;
  end if;
  v_kept := case when v_days <= s.return_tier1_days then s.return_tier1_pct
                 when v_days <= s.return_tier2_days then s.return_tier2_pct
                 when v_days <= s.return_tier3_days then s.return_tier3_pct end;
  if v_kept is null then
    return;
  end if;
  refund_cents := least(round(v_base * (1 - v_kept / 100))::integer, v_order.total_cents - v_order.refunded_cents);
  kept_pct := v_kept;
  return next;
end $$;

-- The customer asks to return a piece (through the website's server, which checks the order number and email).
create function public.request_return(p_order uuid, p_item uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quote record;
  v_id uuid;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  perform 1 from public.orders where id = p_order for update;
  if not exists (select 1 from public.order_items where id = p_item and order_id = p_order) then
    raise exception 'item_not_in_order' using errcode = 'P0001';
  end if;
  select * into v_quote from public._return_quote(p_item, p_reason);
  if v_quote.refund_cents is null then
    raise exception 'not_returnable' using errcode = 'P0001';
  end if;
  insert into public.returns (order_id, order_item_id, reason, refund_cents, kept_pct)
  values (p_order, p_item, p_reason, v_quote.refund_cents, v_quote.kept_pct)
  returning id into v_id;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (p_order, 'return_requested', true, p_reason);
  return v_id;
end $$;

-- The piece is back at the US warehouse: it becomes a clearance draft.
create function public.admin_return_received(p_return uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_return public.returns;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_return from public.returns where id = p_return for update;
  if not found or v_return.status <> 'requested' then
    raise exception 'return_not_open' using errcode = 'P0001';
  end if;
  update public.returns set status = 'received' where id = p_return;
  perform public._to_clearance(v_return.order_item_id, 'returned: ' || v_return.reason);
end $$;

-- Stripe was refunded: the amount must be the one fixed when the return was asked for.
create function public.admin_return_refunded(p_return uuid, p_amount_cents integer, p_refund_ref text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_return public.returns;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_return from public.returns where id = p_return for update;
  if not found or v_return.status <> 'received' then
    raise exception 'return_not_received' using errcode = 'P0001';
  end if;
  if p_amount_cents is distinct from v_return.refund_cents then
    raise exception 'refund_amount_mismatch:%', v_return.refund_cents using errcode = 'P0001';
  end if;
  update public.returns set status = 'refunded', decided_at = now(), refund_ref = p_refund_ref where id = p_return;
  update public.order_items set status = 'refunded' where id = v_return.order_item_id;
  update public.orders
     set refunded_cents = refunded_cents + p_amount_cents,
         payment_status = case when refunded_cents + p_amount_cents >= total_cents then 'refunded'
                               else 'partially_refunded' end::public.payment_status
   where id = v_return.order_id;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (v_return.order_id, 'item_refunded', true, 'return refunded ' || coalesce(p_refund_ref, '?'));
end $$;

create function public.admin_return_rejected(p_return uuid, p_note text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.returns set status = 'rejected', decided_at = now(), note = p_note
   where id = p_return and status in ('requested', 'received');
  if not found then
    raise exception 'return_not_open' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  select order_id, 'return_rejected', true, p_note from public.returns where id = p_return;
end $$;

-- -----------------------------------------------------------------------------
-- What the customer may do on their order now
-- -----------------------------------------------------------------------------
create or replace function public._order_actions(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'can_cancel', public._in_india(o),
    'cancel_refund_cents', case when public._in_india(o) then public._customer_cancel_cents(o.id) end,
    'delay_open', public._delay_open(o.id),
    'delay_refund_cents', case when public._delay_open(o.id) then public._cancel_refund_cents(o.id, 'our_fault') end,
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
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public._to_clearance(uuid, text), public._us_stock_order(), public._in_india(public.orders),
  public._customer_cancel_cents(uuid), public._unwind_order_pieces(uuid, text), public._record_cancel(uuid, integer, text),
  public.customer_cancel(uuid, integer, text), public.admin_cancel_after_export_cents(uuid),
  public.admin_cancel_after_export(uuid, integer, text), public._delivered_at(uuid), public._return_quote(uuid, text),
  public.request_return(uuid, uuid, text), public.admin_return_received(uuid),
  public.admin_return_refunded(uuid, integer, text), public.admin_return_rejected(uuid, text)
  from public, anon, authenticated;
grant execute on function public.customer_cancel(uuid, integer, text), public.request_return(uuid, uuid, text)
  to service_role;
grant execute on function public.admin_cancel_after_export_cents(uuid), public.admin_cancel_after_export(uuid, integer, text),
  public.admin_return_received(uuid), public.admin_return_refunded(uuid, integer, text),
  public.admin_return_rejected(uuid, text) to authenticated, service_role;
grant execute on function public._customer_cancel_cents(uuid), public._return_quote(uuid, text) to service_role;
