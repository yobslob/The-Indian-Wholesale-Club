-- =============================================================================
-- D-187, the simple store, part 2 of 3: the store reads. No 7-day set behind any card, list or page (every food card
-- says 7 delivery days from its type and Settings, so the card itself carries no days); pieces bought from the same
-- shop still take turns by the site, without a vendor. Coming-soon pieces leave every store read, search too (§10 Y-9;
-- the admin still has them). store_home() gains Home's category tiles and its two food rows in its one cached call.
-- Cost (D-147): none added. Fewer reads per card and per list; Home's cached answer loses Just listed Food's 12 cards
-- and gains the 24 of its two food rows (about the same page-cache size); no new index, table or page-cache write.
-- =============================================================================

-- ---------------------------------------------------------------- views: nothing that cannot be bought

create or replace view public.store_media as
  select m.id, m.product_id, m.variant_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary, m.credit, m.is_ai
  from public.product_media m
  join public.products p on p.id = m.product_id
  where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- store_search returns this view's rows, so it goes first and comes back below; the view keeps its grants by hand.
drop function public.store_search(text, integer, integer, boolean, boolean);
drop view public.store_products;
create view public.store_products as
  select p.id, p.slug, p.name, p.product_type, p.region_id, r.slug as region_slug, r.name as region_name,
         p.category_id, c.slug as category_slug, c.name as category_name, p.summary, p.description, p.story, p.craft,
         p.attributes, p.price_cents, p.published_at,
         (select m.storage_path from public.product_media m where m.product_id = p.id
           order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
         p.search, p.is_curated, p.is_us_stock, p.made_in = 'India' as made_in_india
  from public.products p
  left join public.regions r on r.id = p.region_id
  join public.categories c on c.id = p.category_id
  where p.status = 'live' and (not p.is_placeholder or public.dev_preview());
grant select on public.store_products to anon, authenticated, service_role;

-- ---------------------------------------------------------------- cards

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
                 end)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$$;

-- ---------------------------------------------------------------- Home

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
  -- The tiles' categories (apps/web/features/home/tile-photos.ts): each with its count, biggest first
  tiles as (
    select p.category_id, p.category_slug, p.category_name, p.product_type, count(*) as n
    from public.store_products p
    where p.category_slug in ('snacks-and-namkeen', 'sweets', 'rice-flours-and-staples', 'masala-blends',
                              'pickles-and-chutneys', 'whole-spices', 'tea-and-drinks', 'ground-spices', 'papad-and-wadi',
                              'pooja-and-spiritual', 'handicrafts-and-decor', 'thaali-and-serveware')
    group by p.category_id, p.category_slug, p.category_name, p.product_type),
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
               -- the photo of its newest piece that has one
               'image_path', (select x.primary_image_path from public.store_products x
                               where x.category_id = t.category_id and x.primary_image_path is not null
                               order by x.published_at desc nulls last, x.id limit 1))
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

-- ---------------------------------------------------------------- See all

drop function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, boolean);
create function public.store_browse(p_type text, p_region text default null, p_category text default null,
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
               'options', public._store_card_options(s.id))
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
               'options', public._store_card_options(t.id))
             order by t.k)
      from (select touches.*,
                   row_number() over (order by case when p_region is not null then region_slug is null end,
                                               price_cents, published_at desc nulls last, name, id) as k
            from touches
            order by k
            offset greatest(coalesce(p_offset, 0), 0) / 2
            limit (least(greatest(coalesce(p_limit, 24), 1), 500) + 1) / 2) t), '[]'::jsonb));
$$;
revoke all on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text) from public;
grant execute on function public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------- the product page

