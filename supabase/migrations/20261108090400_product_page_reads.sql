-- =============================================================================
-- The product page reads less (2026-11-03: on the live site, fresh product pages failed after 8 s whenever several
-- were built at once, and searches gave up while the database caught up; a mouse crossing a grid of cards built
-- several at once). Measured on a production-sized copy (9,174 live listings, 6,116 all-India), one all-India piece:
-- store_product_page() touched 4,747 buffers (37 MB), of which Similar items 1,208 (every listing of the category
-- read and sorted to keep 12) and Curated for you 884 (every all-India listing read: `region_id is not distinct from`
-- cannot use an index). Now each list walks an index in its own order and stops at 12:
--  - Similar items: the state's own (all-India with all-India) newest first, then the rest of the category newest
--    first, as before; each half read through products_category_region_newest_idx / products_category_newest_idx.
--  - Curated for you: the same state's curated pieces, newest first, through products_curated_newest_idx.
-- Same arguments, same jsonb, same order as 20261022120000_seven_day_delivery (store_pages_v2, curated_leaving_soon
-- and all_india tests unchanged; product_page_reads.test.sql adds the all-India order).
-- Cost (D-147): database size: three btree indexes on products, about 0.4 MB each for 8,500 listings (the curated one
-- far less). Writes: one index entry each per listing inserted, or when its category, state, curated mark or publish
-- time changes (the sourcing runner's inserts: three small writes more). No page-cache writes. Egress: none.
-- =============================================================================

-- A listing's state for matching, as an expression an index can hold: all-India (no state) is the zero uuid, so
-- all-India matches all-India. Plain coalesce, not a helper function: Postgres checks EXECUTE on an index's functions
-- at every insert, so a helper would have to be open to every signed-in user (schema.test.sql forbids it).
create index if not exists products_category_region_newest_idx
  on public.products (category_id, (coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid)), published_at desc nulls last, name);
create index if not exists products_category_newest_idx
  on public.products (category_id, published_at desc nulls last, name);
create index if not exists products_curated_newest_idx
  on public.products ((coalesce(region_id, '00000000-0000-0000-0000-000000000000'::uuid)), published_at desc nulls last, name) where is_curated;

-- As 20261022120000_seven_day_delivery, with Similar items and Curated for you read through those indexes.
create or replace function public.store_product_page(p_region_slug text, p_product_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
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
$$;
