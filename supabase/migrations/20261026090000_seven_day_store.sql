-- =============================================================================
-- D-154 step 4 (founder, 2026-10-23): the 7-day store, a second store inside the site with its own door (the header's
-- store switch), front page, categories and search, holding only 7-day pieces; one account and one bag for both.
--  - store_browse: "Delivery: in 7 days" on See all (p_quick, last, so every positional call keeps working) and the
--    filter's count (quick_total).
--  - store_search: p_quick, the 7-day store's search (only 7-day pieces) and the IWC store's search filter.
--  - store_quick_front: the 7-day front page in one read: its days and line, the category tiles (each with one photo)
--    and the rows Most ordered this week, Under $5 and New this week (light cards, like the page's list). Which shop
--    makes a piece 7-day never leaves the database (D-003); the order counts only order the row.
--  - store_policy: the 7-day line ($49.99, Settings) and whether 7-day delivery is on (days set, not paused), for the
--    switch and the product page's "Comes in 7 days with $49.99 of 7-day pieces".
-- Prices, charges and which pieces are 7-day are unchanged. Tests: seven_day_store.test.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. See all: the 7-day filter. As 20261022120000_seven_day_delivery, with p_quick and quick_total.
-- -----------------------------------------------------------------------------
drop function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text);

create function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null, p_for text default null,
                                    p_quick boolean default null)
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with wanted as (
    select nullif(array_remove(array(select public._size_norm(x) from unnest(string_to_array(p_sizes, '|')) x), null), '{}') as sizes,
           case when p_for in ('women', 'men') then p_for end as for_,
           coalesce(p_sort, 'new') as sort_,
           -- D-144: Clothing's default view, the only one with a drawer and the step-up order
           (coalesce(p_sort, 'new') = 'low' and p_type = 'clothing' and p_category is null) as drawer_on),
  -- D-154: the 7-day pieces, read once (none while 7-day delivery is off or paused)
  quick as materialized (
    select q.id from public._quick_listings() q
    where exists (select 1 from public.pricing_settings s
                  where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null)),
  typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at, p.coming_soon, bp.wears,
           -- L8: pieces published at the same moment take turns by shop and category
           row_number() over (partition by p.published_at, bp.vendor_id, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.vendor_id::text, '') || coalesce(p.category_slug, '')) as lane,
           (p_region is null or p.region_slug = p_region or p.region_slug is null) as r_ok,
           (p_category is null or p.category_slug = p_category) as c_ok,
           ((p_min_cents is null and p_max_cents is null)
             or (not p.coming_soon and p.price_cents >= coalesce(p_min_cents, 0)
                 and p.price_cents <= coalesce(p_max_cents, 2147483647))) as p_ok,
           (w.sizes is null or exists (
              select 1 from public.product_variants v
              where v.product_id = p.id and v.is_active
                and public._variant_size(v.options, p.product_type) = any (w.sizes))) as s_ok,
           (w.for_ is null or bp.wears in (w.for_, 'unisex')) as f_ok,
           (not p.coming_soon and p.id in (select id from quick)) as is_quick,
           -- D-144: a finishing touch, drawn in the drawer instead of the list
           (w.drawer_on and p.category_slug in ('accessories', 'headwear')) as touch
    from public.store_products p
    join public.products bp on bp.id = p.id
    cross join wanted w
    where p.product_type::text = p_type),
  typed_q as (select t.*, (not coalesce(p_quick, false) or t.is_quick) as q_ok from typed t),
  shown as (select * from typed_q where r_ok and c_ok and p_ok and s_ok and f_ok and q_ok and not touch),
  touches as (select * from typed_q where r_ok and c_ok and p_ok and s_ok and f_ok and q_ok and touch and not coming_soon),
  -- the active variants of the pieces in view, read once (typed holds only pieces customers may see)
  vs as materialized (
    select t.id, t.product_type, coalesce(v.options ->> 'size', '') as sz, coalesce(v.options ->> 'pack', '') as pk
    from typed_q t
    join public.product_variants v on v.product_id = t.id and v.is_active
    where t.r_ok and t.c_ok and t.p_ok and t.f_ok and t.q_ok),
  -- each distinct raw size or pack spelled once
  spelled as (
    select d.sz, d.pk, d.product_type,
           public._variant_size(jsonb_build_object('size', nullif(d.sz, ''), 'pack', nullif(d.pk, '')), d.product_type) as size
    from (select distinct sz, pk, product_type from vs) d)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    'all_total', (select count(*) from typed_q),
    'states_total', (select count(*) from typed_q where p_ok and s_ok and f_ok and q_ok),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed_q where region_slug is null and p_ok and s_ok and f_ok and q_ok))
             order by g.region_name)
      from (select region_slug, region_name, count(*) filter (where p_ok and s_ok and f_ok and q_ok) as n
            from typed_q where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from typed_q where r_ok and p_ok and s_ok and f_ok and q_ok
            group by category_slug, category_name) g),
      '[]'::jsonb),
    -- D-140: For, counted with every other filter applied (unisex pieces count under both)
    'wears', (select jsonb_build_object(
                'women', count(*) filter (where wears in ('women', 'unisex')),
                'men', count(*) filter (where wears in ('men', 'unisex')))
              from typed_q where r_ok and c_ok and p_ok and s_ok and q_ok),
    -- each distinct size or pack is spelled once (a few dozen), then pieces are counted per spelling
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('value', g.size, 'count', g.n) order by g.size)
      from (select sp.size, count(distinct vs.id) as n
            from vs
            join spelled sp on sp.sz = vs.sz and sp.pk = vs.pk and sp.product_type = vs.product_type
            where sp.size is not null
            group by sp.size) g), '[]'::jsonb),
    'prices', (
      select case when count(*) > 0 then jsonb_build_object(
               'min', min(price_cents), 'max', max(price_cents),
               'q1', percentile_disc(0.25) within group (order by price_cents),
               'q2', percentile_disc(0.5) within group (order by price_cents),
               'q3', percentile_disc(0.75) within group (order by price_cents)) end
      from typed_q where r_ok and c_ok and s_ok and f_ok and q_ok and not coming_soon),
    -- D-154: the "Delivery: in 7 days" filter's count, every other filter applied
    'quick_total', (select count(*) from typed_q where r_ok and c_ok and p_ok and s_ok and f_ok and is_quick and not touch),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type),
               'coming_soon', s.coming_soon,
               -- D-140 (F9): the card's + picks a size or pack right there
               'options', case when not s.coming_soon then public._store_card_options(s.id) end,
               -- D-148: the 7-day tag
               'quick_days', case when not s.coming_soon then public._quick_days(s.id) end)
             order by s.k)
      from (select x.*,
                   row_number() over (order by
                     case when w.sort_ <> 'new' then coming_soon end,
                     -- L2: the state's own pieces before the all-India ones (newest and the default)
                     case when p_region is not null and w.sort_ in ('new', 'low') then region_slug is null end,
                     -- D-144: one of each, then step up
                     case when w.drawer_on then step end,
                     case when w.sort_ in ('price-asc', 'low') then price_cents end,
                     case when w.sort_ = 'price-desc' then price_cents end desc,
                     published_at desc nulls last, turn, lane, name, id) as k
            from (select shown.*,
                         row_number() over (partition by (p_region is not null and region_slug is null), category_slug
                                            order by coming_soon, price_cents, id) as step
                  from shown) x
            cross join wanted w
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb),
    -- D-144: the finishing touches by price, 12 for every 24 cards drawn
    'drawer_total', (select count(*) from touches),
    'drawer', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id, 'slug', t.slug, 'name', t.name, 'product_type', t.product_type,
               'region_slug', t.region_slug, 'region_name', t.region_name,
               'category_slug', t.category_slug, 'category_name', t.category_name,
               'price_cents', t.price_cents, 'primary_image_path', t.primary_image_path,
               'pack', public._store_pack(t.id, t.name, t.product_type),
               'coming_soon', false,
               'options', public._store_card_options(t.id),
               'quick_days', public._quick_days(t.id))
             order by t.k)
      from (select touches.*,
                   row_number() over (order by case when p_region is not null then region_slug is null end,
                                               price_cents, published_at desc nulls last, name, id) as k
            from touches
            order by k
            offset greatest(coalesce(p_offset, 0), 0) / 2
            limit (least(greatest(coalesce(p_limit, 24), 1), 500) + 1) / 2) t), '[]'::jsonb));
