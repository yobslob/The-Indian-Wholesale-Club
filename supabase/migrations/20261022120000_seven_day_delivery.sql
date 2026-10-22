-- =============================================================================
-- D-148 (founder, 2026-10-22): 7-day delivery. Pieces bought from the quick-delivery shops (Blinkit, BigBasket, Zepto,
-- Instamart) reach the hub within the hour and fly at once, so a bag of only such pieces arrives in the 7-day days.
--  - pricing_settings.quick_delivery_days_min/_max: the promise (the founder: exactly 7, so 7 and 7). Empty = no
--    7-day delivery anywhere: no tags, an empty 7-day page, Home's old line (non-negotiable 4: never hard-coded).
--  - sourcing_shops.quick_delivery: which shops count (admin only; customers never see a shop, D-003).
--  - A 7-day listing: live, not already in the US, and every option on sale is bought from such a shop (the source in
--    use, else the shop the listing was imported from). Worked out on every read, so a listing the weekly check moves to
--    another shop leaves the page by itself and the promise stays true.
--  - Cards carry quick_days (the tag); the product page its 7-day window; store_quick_bag tells the bag, checkout and
--    create_order whether the whole bag is 7-day (a single other piece makes it a normal order, the founder's rule).
--  - store_quick_browse: the 7-day page (one of each category, then step up, by price). Prices and charges unchanged.
-- Tests: seven_day.test.sql.
-- =============================================================================

alter table public.pricing_settings
  add column quick_delivery_days_min smallint check (quick_delivery_days_min between 0 and 60),
  add column quick_delivery_days_max smallint check (quick_delivery_days_max between 0 and 60),
  add constraint quick_delivery_days_order check (quick_delivery_days_max >= quick_delivery_days_min);
update public.pricing_settings set quick_delivery_days_min = 7, quick_delivery_days_max = 7 where id = 1;

alter table public.sourcing_shops add column quick_delivery boolean not null default false;
update public.sourcing_shops set quick_delivery = true
 where site in ('blinkit.com', 'bigbasket.com', 'zepto.com', 'swiggy.com');

-- The 7-day listings (the rule above, in one place). No SET clause, so the planner inlines it and a single listing is
-- an index lookup (names are schema-qualified instead; it is not security definer).
create function public._quick_listings() returns table (id uuid)
language sql stable as $$
  select p.id
  from public.products p
  where p.status = 'live' and not p.is_us_stock
    and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
    and not exists (
      select 1
      from public.product_variants v
      left join public.product_sources ps on ps.id = v.source_id
      left join public.sourcing_shops sh on sh.site = coalesce(ps.site, p.source_site)
      where v.product_id = p.id and v.is_active and not coalesce(sh.quick_delivery, false))
$$;
revoke all on function public._quick_listings() from public, anon, authenticated;

-- A listing's 7-day days (the most, for its tag), or null: not a 7-day piece, or 7-day delivery is off.
create function public._quick_days(p_product uuid) returns integer
language sql stable as $$
  select s.quick_delivery_days_max::integer
  from public.pricing_settings s
  where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
    and exists (select 1 from public._quick_listings() q where q.id = p_product)
$$;
revoke all on function public._quick_days(uuid) from public, anon, authenticated;

-- The bag (the bag panel, checkout, create_order): {days_min, days_max} when every piece in it is a 7-day piece on
-- sale, else null. An unknown or stopped option makes it a normal bag.
create function public.store_quick_bag(p_variant_ids uuid[]) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('days_min', s.quick_delivery_days_min, 'days_max', s.quick_delivery_days_max)
  from public.pricing_settings s
  where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
    and cardinality(p_variant_ids) between 1 and 100
    and not exists (
      select 1
      from unnest(p_variant_ids) x(id)
      left join public.product_variants v on v.id = x.id and v.is_active
      where v.id is null or not exists (select 1 from public._quick_listings() q where q.id = v.product_id))
$$;
revoke all on function public.store_quick_bag(uuid[]) from public;
grant execute on function public.store_quick_bag(uuid[]) to anon, authenticated;

-- The 7-day page: its days, the categories with their counts, and the cards (one of each category, then the next of
-- each, by price; the same light cards as See all). Coming-soon pieces are never 7-day (they cannot be bought).
create function public.store_quick_browse(p_category text default null, p_offset integer default 0,
                                          p_limit integer default 24)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with days as (
    select s.quick_delivery_days_min as lo, s.quick_delivery_days_max as hi
    from public.pricing_settings s
    where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null),
  quick as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at
    from public.store_products p
    join public._quick_listings() q on q.id = p.id
    where not p.coming_soon and exists (select 1 from days)),
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
revoke all on function public.store_quick_browse(text, integer, integer) from public;
grant execute on function public.store_quick_browse(text, integer, integer) to anon, authenticated;

