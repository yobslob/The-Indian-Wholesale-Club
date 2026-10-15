-- =============================================================================
-- D-129: every price rests on a real weight. The founder: "Pricing heavily depends on weight … make a system which
-- makes sure that this product has/is showing correct weight and each product is showing it's weight … wherever there
-- is an assumption in price, the price will change and customer will be lost … without changing the price algorithm."
-- The formula (D-128) is untouched; what changes is the weight it is given:
--  - product_variants.weight_source / weight_note: where each weight came from (weighed, admin, shop, similar) and
--    what the page said. Admin and worker only (store_variants never selects them, INV-1).
--  - A weight changed without a source counts as the changer's (an admin typed it, the runner read it); the runner
--    never overwrites a weight a person weighed or typed.
--  - Another size or colour of the same piece takes its sibling's weight (marked similar), never a pack's.
--  - No listing goes live while an option has no weight (its price would rest on the category's usual weight, a
--    guess); a new item the weekly check finds on a live listing waits, inactive, until it has one.
--  - admin_weights_to_check(), worker_weight_plan() and worker_set_weights() find and fill the rest.
-- Placeholders (demo rows) and US clearance pieces (priced by hand from what was paid, D-072) are not held.
-- =============================================================================

alter table public.product_variants
  add column weight_source text check (weight_source in ('weighed', 'admin', 'shop', 'similar')),
  add column weight_note text check (char_length(weight_note) <= 200);

comment on column public.product_variants.weight_source is
  'D-129: where weight_g came from: weighed, admin (typed), shop (its own page), similar (a matching item); null with a weight = recorded before D-129';

-- The note a new item gets when it is held for its weight (cleared, and the item sold again, once it has one).
create function public._weight_held_note() returns text language sql immutable as $$
  select 'Waiting for its weight (D-129)'::text
$$;
revoke all on function public._weight_held_note() from public, anon, authenticated;

create function public._variant_weight() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_sib record;
  v_product public.products;
begin
  if tg_op = 'UPDATE' then
    if public.is_worker() and old.weight_source in ('weighed', 'admin')
       and (new.weight_g is distinct from old.weight_g or new.weight_source is distinct from old.weight_source) then
      -- the runner never overwrites what a person weighed or typed
      new.weight_g := old.weight_g;
      new.weight_source := old.weight_source;
      new.weight_note := old.weight_note;
    elsif new.weight_g is distinct from old.weight_g and new.weight_source is not distinct from old.weight_source then
      -- a weight changed without saying where from: it is whoever changed it
      new.weight_source := null;
      if new.weight_note is not distinct from old.weight_note then
        new.weight_note := null;
      end if;
    end if;
  end if;

  -- another size or colour of the same piece weighs what its sibling does; a pack never borrows (packs differ)
  if tg_op = 'INSERT' and new.weight_g is null and not (coalesce(new.options, '{}'::jsonb) ? 'pack') then
    select v.weight_g, v.label into v_sib
      from public.product_variants v
     where v.product_id = new.product_id and v.weight_g is not null and not (v.options ? 'pack')
     order by (v.weight_source = 'weighed') desc, v.weight_g desc
     limit 1;
    if found then
      new.weight_g := v_sib.weight_g;
      new.weight_source := 'similar';
      new.weight_note := left('Another option of this piece: ' || v_sib.label, 200);
    end if;
  end if;

  if new.weight_g is null then
    new.weight_source := null;
  elsif new.weight_source is null then
    new.weight_source := case when public.is_admin() then 'admin' when public.is_worker() then 'shop' end;
  end if;

  select * into v_product from public.products where id = new.product_id;
  if found and v_product.status = 'live' and not v_product.is_placeholder and not v_product.is_us_stock then
    if tg_op = 'INSERT' and new.weight_g is null and new.is_active and public.is_worker() then
      -- a new item on a live listing (the weekly check) waits for its weight instead of selling on a guess
      new.is_active := false;
      new.weight_note := public._weight_held_note();
    elsif new.weight_g is null and new.is_active and (public.is_admin() or public.is_worker())
          and (tg_op = 'INSERT' or old.weight_g is not null or not old.is_active) then
      raise exception 'weight_missing: % of % needs its weight before it sells (D-129)', new.label, v_product.name
        using errcode = '23514';
    end if;
  end if;
  -- the weight arrived: a held item sells again
  if tg_op = 'UPDATE' and old.weight_g is null and new.weight_g is not null and not new.is_active
     and old.weight_note = public._weight_held_note() then
    new.is_active := true;
    if new.weight_note is not distinct from old.weight_note then
      new.weight_note := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function public._variant_weight() from public, anon, authenticated;

create trigger product_variants_weight
  before insert or update of weight_g, weight_source, weight_note, is_active on public.product_variants
  for each row execute function public._variant_weight();

-- No listing goes live with an option that has no weight.
create function public._weight_before_live() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_missing text;
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live')
     and not new.is_placeholder and not new.is_us_stock then
    select string_agg(v.label, ', ' order by v.sort_order, v.label) into v_missing
      from public.product_variants v
     where v.product_id = new.id and v.is_active and v.weight_g is null;
    if v_missing is not null then
      raise exception 'weight_missing: % has no weight for %: its price would rest on a guess (D-129)',
        new.name, left(v_missing, 120) using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