create or replace function public.store_product_page(p_region_slug text, p_product_slug text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
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

-- ---------------------------------------------------------------- search: what can be bought, nothing else

create or replace function public._product_search_sync() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.product_search as s (product_id, doc, product_type, category_id, region_id, listed,
                                          is_placeholder, published_at)
  values (new.id, public._product_search_doc(new.id), new.product_type, new.category_id, new.region_id,
          new.status = 'live', new.is_placeholder, new.published_at)
  on conflict (product_id) do update
    set doc = excluded.doc, product_type = excluded.product_type, category_id = excluded.category_id,
        region_id = excluded.region_id, listed = excluded.listed,
        is_placeholder = excluded.is_placeholder, published_at = excluded.published_at
    where (s.doc, s.product_type, s.category_id, s.region_id, s.listed, s.is_placeholder, s.published_at)
          is distinct from (excluded.doc, excluded.product_type, excluded.category_id, excluded.region_id,
                            excluded.listed, excluded.is_placeholder, excluded.published_at);
  return null;
end $$;

drop function public._search_match(text, boolean);
drop function public._search_hits(tsquery, tsquery, boolean);

create function public._search_hits(p_ts tsquery, p_simple tsquery) returns table (id uuid)
language plpgsql
set search_path to 'public', 'pg_temp'
set plan_cache_mode to 'force_custom_plan'
as $$
begin
  if p_ts is not null then
    return query
      select s.product_id from public.product_search s
      where s.listed and s.doc @@ p_ts and (not s.is_placeholder or public.dev_preview())
      limit 5000;
    if found then
      return;
    end if;
  end if;
  if p_simple is null or public._search_late() then
    return;
  end if;
  return query
    select s.product_id from public.products p
    join public.product_search s on s.product_id = p.id
    where p.search @@ p_simple and s.listed and (not s.is_placeholder or public.dev_preview())
    limit 5000;
end $$;

create function public._search_match(p_query text, out words text[], out fixed text[], out mode text, out ts tsquery,
                                     out exact tsquery, out groups tsquery[], out ids uuid[], out slow boolean)
returns record
language plpgsql
set search_path to 'public', 'pg_temp'
set plan_cache_mode to 'force_custom_plan'
as $$
declare
  v_any tsquery;
  v_g tsquery;
begin
  words := public._search_split(p_query);
  mode := 'none';
  ids := '{}';
  slow := false;
  if cardinality(words) = 0 then
    return;
  end if;
  groups := public._search_groups(words);
  if cardinality(groups) = 0 then
    return; -- only stop words ("for", "the")
  end if;
  exact := plainto_tsquery('english', array_to_string(words, ' '));
  ts := groups[1];
  foreach v_g in array groups[2:] loop
    ts := ts && v_g;
  end loop;
  select coalesce(array_agg(h.id), '{}') into ids
  from public._search_hits(ts, plainto_tsquery('simple', array_to_string(words, ' '))) h;
  if cardinality(ids) > 0 then
    mode := 'all';
    return;
  end if;
  if public._search_late() then
    slow := true;
    return;
  end if;
  -- nothing: the words spelled as the listings spell them
  fixed := public._search_fix(words);
  if fixed is not null then
    groups := public._search_groups(fixed);
    exact := plainto_tsquery('english', array_to_string(fixed, ' '));
    if cardinality(groups) > 0 then
      ts := groups[1];
      foreach v_g in array groups[2:] loop
        ts := ts && v_g;
      end loop;
      select coalesce(array_agg(h.id), '{}') into ids
      from public._search_hits(ts, plainto_tsquery('simple', array_to_string(fixed, ' '))) h;
    end if;
    if cardinality(ids) > 0 then
      mode := 'fixed';
      return;
    end if;
  end if;
  -- still nothing and several words: pieces with some of them, the most first
  if cardinality(groups) > 1 then
    if public._search_late() then
      slow := true;
      fixed := null;
      return;
    end if;
    v_any := groups[1];
    foreach v_g in array groups[2:] loop
      v_any := v_any || v_g;
    end loop;
    select coalesce(array_agg(h.id), '{}') into ids from public._search_hits(v_any, null) h;
    if cardinality(ids) > 0 then
      ts := v_any;
      mode := 'some';
      return;
    end if;
  end if;
  fixed := null;
end $$;
revoke all on function public._search_hits(tsquery, tsquery), public._search_match(text) from public, anon, authenticated;

-- p_quick: TODO(D-187): drop when app <next version> is the minimum. The old app's search always sends it; it is ignored.
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
               'options', public._store_card_options(p.id))
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

create function public.store_search(p_query text, p_offset integer default 0, p_limit integer default 24,
                                    p_record boolean default true)
returns setof public.store_products
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_page jsonb := public.store_search_page(p_query, null, null, null, null, p_offset, p_limit, p_record);
begin
  return query
    select p.* from jsonb_array_elements(v_page -> 'products') with ordinality e(card, n)
    join public.store_products p on p.id = (e.card ->> 'id')::uuid
    order by e.n;
