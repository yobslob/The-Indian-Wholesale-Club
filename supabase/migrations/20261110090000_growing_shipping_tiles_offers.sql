-- =============================================================================
-- D-190 (founder 2026-11-06): three things in the store's reads and the bag's charges.
--  1. Shipping follows every piece: the heaviest piece is billed as before (at least 1 kg, then by the half kg, at the $ a
--     kg in Settings) and every other piece adds its own weight, never under the whole bag by the half kg (D-154). One piece pays what it paid; paid below the free line,
--     struck through above it. Changes what small bags pay. Orders already placed keep their amounts.
--  2. Shop by category: Shirts (men), Tops (women), Pants, Dresses, Kurtis (women), Sarees and Gifts in; Ground
--     Spices out. A tile may carry a `for`; its count is the filter's.
--  3. Struck-through prices on a random offer_pct % of the listings priced by the rules (not hand-priced, not US
--     clearance): the card and product page get `offer: true`, and the display works out the figure
--     (packages/shared/src/domain/pricing.ts, wasCents). Nothing is stored per listing, and no charge, order or Stripe amount
--     changes. Picked from the listing's id, so a listing stays picked on every page.
-- Cost (D-147): one small read per card drawn, no new table, index or page-cache write. A picked card carries 13 more
-- bytes of data; Home's cached answer gains about 700 bytes for six more tiles. No read in the browser.
-- =============================================================================

alter table public.pricing_settings
  add column offer_pct integer not null default 55 check (offer_pct between 0 and 100);

comment on column public.pricing_settings.offer_pct is
  'D-190: the % of the listings priced by the rules that show a struck-through price; 0 = none. Display only.';

create function public._offer_key(p_product_id uuid) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when p.price_auto and not p.is_us_stock
                   and ('x' || left(md5(p.id::text), 8))::bit(32)::bigint % 100 < s.offer_pct
              then '{"offer": true}'::jsonb else '{}'::jsonb end
  from public.products p
  cross join public.pricing_settings s
  where p.id = p_product_id and s.id = 1;
$$;
revoke all on function public._offer_key(uuid) from public, anon, authenticated;
grant execute on function public._offer_key(uuid) to service_role;

-- ---------------------------------------------------------------- 1. Shipping

