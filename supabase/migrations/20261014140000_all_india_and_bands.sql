-- =============================================================================
-- D-121: the state tag is optional; all-India listings fill every state; targets with shops, a price band and their
-- own number of listings; home & gifts without a weight priced from an estimate of its weight, not the category's.
--
--  - products.region_id may be empty: an all-India listing (a Myntra kurta from no state in particular). The store
--    shows no state for it, never an invented one (D-004); it appears on every state's page after the state's own
--    pieces, in browse under every state, and at /states/india/<slug> (`india` is no state's slug).
--  - Online shops' vendor rows may have no state either (one per shop for all-India listings).
--  - sourcing_targets: region_id optional (all states); `sites` (only these shops), `min_price_paise` /
--    `max_price_paise` (the shop's price band) and `listings` (how many listings, instead of the setting).
--  - Home & gifts without a weight of its own: shop ₹ × grams per rupee, at least the minimum, at most the category's
--    typical weight (two settings), instead of the category's weight (1.5 – 2 kg put every cheap basket near $60).
-- Function bodies below are the latest definitions with only the changes named in their comments.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Optional state
-- -----------------------------------------------------------------------------
alter table public.products alter column region_id drop not null;
alter table public.order_items alter column region_name drop not null;
alter table public.vendors alter column region_id drop not null;
alter table public.vendors add constraint vendors_region_or_online check (region_id is not null or online_site is not null);
create unique index vendors_online_site_all_india_key on public.vendors (online_site)
  where online_site is not null and region_id is null;
alter table public.sourcing_targets alter column region_id drop not null;
drop index public.sourcing_targets_name_key;
create unique index sourcing_targets_name_key
  on public.sourcing_targets (coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Same columns; the state may be empty (left join).
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
left join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- -----------------------------------------------------------------------------
-- The online shop of a state, or of all India (p_region null).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._online_vendor(p_site text, p_label text, p_region uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  select id into v_id from public.vendors where online_site = p_site and region_id is not distinct from p_region;
  if found then
    update public.vendors set status = 'active' where id = v_id and status <> 'active';
    return v_id;
  end if;
  insert into public.vendors (shop_name, online_site, region_id, status, notes, onboarded_at)
  values (p_label || ' (online)', p_site, p_region, 'active',
          'Online shop (D-110, D-118): its listings come from ' || p_site || '. A sold piece is ordered there, to the hub.',
          now())
  on conflict do nothing
  returning id into v_id;
  return coalesce(v_id, (select id from public.vendors where online_site = p_site and region_id is not distinct from p_region));
end $function$;

-- -----------------------------------------------------------------------------
-- Orders keep an all-India piece with no state (left join).
-- -----------------------------------------------------------------------------
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
  if v_late then
    update public.orders set status = 'collecting' where id = v_order.id;
    insert into public.order_events (order_id, kind, visible_to_customer)
    values (v_order.id, 'preparing', true);
  end if;

  return query select v_order.id, v_order.order_number;
end $function$;

-- -----------------------------------------------------------------------------
-- Insights: an all-India piece shows as "All states" (left join).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_demand(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'top_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', n, 'last_results', last_results)
                       order by n desc, query)
      from (select query, count(*) as n,
                   (array_agg(results order by created_at desc))[1] as last_results
            from public.search_queries
            where p_since is null or created_at >= p_since
            group by query order by count(*) desc, query limit 20) t), '[]'::jsonb),
    'empty_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', n) order by n desc, query)
      from (select query, count(*) as n from public.search_queries
            where results = 0 and (p_since is null or created_at >= p_since)
            group by query order by count(*) desc, query limit 20) t), '[]'::jsonb),
    'most_saved', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'region', region, 'status', status,
                                          'saves', saves, 'available', available)
                       order by saves desc, name)
      from (select p.id, p.name, coalesce(r.name, 'All states') as region, p.status, count(*) as saves,
                   (select coalesce(sum(v.qty_listed - v.qty_reserved), 0) from public.product_variants v
                    where v.product_id = p.id and v.is_active) as available
            from public.wishlists w
            join public.products p on p.id = w.product_id
            left join public.regions r on r.id = p.region_id
            where p_since is null or w.created_at >= p_since
            group by p.id, p.name, r.name, p.status
            order by count(*) desc, p.name limit 20) t), '[]'::jsonb))
  into v_result;
  return v_result;