-- As 20261018120000_card_options, with the 7-day days.
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
    -- D-148: a 7-day piece carries its days for the card's tag (null otherwise)
    'quick_days', case when not p.coming_soon then public._quick_days(p.id) end,
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

-- As 20261021090000_low_to_high, with the 7-day days on each card.
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

-- As 20261014140000_all_india_and_bands, with the 7-day window.
CREATE OR REPLACE FUNCTION public.store_product_page(p_region_slug text, p_product_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      from (select o.id, o.published_at, o.name, (o.region_id is not distinct from p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id is not distinct from p.region_id) desc, o.published_at desc nulls last, o.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id is not distinct from p.region_id and o.is_curated and o.id <> p.id
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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    -- A piece already in the US ships at once: its window is today + the US delivery days, not the cycle's.
    'ships_from_us', case when p.is_us_stock then (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null) end,
    -- D-148: a 7-day piece's own window, today + the 7-day days (Settings), when the bag holds only 7-day pieces
    'quick_delivery', case when not p.coming_soon and public._quick_days(p.id) is not null then (
      select jsonb_build_object('est_delivery_from', current_date + s.quick_delivery_days_min,
                                'est_delivery_to', current_date + s.quick_delivery_days_max)
      from public.pricing_settings s where s.id = 1) end
  )
  from public.store_products p
  where coalesce(p.region_slug, 'india') = p_region_slug and p.slug = p_product_slug;
$function$;

-- As 20261011120100_min_order, with the 7-day days.
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

-- As 20261011120100_min_order, with the 7-day window; no Express for a bag of only 7-day pieces.
create or replace function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null, p_state text default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path,
               'tax_class', c.tax_class,
               -- What the courier charges to carry one piece (express, D-070): a price, never the weight itself (INV-1).
               'courier_cents', ceil(coalesce(pv.weight_g, c.default_weight_g, 1000) / 1000.0
                                     * coalesce((select s.express_courier_cents_per_kg from public.pricing_settings s
                                                 where s.id = 1), 0))::integer)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      join public.product_variants pv on pv.id = v.id
      join public.products pr on pr.id = p.id
      join public.categories c on c.id = pr.category_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents)
      from public.promo_codes c
      where nullif(trim(p_promo_code), '') is not null
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents,
                                'min_order_cents', s.min_order_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    'tax', (
      select jsonb_build_object('state', t.state, 'rate_pct', t.rate_pct, 'taxes_clothing', t.taxes_clothing,
                                'taxes_food', t.taxes_food, 'taxes_general', t.taxes_general)
      from public.tax_rates t where t.state = upper(trim(p_state))),
    -- A bag of only pieces already in the US ships from the warehouse at once: today + the US delivery days (D-072).
    'us_delivery', (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null
        and cardinality(p_variant_ids) > 0
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and not pr.is_us_stock)),
    -- D-148: a bag of only 7-day pieces: today + the 7-day days (Settings).
    'quick_delivery', (
      select jsonb_build_object('est_delivery_from', current_date + s.quick_delivery_days_min,
                                'est_delivery_to', current_date + s.quick_delivery_days_max)
      from public.pricing_settings s
      where s.id = 1 and public.store_quick_bag(p_variant_ids) is not null),
    -- Express is the courier from Mumbai (D-070): never for a bag with a piece already in the US, nor for a bag of
    -- only 7-day pieces, which already arrives sooner (D-148).
    'express', (
      select jsonb_build_object('base_cents', s.express_base_cents,
                                'min_courier_cents', ceil(s.express_min_kg * s.express_courier_cents_per_kg)::integer,
                                'est_delivery_from', current_date + s.express_days_min,
                                'est_delivery_to', current_date + s.express_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.express_base_cents is not null and s.express_courier_cents_per_kg is not null
        and s.express_min_kg is not null and s.express_days_min is not null and s.express_days_max is not null
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and pr.is_us_stock)
        and public.store_quick_bag(p_variant_ids) is null)
  );
