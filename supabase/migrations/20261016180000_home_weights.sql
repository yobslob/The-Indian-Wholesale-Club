-- =============================================================================
-- D-134: home & gifts are priced on the weight their own shop page states (the founder: "design a very smart system
-- for home decor items which has a very large amount of range, although mostly is and will be from amazon and almost
-- every item will definately have its weight listed in one of those dropdown abouts. but this weight will not be
-- shown in frontend"). The sourcing runner reads each option's own page (packages/shared/src/sourcing/estimate/
-- home.ts: the packed weight, else the piece's own weight plus its packing, each checked against its box size) and
-- writes it through the worker account:
--  - worker_home_plan(limit, all): the home listings with an option that has no weight, one recorded before sources
--    were kept, a matching item's or an estimate (all: also a shop's or a packed one, to read again), with every
--    page each option can be read on.
--  - worker_set_home_weights(weights): home only; never over a weight weighed at the hub or typed by an admin (D-133's
--    order: the hub's scale, then an admin, then the system); a matching item's weight never over a page's own.
-- No customer-facing change: weights stay out of every store_* view and function (INV-1, D-132).
-- =============================================================================

create function public.worker_home_plan(p_limit integer default 40, p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'product_type', p.product_type,
             'category_weight_g', c.default_weight_g, 'page_url', p.source_url, 'site', p.source_site,
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source, 'weight_note', v.weight_note)
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id),
             'sources', coalesce((select jsonb_agg(jsonb_build_object(
                                          'variant_id', s.variant_id, 'site', s.site, 'page_url', s.page_url,
                                          'item_url', s.item_url, 'item_key', s.item_key)
                                        order by (s.id = (select v2.source_id from public.product_variants v2
                                                           where v2.id = s.variant_id)) desc,
                                                 s.checked_at desc nulls last)
                                   from public.product_sources s where s.product_id = p.id), '[]'::jsonb))
           order by (p.status = 'live') desc, p.created_at)
      from (select p.* from public.products p
             where p.product_type = 'home' and not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id
                              and coalesce(v.weight_source, '') not in ('weighed', 'admin')
                              and (p_all or v.weight_g is null or v.weight_source is null
                                   or v.weight_source in ('similar', 'estimated')))
             order by (p.status = 'live') desc, p.created_at
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_home_plan(integer, boolean) from public, anon;
grant execute on function public.worker_home_plan(integer, boolean) to authenticated;

