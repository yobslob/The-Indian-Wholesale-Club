-- =============================================================================
-- Two runners at once (the founder, 2026-10-16: "now I will be running one terminal for clothing(nishorama.com only)
-- and one terminal for foods"): worker_sourcing_plan() takes an optional product type and shop, so each runner
-- claims only its own targets (the claim already skips rows another runner has locked), searches only that shop, and
-- re-checks only listings of its type whose sources are all on that shop. Without them it is as before
-- (20261014140000_all_india_and_bands).
-- =============================================================================

drop function public.worker_sourcing_plan(integer);

create function public.worker_sourcing_plan(p_checks integer default 400, p_type public.product_type default null,
                                            p_site text default null)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.sourcing_settings;
  v_now timestamptz := clock_timestamp();   -- marks this call's claims (two calls in one transaction differ)
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;
  update public.sourcing_targets set status = 'queued', claimed_at = null
   where (status = 'searching' and claimed_at < now() - interval '6 hours')
      or (status = 'none' and searched_at < now() - interval '30 days');
  update public.sourcing_targets t set status = 'searching', claimed_at = v_now
    from (select id from public.sourcing_targets where status = 'queued'
             and (p_type is null or product_type = p_type)
             and (p_site is null or sites is null or p_site = any(sites))
           order by tier nulls last, created_at limit s.targets_per_run for update skip locked) q
   where t.id = q.id;

  return jsonb_build_object(
    'settings', to_jsonb(s) - 'id' - 'updated_at' - 'updated_by',
    'shops', coalesce((select jsonb_agg(jsonb_build_object('site', site, 'label', label, 'reader', reader,
                                                          'product_types', product_types, 'delivery_days', delivery_days)
                                        order by sort_order)
                         from public.sourcing_shops
                        where is_enabled and (p_site is null or site = p_site)
                          and (p_type is null or p_type = any(product_types))), '[]'::jsonb),
    'targets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'query', t.query,
                                                            'must_match', t.must_match, 'product_type', t.product_type,
                                                            'category', c.slug, 'region', r.slug, 'tier', t.tier,
                                                            'sites', t.sites, 'min_price_paise', t.min_price_paise,
                                                            'max_price_paise', t.max_price_paise, 'listings', t.listings)
                                          order by t.tier nulls last, t.created_at)
                           from public.sourcing_targets t
                           join public.categories c on c.id = t.category_id
                           left join public.regions r on r.id = t.region_id
                          where t.status = 'searching' and t.claimed_at = v_now), '[]'::jsonb),
    'checks', coalesce((select jsonb_agg(q.x) from (
        select jsonb_build_object(
                 'product_id', p.id, 'name', p.name,
                 'sources', (select jsonb_agg(jsonb_build_object('id', ps.id, 'site', ps.site, 'page_url', ps.page_url,
                                                                'item_url', ps.item_url, 'item_key', ps.item_key,
                                                                'label', v.label, 'options', v.options))
                               from public.product_sources ps
                               join public.product_variants v on v.id = ps.variant_id
                              where ps.product_id = p.id)) as x
          from public.products p
         where p.status <> 'archived'
           and (p_type is null or p.product_type = p_type)
           and exists (select 1 from public.product_sources ps where ps.product_id = p.id)
           and (p_site is null or not exists (select 1 from public.product_sources ps
                                               where ps.product_id = p.id and ps.site <> p_site))
           and (p.source_checked_at is null
                or p.source_checked_at < now() - make_interval(days => s.check_every_days))
         order by p.source_checked_at nulls first
         limit greatest(least(p_checks, 2000), 0)) q), '[]'::jsonb),
    'known', coalesce((select jsonb_agg(site || '|' || item_key) from public.product_sources
                        where item_key is not null), '[]'::jsonb));
end $function$;
revoke all on function public.worker_sourcing_plan(integer, public.product_type, text) from public, anon;
grant execute on function public.worker_sourcing_plan(integer, public.product_type, text) to authenticated;