end $function$;

-- -----------------------------------------------------------------------------
-- Insights: sales of all-India pieces count under "All states".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sales(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  with sold as (
    select oi.quantity, oi.total_price_cents, coalesce(oi.region_name, 'All states') as region_name, o.id as order_id,
           coalesce(c.name, 'Unknown') as category_name,
           coalesce(v.shop_name, 'Unknown') as shop_name,
           coalesce(p.shop_price_paise, 0) * oi.quantity as shop_cost_paise
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    left join public.vendors v on v.id = p.vendor_id
    where oi.status = 'active'
      and o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('pending_payment', 'cancelled', 'refunded')
      and (p_since is null or o.created_at >= p_since)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object('orders', count(distinct order_id), 'pieces', coalesce(sum(quantity), 0),
                                         'revenue_cents', coalesce(sum(total_price_cents), 0)) from sold),
    'by_region', coalesce((select jsonb_agg(jsonb_build_object('name', region_name, 'pieces', pieces,
                                                               'revenue_cents', revenue) order by revenue desc, region_name)
                           from (select region_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                 from sold group by region_name) g), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', category_name, 'pieces', pieces,
                                                                 'revenue_cents', revenue) order by revenue desc, category_name)
                             from (select category_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                   from sold group by category_name) g), '[]'::jsonb),
    'by_shop', coalesce((select jsonb_agg(jsonb_build_object('name', shop_name, 'pieces', pieces,
                                                             'revenue_cents', revenue, 'shop_cost_paise', cost)
                                          order by revenue desc, shop_name)
                         from (select shop_name, sum(quantity) as pieces, sum(total_price_cents) as revenue,
                                      sum(shop_cost_paise) as cost
                               from sold group by shop_name) g), '[]'::jsonb))
  into v_result;
  return v_result;
end $function$;

