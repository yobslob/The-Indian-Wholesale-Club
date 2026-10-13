-- =============================================================================
-- D-118: what the sourcing runner (role 'worker') and the admin can do with auto-sourcing. See
-- 20261013090000_auto_sourcing for the tables.
-- =============================================================================

-- The online shop's vendor for a state (one per shop and state, as the importer makes them: D-110).
create function public._online_vendor(p_site text, p_label text, p_region uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  select id into v_id from public.vendors where online_site = p_site and region_id = p_region;
  if found then
    update public.vendors set status = 'active' where id = v_id and status <> 'active';
    return v_id;
  end if;
  insert into public.vendors (shop_name, online_site, region_id, status, notes, onboarded_at)
  values (p_label || ' (online)', p_site, p_region, 'active',
          'Online shop (D-110, D-118): its listings come from ' || p_site || '. A sold piece is ordered there, to the hub.',
          now())
  on conflict (online_site, region_id) where online_site is not null do nothing
  returning id into v_id;
  return coalesce(v_id, (select id from public.vendors where online_site = p_site and region_id = p_region));
end $$;

-- -----------------------------------------------------------------------------
-- Settle a product after its sources changed: each active variant takes its best source (not held, read fine,
-- in stock, within the delivery limit, cheapest), its shop price and a top-up to `qty_per_variant` pieces on sale;
-- a variant with sources but none usable stops selling (pieces already ordered stay reserved). Variants without
-- any source (added by hand) are left alone. Returns how many prices and stock levels changed.
-- -----------------------------------------------------------------------------
create function public._sourcing_settle(p_product uuid)
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
     order by ps.price_paise, ps.delivery_days nulls last, ps.created_at
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

-- -----------------------------------------------------------------------------
-- The runner's work for one run: settings, the enabled shops, the targets it now holds (queued ones, best tier
-- first; a target nothing was found for goes back in the queue after 30 days), the products due for their check
-- with their sources, and the shop items already listed (so it doesn't read them again).
-- -----------------------------------------------------------------------------
create function public.worker_sourcing_plan(p_checks integer default 400)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
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
           order by tier nulls last, created_at limit s.targets_per_run for update skip locked) q
   where t.id = q.id;

  return jsonb_build_object(
    'settings', to_jsonb(s) - 'id' - 'updated_at' - 'updated_by',
    'shops', coalesce((select jsonb_agg(jsonb_build_object('site', site, 'label', label, 'reader', reader,
                                                          'product_types', product_types, 'delivery_days', delivery_days)
                                        order by sort_order)
                         from public.sourcing_shops where is_enabled), '[]'::jsonb),
    'targets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'query', t.query,
                                                            'must_match', t.must_match, 'product_type', t.product_type,
                                                            'category', c.slug, 'region', r.slug, 'tier', t.tier)
                                          order by t.tier nulls last, t.created_at)
                           from public.sourcing_targets t
                           join public.categories c on c.id = t.category_id
                           join public.regions r on r.id = t.region_id
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
           and exists (select 1 from public.product_sources ps where ps.product_id = p.id)
           and (p.source_checked_at is null
                or p.source_checked_at < now() - make_interval(days => s.check_every_days))
         order by p.source_checked_at nulls first
         limit greatest(least(p_checks, 2000), 0)) q), '[]'::jsonb),
    'known', coalesce((select jsonb_agg(site || '|' || item_key) from public.product_sources
                        where item_key is not null), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- A listing found for a held target. p_listing: {site, shop_label, page_url, name, slug, summary, description,
-- attributes, weight_g, variants: [{item_key, item_url, page_url?, label, options, price_paise, mrp_paise, in_stock,
-- delivery_days, weight_g}], backups: [{variant (1-based), site, page_url, item_url, item_key, price_paise, mrp_paise,
-- in_stock, delivery_days}]}. A shop item or page already listed returns that listing instead.
-- -----------------------------------------------------------------------------
create function public.worker_sourcing_add(p_target uuid, p_listing jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
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
             (select default_weight_g from public.categories where id = t.category_id)),
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
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order, shop_price_paise)
    values (v_id, upper(v_slug) || '-' || v_n, left(v_item ->> 'label', 80),
            case when jsonb_typeof(v_item -> 'options') = 'object' then v_item -> 'options' else '{}'::jsonb end,
            nullif(v_item ->> 'weight_g', '')::integer,
            case when (v_item ->> 'in_stock')::boolean then s.qty_per_variant else 0 end, now(), v_n,
            (v_item ->> 'price_paise')::integer)
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
end $$;

