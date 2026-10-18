-- =============================================================================
-- D-140 (design plan L7): Home's slim band (when an order placed today arrives, where delivery turns free, how long
-- returns stay open) reads its two policy numbers from store_home() itself, so Home stays one database read (PR-2).
-- As 20261018100000_wears_and_rows otherwise.
-- =============================================================================
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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    -- D-140 (L7): the band under Just listed, from the same numbers as the Shipping & returns page
    'band', (select jsonb_build_object('free_min_cents', p -> 'free_shipping_min_cents',
                                       'return_claim_days', p -> 'return_claim_days')
             from public.store_policy() p)
  );
$function$;