-- -----------------------------------------------------------------------------
-- A product page: an all-India piece lives at /states/india/<slug>; its similar pieces prefer its own state (or none).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_product_page(p_region_slug text, p_product_slug text)
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
      from (select o.id, o.published_at, o.name, (o.region_id is not distinct from p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id is not distinct from p.region_id) desc, o.published_at desc nulls last, o.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id is not distinct from p.region_id and o.is_curated and o.id <> p.id
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
  where coalesce(p.region_slug, 'india') = p_region_slug and p.slug = p_product_slug;
$function$;

-- -----------------------------------------------------------------------------
-- A state's page: its own pieces first, then the all-India ones (they fill every state).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_region_page(p_region_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'alt_text', ph.alt_text)
                       order by ph.sort_order, ph.created_at)
      from public.region_photos ph where ph.region_id = r.id), '[]'::jsonb),
    -- The newest 12 (New arrivals) and the first 12 of each category (its row), newest first. A card among the
    -- newest 12 is always among its category's first 12, so each category still has at most 12 here.
    'products', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.all_india, s.published_at desc nulls last, s.name)
      from (select p.id, p.published_at, p.name, (p.region_id is null) as all_india,
                   row_number() over (order by (p.region_id is null), p.published_at desc nulls last, p.name) as overall,
                   row_number() over (partition by p.category_id
                                      order by (p.region_id is null), p.published_at desc nulls last, p.name) as in_category
            from public.store_products p
            where p.region_id = r.id or p.region_id is null) s
      where s.overall <= 12 or s.in_category <= 12), '[]'::jsonb),
    'category_counts', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.category_slug, 'name', c.category_name,
                                          'product_type', c.product_type, 'count', c.n)
                       order by c.n desc, c.category_name)
      from (select p.category_slug, p.category_name, p.product_type, count(*) as n
            from public.store_products p
            where p.region_id = r.id or p.region_id is null
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
            where (p.region_id = r.id or p.region_id is null)
              and exists (select 1 from public.store_variants v where v.product_id = p.id and v.available > 0)
            order by o.ordered desc, p.published_at desc nulls last, p.name
            limit 12) w), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            where (p.region_id = r.id or p.region_id is null) and p.is_curated
            order by (p.region_id is null), p.published_at desc nulls last, p.name limit 12) c), '[]'::jsonb),
    'leaving_soon', coalesce((
      select jsonb_agg(public._store_product_card(l.id) order by l.available, l.published_at desc nulls last, l.name)
      from (select p.id, p.published_at, p.name, a.available
            from public.store_products p
            cross join lateral (select coalesce(sum(v.available), 0) as available
                                from public.store_variants v where v.product_id = p.id) a
            where (p.region_id = r.id or p.region_id is null) and a.available between 1 and public._leaving_soon_max()
            order by (p.region_id is null), a.available, p.published_at desc nulls last, p.name limit 12) l), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$function$;

-- -----------------------------------------------------------------------------
-- Browse: a state's filter includes the all-India pieces; the state list counts them in and never lists "no state".
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_browse(p_type text, p_region text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    where p.product_type::text = p_type),
  in_region as (select * from typed where p_region is null or region_slug = p_region or region_slug is null),
  shown as (select * from in_region where p_category is null or category_slug = p_category)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null))
             order by g.region_name)
      from (select region_slug, region_name, count(*) as n from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
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
$function$;

-- -----------------------------------------------------------------------------
-- Targets: optional state, shops, price band and number of listings.
-- -----------------------------------------------------------------------------
alter table public.sourcing_targets
  add column sites text[] check (sites is null or cardinality(sites) between 1 and 12),
  add column min_price_paise integer check (min_price_paise > 0),
  add column max_price_paise integer check (max_price_paise > 0),
  add column listings smallint check (listings between 1 and 40),
  add constraint sourcing_targets_band check (max_price_paise is null or min_price_paise is null
                                              or max_price_paise >= min_price_paise);
CREATE OR REPLACE FUNCTION public.worker_sourcing_plan(p_checks integer DEFAULT 400)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.sourcing_settings;
  v_now timestamptz := clock_timestamp();   -- marks this call's claims (two calls in one transaction differ)
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;
  update public.sourcing_targets set status = 'queued', claimed_at = null
   where (status = 'searching' and claimed_at < now() - interval '6 hours')
      or (status = 'none' and searched_at < now() - interval '30 days');
  update public.sourcing_targets t set status = 'searching', claimed_at = v_now
    from (select id from public.sourcing_targets where status = 'queued'
           order by tier nulls last, created_at limit s.targets_per_run for update skip locked) q
   where t.id = q.id;

  return jsonb_build_object(
    'settings', to_jsonb(s) - 'id' - 'updated_at' - 'updated_by',
    'shops', coalesce((select jsonb_agg(jsonb_build_object('site', site, 'label', label, 'reader', reader,
                                                          'product_types', product_types, 'delivery_days', delivery_days)
                                        order by sort_order)
                         from public.sourcing_shops where is_enabled), '[]'::jsonb),
    'targets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'query', t.query,
                                                            'must_match', t.must_match, 'product_type', t.product_type,
                                                            'category', c.slug, 'region', r.slug, 'tier', t.tier,
                                                            'sites', t.sites, 'min_price_paise', t.min_price_paise,
                                                            'max_price_paise', t.max_price_paise, 'listings', t.listings)
                                          order by t.tier nulls last, t.created_at)
                           from public.sourcing_targets t
                           join public.categories c on c.id = t.category_id
                           left join public.regions r on r.id = t.region_id
                          where t.status = 'searching' and t.claimed_at = v_now), '[]'::jsonb),
    'checks', coalesce((select jsonb_agg(q.x) from (
        select jsonb_build_object(
                 'product_id', p.id, 'name', p.name,
                 'sources', (select jsonb_agg(jsonb_build_object('id', ps.id, 'site', ps.site, 'page_url', ps.page_url,
                                                                'item_url', ps.item_url, 'item_key', ps.item_key,
                                                                'label', v.label, 'options', v.options))
                               from public.product_sources ps
                               join public.product_variants v on v.id = ps.variant_id
                              where ps.product_id = p.id)) as x
          from public.products p
         where p.status <> 'archived'
           and exists (select 1 from public.product_sources ps where ps.product_id = p.id)
           and (p.source_checked_at is null
                or p.source_checked_at < now() - make_interval(days => s.check_every_days))
         order by p.source_checked_at nulls first
         limit greatest(least(p_checks, 2000), 0)) q), '[]'::jsonb),
    'known', coalesce((select jsonb_agg(site || '|' || item_key) from public.product_sources
                        where item_key is not null), '[]'::jsonb));
