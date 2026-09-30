-- =============================================================================
-- C1: page reads for the approved design (D-050 – D-055), still one round trip
-- per page (engineering.md PR-2), still reading ONLY store_* views (D-017, INV-1).
--  - store_home():          + just_listed, the four newest live products
--  - store_region_page():   product cards carry published_at + quick_add, newest first (New arrivals)
--  - store_product_page():  + similar, up to five other live products in the same category (own region first)
-- Every product card comes from one helper so the three stay alike.
-- =============================================================================

-- One product card. quick_add is set only when the product has exactly one variant and it is
-- in stock, so a card's "Add" button can put it in the bag without a choice; otherwise null.
-- Internal: callable only from the store_* functions below (no grant to anon/authenticated).
create function public._store_product_card(p_product_id uuid)
returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'summary', p.summary, 'craft', p.craft, 'price_cents', p.price_cents,
    'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'available', (select coalesce(sum(v.available), 0) from public.store_variants v where v.product_id = p.id),
    'quick_add', (select jsonb_build_object('variant_id', v.id, 'label', v.label, 'price_cents', v.price_cents)
                  from public.store_variants v
                  where v.product_id = p.id and v.available > 0
                    and (select count(*) from public.store_variants w where w.product_id = p.id) = 1))
  from public.store_products p
  where p.id = p_product_id;
$$;

create or replace function public.store_home()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
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
            order by p.published_at desc nulls last, p.name limit 4) n), '[]'::jsonb),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$$;

create or replace function public.store_region_page(p_region_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'products', coalesce((
      select jsonb_agg(public._store_product_card(p.id) order by p.published_at desc nulls last, p.name)
      from public.store_products p
      where p.region_id = r.id), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$$;

create or replace function public.store_product_page(p_region_slug text, p_product_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'product', to_jsonb(p) - 'search',
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
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$$;

-- Privileges: the helper is internal; the page functions keep their grants (create or replace keeps them,
-- restated here so this file reads on its own).
revoke all on function public._store_product_card(uuid) from public, anon, authenticated;
grant execute on function public._store_product_card(uuid) to service_role;
grant execute on function public.store_home(), public.store_region_page(text), public.store_product_page(text, text)
  to anon, authenticated, service_role;
