-- =============================================================================
-- D-062: product lists are horizontal rows with "See all", so the lists a row shows grow to up to 12 pieces:
-- Just listed (store_home), Most wanted, Curated for you and Leaving soon (store_region_page), Similar items and
-- Curated for you (store_product_page). Nothing else changes (definitions as of migrations 5 to 8).
-- =============================================================================

create or replace function public.store_home()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    'just_listed', coalesce((
      select jsonb_agg(public._store_product_card(n.id) order by n.published_at desc nulls last, n.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            order by p.published_at desc nulls last, p.name limit 12) n), '[]'::jsonb),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$function$
;

create or replace function public.store_region_page(p_region_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'products', coalesce((
      select jsonb_agg(public._store_product_card(p.id) order by p.published_at desc nulls last, p.name)
      from public.store_products p
      where p.region_id = r.id), '[]'::jsonb),
    'most_wanted', coalesce((
      select jsonb_agg(public._store_product_card(w.id) order by w.ordered desc, w.published_at desc nulls last, w.name)
      from (select p.id, p.published_at, p.name, o.ordered
            from public.store_products p
            join (select oi.product_id, sum(oi.quantity) as ordered
                  from public.order_items oi
                  join public.orders od on od.id = oi.order_id
                  where od.created_at >= now() - interval '30 days'
                    and od.payment_status in ('paid', 'partially_refunded')
                    and od.status not in ('pending_payment', 'cancelled', 'refunded')
                    and oi.status = 'active'
                  group by oi.product_id) o on o.product_id = p.id
            where p.region_id = r.id
              and exists (select 1 from public.store_variants v where v.product_id = p.id and v.available > 0)
            order by o.ordered desc, p.published_at desc nulls last, p.name
            limit 12) w), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            where p.region_id = r.id and p.is_curated
            order by p.published_at desc nulls last, p.name limit 12) c), '[]'::jsonb),
    'leaving_soon', coalesce((
      select jsonb_agg(public._store_product_card(l.id) order by l.available, l.published_at desc nulls last, l.name)
      from (select p.id, p.published_at, p.name, a.available
            from public.store_products p
            cross join lateral (select coalesce(sum(v.available), 0) as available
                                from public.store_variants v where v.product_id = p.id) a
            where p.region_id = r.id and a.available between 1 and public._leaving_soon_max()
            order by a.available, p.published_at desc nulls last, p.name limit 12) l), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$function$
;

create or replace function public.store_product_page(p_region_slug text, p_product_slug text)
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
      from (select o.id, o.published_at, o.name, (o.region_id = p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id = p.region_id) desc, o.published_at desc nulls last, o.name
            limit 12) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id = p.region_id and o.is_curated and o.id <> p.id
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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$function$
;

grant execute on function public.store_home(), public.store_region_page(text), public.store_product_page(text, text)
  to anon, authenticated, service_role;
