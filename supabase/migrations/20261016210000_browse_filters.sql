-- =============================================================================
-- D-136: proper filters on the See all pages and per-type Just listed on Home (founder: "On the products page I want
-- a proper filter on the left panel ... Under the just listed on home page, I want the same pill which chooses
-- clothing, food and home decor").
--  - store_browse() takes a price range (p_min_cents, p_max_cents: only pieces with a price shown, so coming-soon
--    pieces drop out), sizes (p_sizes: '|'-separated option values; a piece matches when any of its options is one;
--    food's pack counts as its size) and a sort (p_sort: 'price-asc', 'price-desc', else newest first).
--    It adds the counts the new filters need, each counted with every other filter applied: 'sizes' (value, pieces),
--    'prices' (min, max, quartiles in cents, for the slider and its ready-made ranges) and 'states_total' (pieces in
--    all states). 'regions' and 'categories' keep their meaning (states: the whole type; categories: within the state)
--    with the price and size filters applied, so the app's Browse (which sends neither) reads exactly as before.
--  - store_home() adds 'just_listed_types': the twelve newest of each product type. 'just_listed' stays (the app).
-- Still one round trip per page (PR-2); only what store_products / store_variants already show.
-- =============================================================================

drop function public.store_browse(text, text, text, integer, integer);

create function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null)
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with wanted as (
    select nullif(array_remove(string_to_array(p_sizes, '|'), ''), '{}') as sizes),
  typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at, p.coming_soon,
           (p_region is null or p.region_slug = p_region or p.region_slug is null) as r_ok,
           (p_category is null or p.category_slug = p_category) as c_ok,
           ((p_min_cents is null and p_max_cents is null)
             or (not p.coming_soon and p.price_cents >= coalesce(p_min_cents, 0)
                 and p.price_cents <= coalesce(p_max_cents, 2147483647))) as p_ok,
           (w.sizes is null or exists (
              select 1 from public.store_variants v
              where v.product_id = p.id
                and coalesce(v.options ->> 'size', v.options ->> 'pack') = any (w.sizes))) as s_ok
    from public.store_products p cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and p_ok and s_ok)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    -- D-122: everything of the type (the states' counts each include the all-India pieces)
    'all_total', (select count(*) from typed),
    -- D-136: "All states" with the price and size filters applied
    'states_total', (select count(*) from typed where p_ok and s_ok),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null and p_ok and s_ok))
             order by g.region_name)
      from (select region_slug, region_name, count(*) filter (where p_ok and s_ok) as n
            from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from typed where r_ok and p_ok and s_ok
            group by category_slug, category_name) g),
      '[]'::jsonb),
    'sizes', coalesce((
      select jsonb_agg(jsonb_build_object('value', g.size, 'count', g.n) order by g.size)
      from (select z.size, count(distinct t.id) as n
            from typed t
            join public.store_variants v on v.product_id = t.id
            cross join lateral (select coalesce(v.options ->> 'size', v.options ->> 'pack') as size) z
            where t.r_ok and t.c_ok and t.p_ok and z.size is not null and z.size <> ''
            group by z.size) g), '[]'::jsonb),
    'prices', (
      select case when count(*) > 0 then jsonb_build_object(
               'min', min(price_cents), 'max', max(price_cents),
               'q1', percentile_disc(0.25) within group (order by price_cents),
               'q2', percentile_disc(0.5) within group (order by price_cents),
               'q3', percentile_disc(0.75) within group (order by price_cents)) end
      from typed where r_ok and c_ok and s_ok and not coming_soon),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type),
               'coming_soon', s.coming_soon)
             order by s.k)
      from (select shown.*,
                   -- id last: pages never repeat or skip a product; coming-soon pieces (no price) last in a price sort
                   row_number() over (order by
                     case when p_sort in ('price-asc', 'price-desc') then coming_soon end,
                     case when p_sort = 'price-asc' then price_cents end,
                     case when p_sort = 'price-desc' then price_cents end desc,
                     published_at desc nulls last, name, id) as k
            from shown
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$function$;

revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text) from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text)
  to anon, authenticated, service_role;

