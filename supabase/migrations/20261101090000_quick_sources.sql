-- =============================================================================
-- D-162 (2026-10-26): a listing that can be bought whole from the quick-delivery shops (Blinkit, BigBasket, Zepto,
-- Instamart; D-148) is bought there, so it carries the 7-day tag.
-- The tag is worked out on every read (_quick_listings: every active option's source in use is a quick shop), but
-- _sourcing_settle chose each option's source by price alone: a piece found on Blinkit with a cheaper Amazon or
-- Flipkart backup was bought from the backup and lost its tag, on the day it was added and at every weekly check.
--  - _quick_sourceable(product): 7-day delivery has its days in Settings, and every active option that has a usable
--    source has a usable quick-shop source (in stock, not held, read without failing, inside the delivery limit).
--  - _sourcing_settle: when that holds, a quick-shop source comes before any other; otherwise the cheapest, as before.
--    A listing with one option sold only elsewhere stays a normal listing at the cheapest prices (no 7-day promise to
--    pay for). The pause (quick_delivery_paused) is a day the hub cannot buy and changes no source.
--  - ops_quick_sources(apply, limit): the founder's backfill (`pnpm quick:sources`, service role only): which listings
--    now bought elsewhere would switch, then the switch in batches, each listing settled as the weekly check would
--    (from the prices last read; its check date kept). Idempotent: a switched listing is no longer a candidate.
-- Size: none (functions). Egress: unchanged. Page cache: none (store pages pick it up within the 5-minute fallback).
-- Tests: quick_sources.test.sql.
-- =============================================================================

create function public._quick_sourceable(p_product uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.pricing_settings s
                  where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null)
     and coalesce((
       select bool_and(x.quick)
         from (select ps.variant_id, bool_or(coalesce(sh.quick_delivery, false)) as quick
                 from public.product_sources ps
                 join public.product_variants v on v.id = ps.variant_id
                 left join public.sourcing_shops sh on sh.site = ps.site
                 cross join public.sourcing_settings ss
                where v.product_id = p_product and v.is_active and ss.id = 1
                  and ps.review is null and ps.fail_count < 2 and ps.in_stock and ps.price_paise is not null
                  and coalesce(ps.delivery_days, sh.delivery_days, 0) <= ss.max_delivery_days
                group by ps.variant_id) x), false)
$$;
revoke all on function public._quick_sourceable(uuid) from public, anon, authenticated;

create or replace function public._sourcing_settle(p_product uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.sourcing_settings;
  v public.product_variants;
  v_best public.product_sources;
  v_qty integer;
  v_on_sale boolean := false;
  v_prices integer := 0;
  v_stock integer := 0;
  v_quick boolean := public._quick_sourceable(p_product);
begin
  select * into s from public.sourcing_settings where id = 1;
  perform public._set_stock_context('adjusted', 'source_check', p_product, 'Shop check (D-118)');
  for v in select * from public.product_variants where product_id = p_product and is_active order by sort_order for update
  loop
    select ps.* into v_best
      from public.product_sources ps
      left join public.sourcing_shops sh on sh.site = ps.site
     where ps.variant_id = v.id and ps.review is null and ps.fail_count < 2 and ps.in_stock
       and ps.price_paise is not null
       and coalesce(ps.delivery_days, sh.delivery_days, 0) <= s.max_delivery_days
     order by (v_quick and coalesce(sh.quick_delivery, false)) desc, ps.price_paise, ps.delivery_days nulls last,
              ps.created_at
     limit 1;
    if found then
      v_qty := greatest(v.qty_listed, v.qty_reserved + s.qty_per_variant);
      v_prices := v_prices + (v.shop_price_paise is distinct from v_best.price_paise)::integer;
      v_stock := v_stock + (v_qty <> v.qty_listed)::integer;
      update public.product_variants
         set shop_price_paise = v_best.price_paise, source_id = v_best.id, qty_listed = v_qty, qty_confirmed_at = now()
       where id = v.id;
      v_on_sale := v_on_sale or v_qty > v.qty_reserved;
    elsif exists (select 1 from public.product_sources where variant_id = v.id) then
      if v.qty_listed > v.qty_reserved then
        update public.product_variants set qty_listed = qty_reserved, qty_confirmed_at = now() where id = v.id;
        v_stock := v_stock + 1;
      end if;
    else
      v_on_sale := v_on_sale or v.qty_listed > v.qty_reserved;
    end if;
  end loop;
  perform public._set_stock_context(null, null, null, null);

  update public.products p
     set shop_price_paise = coalesce((select min(x.shop_price_paise) from public.product_variants x
                                       where x.product_id = p.id and x.is_active and x.qty_listed > x.qty_reserved),
                                     p.shop_price_paise),
         source_checked_at = now(),
         source_in_stock = v_on_sale
   where p.id = p_product;
  return jsonb_build_object('price_changes', v_prices, 'stock_changes', v_stock);
end $$;
revoke all on function public._sourcing_settle(uuid) from public, anon, authenticated;

-- The backfill. A candidate: not archived, has a quick-shop source, some active option is bought elsewhere now, and
-- _quick_sourceable says the whole listing can be bought from the quick shops.
create function public.ops_quick_sources(p_apply boolean default false, p_limit integer default 100)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_checked timestamptz;
  v_done integer := 0;
begin
  if p_limit not between 1 and 500 then
    raise exception 'limit_invalid' using errcode = 'P0001';
  end if;
  drop table if exists pg_temp._qs;
  create temp table _qs on commit drop as
  select p.id, p.name, p.status, p.shop_price_paise,
         public._quick_sourceable(p.id) as sourceable,
         (select array_agg(distinct coalesce(ps.site, p.source_site))
            from public.product_variants v left join public.product_sources ps on ps.id = v.source_id
           where v.product_id = p.id and v.is_active) as bought_at,
         (select min(ps.price_paise) from public.product_sources ps
            join public.sourcing_shops sh on sh.site = ps.site and sh.quick_delivery
           where ps.product_id = p.id and ps.in_stock and ps.review is null and ps.fail_count < 2) as quick_price_paise
    from public.products p
   where p.status <> 'archived'
     and exists (select 1 from public.product_sources ps join public.sourcing_shops sh on sh.site = ps.site
                  where ps.product_id = p.id and sh.quick_delivery)
     and exists (select 1 from public.product_variants v
                   left join public.product_sources ps on ps.id = v.source_id
                   left join public.sourcing_shops sh on sh.site = coalesce(ps.site, p.source_site)
                  where v.product_id = p.id and v.is_active and not coalesce(sh.quick_delivery, false));

  if p_apply then
    select array_agg(id) into v_ids from (select id from _qs where sourceable order by id limit p_limit) x;
    foreach v_id in array coalesce(v_ids, '{}') loop
      select source_checked_at into v_checked from public.products where id = v_id;
      perform public._sourcing_settle(v_id);
      update public.products set source_checked_at = v_checked where id = v_id;
      v_done := v_done + 1;
    end loop;
    delete from _qs where id = any(coalesce(v_ids, '{}'));
  end if;

  return jsonb_build_object(
    'switched', v_done,
    'to_switch', (select count(*) from _qs where sourceable),
    'live_to_switch', (select count(*) from _qs where sourceable and status = 'live'),
    -- some option has no usable quick-shop source (sold out there, held, or never found there): stays as it is
    'stay_normal', (select count(*) from _qs where not sourceable),
    'sample', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'status', status,
                                                            'bought_at', bought_at, 'shop_price_paise', shop_price_paise,
                                                            'quick_price_paise', quick_price_paise))
                          from (select * from _qs where sourceable order by status <> 'live', name limit 15) s), '[]'::jsonb),
    -- sites that look like the quick shops but are not marked quick_delivery (a host the shops list lacks)
    'unmarked_sites', coalesce((select jsonb_agg(distinct x.site) from (
        select ps.site from public.product_sources ps
        union select p.source_site from public.products p where p.source_site is not null) x
      where x.site ~* '(blinkit|grofers|zepto|bigbasket|swiggy|instamart)'
        and not exists (select 1 from public.sourcing_shops sh where sh.site = x.site and sh.quick_delivery)), '[]'::jsonb));
end $$;
revoke all on function public.ops_quick_sources(boolean, integer) from public, anon, authenticated;
grant execute on function public.ops_quick_sources(boolean, integer) to service_role;