$function$;

revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, boolean)
  from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, boolean)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Search: only 7-day pieces when asked. As 20261006230000_speed_and_concurrency, with p_quick.
-- -----------------------------------------------------------------------------
drop function public.store_search(text, integer, integer, boolean);

create function public.store_search(p_query text, p_offset integer default 0, p_limit integer default 24,
                                    p_record boolean default true, p_quick boolean default false)
returns setof public.store_products
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_ts tsquery;
  v_quick boolean := coalesce(p_quick, false);
begin
  if v_query = '' then
    return;
  end if;
  v_ts := websearch_to_tsquery('simple', v_query);
  if coalesce(p_record, true) and coalesce(p_offset, 0) = 0 then
    insert into public.search_queries (query, results)
    select lower(v_query), count(*) from public.store_products p
    where p.search @@ v_ts
      and (not v_quick or (not p.coming_soon and public._quick_days(p.id) is not null));
  end if;
  return query
    select p.* from public.store_products p
    where p.search @@ v_ts
      and (not v_quick or (not p.coming_soon and public._quick_days(p.id) is not null))
    order by p.name, p.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 24), 1), 500);
end $$;

revoke all on function public.store_search(text, integer, integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.store_search(text, integer, integer, boolean, boolean) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. The 7-day front page. Null while 7-day delivery is off (no days in Settings) or paused: no store to show.
-- -----------------------------------------------------------------------------
create function public.store_quick_front()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select s.quick_delivery_days_min as lo, s.quick_delivery_days_max as hi, s.quick_delivery_min_cents as line
    from public.pricing_settings s
    where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
      and not s.quick_delivery_paused),
  quick as materialized (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    join public._quick_listings() q on q.id = p.id
    where not p.coming_soon and exists (select 1 from s)),
  -- units ordered this week (paid, not cancelled), only to order the row
  ordered as (
    select oi.product_id as id, sum(oi.quantity) as n
    from public.order_items oi
    join public.orders od on od.id = oi.order_id
    where od.created_at >= now() - interval '7 days'
      and od.payment_status in ('paid', 'partially_refunded')
      and od.status not in ('pending_payment', 'cancelled', 'refunded')
      and oi.status = 'active'
      and oi.product_id in (select id from quick)
    group by oi.product_id),
  card as (
    select q.*, jsonb_build_object(
             'id', q.id, 'slug', q.slug, 'name', q.name, 'product_type', q.product_type,
             'region_slug', q.region_slug, 'region_name', q.region_name,
             'category_slug', q.category_slug, 'category_name', q.category_name,
             'price_cents', q.price_cents, 'primary_image_path', q.primary_image_path,
             'pack', public._store_pack(q.id, q.name, q.product_type),
             'coming_soon', false,
             'options', public._store_card_options(q.id),
             'quick_days', (select hi from s)) as j
    from quick q)
  select case when exists (select 1 from s) then jsonb_build_object(
    'days_min', (select lo from s),
    'days_max', (select hi from s),
    'min_cents', (select line from s),
    'total', (select count(*) from quick),
    -- the tiles: each category with its count and the photo of its newest piece that has one
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n,
                                          'image_path', g.image_path)
                       order by g.n desc, g.category_name)
      from (select q.category_slug, q.category_name, count(*) as n,
                   (select x.primary_image_path from quick x
                    where x.category_slug = q.category_slug and x.primary_image_path is not null
                    order by x.published_at desc nulls last, x.id limit 1) as image_path
            from quick q group by q.category_slug, q.category_name) g), '[]'::jsonb),
    'most_ordered', coalesce((
      select jsonb_agg(c.j order by o.n desc, c.published_at desc nulls last, c.id)
      from (select * from ordered order by n desc, id limit 12) o
      join card c on c.id = o.id), '[]'::jsonb),
    -- the plan's "Under $5" row
    'under_5', coalesce((
      select jsonb_agg(c.j order by c.price_cents, c.id)
      from (select * from card where price_cents < 500 order by price_cents, id limit 12) c), '[]'::jsonb),
    'new_this_week', coalesce((
      select jsonb_agg(c.j order by c.published_at desc, c.id)
      from (select * from card where published_at >= now() - interval '7 days'
            order by published_at desc, id limit 12) c), '[]'::jsonb)) end;