-- As 20261012150000_home_album, with just_listed_types (D-136).
create or replace function public.store_home()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', a.storage_path, 'alt_text', a.alt_text)
                       order by a.source, a.turn, a.region_order)
      from (
        select x.* from (
          select ph.storage_path, ph.alt_text, 0 as source, r.sort_order as region_order,
                 row_number() over (partition by ph.region_id order by ph.sort_order, ph.created_at) as turn
          from public.region_photos ph
          join public.store_regions r on r.id = ph.region_id
          union all
          select m.storage_path, m.alt_text, 1, r.sort_order,
                 row_number() over (partition by p.region_id order by p.published_at desc nulls last, p.name)
          from public.store_products p
          join public.store_regions r on r.id = p.region_id
          join lateral (select sm.storage_path, sm.alt_text from public.store_media sm
                        where sm.product_id = p.id
                        order by sm.is_primary desc, sm.sort_order limit 1) m on true
        ) x
        order by x.source, x.turn, x.region_order
        limit 30) a), '[]'::jsonb),
    'just_listed', coalesce((
      select jsonb_agg(public._store_product_card(n.id) order by n.published_at desc nulls last, n.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            order by p.published_at desc nulls last, p.name limit 12) n), '[]'::jsonb),
    'just_listed_types', (
      select jsonb_object_agg(t.product_type, coalesce((
               select jsonb_agg(public._store_product_card(n.id) order by n.published_at desc nulls last, n.name)
               from (select p.id, p.published_at, p.name from public.store_products p
                     where p.product_type = t.product_type
                     order by p.published_at desc nulls last, p.name limit 12) n), '[]'::jsonb))
      from unnest(enum_range(null::public.product_type)) t(product_type)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$function$;

-- -----------------------------------------------------------------------------
-- D-136: Products' filters in the admin (type, state or all-India, category, shop, price) reach Download Excel too,
-- so the sheet is always the page's view. As 20261015150100_price_sheet, with the new filters.
-- -----------------------------------------------------------------------------
drop function public.admin_price_sheet(public.product_status, boolean, text);

create function public.admin_price_sheet(p_status public.product_status default null,
                                         p_us_stock boolean default false,
                                         p_search text default null,
                                         p_type public.product_type default null,
                                         p_region uuid default null,
                                         p_no_region boolean default false,
                                         p_category uuid default null,
                                         p_vendor uuid default null,
                                         p_min_cents integer default null,
                                         p_max_cents integer default null)
returns table (name text, product_type public.product_type, shop_price_paise integer, weight_g integer,
               price_cents integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select p.name, p.product_type, pick.shop, pick.g, p.price_cents
    from public.products p
   cross join lateral (select max(v.weight_g) as g from public.product_variants v
                        where v.product_id = p.id and v.is_active) wmax
   cross join lateral (
     select x.shop, x.g
       from (select 0 as src, v.sort_order as ord, v.shop_price_paise as shop,
                    coalesce(v.weight_g, wmax.g,
                             public._fallback_weight_g(p.product_type, v.shop_price_paise, p.category_id)) as g
               from public.product_variants v
              where v.product_id = p.id and v.is_active and v.shop_price_paise is not null
             union all
             select 1, 0, p.shop_price_paise,
                    coalesce(wmax.g, public._fallback_weight_g(p.product_type, p.shop_price_paise, p.category_id))) x
      order by x.src, public._auto_price_cents(x.shop, x.g, p.product_type) nulls last, x.ord
      limit 1) pick
   where (p_status is null or p.status = p_status)
     and (not coalesce(p_us_stock, false) or p.is_us_stock)
     and (coalesce(trim(p_search), '') = '' or p.search @@ websearch_to_tsquery('simple', trim(p_search)))
     and (p_type is null or p.product_type = p_type)
     and (p_region is null or p.region_id = p_region)
     and (not coalesce(p_no_region, false) or p.region_id is null)
     and (p_category is null or p.category_id = p_category)
     and (p_vendor is null or p.vendor_id = p_vendor)
     and (p_min_cents is null or p.price_cents >= p_min_cents)
     and (p_max_cents is null or p.price_cents <= p_max_cents)
   order by p.updated_at desc, p.id
   limit 20000;
end $$;

revoke all on function public.admin_price_sheet(public.product_status, boolean, text, public.product_type, uuid, boolean,
                                                uuid, uuid, integer, integer) from public, anon;
grant execute on function public.admin_price_sheet(public.product_status, boolean, text, public.product_type, uuid, boolean,
                                                   uuid, uuid, integer, integer) to authenticated;