-- Photos for a listing the runner just made (paths under products/<id>/ in product-media, uploaded by the runner;
-- item_key ties a photo to its variant). It may go live straight away when the founder turned that on and the
-- runner found every detail customers must see.
create function public.worker_sourcing_media(p_product uuid, p_media jsonb, p_publish boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_note text;
  v_live boolean := false;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.products p where p.id = p_product and p.sourcing_target_id is not null)
     or exists (select 1 from public.product_media m where m.product_id = p_product) then
    raise exception 'product_not_open' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_media) is distinct from 'array' or jsonb_array_length(p_media) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_media) m
                 where split_part(m ->> 'path', '/', 1) <> 'products' or split_part(m ->> 'path', '/', 2) <> p_product::text
                    or split_part(m ->> 'path', '/', 3) = '' or split_part(m ->> 'path', '/', 4) <> '') then
    raise exception 'media_invalid' using errcode = 'P0001';
  end if;
  insert into public.product_media (product_id, variant_id, storage_path, alt_text, sort_order, is_primary)
  select p_product,
         (select ps.variant_id from public.product_sources ps
           where ps.product_id = p_product and ps.item_key = m ->> 'item_key' limit 1),
         m ->> 'path', left(coalesce(m ->> 'alt_text', ''), 200), (n - 1)::integer, n = 1
    from jsonb_array_elements(p_media) with ordinality as e(m, n);

  if p_publish and (select auto_publish from public.sourcing_settings where id = 1) then
    begin
      update public.products set status = 'live', published_at = now() where id = p_product and status = 'draft';
      v_live := found;
    exception when others then
      v_note := left(sqlerrm, 200);   -- e.g. food is not cleared yet (D-074): it stays a draft
    end;
  end if;
  return jsonb_build_object('published', v_live, 'note', v_note);
end $$;