create or replace function public._bag_shipments(p_items jsonb, p_discount_cents integer default 0,
                                                 p_state text default null, p_line1 text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.pricing_settings;
  v_on boolean;
  v_reach boolean;
  v_goods numeric;
  v_food_goods numeric;
  v_grams numeric;
  v_food_grams numeric;
  v_food_ids uuid[];
  v_other boolean;
  v_india boolean;
  v_heaviest numeric;
  v_billed numeric;
  v_shipping integer := 0;
  v_share integer := 0;
begin
  select * into s from public.pricing_settings where id = 1;
  v_on := s.food_delivery_days_min is not null and s.food_delivery_days_max is not null;
  v_reach := (p_state is null or upper(trim(p_state)) not in
               ('AK', 'HI', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM', 'FM', 'MH', 'PW', 'AA', 'AE', 'AP'))
             and (p_line1 is null
                  or p_line1 !~* '(^|[^a-z])(p[. ]*o[. ]*box|post office box|apo|fpo|dpo)([^a-z]|$)');
  select coalesce(sum(x.q * x.price), 0),
         coalesce(sum(x.q * x.price) filter (where x.food), 0),
         coalesce(sum(x.q * x.g) filter (where not x.us), 0),
         coalesce(sum(x.q * x.g) filter (where x.food), 0),
         coalesce(array_agg(x.id) filter (where x.food), '{}'),
         coalesce(bool_or(not x.food), false),
         coalesce(bool_or(not x.us), false),
         coalesce(max(x.g) filter (where not x.us), 0)
    into v_goods, v_food_goods, v_grams, v_food_grams, v_food_ids, v_other, v_india, v_heaviest
    from (select sv.id, least(greatest(coalesce((i ->> 'quantity')::integer, 0), 0), 99) as q, sv.price_cents as price,
                 pr.is_us_stock as us,
                 coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0)
                   * case when pr.product_type = 'food' then coalesce(s.food_billed_pct, 100) / 100.0 else 1 end as g,
                 v_on and pr.product_type = 'food' and not pr.is_us_stock as food
            from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]' end) i
            join public.store_variants sv on sv.id = (i ->> 'variant_id')::uuid
            join public.product_variants pv on pv.id = sv.id
            join public.products pr on pr.id = pv.product_id
           where coalesce((i ->> 'quantity')::integer, 0) > 0) x;
  if v_india then
    -- D-190: the heaviest piece is billed as the courier bills one (at least 1 kg, then by the half kg); every other
    -- piece adds its own weight, so Shipping moves with every piece, paid below the line and struck through above it;
    -- never less than the whole bag by the half kg (D-154), which no bag may pay under
    v_billed := greatest(ceil(greatest(v_grams / 1000.0, 1) * 2) / 2,
                         ceil(greatest(v_heaviest / 1000.0, 1) * 2) / 2 + (v_grams - v_heaviest) / 1000.0);
    v_shipping := case when s.shipping_cents_per_kg is not null then round(v_billed * s.shipping_cents_per_kg)::integer
                       else coalesce(s.small_order_shipping_cents, 0) end;
    if v_reach and v_food_goods > 0 and v_other and v_grams > 0 then
      v_share := round(v_shipping * v_food_grams / v_grams)::integer;
    end if;
  end if;
  return jsonb_build_object(
    'days_min', case when v_on then s.food_delivery_days_min end,
    'days_max', case when v_on then s.food_delivery_days_max end,
    'food_cents', round(v_food_goods - case when v_goods > 0
                                            then least(greatest(coalesce(p_discount_cents, 0), 0), v_goods) * v_food_goods / v_goods
                                            else 0 end)::integer,
    'food_variant_ids', to_jsonb(v_food_ids),
    'food_only', v_reach and v_food_goods > 0 and not v_other,
    'split', v_reach and v_food_goods > 0 and v_other,
    'outside', v_food_goods > 0 and not v_reach,
    'billed_grams', case when v_india then round(v_billed * 1000)::integer else 0 end,
    'shipping_cents', v_shipping,
    'food_shipping_cents', v_share);
end $$;

-- ---------------------------------------------------------------- 3. the cards and the product page

create or replace function public._store_product_card(p_product_id uuid) returns jsonb
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'pack', public._store_pack(p.id, p.name, p.product_type),
    'available', v.available,
    -- D-140 (F9): every option the + offers on the card, with its own price and what is left
    'options', public._store_card_options(p.id),
    -- With exactly one variant, max() is that variant.
    'quick_add', case when v.n = 1 and v.available > 0
                      then jsonb_build_object('variant_id', v.one_id, 'label', v.one_label, 'price_cents', v.one_price)
                 end) || public._offer_key(p.id)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$$;

