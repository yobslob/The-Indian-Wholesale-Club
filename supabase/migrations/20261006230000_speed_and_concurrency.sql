-- =============================================================================
-- Speed and concurrency audit (2026-10-06, engineering.md §Performance, D-011, D-068):
--  1. create_order no longer serialises every checkout on one row. It took FOR UPDATE on the open cycle, so two
--     customers paying at the same moment waited for each other. FOR SHARE still blocks a cutoff (which UPDATEs the
--     cycle) until the order has committed, but lets orders run side by side. Pieces are now reserved in variant-id
--     order, so two orders for the same pieces in a different bag order can't deadlock each other (they could once
--     the cycle lock stopped serialising them). INV-3 is unchanged: one conditional UPDATE per piece.
--  2. variant_availability (the Realtime stock feed, D-010) is written only when a stock column changes and the number
--     really moved. It was rewritten on every product_variants update (a price edit, a re-confirmation), and each
--     rewrite was broadcast to every open product page.
--  3. Product cards: one pass over the variants instead of three, and no summary or craft (no card shows them). Same
--     available and quick_add as before.
--  4. store_region_page(): `products` holds only the cards the page draws (the newest 12, and the first 12 of each
--     category, D-062), plus `category_counts` for the section pills and See all. It returned every live product of
--     the region, and the page drew 12 of each.
--  5. store_browse(type, region, category, offset, limit): the See all pages (website and app) in one round trip:
--     one page of cards, the total, and the per-state and per-category counts for the filters. The website read up to
--     1,000 cards per type and filtered them in JavaScript (past 1,000 the rest silently disappeared); the app made a
--     second round trip for the count.
--  6. store_search(..., p_record): the website's "Show more" re-reads from the first result, which recorded the same
--     search again on every click (Insights counted it twice, three times...). Pages of up to 500 (the website shows
--     up to 480; the old cap of 100 cut its results off silently).
--  7. The every-minute timer also calls the website's job in the two minutes after a cycle closed, even with no email
--     due, so the cached store stops showing the past "order by" time within a minute (D-008). It called only when
--     an email was due, and a cutoff with no orders queues none.
--  8. Indexes for the foreign keys that had none (order_items.variant_id, wishlists.product_id) and for "newest live
--     first", the order of every product list.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. create_order (as in migration 13, with the two locking changes marked)
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

  -- FOR SHARE (was FOR UPDATE): orders run side by side; a cutoff waits until they have committed.
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

  -- The order row first: a second attempt for the same payment (browser and webhook racing) stops here on the
  -- unique payment_intent_id, before it reserves anything.
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

  -- Variant-id order (was the bag's order): every order locks pieces in the same order, so no deadlocks.
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
-- 2. The live stock feed only moves when stock moves
-- -----------------------------------------------------------------------------
create or replace function public.sync_variant_availability() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.variant_availability (variant_id, product_id, available, updated_at)
  values (new.id, new.product_id,
          case when new.is_active then new.qty_listed - new.qty_reserved else 0 end, now())
  on conflict (variant_id) do update
    set product_id = excluded.product_id, available = excluded.available, updated_at = now()
    where (variant_availability.product_id, variant_availability.available)
          is distinct from (excluded.product_id, excluded.available);
  return new;
end $$;

drop trigger product_variants_sync_availability on public.product_variants;
create trigger product_variants_sync_availability
  after insert or update of qty_listed, qty_reserved, is_active, product_id on public.product_variants
  for each row execute function public.sync_variant_availability();

-- -----------------------------------------------------------------------------
-- 3. One product card: one pass over its variants
-- -----------------------------------------------------------------------------
create or replace function public._store_product_card(p_product_id uuid)
returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'available', v.available,
    -- With exactly one variant, max() is that variant.
    'quick_add', case when v.n = 1 and v.available > 0
                      then jsonb_build_object('variant_id', v.one_id, 'label', v.one_label, 'price_cents', v.one_price)
                 end)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$$;