$$;
revoke all on function public.store_quick_front() from public;
grant execute on function public.store_quick_front() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. The store's policy with the 7-day line. As 20261022120000_seven_day_delivery, with its line and whether it is on.
-- -----------------------------------------------------------------------------
create or replace function public.store_policy()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'min_order_cents', s.min_order_cents,
    'express_days_min', s.express_days_min,
    'express_days_max', s.express_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
    'quick_delivery_days_min', s.quick_delivery_days_min,
    'quick_delivery_days_max', s.quick_delivery_days_max,
    -- D-154: the 7-day line, and whether the 7-day store is open (days set, not paused)
    'quick_delivery_min_cents', s.quick_delivery_min_cents,
    'quick_delivery_on', (s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
                          and not s.quick_delivery_paused),
    'cancel_fee_pct', s.cancel_fee_pct,
    'return_claim_days', s.return_claim_days,
    'return_tiers', coalesce((
      select jsonb_agg(jsonb_build_object('days', t.days, 'kept_pct', t.pct) order by t.days)
      from (values (s.return_tier1_days, s.return_tier1_pct), (s.return_tier2_days, s.return_tier2_pct),
                   (s.return_tier3_days, s.return_tier3_pct)) t (days, pct)
      where t.days is not null and t.pct is not null), '[]'::jsonb),
    'tax', coalesce((
      select jsonb_agg(jsonb_build_object('state', r.state, 'rate_pct', r.rate_pct, 'clothing', r.taxes_clothing,
                                          'food', r.taxes_food, 'general', r.taxes_general)
                       order by r.state)
      from public.tax_rates r), '[]'::jsonb))
  from public.pricing_settings s
  where s.id = 1;
$$;