create or replace function public.store_browse(p_type text, p_region text default null, p_category text default null,
                                    p_offset integer default 0, p_limit integer default 24,
                                    p_min_cents integer default null, p_max_cents integer default null,
                                    p_sizes text default null, p_sort text default null, p_for text default null)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with wanted as (
    select nullif(array_remove(array(select public._size_norm(x) from unnest(string_to_array(p_sizes, '|')) x), null), '{}') as sizes,
           case when p_for in ('women', 'men') then p_for end as for_,
           coalesce(p_sort, 'new') as sort_,
           -- D-144: Clothing's default view, the only one with a drawer and the step-up order
           (coalesce(p_sort, 'new') = 'low' and p_type = 'clothing' and p_category is null) as drawer_on),
  typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.published_at, bp.wears,
           -- L8: pieces published at the same moment take turns by shop and category
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane,
           (p_region is null or p.region_slug = p_region or p.region_slug is null) as r_ok,
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
    cross join wanted w
    where p.product_type::text = p_type),
  shown as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok and not touch),
  touches as (select * from typed where r_ok and c_ok and p_ok and s_ok and f_ok and touch),
  -- the active variants of the pieces in view, read once (typed holds only pieces customers may see)
  vs as materialized (
    select t.id, t.product_type, coalesce(v.options ->> 'size', '') as sz, coalesce(v.options ->> 'pack', '') as pk
    from typed t
    join public.product_variants v on v.product_id = t.id and v.is_active
    where t.r_ok and t.c_ok and t.p_ok and t.f_ok),
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
      from typed where r_ok and c_ok and s_ok and f_ok),
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
                     -- D-144: one of each, then step up
                     case when w.drawer_on then step end,
                     case when w.sort_ in ('price-asc', 'low') then price_cents end,
                     case when w.sort_ = 'price-desc' then price_cents end desc,
                     published_at desc nulls last, turn, lane, name, id) as k
            from (select shown.*,
                         row_number() over (partition by (p_region is not null and region_slug is null), category_slug
                                            order by price_cents, id) as step
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

create or replace function public.store_search_page(p_query text, p_type text default null, p_category text default null,
                                                    p_region text default null, p_sort text default null,
                                                    p_offset integer default 0, p_limit integer default 24,
                                                    p_record boolean default true, p_quick boolean default false)
returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
set plan_cache_mode to 'force_custom_plan'
as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_cap constant integer := 1000;
  v_m record;
  v_words text[];
  v_phrase tsquery;
  v_named text[];
  v_price boolean := p_sort in ('price-asc', 'price-desc');
  v_result jsonb;
  v_total integer;
begin
  select * into v_m from public._search_match(v_query);
  v_words := coalesce(v_m.fixed, v_m.words);
  -- several words, in order, in the listing's name ("block print kurti")
  if cardinality(v_words) > 1 then
    v_phrase := phraseto_tsquery('english', array_to_string(v_words, ' '));
    if numnode(v_phrase) = 0 then
      v_phrase := null;
    end if;
  end if;
  -- the states the words name ("kerala", "punjabi"): their pieces first, and offered as a filter
  select coalesce(array_agg(r.slug order by r.name), '{}') into v_named
  from public.regions r
  where v_m.mode <> 'none'
    and exists (select 1 from unnest(v_m.groups) g where to_tsvector('english', r.name) @@ g);

  with m as materialized (
    select s.product_id as id, s.product_type::text as product_type, r.slug as region_slug, r.name as region_name,
           c.slug as category_slug, c.name as category_name, s.published_at,
           ts_rank(s.doc, v_m.ts)
             + 0.5 * (select count(*) from unnest(v_m.groups) g where s.doc @@ g)
             + case when s.doc @@ v_m.exact then 0.3 else 0 end
             + case when ts_filter(s.doc, '{a}') @@ v_phrase then 0.5 else 0 end
             + case when r.slug = any (v_named) then 0.2 else 0 end
             + case when s.published_at > now() - interval '14 days' then 0.05 else 0 end as score
    from public.product_search s
    join public.categories c on c.id = s.category_id
    left join public.regions r on r.id = s.region_id
    where s.product_id = any (v_m.ids)),
  f as (
    select m.*,
           (p_type is null or m.product_type = p_type) as t_ok,
           (p_category is null or m.category_slug = p_category) as c_ok,
           (p_region is null or m.region_slug = p_region or m.region_slug is null) as r_ok
    from m),
  shown as (select * from f where t_ok and c_ok and r_ok),
  -- the best 1,000 by the order below without stock (a price sort reads each match's price), then their stock
  cand as materialized (
    select shown.id, shown.score, shown.published_at, x.price_cents
    from shown
    left join lateral (select p.price_cents from public.products p where v_price and p.id = shown.id) x on true
    order by case when p_sort = 'price-asc' then x.price_cents end,
             case when p_sort = 'price-desc' then x.price_cents end desc,
             case when p_sort = 'new' then shown.published_at end desc nulls last,
             shown.score desc, shown.published_at desc nulls last, shown.id
    limit v_cap),
  ranked as (
    select cand.*,
           not exists (select 1 from public.variant_availability a
                       where a.product_id = cand.id and a.available > 0) as last
    from cand)
  select jsonb_build_object(
    'query', v_query,
    'fixed', array_to_string(v_m.fixed, ' '),
    'mode', v_m.mode,
    'total', (select count(*) from (select 1 from shown limit v_cap) x),
    'all_total', (select count(*) from (select 1 from m limit v_cap) x),
    'capped', (select count(*) > v_cap from (select 1 from shown limit v_cap + 1) x),
    'slow', v_m.slow,
    'types', coalesce((select jsonb_object_agg(product_type, n) from (
                         select product_type, count(*) as n from f where r_ok group by product_type) t), '{}'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', category_slug, 'name', category_name, 'type', product_type, 'count', n)
                       order by n desc, category_name)
      from (select category_slug, category_name, product_type, count(*) as n from f where t_ok and r_ok
            group by category_slug, category_name, product_type order by count(*) desc, category_name limit 12) c),
      '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', region_slug, 'name', region_name, 'count', n) order by n desc, region_name)
      from (select region_slug, region_name, count(*) as n from f where t_ok and c_ok and region_slug is not null
            group by region_slug, region_name order by count(*) desc, region_name limit 12) r),
      '[]'::jsonb),
    'named_regions', to_jsonb(v_named),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
               'region_slug', p.region_slug, 'region_name', p.region_name,
               'category_slug', p.category_slug, 'category_name', p.category_name,
               'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path,
               'pack', public._store_pack(p.id, p.name, p.product_type),
               'options', public._store_card_options(p.id)) || public._offer_key(p.id)
             order by k.k)
      from (select ranked.id, row_number() over (order by
                     -- what cannot be bought last, whatever the order
                     ranked.last,
                     case when p_sort = 'price-asc' then ranked.price_cents end,
                     case when p_sort = 'price-desc' then ranked.price_cents end desc,
                     case when p_sort = 'new' then ranked.published_at end desc nulls last,
                     ranked.score desc, ranked.published_at desc nulls last, ranked.id) as k
            from ranked
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) k
      join public.store_products p on p.id = k.id), '[]'::jsonb))
  into v_result;

  if coalesce(p_record, true) and coalesce(p_offset, 0) = 0 and v_query <> ''
     and p_type is null and p_category is null and p_region is null and p_sort is null then
    v_total := case when v_m.mode = 'some' then 0 else cardinality(v_m.ids) end;
    insert into public.search_queries (query, results, fixed, partial)
    values (lower(v_query), v_total, case when v_m.mode = 'fixed' then array_to_string(v_m.fixed, ' ') end,
            v_m.mode = 'some');
  end if;
  return v_result;
