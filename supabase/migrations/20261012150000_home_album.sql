-- =============================================================================
-- D-113: Home gets the album the region pages have (D-051, D-052), drawn from all of India: store_home() adds 'album'
-- (path + alt text). The states' album photos come first, one state at a time in turn so no state fills the wall;
-- then the main photo of each state's newest pieces, the same way, up to 30 photos. Still one round trip (PR-2);
-- only what the store already shows (store_regions, store_products, store_media).
-- =============================================================================

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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$function$;
