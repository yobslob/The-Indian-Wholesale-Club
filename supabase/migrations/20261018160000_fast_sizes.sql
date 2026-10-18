-- =============================================================================
-- D-140 follow-up (2026-10-18): the production build timed out prerendering See all (statement timeout, anon 3 s).
-- At production volume store_browse('food') spent 1.05 s of 1.31 s in _size_norm, called twice for each of 9,000
-- variants: a SQL function with a CTE and a SET clause is never inlined, so each call ran as its own query.
--  - _size_norm and _variant_size are single expressions with no SET clause (they read no table), so Postgres inlines
--    them like any expression.
--  - See all's size list reads the pieces' variants once (the base table: the pieces are already the visible ones),
--    spells each distinct size or pack once (a few dozen), then counts pieces per spelling with a plain join.
-- Same results; tests: wears_and_rows.test.sql, browse_filters.test.sql.
-- =============================================================================

create or replace function public._size_norm(p text) returns text
language sql immutable as $$
  select case
    when btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) = '' then null
    when lower(btrim(regexp_replace(p, '\s+', ' ', 'g'))) in ('one size', 'onesize', 'one-size', 'free size', 'freesize', 'free')
      then 'One size'
    when upper(regexp_replace(p, '\s+', '', 'g')) ~ '^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)$'
      then upper(regexp_replace(p, '\s+', '', 'g'))
    when upper(regexp_replace(p, '\s+', '', 'g')) ~ '^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)[-/](XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)$'
      then replace(upper(regexp_replace(p, '\s+', '', 'g')), '-', '/')
    else btrim(regexp_replace(p, '\s+', ' ', 'g'))
  end
$$;

create or replace function public._variant_size(p_options jsonb, p_type public.product_type) returns text
language sql immutable as $$
  select coalesce(public._size_norm(p_options ->> 'size'), nullif(btrim(p_options ->> 'pack'), ''),
                  case when p_type = 'clothing' then 'One size' end)
$$;
alter function public._size_norm(text) reset all;
alter function public._variant_size(jsonb, public.product_type) reset all;

-- As 20261018120000_card_options, with the size list spelled once per distinct size.
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
           case when p_for in ('women', 'men') then p_for end as for_),
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
           (w.for_ is null or bp.wears in (w.for_, 'unisex')) as f_ok
    from public.store_products p
    join public.products bp on bp.id = p.id
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok),
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
      from (select shown.*,
                   row_number() over (order by
                     case when p_sort in ('price-asc', 'price-desc') then coming_soon end,
                     case when p_sort = 'price-asc' then price_cents end,
                     case when p_sort = 'price-desc' then price_cents end desc,
                     -- L2: newest first, the state's own pieces before the all-India ones
                     case when p_region is not null and coalesce(p_sort, 'new') not in ('price-asc', 'price-desc')
                          then region_slug is null end,
                     published_at desc nulls last, turn, lane, name, id) as k
            from shown
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$function$;
