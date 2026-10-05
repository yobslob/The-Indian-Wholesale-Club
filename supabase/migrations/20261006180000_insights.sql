-- =============================================================================
-- C7, insights (admin.md §Insights): real numbers only, computed in SQL (never estimated or fabricated).
--  - admin_sales(since): pieces and revenue by state, category and shop, plus totals. A piece counts when its line is
--    still active (not unavailable or refunded) in a paid order that was not cancelled. Shop cost (₹) per shop from the
--    shop price recorded on each product. Admin only.
--  - search_queries + store_search(q, offset, limit): the storefront search (website and app) as one function that
--    also writes down what was searched and how many pieces matched (first page only; no user, no IP: just the words).
--  - admin_demand(since): top searches, searches that found nothing (what to list next), most saved pieces.
-- =============================================================================

create function public.admin_sales(p_since timestamptz default null)
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  with sold as (
    select oi.quantity, oi.total_price_cents, oi.region_name, o.id as order_id,
           coalesce(c.name, 'Unknown') as category_name,
           coalesce(v.shop_name, 'Unknown') as shop_name,
           coalesce(p.shop_price_paise, 0) * oi.quantity as shop_cost_paise
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
    left join public.vendors v on v.id = p.vendor_id
    where oi.status = 'active'
      and o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('pending_payment', 'cancelled', 'refunded')
      and (p_since is null or o.created_at >= p_since)
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object('orders', count(distinct order_id), 'pieces', coalesce(sum(quantity), 0),
                                         'revenue_cents', coalesce(sum(total_price_cents), 0)) from sold),
    'by_region', coalesce((select jsonb_agg(jsonb_build_object('name', region_name, 'pieces', pieces,
                                                               'revenue_cents', revenue) order by revenue desc, region_name)
                           from (select region_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                 from sold group by region_name) g), '[]'::jsonb),
    'by_category', coalesce((select jsonb_agg(jsonb_build_object('name', category_name, 'pieces', pieces,
                                                                 'revenue_cents', revenue) order by revenue desc, category_name)
                             from (select category_name, sum(quantity) as pieces, sum(total_price_cents) as revenue
                                   from sold group by category_name) g), '[]'::jsonb),
    'by_shop', coalesce((select jsonb_agg(jsonb_build_object('name', shop_name, 'pieces', pieces,
                                                             'revenue_cents', revenue, 'shop_cost_paise', cost)
                                          order by revenue desc, shop_name)
                         from (select shop_name, sum(quantity) as pieces, sum(total_price_cents) as revenue,
                                      sum(shop_cost_paise) as cost
                               from sold group by shop_name) g), '[]'::jsonb))
  into v_result;
  return v_result;
end $$;

-- -----------------------------------------------------------------------------
-- What customers search for
-- -----------------------------------------------------------------------------
create table public.search_queries (
  id bigint generated always as identity primary key,
  query text not null check (length(query) between 1 and 100),
  results integer not null check (results >= 0),
  created_at timestamptz not null default now()
);
create index search_queries_created_idx on public.search_queries (created_at desc);

alter table public.search_queries enable row level security;
create policy admin_read on public.search_queries for select to authenticated using (public.is_admin());
revoke all on public.search_queries from anon, authenticated;
grant select on public.search_queries to authenticated;

-- The storefront search (store_products only, D-017): product cards, a page at a time (D-067). The first page also
-- records the words and the number of matches, for Insights. Same matching and order as before (websearch, name, id).
create function public.store_search(p_query text, p_offset integer default 0, p_limit integer default 24)
returns setof public.store_products
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_ts tsquery;
begin
  if v_query = '' then
    return;
  end if;
  v_ts := websearch_to_tsquery('simple', v_query);
  if coalesce(p_offset, 0) = 0 then
    insert into public.search_queries (query, results)
    select lower(v_query), count(*) from public.store_products p where p.search @@ v_ts;
  end if;
  return query
    select p.* from public.store_products p
    where p.search @@ v_ts
    order by p.name, p.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limit, 24), 1), 100);
end $$;

-- -----------------------------------------------------------------------------
-- Demand signals
-- -----------------------------------------------------------------------------
-- Owner rights: saved items are private to each customer under RLS; only these counts leave, behind the admin check.
create function public.admin_demand(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'top_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', n, 'last_results', last_results)
                       order by n desc, query)
      from (select query, count(*) as n,
                   (array_agg(results order by created_at desc))[1] as last_results
            from public.search_queries
            where p_since is null or created_at >= p_since
            group by query order by count(*) desc, query limit 20) t), '[]'::jsonb),
    'empty_searches', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', n) order by n desc, query)
      from (select query, count(*) as n from public.search_queries
            where results = 0 and (p_since is null or created_at >= p_since)
            group by query order by count(*) desc, query limit 20) t), '[]'::jsonb),
    'most_saved', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'region', region, 'status', status,
                                          'saves', saves, 'available', available)
                       order by saves desc, name)
      from (select p.id, p.name, r.name as region, p.status, count(*) as saves,
                   (select coalesce(sum(v.qty_listed - v.qty_reserved), 0) from public.product_variants v
                    where v.product_id = p.id and v.is_active) as available
            from public.wishlists w
            join public.products p on p.id = w.product_id
            join public.regions r on r.id = p.region_id
            where p_since is null or w.created_at >= p_since
            group by p.id, p.name, r.name, p.status
            order by count(*) desc, p.name limit 20) t), '[]'::jsonb))
  into v_result;
  return v_result;
end $$;

revoke all on function public.admin_sales(timestamptz), public.store_search(text, integer, integer),
  public.admin_demand(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_sales(timestamptz), public.admin_demand(timestamptz) to authenticated, service_role;
grant execute on function public.store_search(text, integer, integer) to anon, authenticated, service_role;