-- p_weights: [{variant_id, weight_g, source: shop | packed | similar, note}], 500 at most, home only. Returns how
-- many options changed.
create function public.worker_set_home_weights(p_weights jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  v_g integer;
  v_src text;
  v_note text;
  v_n integer := 0;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_weights) is distinct from 'array' or jsonb_array_length(p_weights) > 500 then
    raise exception 'weights_invalid' using errcode = 'P0001';
  end if;
  for w in select * from jsonb_array_elements(p_weights) loop
    v_g := case when jsonb_typeof(w -> 'weight_g') = 'number' then (w ->> 'weight_g')::numeric::integer end;
    v_src := w ->> 'source';
    v_note := nullif(left(coalesce(w ->> 'note', ''), 200), '');
    if v_g is null or v_g not between 1 and 50000 or coalesce(v_src, '') not in ('shop', 'packed', 'similar') then
      continue;
    end if;
    update public.product_variants v
       set weight_g = v_g, weight_source = v_src, weight_note = v_note
      from public.products p
     where v.id = nullif(w ->> 'variant_id', '')::uuid and p.id = v.product_id and p.product_type = 'home'
       and coalesce(v.weight_source, '') not in ('weighed', 'admin')
       and (v_src <> 'similar' or v.weight_g is null or v.weight_source is null
            or v.weight_source in ('similar', 'estimated'))
       and (v.weight_g is distinct from v_g or v.weight_source is distinct from v_src
            or v.weight_note is distinct from v_note);
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.worker_set_home_weights(jsonb) from public, anon;
grant execute on function public.worker_set_home_weights(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- The runner's new home options keep their packed weight too (D-134). Otherwise as 20261016160000_food_weights.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.worker_sourcing_add(p_target uuid, p_listing jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.sourcing_settings;
  t public.sourcing_targets;
  v_site text := p_listing ->> 'site';
  v_existing uuid;
  v_id uuid;
  v_slug text := coalesce(p_listing ->> 'slug', '');
  v_shop integer;
  v_weight integer;
  v_price integer;
  v_item jsonb;
  v_n integer;
  v_var uuid;
  v_src uuid;
  v_vars uuid[] := '{}';
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;
  select * into t from public.sourcing_targets where id = p_target and status = 'searching' for update;
  if not found then
    raise exception 'target_not_held' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_listing -> 'variants') is distinct from 'array'
     or jsonb_array_length(p_listing -> 'variants') not between 1 and 60
     or exists (select 1 from jsonb_array_elements(p_listing -> 'variants') x
                 where coalesce(x ->> 'item_key', '') = '' or coalesce((x ->> 'price_paise')::integer, 0) <= 0
                    or coalesce(x ->> 'item_url', '') !~ '^https://' or coalesce(x ->> 'label', '') = '')
     or (select count(distinct x ->> 'item_key') from jsonb_array_elements(p_listing -> 'variants') x)
        <> jsonb_array_length(p_listing -> 'variants')
     or coalesce(v_site, '') = '' or coalesce(p_listing ->> 'page_url', '') !~ '^https://'
     or length(coalesce(p_listing ->> 'name', '')) not between 2 and 120
     or jsonb_typeof(coalesce(p_listing -> 'attributes', '{}'::jsonb)) <> 'object' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;

  select ps.product_id into v_existing
    from public.product_sources ps
   where ps.site = v_site and ps.item_key in (select x ->> 'item_key' from jsonb_array_elements(p_listing -> 'variants') x)
   limit 1;
  if v_existing is null then
    select id into v_existing from public.products where source_url = p_listing ->> 'page_url';
  end if;
  if v_existing is not null then
    return jsonb_build_object('product_id', v_existing, 'created', false);
  end if;

  select coalesce(min((x ->> 'price_paise')::integer) filter (where (x ->> 'in_stock')::boolean),
                  min((x ->> 'price_paise')::integer)),
         max(nullif(x ->> 'weight_g', '')::integer)
    into v_shop, v_weight
    from jsonb_array_elements(p_listing -> 'variants') x;
  v_price := public._auto_price_cents(
    v_shop,
    coalesce(v_weight, nullif(p_listing ->> 'weight_g', '')::integer,
             public._fallback_weight_g(t.product_type, v_shop, t.category_id)),
    t.product_type);
  if v_price is null then
    raise exception 'price_needed' using errcode = 'P0001';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'listing_invalid' using errcode = 'P0001';
  end if;
  while exists (select 1 from public.products where slug = v_slug) loop
    v_slug := left(coalesce(p_listing ->> 'slug', 'item'), 70) || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, description,
                               attributes, price_cents, shop_price_paise, price_auto, status, created_by, source_url,
                               source_site, source_checked_at, source_in_stock, sourcing_target_id)
  values (public._online_vendor(v_site, coalesce(nullif(p_listing ->> 'shop_label', ''), v_site), t.region_id),
          t.region_id, t.category_id, t.product_type, p_listing ->> 'name', v_slug,
          nullif(left(p_listing ->> 'summary', 300), ''), nullif(left(p_listing ->> 'description', 4000), ''),
          coalesce(p_listing -> 'attributes', '{}'::jsonb), v_price, v_shop, true, 'draft', auth.uid(),
          p_listing ->> 'page_url', v_site, now(), true, t.id)
  returning id into v_id;

  for v_item, v_n in select x, n from jsonb_array_elements(p_listing -> 'variants') with ordinality as e(x, n) loop
    insert into public.product_variants (product_id, sku, label, options, weight_g, weight_source, weight_note,
                                         qty_listed, qty_confirmed_at, sort_order, shop_price_paise, net_qty)
    values (v_id, upper(v_slug) || '-' || v_n, left(v_item ->> 'label', 80),
            case when jsonb_typeof(v_item -> 'options') = 'object' then v_item -> 'options' else '{}'::jsonb end,
            nullif(v_item ->> 'weight_g', '')::integer,
            case when v_item ->> 'weight_source' in ('shop', 'similar')
                      or (v_item ->> 'weight_source' = 'packed' and t.product_type in ('food', 'home'))
                 then v_item ->> 'weight_source' end,
            nullif(left(coalesce(v_item ->> 'weight_note', ''), 200), ''),
            case when (v_item ->> 'in_stock')::boolean then s.qty_per_variant else 0 end, now(), v_n,
            (v_item ->> 'price_paise')::integer,
            case when t.product_type = 'food' then nullif(left(coalesce(v_item ->> 'net_qty', ''), 40), '') end)
    returning id into v_var;
    v_vars := v_vars || v_var;
    insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                        mrp_paise, in_stock, delivery_days, checked_at)
    values (v_id, v_var, v_site, coalesce(nullif(v_item ->> 'page_url', ''), p_listing ->> 'page_url'),
            v_item ->> 'item_url', v_item ->> 'item_key', (v_item ->> 'price_paise')::integer,
            nullif(v_item ->> 'mrp_paise', '')::integer, coalesce((v_item ->> 'in_stock')::boolean, false),
            nullif(v_item ->> 'delivery_days', '')::smallint, now())
    returning id into v_src;
    update public.product_variants set source_id = v_src where id = v_var;
  end loop;

  -- the same piece on other shops: backups the weekly check can switch to
  insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                      mrp_paise, in_stock, delivery_days, checked_at)
  select v_id, v_vars[(b ->> 'variant')::integer], b ->> 'site', b ->> 'page_url', b ->> 'item_url', b ->> 'item_key',
         nullif(b ->> 'price_paise', '')::integer, nullif(b ->> 'mrp_paise', '')::integer,
         coalesce((b ->> 'in_stock')::boolean, false), nullif(b ->> 'delivery_days', '')::smallint, now()
    from jsonb_array_elements(coalesce(p_listing -> 'backups', '[]'::jsonb)) b
   where (b ->> 'variant')::integer between 1 and cardinality(v_vars)
     and coalesce(b ->> 'site', '') <> '' and coalesce(b ->> 'item_key', '') <> ''
     and coalesce(b ->> 'page_url', '') ~ '^https://' and coalesce(b ->> 'item_url', '') ~ '^https://'
  on conflict (site, item_key) where item_key is not null do nothing;

  perform public._sourcing_settle(v_id);
  update public.sourcing_targets set found_count = found_count + 1 where id = p_target;
  return jsonb_build_object('product_id', v_id, 'created', true);
end $function$;
