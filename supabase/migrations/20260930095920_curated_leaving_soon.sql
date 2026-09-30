-- =============================================================================
-- D-056: Curated for you and Leaving soon (still one round trip per page, PR-2).
--  - products.is_curated: an admin's pick for its region's "Curated for you"
--    (personalised from saves and views later).
--  - pricing_settings.leaving_soon_max: "Leaving soon" lists live pieces with
--    1 to this many left (default 2, D-056).
--  - store_products gains is_curated (not operational data, D-003).
--  - store_region_page(): + curated, + leaving_soon; store_product_page(): + curated.
-- =============================================================================

alter table public.products add column is_curated boolean not null default false;
alter table public.pricing_settings add column leaving_soon_max integer not null default 2
  check (leaving_soon_max between 1 and 20);

-- Same columns as before, is_curated appended (create or replace keeps grants and column order).
create or replace view public.store_products as
select p.id, p.slug, p.name, p.product_type,
       p.region_id, r.slug as region_slug, r.name as region_name,
       p.category_id, c.slug as category_slug, c.name as category_name,
       p.summary, p.description, p.story, p.craft, p.attributes, p.price_cents, p.published_at,
       (select m.storage_path from public.product_media m
         where m.product_id = p.id order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
       p.search,
       p.is_curated
from public.products p
join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- The "Leaving soon" limit. Internal: only the store_* functions below call it.
create function public._leaving_soon_max()
returns integer
language sql stable set search_path = public, pg_temp as $$
  select coalesce((select s.leaving_soon_max from public.pricing_settings s where s.id = 1), 2);
$$;

create or replace function public.store_region_page(p_region_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'products', coalesce((
      select jsonb_agg(public._store_product_card(p.id) order by p.published_at desc nulls last, p.name)
      from public.store_products p
      where p.region_id = r.id), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name from public.store_products p
            where p.region_id = r.id and p.is_curated
            order by p.published_at desc nulls last, p.name limit 4) c), '[]'::jsonb),
    'leaving_soon', coalesce((
      select jsonb_agg(public._store_product_card(l.id) order by l.available, l.published_at desc nulls last, l.name)
      from (select p.id, p.published_at, p.name, a.available
            from public.store_products p
            cross join lateral (select coalesce(sum(v.available), 0) as available
                                from public.store_variants v where v.product_id = p.id) a
            where p.region_id = r.id and a.available between 1 and public._leaving_soon_max()
            order by a.available, p.published_at desc nulls last, p.name limit 4) l), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$$;

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
      from (select o.id, o.published_at, o.name, (o.region_id = p.region_id) as same_region
            from public.store_products o
            where o.category_id = p.category_id and o.id <> p.id
            order by (o.region_id = p.region_id) desc, o.published_at desc nulls last, o.name
            limit 5) s), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.published_at desc nulls last, c.name)
      from (select o.id, o.published_at, o.name from public.store_products o
            where o.region_id = p.region_id and o.is_curated and o.id <> p.id
            order by o.published_at desc nulls last, o.name limit 4) c), '[]'::jsonb),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$$;

revoke all on function public._leaving_soon_max() from public, anon, authenticated;
grant execute on function public._leaving_soon_max() to service_role;
grant execute on function public.store_region_page(text), public.store_product_page(text, text)
  to anon, authenticated, service_role;
