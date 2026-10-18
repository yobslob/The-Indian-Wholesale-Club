-- =============================================================================
-- D-140 (design plan F2, L2, L8): who a piece is for, a state's own pieces first, and Newest that mixes shops.
--  - products.wears: women, men, kids or unisex (the vendor screens' words, D-102). A clothing listing gets it from its
--    name when nobody set it (the founder's kind of rules, D-132: "women's", "men's", "boys", "girls", "unisex"), else
--    from its category where the category says it (sarees, lehengas, dupattas: women; dhotis and mundus: men; kids:
--    kids; shawls, fabrics, accessories, headwear: unisex). A clothing listing cannot go live without it.
--    No Kids at launch (founder: "no kids at launch"): kids' pieces are marked, nothing offers them as a filter.
--  - store_browse() takes p_for ('women' | 'men'; unisex pieces show under both) and returns 'wears' counts; sizes read
--    as one spelling ("One Size", "Free size" and a piece with no size → "One size"; "L-XL" = "L/XL"), and a size
--    filter matches that spelling.
--  - L2 (founder: "When a state is opened its own pieces should be top of the horizontal rows"): See all with a state
--    puts the state's own pieces before the all-India ones (newest first within each); the state page's Most wanted,
--    Curated and Leaving soon do too (their outer order dropped it).
--  - L8: pieces published at the same moment (Publish all drafts, a shop's whole collection) are mixed by shop and
--    category instead of A–Z, on See all and Home's Just listed rows.
-- Only customer-safe fields leave the functions (D-003): the shop is used to mix, never shown.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Who it is for
-- -----------------------------------------------------------------------------
alter table public.products
  add column wears text check (wears in ('women', 'men', 'kids', 'unisex'));

comment on column public.products.wears is
  'D-140: who the piece is for (clothing): women, men, kids or unisex. Unisex shows under Women and Men.';

-- From the name: kids' words first ("girls' lehenga" is a kid's), then unisex, women, men, then garments only women or
-- only men wear (a saree, a sherwani).
create function public._wears_from_name(p_name text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_name ~* '\m(kids?|kid''s|boys?|boy''s|girls?|girl''s|baby|babies|infants?|toddlers?|children|child)\M' then 'kids'
    when p_name ~* '\munisex\M' then 'unisex'
    when p_name ~* '\m(women|womens|women''s|woman|ladies|lady|female)\M' then 'women'
    when p_name ~* '\m(men|mens|men''s|man|gents|male)\M' then 'men'
    -- what only women or only men wear, by name
    when p_name ~* '\m(sarees?|saris?|lehengas?|lehnga|ghagra|chaniya|blouses?|kurtis?|salwars?|anarkali|churidars?|dupattas?|palazzos?|nighty|leggings)\M' then 'women'
    when p_name ~* '\m(sherwanis?|dhotis?|lungis?|pathani|veshti)\M' then 'men'
  end
$$;

create function public._wears_from_category(p_slug text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select case
    when p_slug in ('sarees', 'lehengas', 'dupattas-and-stoles') then 'women'
    when p_slug = 'dhotis-and-mundus' then 'men'
    when p_slug = 'kids' then 'kids'
    when p_slug in ('shawls', 'fabrics', 'accessories', 'headwear') then 'unisex'
  end
$$;

-- A clothing listing without a "wears" gets one from its name, else its category, whenever it is saved.
create function public._product_wears() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.product_type = 'clothing' and new.wears is null then
    new.wears := coalesce(public._wears_from_name(new.name),
                          public._wears_from_category((select slug from public.categories where id = new.category_id)));
  end if;
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live')
     and new.product_type = 'clothing' and new.wears is null and not new.is_placeholder then
    raise exception 'wears_missing: % needs who it is for (women, men, kids or unisex) before it sells (D-140)', new.name
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public._wears_from_name(text), public._wears_from_category(text), public._product_wears()
  from public, anon, authenticated;

create trigger products_wears
  before insert or update of status, name, category_id, wears, product_type on public.products
  for each row execute function public._product_wears();

update public.products p
   set wears = coalesce(public._wears_from_name(p.name), public._wears_from_category(c.slug))
  from public.categories c
 where c.id = p.category_id and p.product_type = 'clothing' and p.wears is null;

create index products_wears_idx on public.products (wears) where status = 'live';

-- -----------------------------------------------------------------------------
-- 2. One spelling per size
-- -----------------------------------------------------------------------------
create function public._size_norm(p text) returns text
language sql immutable set search_path = public, pg_temp as $$
  with s as (select btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')) as v)
  select case
    when v = '' then null
    when lower(v) in ('one size', 'onesize', 'one-size', 'free size', 'freesize', 'free') then 'One size'
    when upper(replace(v, ' ', '')) ~ '^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)$' then upper(replace(v, ' ', ''))
    when upper(replace(v, ' ', '')) ~ '^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)[-/](XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)$'
      then replace(upper(replace(v, ' ', '')), '-', '/')
    else v
  end from s
$$;

-- A variant's size as the filters show it: its size, else food's pack, else (clothing) One size.
create function public._variant_size(p_options jsonb, p_type public.product_type) returns text
language sql immutable set search_path = public, pg_temp as $$
  select coalesce(public._size_norm(p_options ->> 'size'), nullif(btrim(p_options ->> 'pack'), ''),
                  case when p_type = 'clothing' then 'One size' end)
$$;
revoke all on function public._size_norm(text), public._variant_size(jsonb, public.product_type) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. See all: For, one spelling per size, own pieces first, same-moment pieces mixed
-- -----------------------------------------------------------------------------
drop function public.store_browse(text, text, text, integer, integer, integer, integer, text, text);

create function public.store_browse(p_type text, p_region text default null, p_category text default null,
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
               'coming_soon', s.coming_soon)
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

revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text) from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Home: Just listed rows mix same-moment pieces (L8). As 20261016210000_browse_filters otherwise.
-- -----------------------------------------------------------------------------
create or replace function public.store_home()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  with ranked as (
    select p.id, p.product_type, p.published_at, p.name,
           row_number() over (partition by p.published_at, bp.vendor_id, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.vendor_id::text, '') || coalesce(p.category_slug, '')) as lane
    from public.store_products p
    join public.products bp on bp.id = p.id),
  newest as (
    select x.*,
           row_number() over (partition by x.product_type order by x.published_at desc nulls last, x.turn, x.lane, x.name) as k,
           row_number() over (order by x.published_at desc nulls last, x.name) as overall
    from ranked x)
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
      select jsonb_agg(public._store_product_card(n.id) order by n.overall)
      from newest n where n.overall <= 12), '[]'::jsonb),
    'just_listed_types', (
      select jsonb_object_agg(t.product_type, coalesce((
               select jsonb_agg(public._store_product_card(n.id) order by n.k)
               from newest n where n.product_type = t.product_type and n.k <= 12), '[]'::jsonb))
      from unnest(enum_range(null::public.product_type)) t(product_type)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$function$;

-- -----------------------------------------------------------------------------
-- 5. A state's page: its own pieces first in every row (L2). As 20261014140000_all_india_and_bands otherwise.
-- -----------------------------------------------------------------------------
create or replace function public.store_region_page(p_region_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'alt_text', ph.alt_text)
                       order by ph.sort_order, ph.created_at)
      from public.region_photos ph where ph.region_id = r.id), '[]'::jsonb),
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
      select jsonb_agg(public._store_product_card(w.id) order by w.all_india, w.ordered desc, w.published_at desc nulls last, w.name)
      from (select p.id, p.published_at, p.name, o.ordered, (p.region_id is null) as all_india
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
            order by (p.region_id is null), o.ordered desc, p.published_at desc nulls last, p.name
            limit 12) w), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.all_india, c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name, (p.region_id is null) as all_india from public.store_products p
            where (p.region_id = r.id or p.region_id is null) and p.is_curated
            order by (p.region_id is null), p.published_at desc nulls last, p.name limit 12) c), '[]'::jsonb),
    'leaving_soon', coalesce((
      select jsonb_agg(public._store_product_card(l.id) order by l.all_india, l.available, l.published_at desc nulls last, l.name)
      from (select p.id, p.published_at, p.name, a.available, (p.region_id is null) as all_india
            from public.store_products p
            cross join lateral (select coalesce(sum(v.available), 0) as available
                                from public.store_variants v where v.product_id = p.id) a
            where (p.region_id = r.id or p.region_id is null) and a.available between 1 and public._leaving_soon_max()
            order by (p.region_id is null), a.available, p.published_at desc nulls last, p.name limit 12) l), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$function$;
