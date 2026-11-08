-- =============================================================================
-- D-195 (founder 2026-11-08): Traditional wear, a tile in Home's Shop by category that opens Clothing with only the
-- pieces from a state, each card with its state's name (cards already show it). store_browse takes p_region =
-- 'any-state' for that: every state's pieces and none of the all-India ones. Nothing else in it changes, and no
-- region has that slug (slugs are the 36 regions' names).
-- Size: none. Egress: unchanged. Page cache: one more cached See all page per type that opens it
-- (/see-all/clothing/any-state/...), built on first visit. Tests: traditional_wear.test.sql.
-- =============================================================================

create or replace function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null, p_for text default null,
                                    p_sub text default null)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with wanted as (
    select nullif(array_remove(array(select public._size_norm(x) from unnest(string_to_array(p_sizes, '|')) x), null), '{}') as sizes,
           case when p_for in ('women', 'men') then p_for end as for_,
           coalesce(p_sort, 'new') as sort_,
           -- D-191: Popular's long tail takes turns week by week
           to_char(current_date, 'IYYY-IW') as week,
           -- D-144: Clothing's default view, the only one with a drawer and the step-up order
           (coalesce(p_sort, 'new') in ('low', 'popular') and p_type = 'clothing' and p_category is null and p_sub is null) as drawer_on),
  typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.published_at, bp.wears,
           -- D-191: the sub-category and Popular's numbers, worked out once a day (_refresh_places)
           sb.slug as sub_slug, coalesce(pl.score, 0) as score, coalesce(pl.band, 1) as band,
           md5(p.id::text || w.week) as pop_turn,
           (p_sub is null or sb.slug = p_sub) as b_ok,
           -- L8: pieces published at the same moment take turns by shop and category
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane,
           -- D-195: 'any-state' is every state's pieces and none of the all-India ones (Traditional wear)
           (p_region is null or p.region_slug = p_region
             or (p_region = 'any-state' and p.region_slug is not null)
             or (p_region <> 'any-state' and p.region_slug is null)) as r_ok,
           (p_category is null or p.category_slug = p_category) as c_ok,
           ((p_min_cents is null and p_max_cents is null)
             or (p.price_cents >= coalesce(p_min_cents, 0)
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
    left join public.product_place pl on pl.product_id = p.id
    left join public.subcategories sb on sb.id = pl.subcategory_id
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and b_ok and p_ok and s_ok and f_ok and not touch),
  touches as (select * from typed where r_ok and c_ok and b_ok and p_ok and s_ok and f_ok and touch),
  -- the active variants of the pieces in view, read once (typed holds only pieces customers may see)
  vs as materialized (
    select t.id, t.product_type, coalesce(v.options ->> 'size', '') as sz, coalesce(v.options ->> 'pack', '') as pk
    from typed t
    join public.product_variants v on v.product_id = t.id and v.is_active
    where t.r_ok and t.c_ok and t.b_ok and t.p_ok and t.f_ok),
  -- each distinct raw size or pack spelled once (materialized: else _variant_size is inlined into every option)
  spelled as materialized (
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
    -- D-191: the rail: the sub-categories in view with their counts and the photo of each one's first piece (a chosen
    -- category's in their order; all of a type's, biggest first)
    'subcategories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.sub_slug, 'name', sc.name, 'category_slug', sc.category_slug, 'count', g.n,
                                          'image_path', (select sp.primary_image_path from public.store_products sp where sp.id = g.first_id))
                       order by case when p_category is null then -g.n end, sc.sort_order, sc.name)
      from (select sub_slug, count(*) as n, (array_agg(id order by score desc, band, pop_turn))[1] as first_id
            from typed where r_ok and c_ok and p_ok and s_ok and f_ok and sub_slug is not null
            group by sub_slug) g
      join public.subcategories sc on sc.slug = g.sub_slug), '[]'::jsonb),
    -- D-140: For, counted with every other filter applied (unisex pieces count under both)
    'wears', (select jsonb_build_object(
                'women', count(*) filter (where wears in ('women', 'unisex')),
                'men', count(*) filter (where wears in ('men', 'unisex')))
              from typed where r_ok and c_ok and b_ok and p_ok and s_ok),
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
      from typed where r_ok and c_ok and b_ok and s_ok and f_ok),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', (select sp.primary_image_path from public.store_products sp where sp.id = s.id),
               'pack', public._store_pack(s.id, s.name, s.product_type),
               -- D-140 (F9): the card's + picks a size or pack right there
               'options', public._store_card_options(s.id)) || public._offer_key(s.id)
             order by s.k)
      from (select x.*,
                   row_number() over (order by
                     -- L2, founder 2026-11-03: the state's own pieces before the all-India ones, whatever the sort
                     case when p_region is not null then region_slug is null end,
                     -- D-144: one of each, then step up. D-191: on Popular too, by each category's best
                     case when w.drawer_on or w.sort_ = 'popular' then step end,
                     case when w.sort_ = 'popular' then score end desc,
                     case when w.sort_ = 'popular' then band end,
                     case when w.sort_ = 'popular' then pop_turn end,
                     case when w.sort_ in ('price-asc', 'low') then price_cents end,
                     case when w.sort_ = 'price-desc' then price_cents end desc,
                     published_at desc nulls last, turn, lane, name, id) as k
            from (select shown.*,
                         row_number() over (partition by (p_region is not null and region_slug is null), category_slug
                                            order by case when v.sort_ = 'popular' then score end desc,
                                                     case when v.sort_ = 'popular' then band end,
                                                     case when v.sort_ = 'popular' then pop_turn end,
                                                     price_cents, id) as step
                  from shown cross join wanted v) x
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
               'price_cents', t.price_cents, 'primary_image_path', (select sp.primary_image_path from public.store_products sp where sp.id = t.id),
               'pack', public._store_pack(t.id, t.name, t.product_type),
               'options', public._store_card_options(t.id)) || public._offer_key(t.id)
             order by t.k)
      from (select touches.*,
                   row_number() over (order by case when p_region is not null then region_slug is null end,
                                               price_cents, published_at desc nulls last, name, id) as k
            from touches
            order by k
            offset greatest(coalesce(p_offset, 0), 0) / 2
            limit (least(greatest(coalesce(p_limit, 24), 1), 500) + 1) / 2) t), '[]'::jsonb));
$$;

revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, text) from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, text) to anon, authenticated, service_role;
