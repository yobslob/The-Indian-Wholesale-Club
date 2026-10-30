-- =============================================================================
-- D-169 (founder 2026-10-31: "Remove the existing … states photos from home and just use the photos which I will
-- upload and give me an option to move them in the grid"): Home's drifting mosaic (D-113) shows only the founder's own
-- Home photos, in the order the founder sets in the admin (Home photos). The states' albums stay on their own pages; no
-- listing photo fills Home any more. Files live in the public product-media bucket under home/album/ (s/ once stored
-- with copies, D-140). The table is admin-only (RLS); customers read it only through store_home(), still one read
-- (PR-2). Until three photos are added Home has no mosaic (region-album.tsx's minimum).
-- store_home() is 20261018150000_home_band's with only 'album' changed.
-- =============================================================================

create table public.home_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (storage_path ~ '^home/album/([cs]/)?[^/]+$'),
  alt_text text not null check (length(btrim(alt_text)) between 1 and 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index home_photos_order_idx on public.home_photos (sort_order, created_at);

alter table public.home_photos enable row level security;
create policy admin_all on public.home_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.home_photos from anon, authenticated;
grant select, insert, update, delete on public.home_photos to authenticated;

-- The admin's new order in one call: the ids as the grid shows them, first tile first. RLS keeps it to admins.
create function public.admin_order_home_photos(p_ids uuid[]) returns void
language sql security invoker set search_path = public, pg_temp as $$
  update public.home_photos h set sort_order = x.n
  from unnest(p_ids) with ordinality as x(id, n)
  where h.id = x.id;
$$;
revoke all on function public.admin_order_home_photos(uuid[]) from public, anon;
grant execute on function public.admin_order_home_photos(uuid[]) to authenticated;

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
    -- D-169: the founder's Home photos only, in the admin's order
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', a.storage_path, 'alt_text', a.alt_text)
                       order by a.sort_order, a.created_at)
      from (select h.storage_path, h.alt_text, h.sort_order, h.created_at
            from public.home_photos h
            order by h.sort_order, h.created_at
            limit 60) a), '[]'::jsonb),
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