end $$;

create or replace function public.store_product_page(p_region_slug text, p_product_slug text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'product', (to_jsonb(p) - 'search' - 'is_curated') || public._offer_key(p.id),
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.sort_order, v.label)
      from public.store_variants v where v.product_id = p.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.sort_order)
      from public.store_media m where m.product_id = p.id), '[]'::jsonb),
    'similar', coalesce((
      select jsonb_agg(public._store_product_card(s.id) order by s.same_region desc, s.published_at desc nulls last, s.name)
      from (select u.* from (
              (select o.id, o.published_at, o.name, true as same_region
               from public.store_products o
               where o.category_id = p.category_id and o.id <> p.id
                 and coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
               order by o.published_at desc nulls last, o.name limit 12)
              union all
              (select o.id, o.published_at, o.name, false
               from public.store_products o
               where o.category_id = p.category_id
                 and coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) <> coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid)
               order by o.published_at desc nulls last, o.name limit 12)) u
            order by u.same_region desc, u.published_at desc nulls last, u.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where coalesce(o.region_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p.region_id, '00000000-0000-0000-0000-000000000000'::uuid) and o.is_curated and o.id <> p.id
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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),  -- TODO(D-187): drop when app <next version> is the minimum
    'quick_delivery', null,  -- TODO(D-187): drop when app <next version> is the minimum
    -- A piece already in the US ships at once: its window is today + the US delivery days.
    'ships_from_us', case when p.is_us_stock then (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null) end
  )
  from public.store_products p
  where coalesce(p.region_slug, 'india') = p_region_slug and p.slug = p_product_slug;
$$;

-- ---------------------------------------------------------------- 2. Home's tiles (and its cards, above)

