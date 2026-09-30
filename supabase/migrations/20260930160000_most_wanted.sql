-- =============================================================================
-- D-058: Most wanted = the region's live pieces customers ordered most in the last 30 days.
--  - Counted from real orders only (D-012): paid (or partly refunded) orders that are not cancelled or refunded,
--    and only their active lines. A piece needs at least one order in the window; sold-out pieces are left out.
--  - Ties go to the newer listing. At most 4 pieces, like the other lists.
--  - Only the ranking reaches customers: the counts stay inside the function (D-003).
--  - store_region_page(): + most_wanted (still one round trip, PR-2).
-- =============================================================================

create or replace function public.store_region_page(p_region_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
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
            limit 4) w), '[]'::jsonb),
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

-- The window scan starts from recent orders (orders_created_idx); this finds their lines per product.
create index order_items_product_idx on public.order_items (product_id);

grant execute on function public.store_region_page(text) to anon, authenticated, service_role;
