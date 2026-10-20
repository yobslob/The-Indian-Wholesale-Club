-- =============================================================================
-- D-144 (plan F11, founder 2026-10-21): See all opens low to high, and Clothing keeps its finishing touches in a drawer.
--  - p_sort 'low' (the website's default): cheapest first, coming-soon pieces last, a state's own pieces first (L2).
--    On Clothing with no category chosen it is "one of each, then step up": each category's cheapest, then each one's
--    second cheapest…, so the first screen shows the whole wardrobe climbing in price.
--  - The drawer: on that same view Accessories and Turbans & Headwear leave the list and come back as `drawer`, the
--    finishing touches in view by price, 12 for every 24 cards (offset and limit halved, so each Show more brings the
--    next 12); `drawer_total` counts them. Footwear stays in the list (the plan's proposal; Q-40).
--  - 'price-asc' stays a strict ascending list; no p_sort (the app) stays newest first, as before.
-- Same body as 20261018160000_fast_sizes otherwise. Tests: low_to_high.test.sql.
-- =============================================================================

create or replace function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null, p_for text default null)
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
           -- D-144: a finishing touch, drawn in the drawer instead of the list
           (w.drawer_on and p.category_slug in ('accessories', 'headwear')) as touch
    from public.store_products p
    join public.products bp on bp.id = p.id
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok and not touch),
  touches as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok and touch and not coming_soon),
  -- the active variants of the pieces in view, read once (typed holds only pieces customers may see)
  vs as materialized (
    select t.id, t.product_type, coalesce(v.options ->> 'size', '') as sz, coalesce(v.options ->> 'pack', '') as pk
    from typed t
    join public.product_variants v on v.product_id = t.id and v.is_active
    where t.r_ok and t.c_ok and t.p_ok and t.f_ok),
  -- each distinct raw size or pack spelled once
  spelled as (
    select d.sz, d.pk, d.product_type,
           public._variant_size(jsonb_build_object('size', nullif(d.sz, ''), 'pack', nullif(d.pk, '')), d.product_type) as size
    from (select distinct sz, pk, product_type from vs) d)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    'all_total', (select count(*) from typed),
    'states_total', (select count(*) from typed where p_ok and s_ok and f_ok),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null and p_ok and s_ok and f_ok))
             order by g.region_name)
      from (select region_slug, region_name, count(*) filter (where p_ok and s_ok and f_ok) as n
            from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from typed where r_ok and p_ok and s_ok and f_ok
            group by category_slug, category_name) g),
      '[]'::jsonb),
    -- D-140: For, counted with every other filter applied (unisex pieces count under both)
    'wears', (select jsonb_build_object(
                'women', count(*) filter (where wears in ('women', 'unisex')),
                'men', count(*) filter (where wears in ('men', 'unisex')))
              from typed where r_ok and c_ok and p_ok and s_ok),
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
      from typed where r_ok and c_ok and s_ok and f_ok and not coming_soon),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type),
               'coming_soon', s.coming_soon,
               -- D-140 (F9): the card's + picks a size or pack right there
               'options', case when not s.coming_soon then public._store_card_options(s.id) end)
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
               'options', public._store_card_options(t.id))
             order by t.k)
      from (select touches.*,
                   row_number() over (order by case when p_region is not null then region_slug is null end,
                                               price_cents, published_at desc nulls last, name, id) as k
            from touches
            order by k
            offset greatest(coalesce(p_offset, 0), 0) / 2
            limit (least(greatest(coalesce(p_limit, 24), 1), 500) + 1) / 2) t), '[]'::jsonb));
$function$;
