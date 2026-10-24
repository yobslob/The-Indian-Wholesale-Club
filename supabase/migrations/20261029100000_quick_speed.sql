-- The 7-day store's reads, fast again with thousands of 7-day pieces (2026-10-24: the website build stopped at the
-- database's 8 s statement limit prerendering /7-day-delivery). Same answers, two changes:
--   1. The 7-day listings are read once into their own list before they meet store_products. Joined straight to
--      the view, the planner multiplied every option by every category (225,000 rows for 8,000 listings) and checked
--      each listing's shops 161,000 times: store_quick_browse() took 1.3 – 1.7 s on a production copy with 5,100
--      7-day pieces, whatever its limit; read once, the list takes about 0.1 s.
--   2. store_quick_front() builds the cards of its three rows only (36 at most), not of every 7-day piece.
-- Size: none (functions). Egress: unchanged.

create or replace function public.store_quick_browse(p_category text default null, p_offset integer default 0,
                                                     p_limit integer default 24)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with days as (
    select s.quick_delivery_days_min as lo, s.quick_delivery_days_max as hi
    from public.pricing_settings s
    where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null),
  ids as materialized (select q.id from public._quick_listings() q where exists (select 1 from days)),
  quick as materialized (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    where not p.coming_soon and p.id in (select id from ids)),
  shown as (select * from quick where p_category is null or category_slug = p_category)
  select jsonb_build_object(
    'days_min', (select lo from days),
    'days_max', (select hi from days),
    'total', (select count(*) from shown),
    'all_total', (select count(*) from quick),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name,
                                          'product_type', g.product_type, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, product_type, count(*) as n
            from quick group by category_slug, category_name, product_type) g), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type),
               'coming_soon', false,
               'options', public._store_card_options(s.id),
               'quick_days', (select hi from days))
             order by s.k)
      from (select x.*,
                   row_number() over (order by x.step, x.price_cents, x.published_at desc nulls last, x.name, x.id) as k
            from (select shown.*,
                         row_number() over (partition by category_slug order by price_cents, id) as step
                  from shown) x
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$$;

create or replace function public.store_quick_front()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select s.quick_delivery_days_min as lo, s.quick_delivery_days_max as hi, s.quick_delivery_min_cents as line
    from public.pricing_settings s
    where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
      and not s.quick_delivery_paused),
  ids as materialized (select q.id from public._quick_listings() q where exists (select 1 from s)),
  quick as materialized (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    where not p.coming_soon and p.id in (select id from ids)),
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
  -- the rows' pieces only (12 each), then their cards
  picked as materialized (
    select 'most_ordered' as row_, q.*, row_number() over (order by o.n desc, q.published_at desc nulls last, q.id) as k
    from (select * from ordered order by n desc, id limit 12) o join quick q on q.id = o.id
    union all
    select 'under_5', u.*, row_number() over (order by u.price_cents, u.id)
    from (select * from quick where price_cents < 500 order by price_cents, id limit 12) u
    union all
    select 'new_this_week', n.*, row_number() over (order by n.published_at desc, n.id)
    from (select * from quick where published_at >= now() - interval '7 days'
          order by published_at desc, id limit 12) n),
  card as (
    select p.row_, p.k, jsonb_build_object(
             'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
             'region_slug', p.region_slug, 'region_name', p.region_name,
             'category_slug', p.category_slug, 'category_name', p.category_name,
             'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path,
             'pack', public._store_pack(p.id, p.name, p.product_type),
             'coming_soon', false,
             'options', public._store_card_options(p.id),
             'quick_days', (select hi from s)) as j
    from picked p)
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
    'most_ordered', coalesce((select jsonb_agg(c.j order by c.k) from card c where c.row_ = 'most_ordered'), '[]'::jsonb),
    -- the plan's "Under $5" row
    'under_5', coalesce((select jsonb_agg(c.j order by c.k) from card c where c.row_ = 'under_5'), '[]'::jsonb),
    'new_this_week', coalesce((select jsonb_agg(c.j order by c.k) from card c where c.row_ = 'new_this_week'), '[]'::jsonb)) end;
$$;