revoke all on function public._weight_before_live() from public, anon, authenticated;

create trigger products_weight_before_live
  before insert or update of status on public.products
  for each row execute function public._weight_before_live();

-- -----------------------------------------------------------------------------
-- What needs a weight: an option without one, one from a matching item, one recorded before sources were kept, or a
-- clothing or home weight under a quarter or over four times its category's (domain/weight.ts unusualWeight).
-- -----------------------------------------------------------------------------
create function public._weight_needs_check(v public.product_variants, p_type public.product_type, p_category_g integer)
returns boolean language sql immutable as $$
  select v.is_active and (
    v.weight_g is null
    or v.weight_source is null or v.weight_source = 'similar'
    or (p_type <> 'food' and p_category_g is not null
        and v.weight_source <> 'weighed' and v.weight_source <> 'admin'
        and (v.weight_g * 4 < p_category_g or v.weight_g > p_category_g * 4)))
$$;
revoke all on function public._weight_needs_check(public.product_variants, public.product_type, integer)
  from public, anon, authenticated;

create function public.admin_weights_to_check(p_offset integer default 0, p_limit integer default 50)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    with due as (
      select p.id, p.name, p.status, p.product_type, p.updated_at, c.name as category, c.default_weight_g,
             bool_or(v.weight_g is null and v.is_active) as missing
        from public.products p
        join public.categories c on c.id = p.category_id
        join public.product_variants v on v.product_id = p.id
       where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
         and (public._weight_needs_check(v, p.product_type, c.default_weight_g)
              or v.weight_note = public._weight_held_note())
       group by p.id, c.name, c.default_weight_g
    )
    select jsonb_build_object(
      'total', (select count(*) from due),
      'missing', (select count(*) from due where missing),
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', d.id, 'name', d.name, 'status', d.status, 'product_type', d.product_type,
                 'category', d.category, 'category_weight_g', d.default_weight_g,
                 'variants', (select jsonb_agg(jsonb_build_object(
                                       'id', v.id, 'label', v.label, 'options', v.options, 'is_active', v.is_active,
                                       'weight_g', v.weight_g, 'weight_source', v.weight_source,
                                       'weight_note', v.weight_note, 'shop_price_paise', v.shop_price_paise)
                                     order by v.sort_order, v.label)
                                from public.product_variants v where v.product_id = d.id))
               order by (d.status = 'live') desc, d.missing desc, d.updated_at desc, d.id)
          from (select * from due
                 order by (status = 'live') desc, missing desc, updated_at desc, id
                 offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 200)) d), '[]'::jsonb)));
end $$;
revoke all on function public.admin_weights_to_check(integer, integer) from public, anon;
grant execute on function public.admin_weights_to_check(integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- The runner fills missing weights (D-129): the listings whose options have none, with every shop item they can be
-- ordered as, and a way to write what it read (never over a person's weight, never over a shop's with a similar one).
-- -----------------------------------------------------------------------------
create function public.worker_weight_plan(p_limit integer default 40)
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
                                   'weight_source', v.weight_source)
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id),
             'sources', coalesce((select jsonb_agg(jsonb_build_object(
                                          'variant_id', s.variant_id, 'site', s.site, 'page_url', s.page_url,
                                          'item_url', s.item_url, 'item_key', s.item_key)
                                        order by s.checked_at desc nulls last)
                                   from public.product_sources s where s.product_id = p.id), '[]'::jsonb))
           order by (p.status = 'live') desc, p.created_at)
      from (select p.* from public.products p
             where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id
                              and (v.weight_g is null or v.weight_source = 'similar'
                                   or v.weight_note = public._weight_held_note()))
             order by (p.status = 'live') desc, p.created_at
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_weight_plan(integer) from public, anon;
grant execute on function public.worker_weight_plan(integer) to authenticated;