$$;

-- As 20261014140000_all_india_and_bands, with the 7-day window.
CREATE OR REPLACE FUNCTION public.create_order(p_order jsonb)
 RETURNS TABLE(order_id uuid, order_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_cycle public.cycles%rowtype;
  v_shown public.cycles%rowtype;
  v_priced_at timestamptz;
  v_late boolean := false;
  v_settings public.pricing_settings%rowtype;
  v_order public.orders%rowtype;
  v_method public.shipping_method;
  v_from date;
  v_to date;
  v_item jsonb;
  v_variant record;
  v_qty integer;
  v_unit integer;
  v_sum integer := 0;
  v_made_to_order boolean;
  v_quick boolean;
begin
  select * into v_settings from public.pricing_settings where id = 1;
  v_method := coalesce(nullif(p_order ->> 'shipping_method', ''), 'standard')::public.shipping_method;
  -- D-115: in the pilot every piece is bought as soon as it sells; no cycle, the window counts from today.
  v_made_to_order := v_method = 'standard'
    and v_settings.pilot_delivery_days_min is not null and v_settings.pilot_delivery_days_max is not null;

  -- D-148: a standard bag of only 7-day pieces is bought at once and arrives in the 7-day days (Settings).
  v_quick := v_method = 'standard' and jsonb_typeof(p_order -> 'items') = 'array'
    and public.store_quick_bag(array(select (i ->> 'variant_id')::uuid
                                     from jsonb_array_elements(p_order -> 'items') i)) is not null;

  if v_quick then
    v_from := current_date + v_settings.quick_delivery_days_min;
    v_to := current_date + v_settings.quick_delivery_days_max;
    v_made_to_order := true;
  elsif v_method = 'express' then
    -- Courier from Mumbai to the door, outside the cycle: the window counts from today.
    if v_settings.express_days_min is null or v_settings.express_days_max is null
       or v_settings.express_base_cents is null or v_settings.express_courier_cents_per_kg is null then
      raise exception 'express_unavailable' using errcode = 'P0001';
    end if;
    v_from := current_date + v_settings.express_days_min;
    v_to := current_date + v_settings.express_days_max;
  elsif v_made_to_order then
    v_from := current_date + v_settings.pilot_delivery_days_min;
    v_to := current_date + v_settings.pilot_delivery_days_max;
  else
    -- Never join a cycle after its cutoff, even if the timer has not run yet.
    perform public.roll_cycles();
    -- FOR SHARE: orders run side by side; a cutoff waits until they have committed.
    select * into v_cycle from public.cycles where status = 'open' for share;
    if not found then
      raise exception 'no_open_cycle' using errcode = 'P0001';
    end if;
    -- D-065: the cycle whose window the customer saw is the first to close after they were priced.
    select created_at into v_priced_at from public.pending_orders
     where payment_intent_id = p_order ->> 'payment_intent_id';
    if v_priced_at is not null then
      select * into v_shown from public.cycles where cutoff_at > v_priced_at order by cutoff_at limit 1 for share;
      if found and v_shown.id <> v_cycle.id then
        if v_shown.status <> 'collecting' then
          raise exception 'cycle_closed' using errcode = 'P0001';
        end if;
        v_cycle := v_shown;
        v_late := true;
      end if;
    end if;
    if v_settings.domestic_days_min is null or v_settings.domestic_days_max is null then
      raise exception 'delivery_window_unconfigured' using errcode = 'P0001';
    end if;
    v_from := v_cycle.est_arrival_on + v_settings.domestic_days_min;
    v_to := v_cycle.est_arrival_on + v_settings.domestic_days_max;
  end if;

  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'order_has_no_items' using errcode = 'P0001';
  end if;

  insert into public.orders (
    user_id, email, status, cycle_id, est_delivery_from, est_delivery_to, shipping_method,
    subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
    promo_code_id, payment_intent_id, payment_status, shipping_address)
  values (
    nullif(p_order ->> 'user_id', '')::uuid,
    lower(p_order ->> 'email'),
    'confirmed',
    case when v_method = 'express' or v_made_to_order then null else v_cycle.id end,
    v_from, v_to, v_method,
    (p_order ->> 'subtotal_cents')::integer,
    coalesce((p_order ->> 'discount_cents')::integer, 0),
    coalesce((p_order ->> 'shipping_cents')::integer, 0),
    coalesce((p_order ->> 'tax_cents')::integer, 0),
    (p_order ->> 'total_cents')::integer,
    nullif(p_order ->> 'promo_code_id', '')::uuid,
    p_order ->> 'payment_intent_id',
    'paid',
    p_order -> 'shipping_address')
  returning * into v_order;

  -- Variant-id order: every order locks pieces in the same order, so no deadlocks (PR-9).
  for v_item in select value from jsonb_array_elements(p_order -> 'items') order by value ->> 'variant_id'
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    v_unit := (v_item ->> 'unit_price_cents')::integer;

    select v.id, v.label, v.product_id, coalesce(v.price_cents, p.price_cents) as price_cents,
           p.name as product_name, r.name as region_name
      into v_variant
    from public.product_variants v
    join public.products p on p.id = v.product_id
    left join public.regions r on r.id = p.region_id
    where v.id = (v_item ->> 'variant_id')::uuid
      and v.is_active
      and p.status = 'live'
      and (not p.is_placeholder or public.dev_preview());
    if not found then
      raise exception 'variant_unavailable:%', v_item ->> 'variant_id' using errcode = 'P0001';
    end if;
    if v_unit is distinct from v_variant.price_cents then
      raise exception 'price_mismatch:%', v_variant.id using errcode = 'P0001';
    end if;

    -- INV-3: one conditional statement; fails instead of overselling.
    perform public._set_stock_context('reserved', 'order', v_order.id, null);
    update public.product_variants
       set qty_reserved = qty_reserved + v_qty
     where id = v_variant.id
       and qty_listed - qty_reserved >= v_qty;
    if not found then
      raise exception 'insufficient_stock:%', v_variant.id using errcode = 'P0001';
    end if;
    perform public._set_stock_context(null, null, null, null);

    insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label,
                                    region_name, quantity, unit_price_cents, total_price_cents)
    values (v_order.id, v_variant.id, v_variant.product_id, v_variant.product_name, v_variant.label,
            v_variant.region_name, v_qty, v_unit, v_qty * v_unit);
    v_sum := v_sum + v_qty * v_unit;
  end loop;

  if v_sum <> v_order.subtotal_cents then
    raise exception 'subtotal_mismatch' using errcode = 'P0001';
  end if;

  insert into public.order_events (order_id, kind, visible_to_customer)
  values (v_order.id, 'order_confirmed', true);

  -- Express (D-070), a made-to-order pilot piece (D-115), or a late payment joining a collecting cycle (D-065): the
  -- pieces go on a pickup list now.
  if v_method = 'express' or v_made_to_order or v_late then
    insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise)
    select oi.id, case when v_method = 'express' or v_made_to_order then null else v_cycle.id end, p.vendor_id, oi.variant_id,
           oi.quantity, p.shop_price_paise
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id;
  end if;
  if v_late then
    update public.orders set status = 'collecting' where id = v_order.id;
    insert into public.order_events (order_id, kind, visible_to_customer)
    values (v_order.id, 'preparing', true);
  end if;

  return query select v_order.id, v_order.order_number;
end $function$;