create function public.worker_sourcing_target_done(p_target uuid, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  update public.sourcing_targets
     set status = case when found_count > 0 then 'found' else 'none' end::public.sourcing_target_status,
         searched_at = now(), claimed_at = null, note = left(p_note, 500)
   where id = p_target and status = 'searching';
end $$;

-- -----------------------------------------------------------------------------
-- One product's check. p_results: {sources: [{id, ok, item_key, price_paise, mrp_paise, in_stock, delivery_days,
-- error}], added: [{site, page_url, item_url, item_key, label, options, price_paise, mrp_paise, in_stock,
-- delivery_days, weight_g}]} (added: a flavour, colour or pack the shop now has on the same page).
-- A price beyond the guard is held (the variant stops selling from that source until an admin decides).
-- -----------------------------------------------------------------------------
create function public.worker_sourcing_checked(p_product uuid, p_results jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  s public.sourcing_settings;
  r jsonb;
  src public.product_sources;
  v_new integer;
  v_jump boolean;
  v_held integer := 0;
  v_added integer := 0;
  v_slug text;
  v_sort integer;
  v_var uuid;
  v_src uuid;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into s from public.sourcing_settings where id = 1;

  for r in select * from jsonb_array_elements(coalesce(p_results -> 'sources', '[]'::jsonb)) loop
    select * into src from public.product_sources
     where id = (r ->> 'id')::uuid and product_id = p_product for update;
    if not found then
      continue;
    end if;
    if not coalesce((r ->> 'ok')::boolean, false) then
      update public.product_sources
         set fail_count = least(fail_count + 1, 99), last_error = left(coalesce(r ->> 'error', 'unread'), 300),
             checked_at = now()
       where id = src.id;
      continue;
    end if;
    v_new := nullif(r ->> 'price_paise', '')::integer;
    v_jump := v_new is not null and src.price_paise is not null
              and (v_new > src.price_paise * (1 + s.max_rise_pct / 100.0)
                   or v_new < src.price_paise * (1 - s.max_drop_pct / 100.0));
    update public.product_sources
       set price_paise = case when v_jump then price_paise else coalesce(v_new, price_paise) end,
           review = case when v_jump then case when v_new > src.price_paise then 'price_rise' else 'price_drop' end end,
           review_price_paise = case when v_jump then v_new end,
           mrp_paise = coalesce(nullif(r ->> 'mrp_paise', '')::integer, mrp_paise),
           in_stock = coalesce((r ->> 'in_stock')::boolean, false),
           delivery_days = nullif(r ->> 'delivery_days', '')::smallint,
           item_key = case when item_key is null and coalesce(r ->> 'item_key', '') <> ''
                             and not exists (select 1 from public.product_sources o
                                              where o.site = src.site and o.item_key = r ->> 'item_key')
                           then r ->> 'item_key' else item_key end,
           checked_at = now(), fail_count = 0, last_error = null
     where id = src.id;
    v_held := v_held + v_jump::integer;
  end loop;

  select slug into v_slug from public.products where id = p_product;
  for r in select * from jsonb_array_elements(coalesce(p_results -> 'added', '[]'::jsonb)) loop
    continue when coalesce(r ->> 'item_key', '') = '' or coalesce(r ->> 'label', '') = ''
               or coalesce((r ->> 'price_paise')::integer, 0) <= 0 or coalesce(r ->> 'item_url', '') !~ '^https://'
               or coalesce(r ->> 'page_url', '') !~ '^https://'
               or exists (select 1 from public.product_sources o where o.site = r ->> 'site' and o.item_key = r ->> 'item_key')
               or exists (select 1 from public.product_variants x
                           where x.product_id = p_product and lower(x.label) = lower(r ->> 'label'));
    select coalesce(max(sort_order), 0) + 1 into v_sort from public.product_variants where product_id = p_product;
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order, shop_price_paise)
    values (p_product, upper(v_slug) || '-' || v_sort || '-' || substr(md5(random()::text), 1, 3),
            left(r ->> 'label', 80),
            case when jsonb_typeof(r -> 'options') = 'object' then r -> 'options' else '{}'::jsonb end,
            nullif(r ->> 'weight_g', '')::integer, 0, now(), v_sort, (r ->> 'price_paise')::integer)
    returning id into v_var;
    insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise,
                                        mrp_paise, in_stock, delivery_days, checked_at)
    values (p_product, v_var, r ->> 'site', r ->> 'page_url', r ->> 'item_url', r ->> 'item_key',
            (r ->> 'price_paise')::integer, nullif(r ->> 'mrp_paise', '')::integer,
            coalesce((r ->> 'in_stock')::boolean, false), nullif(r ->> 'delivery_days', '')::smallint, now())
    returning id into v_src;
    update public.product_variants set source_id = v_src where id = v_var;
    v_added := v_added + 1;
  end loop;

  return public._sourcing_settle(p_product) || jsonb_build_object('held', v_held, 'added', v_added);
end $$;