-- -----------------------------------------------------------------------------
-- 4. The region page: only the cards it draws, and the counts
-- -----------------------------------------------------------------------------
create or replace function public.store_region_page(p_region_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'alt_text', ph.alt_text)
                       order by ph.sort_order, ph.created_at)
      from public.region_photos ph where ph.region_id = r.id), '[]'::jsonb),
    -- The newest 12 (New arrivals) and the first 12 of each category (its row), newest first. A card among the
    -- newest 12 is always among its category's first 12, so each category still has at most 12 here.
    'products', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.published_at desc nulls last, s.name)
      from (select p.id, p.published_at, p.name,
                   row_number() over (order by p.published_at desc nulls last, p.name) as overall,
                   row_number() over (partition by p.category_id
                                      order by p.published_at desc nulls last, p.name) as in_category
            from public.store_products p
            where p.region_id = r.id) s
      where s.overall <= 12 or s.in_category <= 12), '[]'::jsonb),
    'category_counts', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.category_slug, 'name', c.category_name,
                                          'product_type', c.product_type, 'count', c.n)
                       order by c.n desc, c.category_name)
      from (select p.category_slug, p.category_name, p.product_type, count(*) as n
            from public.store_products p
            where p.region_id = r.id
            group by p.category_slug, p.category_name, p.product_type) c), '[]'::jsonb),
    'most_wanted', coalesce((
      select jsonb_agg(public._store_product_card(w.id) order by w.ordered desc, w.published_at desc nulls last, w.name)
      from (select p.id, p.published_at, p.name, o.ordered
            from public.store_products p
            join (select oi.product_id, sum(oi.quantity) as ordered
                  from public.order_items oi
                  join public.orders od on od.id = oi.order_id
                  where od.created_at >= now() - interval '30 days'
                    and od.payment_status in ('paid', 'partially_refunded')
                    and od.status not in ('pending_payment', 'cancelled', 'refunded')
                    and oi.status = 'active'
                  group by oi.product_id) o on o.product_id = p.id
            where p.region_id = r.id
              and exists (select 1 from public.store_variants v where v.product_id = p.id and v.available > 0)
            order by o.ordered desc, p.published_at desc nulls last, p.name
            limit 12) w), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            where p.region_id = r.id and p.is_curated
            order by p.published_at desc nulls last, p.name limit 12) c), '[]'::jsonb),
    'leaving_soon', coalesce((
      select jsonb_agg(public._store_product_card(l.id) order by l.available, l.published_at desc nulls last, l.name)
      from (select p.id, p.published_at, p.name, a.available
            from public.store_products p
            cross join lateral (select coalesce(sum(v.available), 0) as available
                                from public.store_variants v where v.product_id = p.id) a
            where p.region_id = r.id and a.available between 1 and public._leaving_soon_max()
            order by a.available, p.published_at desc nulls last, p.name limit 12) l), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$$;

-- -----------------------------------------------------------------------------
-- 5. See all: one page, the total and the filter counts, in one round trip
-- -----------------------------------------------------------------------------
-- Light cards (no stock): a See all page stays the same when a piece sells, so an order never has to refresh it.
create function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    where p.product_type::text = p_type),
  in_region as (select * from typed where p_region is null or region_slug = p_region),
  shown as (select * from in_region where p_category is null or category_slug = p_category)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name, 'count', g.n) order by g.region_name)
      from (select region_slug, region_name, count(*) as n from typed group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from in_region group by category_slug, category_name) g),
      '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path)
             order by s.published_at desc nulls last, s.name, s.id)
      from (select * from shown
            order by published_at desc nulls last, name, id   -- id last: pages never repeat or skip a product
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$$;

revoke all on function public.store_browse(text, text, text, integer, integer) from public;
grant execute on function public.store_browse(text, text, text, integer, integer) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Search: record only when asked, pages of up to 500
-- -----------------------------------------------------------------------------
drop function public.store_search(text, integer, integer);
create function public.store_search(p_query text, p_offset integer default 0, p_limit integer default 24,
                                    p_record boolean default true)
returns setof public.store_products
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_ts tsquery;
begin
  if v_query = '' then
    return;
  end if;
  v_ts := websearch_to_tsquery('simple', v_query);
  if coalesce(p_record, true) and coalesce(p_offset, 0) = 0 then
    insert into public.search_queries (query, results)
    select lower(v_query), count(*) from public.store_products p where p.search @@ v_ts;
  end if;
  return query
    select p.* from public.store_products p
    where p.search @@ v_ts
    order by p.name, p.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 24), 1), 500);
end $$;

revoke all on function public.store_search(text, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.store_search(text, integer, integer, boolean) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. The timer after a cutoff
-- -----------------------------------------------------------------------------
create or replace function public._kick_email_outbox()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'pending' and next_attempt_at <= now())
     and not exists (select 1 from public.cycles
                     where status <> 'open' and cutoff_at between now() - interval '2 minutes' and now()) then
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

-- -----------------------------------------------------------------------------
-- 8. Indexes
-- -----------------------------------------------------------------------------
create index order_items_variant_idx on public.order_items (variant_id);
create index wishlists_product_idx on public.wishlists (product_id);
create index products_live_newest_idx on public.products (published_at desc nulls last, name) where status = 'live';
