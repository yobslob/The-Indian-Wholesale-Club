-- A state's page without its card lists (D-157, founder 2026-10-24): since the state's inventory became See all's view
-- (one store_browse() per type), the page reads only its head: the region, its album, Most wanted, Picked for you and
-- each type's count. store_region_page() built every category's first 12 cards (Punjab: about 380 KB, 3.6 s on a cold
-- copy of production), so 36 of them at build time, with the new browse reads, ran the website build past the
-- database's 8 s statement limit (2026-10-24: "canceling statement due to statement timeout" prerendering a page).
-- store_region_page() stays as it is for the website until it reads this one (it falls back while this is missing).
-- Size: none (a function). Egress: less (the page's read loses its card lists).

create or replace function public.store_region_head(p_region_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', ph.storage_path, 'alt_text', ph.alt_text)
                       order by ph.sort_order, ph.created_at)
      from public.region_photos ph where ph.region_id = r.id), '[]'::jsonb),
    -- every piece the state's page lists, by type: its own and the all-India ones (D-121), as the switch counts them
    'type_counts', (
      select jsonb_object_agg(t.product_type, coalesce(c.n, 0))
      from unnest(enum_range(null::public.product_type)) t(product_type)
      left join (select p.product_type, count(*) as n
                 from public.store_products p
                 where p.region_id = r.id or p.region_id is null
                 group by p.product_type) c on c.product_type = t.product_type),
    'most_wanted', coalesce((
      select jsonb_agg(public._store_product_card(w.id) order by w.all_india, w.ordered desc, w.published_at desc nulls last, w.name)
      from (select p.id, p.published_at, p.name, o.ordered, (p.region_id is null) as all_india
            from public.store_products p
            join (select oi.product_id, sum(oi.quantity) as ordered
                  from public.order_items oi
                  join public.orders od on od.id = oi.order_id
                  where od.created_at >= now() - interval '30 days'
                    and od.payment_status in ('paid', 'partially_refunded')
                    and od.status not in ('pending_payment', 'cancelled', 'refunded')
                    and oi.status = 'active'
                  group by oi.product_id) o on o.product_id = p.id
            where (p.region_id = r.id or p.region_id is null)
              and exists (select 1 from public.store_variants v where v.product_id = p.id and v.available > 0)
            order by (p.region_id is null), o.ordered desc, p.published_at desc nulls last, p.name
            limit 12) w), '[]'::jsonb),
    'curated', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.all_india, c.published_at desc nulls last, c.name)
      from (select p.id, p.published_at, p.name, (p.region_id is null) as all_india from public.store_products p
            where (p.region_id = r.id or p.region_id is null) and p.is_curated
            order by (p.region_id is null), p.published_at desc nulls last, p.name limit 12) c), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$function$;

revoke all on function public.store_region_head(text) from public;
grant execute on function public.store_region_head(text) to anon, authenticated, service_role;