-- The run's totals, and each shop's health for the admin.
create function public.worker_sourcing_log(p_run jsonb)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_site text;
  v_shop jsonb;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  insert into public.sourcing_runs (started_at, worker_id, targets_searched, listings_added, products_checked,
                                    prices_changed, stock_changed, held, errors, shops)
  values (coalesce((p_run ->> 'started_at')::timestamptz, now()), auth.uid(),
          coalesce((p_run ->> 'targets_searched')::integer, 0), coalesce((p_run ->> 'listings_added')::integer, 0),
          coalesce((p_run ->> 'products_checked')::integer, 0), coalesce((p_run ->> 'prices_changed')::integer, 0),
          coalesce((p_run ->> 'stock_changed')::integer, 0), coalesce((p_run ->> 'held')::integer, 0),
          coalesce((p_run ->> 'errors')::integer, 0),
          case when jsonb_typeof(p_run -> 'shops') = 'object' then p_run -> 'shops' else '{}'::jsonb end);
  for v_site, v_shop in select * from jsonb_each(case when jsonb_typeof(p_run -> 'shops') = 'object'
                                                      then p_run -> 'shops' else '{}'::jsonb end) loop
    update public.sourcing_shops
       set last_ok_at = case when coalesce((v_shop ->> 'pages')::integer, 0) > coalesce((v_shop ->> 'failed')::integer, 0)
                             then now() else last_ok_at end,
           last_error = case when coalesce(v_shop ->> 'error', '') <> '' then left(v_shop ->> 'error', 300) else last_error end,
           last_error_at = case when coalesce(v_shop ->> 'error', '') <> '' then now() else last_error_at end
     where site = v_site;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Admin: decide a held price (accept it, or drop that source), then settle the product.
-- -----------------------------------------------------------------------------
create function public.admin_sourcing_review(p_source uuid, p_accept boolean)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_product uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_accept then
    update public.product_sources
       set price_paise = review_price_paise, review = null, review_price_paise = null
     where id = p_source and review is not null
    returning product_id into v_product;
  else
    delete from public.product_sources where id = p_source returning product_id into v_product;
  end if;
  if v_product is null then
    raise exception 'source_not_found' using errcode = 'P0001';
  end if;
  perform public._sourcing_settle(v_product);
end $$;

-- Sources for listings imported by hand before D-118 (one per active variant, matched by its label until the first
-- check fills in the shop's id), so the weekly check covers them too.
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, price_paise, in_stock, checked_at)
select p.id, v.id, coalesce(p.source_site, substring(p.source_url from '^https://(?:www\.)?([^/]+)')),
       p.source_url, p.source_url, nullif(p.shop_price_paise, 0), coalesce(p.source_in_stock, v.qty_listed > v.qty_reserved),
       p.source_checked_at
  from public.products p
  join public.product_variants v on v.product_id = p.id and v.is_active
 where p.source_url is not null;
update public.product_variants v set source_id = ps.id
  from public.product_sources ps where ps.variant_id = v.id and v.source_id is null;

-- -----------------------------------------------------------------------------
-- Storage: the runner may add photos only to a listing it made that has none yet.
-- -----------------------------------------------------------------------------
create function public.worker_may_add_photos(p_product text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.is_worker() and exists (select 1 from public.products p
                  where p.id::text = p_product and p.sourcing_target_id is not null
                    and not exists (select 1 from public.product_media m where m.product_id = p.id));
$$;
create policy "iwc worker sourced photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and public.is_worker() and split_part(name, '/', 1) = 'products'
              and public.worker_may_add_photos(split_part(name, '/', 2)));

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke all on function public._online_vendor(text, text, uuid), public._sourcing_settle(uuid),
  public.worker_may_add_photos(text) from public, anon;
revoke all on function public._online_vendor(text, text, uuid), public._sourcing_settle(uuid) from authenticated;
grant execute on function public.worker_may_add_photos(text) to authenticated;
revoke all on function public.worker_sourcing_plan(integer), public.worker_sourcing_add(uuid, jsonb),
  public.worker_sourcing_media(uuid, jsonb, boolean), public.worker_sourcing_target_done(uuid, text),
  public.worker_sourcing_checked(uuid, jsonb), public.worker_sourcing_log(jsonb),
  public.admin_sourcing_review(uuid, boolean) from public, anon, authenticated;
grant execute on function public.worker_sourcing_plan(integer), public.worker_sourcing_add(uuid, jsonb),
  public.worker_sourcing_media(uuid, jsonb, boolean), public.worker_sourcing_target_done(uuid, text),
  public.worker_sourcing_checked(uuid, jsonb), public.worker_sourcing_log(jsonb),
  public.admin_sourcing_review(uuid, boolean) to authenticated, service_role;
