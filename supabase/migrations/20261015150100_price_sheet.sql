-- =============================================================================
-- D-128: Products → Download Excel. The founder: "I want a button in the products section which creates a excel sheets
-- output of these 6 columns only" (name, Indian price, category, weight, US price, margin).
-- One row per product, in the Products page's view (a status tab, the US clearance tab, a search): the shop price and
-- weight that gave the product its price (as _product_auto_price: the cheapest active option with its own shop price,
-- else the product's own, the weight as the repricing uses it) and the price itself. Admins only; the sheet is built
-- in the web app (apps/web/features/admin/price-sheet.ts).
-- =============================================================================

create function public.admin_price_sheet(p_status public.product_status default null,
                                         p_us_stock boolean default false,
                                         p_search text default null)
returns table (name text, product_type public.product_type, shop_price_paise integer, weight_g integer,
               price_cents integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select p.name, p.product_type, pick.shop, pick.g, p.price_cents
    from public.products p
   cross join lateral (select max(v.weight_g) as g from public.product_variants v
                        where v.product_id = p.id and v.is_active) wmax
   cross join lateral (
     select x.shop, x.g
       from (select 0 as src, v.sort_order as ord, v.shop_price_paise as shop,
                    coalesce(v.weight_g, wmax.g,
                             public._fallback_weight_g(p.product_type, v.shop_price_paise, p.category_id)) as g
               from public.product_variants v
              where v.product_id = p.id and v.is_active and v.shop_price_paise is not null
             union all
             select 1, 0, p.shop_price_paise,
                    coalesce(wmax.g, public._fallback_weight_g(p.product_type, p.shop_price_paise, p.category_id))) x
      order by x.src, public._auto_price_cents(x.shop, x.g, p.product_type) nulls last, x.ord
      limit 1) pick
   where (p_status is null or p.status = p_status)
     and (not coalesce(p_us_stock, false) or p.is_us_stock)
     and (coalesce(trim(p_search), '') = '' or p.search @@ websearch_to_tsquery('simple', trim(p_search)))
   order by p.updated_at desc, p.id
   limit 20000;
end $$;

revoke all on function public.admin_price_sheet(public.product_status, boolean, text) from public, anon;
grant execute on function public.admin_price_sheet(public.product_status, boolean, text) to authenticated;
