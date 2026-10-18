-- =============================================================================
-- D-140 (design plan F8, F9): the card's + picks the size (clothing) or the pack, flavour or type (food, home & gifts)
-- right on the card, and the card shows how many are in the bag. Each card carries its options so the picker opens
-- with no request: the variant, its label and options, its own price and what is left (store_variants already shows
-- all of these on the product page; nothing else). At most 20 options a card. quick_add stays (the app).
-- A See all card's options are as fresh as its cached page (up to 5 minutes after a sale); checkout re-checks stock.
-- =============================================================================

create function public._store_card_options(p_product uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'options', o.options,
                                               'price_cents', o.price_cents, 'available', o.available)
                            order by o.sort_order, o.label), '[]'::jsonb)
  from (select sv.id, sv.label, sv.options, sv.price_cents, sv.available, sv.sort_order
        from public.store_variants sv
        where sv.product_id = p_product
        order by sv.sort_order, sv.label
        limit 20) o
$$;
revoke all on function public._store_card_options(uuid) from public, anon, authenticated;

-- As 20261016200000_coming_soon, with the options.
CREATE OR REPLACE FUNCTION public._store_product_card(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'pack', public._store_pack(p.id, p.name, p.product_type),
    'available', v.available,
    'coming_soon', p.coming_soon,
    -- D-140 (F9): every option the + offers on the card, with its own price and what is left
    'options', case when not p.coming_soon then public._store_card_options(p.id) end,
    -- With exactly one variant, max() is that variant.
    'quick_add', case when v.n = 1 and v.available > 0 and not p.coming_soon
                      then jsonb_build_object('variant_id', v.one_id, 'label', v.one_label, 'price_cents', v.one_price)
                 end)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$function$;

-- As 20261018100000_wears_and_rows, with the options on each card.
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
              select 1 from public.store_variants v
              where v.product_id = p.id and public._variant_size(v.options, p.product_type) = any (w.sizes))) as s_ok,
           (w.for_ is null or bp.wears in (w.for_, 'unisex')) as f_ok
    from public.store_products p
    join public.products bp on bp.id = p.id
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok)
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
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('value', g.size, 'count', g.n) order by g.size)
      from (select z.size, count(distinct t.id) as n
            from typed t
            join public.store_variants v on v.product_id = t.id
            cross join lateral (select public._variant_size(v.options, t.product_type) as size) z
            where t.r_ok and t.c_ok and t.p_ok and t.f_ok and z.size is not null
            group by z.size) g), '[]'::jsonb),
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