create or replace function public.store_home() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with ranked as (
    select p.id, p.product_type, p.published_at, p.name,
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane
    from public.store_products p
    join public.products bp on bp.id = p.id),
  newest as (
    select x.*,
           row_number() over (partition by x.product_type order by x.published_at desc nulls last, x.turn, x.lane, x.name) as k,
           row_number() over (order by x.published_at desc nulls last, x.name) as overall
    from ranked x),
  -- The tiles (D-190; their photos: apps/web/features/home/tile-photos.ts), each with its count, biggest first. A tile with
  -- a `who` counts as that filter does: pieces for them and unisex pieces. Gifts (`whole`) is all of Home & gifts, which has
  -- no gifts category; its slug is where an older app, which reads only the slug, lands.
  tile_list (category_slug, label, who, whole) as (
    values ('snacks-and-namkeen', null, null, false), ('sweets', null, null, false), ('rice-flours-and-staples', null, null, false),
           ('masala-blends', null, null, false), ('pickles-and-chutneys', null, null, false), ('whole-spices', null, null, false),
           ('tea-and-drinks', null, null, false), ('papad-and-wadi', null, null, false),
           ('pooja-and-spiritual', null, null, false), ('thaali-and-serveware', null, null, false),
           ('handicrafts-and-decor', null, null, false), ('handicrafts-and-decor', 'Gifts', null, true),
           ('shirts-and-tops', 'Shirts', 'men', false), ('shirts-and-tops', 'Tops', 'women', false),
           ('jeans-and-trousers', 'Pants', null, false), ('co-ords-and-dresses', 'Dresses', null, false),
           ('kurtas', 'Kurtis', 'women', false), ('sarees', 'Sarees', null, false)),
  tiles as (
    select l.category_slug, coalesce(l.label, min(p.category_name)) as category_name, min(p.product_type::text)::public.product_type as product_type,
           l.who, l.whole, count(*) as n,
           -- the photo of its newest piece that has one
           (array_agg(p.primary_image_path order by p.published_at desc nulls last, p.id)
              filter (where p.primary_image_path is not null))[1] as image_path
    from tile_list l
    join public.store_products p on case when l.whole then p.product_type = 'home' else p.category_slug = l.category_slug end
    join public.products bp on bp.id = p.id
    where l.who is null or bp.wears in (l.who, 'unisex')
    group by l.category_slug, l.label, l.who, l.whole),
  -- Pieces ordered this week (paid, not cancelled), only to order the row: the counts never leave (D-003)
  ordered as (
    select oi.product_id as id, sum(oi.quantity) as n, max(p.published_at) as published_at
    from public.order_items oi
    join public.orders od on od.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where od.created_at >= now() - interval '7 days'
      and od.payment_status in ('paid', 'partially_refunded')
      and od.status not in ('pending_payment', 'cancelled', 'refunded')
      and oi.status = 'active'
      and p.status = 'live' and (not p.is_placeholder or public.dev_preview())
    group by oi.product_id
    order by n desc, published_at desc nulls last, oi.product_id
    limit 12),
  cheap as (
    select p.id, p.price_cents
    from public.store_products p
    where p.price_cents < 500
    order by p.price_cents, p.id
    limit 12)
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    -- D-169: the founder's Home photos only, in the admin's order
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', a.storage_path, 'alt_text', a.alt_text)
                       order by a.sort_order, a.created_at)
      from (select h.storage_path, h.alt_text, h.sort_order, h.created_at
            from public.home_photos h
            order by h.sort_order, h.created_at
            limit 60) a), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.category_slug, 'name', t.category_name, 'product_type', t.product_type, 'count', t.n,
               'for', t.who, 'image_path', t.image_path)
             || case when t.whole then '{"whole": true}'::jsonb else '{}'::jsonb end
             order by t.n desc, t.category_name)
      from tiles t), '[]'::jsonb),
    'most_ordered', coalesce((
      select jsonb_agg(public._store_product_card(o.id) order by o.n desc, o.published_at desc nulls last, o.id)
      from ordered o), '[]'::jsonb),
    'under_5', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.price_cents, c.id)
      from cheap c), '[]'::jsonb),
    'just_listed', coalesce((  -- TODO(D-187): drop when app <next version> is the minimum (its Home's only row)
      select jsonb_agg(public._store_product_card(n.id) order by n.overall)
      from newest n where n.overall <= 12), '[]'::jsonb),
    'just_listed_types', (
      select jsonb_object_agg(t.product_type, coalesce((
               select jsonb_agg(public._store_product_card(n.id) order by n.k)
               from newest n where n.product_type = t.product_type and n.k <= 12), '[]'::jsonb))
      from (values ('clothing'::public.product_type), ('home'::public.product_type)) t(product_type)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),  -- TODO(D-187): drop when app <next version> is the minimum
    -- D-140 (L7): the band under Just listed, from the same numbers as the Shipping & returns page
    'band', (select jsonb_build_object('free_min_cents', p -> 'free_shipping_min_cents',
                                       'return_claim_days', p -> 'return_claim_days')
             from public.store_policy() p)
  );
$$;