end $function$;

-- -----------------------------------------------------------------------------
-- Home & gifts without a weight of its own: an estimate from its shop price (two settings), at most the category's.
-- -----------------------------------------------------------------------------
alter table public.pricing_settings
  add column home_est_g_per_rupee numeric(6, 3) check (home_est_g_per_rupee > 0),
  add column home_est_min_g integer check (home_est_min_g > 0);

create function public._fallback_weight_g(p_type public.product_type, p_shop_paise integer, p_category uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when p_type = 'home' and s.home_est_g_per_rupee is not null and p_shop_paise is not null then
      least(coalesce(c.default_weight_g, 50000),
            greatest(coalesce(s.home_est_min_g, 1), round(p_shop_paise / 100.0 * s.home_est_g_per_rupee)))::integer
    else c.default_weight_g
  end
  from public.categories c cross join public.pricing_settings s
  where c.id = p_category and s.id = 1;
$$;
revoke all on function public._fallback_weight_g(public.product_type, integer, uuid) from public, anon, authenticated;
CREATE OR REPLACE FUNCTION public._product_auto_price(p_product uuid, p_shop_paise integer, p_category uuid, p_type product_type)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with w as (
    select (select max(v.weight_g) from public.product_variants v
             where v.product_id = p_product and v.is_active) as g
  )
  select coalesce(
    (select min(public._auto_price_cents(v.shop_price_paise,
                                     coalesce(v.weight_g, w.g, public._fallback_weight_g(p_type, v.shop_price_paise, p_category)),
                                     p_type))
       from public.product_variants v
      where v.product_id = p_product and v.is_active and v.shop_price_paise is not null),
    public._auto_price_cents(p_shop_paise, coalesce(w.g, public._fallback_weight_g(p_type, p_shop_paise, p_category)), p_type))
  from w;
$function$;
CREATE OR REPLACE FUNCTION public._reprice_products(p_product uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_variants integer;
  v_products integer;
begin
  -- variants with their own shop price (manual prices, price_auto off, are left alone)
  update public.product_variants v
     set price_cents = n.price
    from (select v2.id,
                 public._auto_price_cents(v2.shop_price_paise,
                   coalesce(v2.weight_g,
                            (select max(v3.weight_g) from public.product_variants v3
                              where v3.product_id = x.id and v3.is_active),
                            public._fallback_weight_g(x.product_type, v2.shop_price_paise, x.category_id)),
                   x.product_type) as price
            from public.product_variants v2
            join public.products x on x.id = v2.product_id
           where x.price_auto and v2.shop_price_paise is not null and (p_product is null or x.id = p_product)) n
   where v.id = n.id and n.price is not null and v.price_cents is distinct from n.price;
  get diagnostics v_variants = row_count;

  update public.products p
     set price_cents = n.price
    from (select x.id, public._product_auto_price(x.id, x.shop_price_paise, x.category_id, x.product_type) as price
            from public.products x
           where x.price_auto and (p_product is null or x.id = p_product)) n
   where p.id = n.id and n.price is not null and p.price_cents is distinct from n.price;
  get diagnostics v_products = row_count;
  return v_variants + v_products;
end $function$;
CREATE OR REPLACE FUNCTION public.worker_sourcing_add(p_target uuid, p_listing jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.sourcing_settings;
  t public.sourcing_targets;
  v_site text := p_listing ->> 'site';
  v_existing uuid;
  v_id uuid;
  v_slug text := coalesce(p_listing ->> 'slug', '');
  v_shop integer;
  v_weight integer;
  v_price integer;
  v_item jsonb;
  v_n integer;
  v_var uuid;
  v_src uuid;
  v_vars uuid[] := '{}';
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;
  select * into t from public.sourcing_targets where id = p_target and status = 'searching' for update;
  if not found then
    raise exception 'target_not_held' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_listing -> 'variants') is distinct from 'array'
     or jsonb_array_length(p_listing -> 'variants') not between 1 and 60
     or exists (select 1 from jsonb_array_elements(p_listing -> 'variants') x
                 where coalesce(x ->> 'item_key', '') = '' or coalesce((x ->> 'price_paise')::integer, 0) <= 0
                    or coalesce(x ->> 'item_url', '') !~ '^https://' or coalesce(x ->> 'label', '') = '')
     or (select count(distinct x ->> 'item_key') from jsonb_array_elements(p_listing -> 'variants') x)
        <> jsonb_array_length(p_listing -> 'variants')
     or coalesce(v_site, '') = '' or coalesce(p_listing ->> 'page_url', '') !~ '^https://'
     or length(coalesce(p_listing ->> 'name', '')) not between 2 and 120
     or jsonb_typeof(coalesce(p_listing -> 'attributes', '{}'::jsonb)) <> 'object' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;

  select ps.product_id into v_existing
    from public.product_sources ps
   where ps.site = v_site and ps.item_key in (select x ->> 'item_key' from jsonb_array_elements(p_listing -> 'variants') x)
   limit 1;
  if v_existing is null then
    select id into v_existing from public.products where source_url = p_listing ->> 'page_url';
  end if;
  if v_existing is not null then
    return jsonb_build_object('product_id', v_existing, 'created', false);
  end if;

  select coalesce(min((x ->> 'price_paise')::integer) filter (where (x ->> 'in_stock')::boolean),
                  min((x ->> 'price_paise')::integer)),
         max(nullif(x ->> 'weight_g', '')::integer)
    into v_shop, v_weight
    from jsonb_array_elements(p_listing -> 'variants') x;
  v_price := public._auto_price_cents(
    v_shop,
    coalesce(v_weight, nullif(p_listing ->> 'weight_g', '')::integer,
             public._fallback_weight_g(t.product_type, v_shop, t.category_id)),
    t.product_type);
  if v_price is null then
    raise exception 'price_needed' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;
  while exists (select 1 from public.products where slug = v_slug) loop
    v_slug := left(coalesce(p_listing ->> 'slug', 'item'), 70) || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, description,
                               attributes, price_cents, shop_price_paise, price_auto, status, created_by, source_url,
                               source_site, source_checked_at, source_in_stock, sourcing_target_id)
  values (public._online_vendor(v_site, coalesce(nullif(p_listing ->> 'shop_label', ''), v_site), t.region_id),
          t.region_id, t.category_id, t.product_type, p_listing ->> 'name', v_slug,
          nullif(left(p_listing ->> 'summary', 300), ''), nullif(left(p_listing ->> 'description', 4000), ''),
          coalesce(p_listing -> 'attributes', '{}'::jsonb), v_price, v_shop, true, 'draft', auth.uid(),
          p_listing ->> 'page_url', v_site, now(), true, t.id)
  returning id into v_id;

  for v_item, v_n in select x, n from jsonb_array_elements(p_listing -> 'variants') with ordinality as e(x, n) loop
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order, shop_price_paise)
    values (v_id, upper(v_slug) || '-' || v_n, left(v_item ->> 'label', 80),
            case when jsonb_typeof(v_item -> 'options') = 'object' then v_item -> 'options' else '{}'::jsonb end,
            nullif(v_item ->> 'weight_g', '')::integer,
            case when (v_item ->> 'in_stock')::boolean then s.qty_per_variant else 0 end, now(), v_n,
            (v_item ->> 'price_paise')::integer)
    returning id into v_var;
    v_vars := v_vars || v_var;
    insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                        mrp_paise, in_stock, delivery_days, checked_at)
    values (v_id, v_var, v_site, coalesce(nullif(v_item ->> 'page_url', ''), p_listing ->> 'page_url'),
            v_item ->> 'item_url', v_item ->> 'item_key', (v_item ->> 'price_paise')::integer,
            nullif(v_item ->> 'mrp_paise', '')::integer, coalesce((v_item ->> 'in_stock')::boolean, false),
            nullif(v_item ->> 'delivery_days', '')::smallint, now())
    returning id into v_src;
    update public.product_variants set source_id = v_src where id = v_var;
  end loop;

  -- the same piece on other shops: backups the weekly check can switch to
  insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                      mrp_paise, in_stock, delivery_days, checked_at)
  select v_id, v_vars[(b ->> 'variant')::integer], b ->> 'site', b ->> 'page_url', b ->> 'item_url', b ->> 'item_key',
         nullif(b ->> 'price_paise', '')::integer, nullif(b ->> 'mrp_paise', '')::integer,
         coalesce((b ->> 'in_stock')::boolean, false), nullif(b ->> 'delivery_days', '')::smallint, now()
    from jsonb_array_elements(coalesce(p_listing -> 'backups', '[]'::jsonb)) b
   where (b ->> 'variant')::integer between 1 and cardinality(v_vars)
     and coalesce(b ->> 'site', '') <> '' and coalesce(b ->> 'item_key', '') <> ''
     and coalesce(b ->> 'page_url', '') ~ '^https://' and coalesce(b ->> 'item_url', '') ~ '^https://'
  on conflict (site, item_key) where item_key is not null do nothing;

  perform public._sourcing_settle(v_id);
  update public.sourcing_targets set found_count = found_count + 1 where id = p_target;
  return jsonb_build_object('product_id', v_id, 'created', true);