end $$;
revoke all on function public.store_search(text, integer, integer, boolean) from public;
grant execute on function public.store_search(text, integer, integer, boolean) to anon, authenticated, service_role;

create or replace function public.store_search_hints() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with live as (
    select s.product_type::text as product_type, c.slug as category_slug, c.name as category_name, r.slug as region_slug
    from public.product_search s
    join public.categories c on c.id = s.category_id
    left join public.regions r on r.id = s.region_id
    where s.listed and (not s.is_placeholder or public.dev_preview()))
  select jsonb_build_object(
    'words', coalesce((select jsonb_agg(w.word order by w.ndoc desc, w.word)
                       from (select word, ndoc from public.search_words order by ndoc desc, word limit 1500) w),
                      '[]'::jsonb),
    'synonyms', coalesce((
      select jsonb_agg(g.terms order by g.grp)
      from (select s.grp, jsonb_agg(s.term order by s.term) as terms from public.search_synonyms s
            where exists (select 1 from public.search_synonyms t join public.search_words w on w.word_key = t.term_key
                          where t.grp = s.grp)
            group by s.grp) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('type', c.product_type, 'slug', c.category_slug, 'name', c.category_name,
                                          'count', c.n) order by c.n desc)
      from (select product_type, category_slug, category_name, count(*) as n from live
            group by product_type, category_slug, category_name) c), '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.slug, 'name', r.name, 'count', coalesce(n.n, 0)) order by r.name)
      from public.regions r
      left join (select region_slug, count(*) as n from live where region_slug is not null group by region_slug) n
        on n.region_slug = r.slug), '[]'::jsonb),
    'popular', coalesce((
      select jsonb_agg(q.query order by q.n desc, q.query)
      from (select sq.query, count(*) as n from public.search_queries sq
            where sq.created_at > now() - interval '30 days' and sq.results > 0 and not sq.partial and sq.fixed is null
              and sq.query ~ '^[a-z ]{3,40}$'
              and not exists (select 1 from regexp_split_to_table(sq.query, ' ') x(word)
                              where length(x.word) >= 2
                                and not exists (select 1 from public.search_words w
                                                where w.word_key = public._search_key(x.word)))
            group by sq.query having count(*) >= 3
            order by count(*) desc, sq.query limit 12) q), '[]'::jsonb))
$$;

create or replace function public.refresh_search_words() returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_changed integer;
begin
  with listed as (
    select word, ndoc from ts_stat($q$
      select to_tsvector('simple', p.name || ' ' || p.category_name || ' ' || coalesce(p.craft, '') || ' '
                                   || coalesce(p.region_name, ''))
      from public.store_products p $q$)
    where word ~ '^[a-z]{3,24}$'),
  keyed as materialized (select word, ndoc, public._search_key(word) as k from listed),
  -- one spelling per stem, the shortest (mostly the singular: "saree", not "sarees" from "Sarees & Drapes"), counted
  -- as its most used spelling; stop words have no stem and are left out
  spelt as (
    select distinct on (k) word, max(ndoc) over (partition by k) as ndoc
    from keyed where k is not null order by k, length(word), ndoc desc, word),
  -- a synonym counts as often as the most-used word of its group (a group the listings never use is left out)
  synonyms as (
    select s.term as word, max(l.ndoc)::integer as ndoc
    from public.search_synonyms s
    join public.search_synonyms g on g.grp = s.grp
    join keyed l on l.k = g.term_key
    where s.term ~ '^[a-z]{3,24}$'
      and not exists (select 1 from spelt x where public._search_key(x.word) = s.term_key)
    group by s.term),
  fresh as (
    select word, max(ndoc)::integer as ndoc from (select * from spelt union all select * from synonyms) a group by word),
  gone as (delete from public.search_words w where not exists (select 1 from fresh f where f.word = w.word) returning 1),
  put as (
    insert into public.search_words (word, ndoc) select word, ndoc from fresh
    on conflict (word) do update set ndoc = excluded.ndoc where search_words.ndoc <> excluded.ndoc
    returning 1)
  select (select count(*) from gone) + (select count(*) from put) into v_changed;
  return v_changed;
end $$;

-- Coming-soon pieces leave search now: only their rows change (a few dozen). The column the old rule needed goes.
update public.product_search set listed = false where listed and soon;
alter table public.product_search drop column soon;

notify pgrst, 'reload schema';
