-- =============================================================================
-- Pagination (founder, 2026-10-06: "Pagination should be done wherever needed everywhere where there are a lot of
-- images which slows the interface"): store_type_rows(type) returns one row per category of clothing or spices, each
-- with its total and only the first 12 cards (D-062: rows of up to 12, See all for the rest), so the app's Explore no
-- longer downloads every product to draw a few rows. One round trip (PR-2), store_* data only (D-017).
-- =============================================================================

create function public.store_type_rows(p_type text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', c.category_slug, 'name', c.category_name, 'count', c.n,
           'products', (select jsonb_agg(public._store_product_card(t.id) order by t.published_at desc nulls last, t.name)
                        from (select p.id, p.published_at, p.name from public.store_products p
                              where p.product_type::text = p_type and p.category_slug = c.category_slug
                              order by p.published_at desc nulls last, p.name limit 12) t))
         order by c.n desc, c.category_name), '[]'::jsonb)
  from (select p.category_slug, p.category_name, count(*) as n
        from public.store_products p
        where p.product_type::text = p_type
        group by p.category_slug, p.category_name) c;
$$;

revoke all on function public.store_type_rows(text) from public;
grant execute on function public.store_type_rows(text) to anon, authenticated, service_role;