end $function$;

-- -----------------------------------------------------------------------------
-- Claude's proposals carry the estimate label (D-047).
-- -----------------------------------------------------------------------------
alter table public.pricing_estimates drop constraint pricing_estimates_setting_check;
alter table public.pricing_estimates add constraint pricing_estimates_setting_check check (setting in (
  'fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct', 'domestic_days_min', 'domestic_days_max',
  'stale_listing_days', 'fx_buffer_pct', 'india_handling_paise', 'volumetric_pct', 'broker_cents_per_shipment',
  'shipment_kg', 'us_handling_cents', 'us_last_mile_cents_per_kg', 'us_last_mile_min_cents', 'returns_allowance_pct',
  'card_fee_pct', 'card_fee_fixed_cents', 'express_base_cents', 'express_courier_cents_per_kg', 'express_min_kg',
  'express_days_min', 'express_days_max', 'cycle_days', 'fast_offer_cents', 'cancel_fee_pct',
  'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
  'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct',
  'food_fee_paise', 'food_parcel_kg', 'food_billed_pct', 'parcel_fixed_paise',
  'duty_clothing_pct', 'duty_food_pct', 'duty_home_pct',
  'small_food_max_shop_paise', 'small_food_max_g', 'small_food_ship_share_pct',
  'home_est_g_per_rupee', 'home_est_min_g'));

-- This update reprices every automatic price (pricing_settings_reprice).
update public.pricing_settings set home_est_g_per_rupee = 1.5, home_est_min_g = 200 where id = 1;

insert into public.pricing_estimates (setting, source, source_url, checked_on) values
  ('home_est_g_per_rupee', 'Claude (D-121): baskets, disposables, tissue and decor run about 1 – 2 g per rupee on Amazon and Blinkit; brass and steel are dearer per gram', null, '2026-10-14'),
  ('home_est_min_g', 'Claude (D-121): the lightest packed home piece (a pack of napkins, a small diya) with its box', null, '2026-10-14')
on conflict (setting) do update set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;

