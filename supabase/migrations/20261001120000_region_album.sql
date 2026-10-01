-- =============================================================================
-- The region album (D-051, D-052, C2): more photos per region, shown on the region page as a mosaic that scrolls
-- sideways by itself. Admins add them (with alt text) in the admin Regions page; files live in the public
-- product-media bucket under regions/<slug>/album/. store_region_page() adds 'album' (path + alt text, in order),
-- still one round trip (PR-2). The table is admin-only (RLS); customers read it only through the function.
-- =============================================================================

create table public.region_photos (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions (id) on delete cascade,
  storage_path text not null unique check (storage_path ~ '^regions/[a-z0-9-]+/album/[^/]+$'),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index region_photos_region_idx on public.region_photos (region_id, sort_order);

alter table public.region_photos enable row level security;
create policy admin_all on public.region_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.region_photos from anon, authenticated;
grant select, insert, update, delete on public.region_photos to authenticated;

create or replace function public.store_region_page(p_region_slug text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'alt_text', ph.alt_text)
                       order by ph.sort_order, ph.created_at)
      from public.region_photos ph where ph.region_id = r.id), '[]'::jsonb),
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

grant execute on function public.store_region_page(text) to anon, authenticated, service_role;