-- p_weights: [{variant_id, weight_g, source: shop | similar, note}]. A missing weight is filled; a similar one only
-- by the shop's own; nothing else is touched. Returns how many options got a weight.
create function public.worker_set_weights(p_weights jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  v_n integer := 0;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_weights) is distinct from 'array' or jsonb_array_length(p_weights) > 500 then
    raise exception 'weights_invalid' using errcode = 'P0001';
  end if;
  for w in select * from jsonb_array_elements(p_weights) loop
    if coalesce(w ->> 'source', '') not in ('shop', 'similar')
       or coalesce(nullif(w ->> 'weight_g', '')::integer, 0) not between 1 and 50000 then
      continue;
    end if;
    update public.product_variants v
       set weight_g = (w ->> 'weight_g')::integer, weight_source = w ->> 'source',
           weight_note = nullif(left(coalesce(w ->> 'note', ''), 200), '')
     where v.id = nullif(w ->> 'variant_id', '')::uuid
       and (v.weight_g is null or (v.weight_source = 'similar' and w ->> 'source' = 'shop'));
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.worker_set_weights(jsonb) from public, anon;
grant execute on function public.worker_set_weights(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Publish all drafts (D-120) holds a draft whose option has no weight and counts it (no_weight). Otherwise as
-- 20261014120100_publish_drafts.
-- -----------------------------------------------------------------------------
create or replace function public.admin_publish_drafts()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_live integer := 0;
  v_no_photo integer := 0;
  v_no_option integer := 0;
  v_no_stock integer := 0;
  v_no_weight integer := 0;
  v_refused integer := 0;
  v_missing integer := 0;
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  for r in
    select p.id,
           case p.product_type
             when 'clothing' then coalesce(p.attributes ->> 'fibre_content', '') <> ''
                                  and coalesce(p.attributes ->> 'care', '') <> ''
             when 'food' then coalesce(p.attributes ->> 'ingredients', '') <> ''
                              and jsonb_typeof(p.attributes -> 'allergens') = 'array'
                              and p.attributes ? 'shelf_life_days'
             when 'home' then coalesce(p.attributes ->> 'material', '') <> ''
             else true
           end as has_details,
           exists (select 1 from public.product_media m where m.product_id = p.id) as has_photo,
           exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active) as has_option,
           exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active and v.qty_listed > v.qty_reserved) as has_stock,
           not exists (select 1 from public.product_variants v
                        where v.product_id = p.id and v.is_active and v.weight_g is null) as has_weight
      from public.products p
     where p.status = 'draft' and not p.is_placeholder and not p.is_us_stock
     order by p.created_at
  loop
    if not r.has_photo then
      v_no_photo := v_no_photo + 1;
    elsif not r.has_option then
      v_no_option := v_no_option + 1;
    elsif not r.has_stock then
      v_no_stock := v_no_stock + 1;
    elsif not r.has_weight then
      v_no_weight := v_no_weight + 1;   -- D-129: its price would rest on a guess
    else
      begin
        update public.products set status = 'live', published_at = now() where id = r.id and status = 'draft';
        v_live := v_live + 1;
        if not r.has_details then
          v_missing := v_missing + 1;
        end if;
      exception when others then
        v_refused := v_refused + 1;
        v_note := left(sqlerrm, 200);   -- e.g. food is not cleared (D-074)
      end;
    end if;
  end loop;
  return jsonb_build_object('published', v_live, 'no_photo', v_no_photo, 'no_option', v_no_option,
                            'no_stock', v_no_stock, 'no_weight', v_no_weight, 'refused', v_refused, 'note', v_note,
                            'live_missing_details', v_missing);
end $$;

-- -----------------------------------------------------------------------------
-- A listing made by hand or imported keeps where each weight came from. Otherwise as 20261013090100_variant_prices.
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_listing(p_listing jsonb)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_variant jsonb;
  v_n integer := 0;
  v_price integer := nullif(p_listing ->> 'price_cents', '')::integer;
  v_shop integer := nullif(p_listing ->> 'shop_price_paise', '')::integer;
  v_weight integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_vendor from public.vendors
   where id = nullif(p_listing ->> 'vendor_id', '')::uuid and status = 'active';
  if not found then
    raise exception 'vendor_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_listing -> 'variants', '[]'::jsonb)) <> 'array' then
    raise exception 'variants_must_be_a_list' using errcode = 'P0001';
  end if;
  if v_price is null then
    select coalesce(max(nullif(v ->> 'weight_g', '')::integer),
                    (select default_weight_g from public.categories where id = (p_listing ->> 'category_id')::uuid))
      into v_weight
    from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) v;
    v_price := public.admin_price_preview(v_shop, v_weight, (p_listing ->> 'product_type')::public.product_type);
    if v_price is null then
      raise exception 'price_needed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, price_auto, status, created_by)
  values (v_vendor.id, v_vendor.region_id, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          v_price, v_shop, nullif(p_listing ->> 'price_cents', '') is null, 'draft', auth.uid())
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, weight_source, weight_note,
                                         qty_listed, qty_confirmed_at, sort_order, shop_price_paise)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            case when v_variant ->> 'weight_source' in ('weighed', 'admin', 'shop', 'similar')
                 then v_variant ->> 'weight_source' end,
            nullif(left(coalesce(v_variant ->> 'weight_note', ''), 200), ''),
            (v_variant ->> 'qty')::integer, now(), v_n, nullif(v_variant ->> 'shop_price_paise', '')::integer);
  end loop;
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- The runner's new listings keep where each weight was read. Otherwise as 20261014140000_all_india_and_bands.
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
                                         qty_listed, qty_confirmed_at, sort_order, shop_price_paise)
    values (v_id, upper(v_slug) || '-' || v_n, left(v_item ->> 'label', 80),
            case when jsonb_typeof(v_item -> 'options') = 'object' then v_item -> 'options' else '{}'::jsonb end,
            nullif(v_item ->> 'weight_g', '')::integer,
            case when v_item ->> 'weight_source' in ('shop', 'similar') then v_item ->> 'weight_source' end,
            nullif(left(coalesce(v_item ->> 'weight_note', ''), 200), ''),
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
end $function$;
