-- =============================================================================
-- D-133: every food option is priced on its packed weight (the founder: "make a system which makes sure that this
-- product has/is showing correct weight and each product is showing it's weight … the priority order should be
-- Manually inserted at hub > updated from admin portal > the system you are going to produce (Update everything in
-- the current database's food … also when I run the scraper which adds food products update there also smartly").
-- The weight is worked out from the label's net quantity and the weight of its pack
-- (packages/shared/src/sourcing/estimate/food.ts) by tools/weight-estimator (`pnpm weights food`) and the sourcing
-- runner (each new listing, and every food listing not yet worked out at the end of each run); this migration keeps it:
--  - weight_source 'packed'; product_variants.net_qty, the net quantity customers see ("400 g", "2 × 200 g"): it is
--    printed on the pack (D-122), never the packed weight or where it came from (INV-1, D-003).
--  - worker_food_plan() and worker_set_food_weights() (worker account only). A packed weight replaces a shop's, a
--    matching item's or an estimate; never one weighed at the hub or typed by an admin.
--  - The order (D-133): the hub's scale, then an admin's weight, then the system. An admin's typed weight no longer
--    replaces one weighed at the hub (it is weighed again instead); weighing at the hub replaces the other flavours'
--    packed weights too. The runner's new food listings keep their packed weight and net quantity.
-- The D-128 formula is untouched.
-- =============================================================================

alter table public.product_variants drop constraint product_variants_weight_source_check;
alter table public.product_variants
  add constraint product_variants_weight_source_check
    check (weight_source in ('weighed', 'admin', 'shop', 'similar', 'estimated', 'class', 'packed')),
  add column net_qty text check (char_length(net_qty) <= 40);

comment on column public.product_variants.weight_source is
  'D-129, D-131 – D-133: where weight_g came from: weighed, admin (typed), shop (its own page), similar (a matching item), estimated (the weight estimator), class (clothing by the founder''s classes), packed (food: its net quantity plus its pack); null with a weight = recorded before D-129';
comment on column public.product_variants.net_qty is
  'D-133: a food option''s net quantity as its label states it ("400 g", "2 × 200 g"), shown to customers; null when unknown';

-- As the baseline, with net_qty (appended: a view keeps its columns' order).
create or replace view public.store_variants as
select v.id, v.product_id, v.label, v.options,
       coalesce(v.price_cents, p.price_cents) as price_cents,
       greatest(v.qty_listed - v.qty_reserved, 0) as available,
       v.sort_order,
       case when p.product_type = 'food' then v.net_qty end as net_qty
from public.product_variants v
join public.products p on p.id = v.product_id
where v.is_active and p.status = 'live' and (not p.is_placeholder or public.dev_preview());

-- A food piece's pack size for its card: its cheapest available option's pack, else its net quantity (D-133), else
-- the first weight in its name. Otherwise as 20261014160000_food_share_footwear_pack.
create or replace function public._store_pack(p_product uuid, p_name text, p_type public.product_type)
returns text
language sql stable set search_path = public, pg_temp as $$
  select case when p_type = 'food' then coalesce(
    (select sv.options ->> 'pack' from public.store_variants sv
      where sv.product_id = p_product and coalesce(sv.options ->> 'pack', '') <> ''
      order by (sv.available > 0) desc, sv.price_cents, sv.sort_order limit 1),
    (select sv.net_qty from public.store_variants sv
      where sv.product_id = p_product and coalesce(sv.net_qty, '') <> ''
      order by (sv.available > 0) desc, sv.price_cents, sv.sort_order limit 1),
    regexp_replace(substring(lower(p_name) from '([0-9]+(\.[0-9]+)? ?(kg|gms|gm|g|ml|l))([^a-z]|$)'),
                   '([0-9]) ?(kg|gms|gm|g|ml|l)$', '\1 \2'))
  end;
$$;

-- -----------------------------------------------------------------------------
-- The food listings to work out, 200 at most per call, in id order after p_after: those with an option whose weight
-- is not a person's and not yet worked out, or whose net quantity is not known (p_all: every food listing).
-- -----------------------------------------------------------------------------
create function public.worker_food_plan(p_after uuid default null, p_limit integer default 200,
                                        p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'category', c.slug,
             'description', left(coalesce(p.summary || E'\n', '') || coalesce(p.description, ''), 2000),
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source, 'weight_note', v.weight_note,
                                   'net_qty', v.net_qty)
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where p.product_type = 'food' and not p.is_placeholder and not p.is_us_stock
               and p.status <> 'archived'
               and (p_after is null or p.id > p_after)
               and (p_all or exists (select 1 from public.product_variants v
                                      where v.product_id = p.id
                                        and (v.net_qty is null
                                             or coalesce(v.weight_source, '') not in ('weighed', 'admin', 'packed'))))
             order by p.id
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_food_plan(uuid, integer, boolean) from public, anon;
grant execute on function public.worker_food_plan(uuid, integer, boolean) to authenticated;

-- p_weights: [{variant_id, weight_g, note, net_qty}], 500 at most, food only. The net quantity is always kept; the
-- weight (source packed, with its note) unless a person weighed or typed it, or weight_g is null. Returns how many
-- options changed.
create function public.worker_set_food_weights(p_weights jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  v public.product_variants;
  v_g integer;
  v_note text;
  v_net text;
  v_keep boolean;
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
    if v_g is not null and v_g not between 1 and 50000 then
      continue;
    end if;
    select pv.* into v from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = nullif(w ->> 'variant_id', '')::uuid and p.product_type = 'food';
    if not found then
      continue;
    end if;
    v_note := nullif(left(coalesce(w ->> 'note', ''), 200), '');
    v_net := nullif(left(coalesce(w ->> 'net_qty', ''), 40), '');
    v_keep := v_g is null or coalesce(v.weight_source, '') in ('weighed', 'admin');
    if (v_net is not null and v.net_qty is distinct from v_net)
       or (not v_keep and (v.weight_g is distinct from v_g or v.weight_source is distinct from 'packed'
                           or v.weight_note is distinct from v_note)) then
      update public.product_variants
         set net_qty = coalesce(v_net, net_qty),
             weight_g = case when v_keep then weight_g else v_g end,
             weight_source = case when v_keep then weight_source else 'packed' end,
             weight_note = case when v_keep then weight_note else v_note end
       where id = v.id;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.worker_set_food_weights(jsonb) from public, anon;
grant execute on function public.worker_set_food_weights(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- D-133: the hub's scale comes before an admin's typed weight: a typed weight does not replace one weighed at the hub
-- (weighing it again does). Otherwise as 20261015180000_weight_estimates.
-- -----------------------------------------------------------------------------
create or replace function public._variant_weight() returns trigger
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
    elsif old.weight_source = 'weighed' and new.weight_source = 'admin' and new.weight_g is distinct from old.weight_g then
      -- D-133: the hub's scale comes first; weighing it again replaces it, a typed weight does not
      raise exception 'weight_weighed: % was weighed at % g: weigh it again (tick "weighed on a scale") to change it (D-133)',
        old.label, old.weight_g using errcode = '23514';
    elsif new.weight_g is distinct from old.weight_g and new.weight_source is not distinct from old.weight_source
          and new.weight_note is not distinct from old.weight_note then
      -- a weight changed without saying where from: it is whoever changed it
      new.weight_source := null;
      new.weight_note := null;
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

-- -----------------------------------------------------------------------------
-- Weighing at the hub (D-130) also replaces the other flavours' packed weights (D-133). Otherwise as
-- 20261016090000_clothing_classes.
-- -----------------------------------------------------------------------------
create or replace function public.admin_weigh_pickup(p_pickup uuid, p_grams integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_pickup public.pickups;
  v_variant public.product_variants;
  v_product public.products;
  v_old_g integer;
  v_old_cents integer;
  v_new_cents integer;
  v_pct integer;
  v_note text;
  v_order text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_grams is null or p_grams not between 1 and 50000 then
    raise exception 'weight_invalid' using errcode = 'P0001';
  end if;
  select * into v_pickup from public.pickups where id = p_pickup for update;
  if not found or v_pickup.status <> 'picked' then
    raise exception 'pickup_not_picked' using errcode = 'P0001';
  end if;
  select * into v_variant from public.product_variants where id = v_pickup.variant_id for update;
  select * into v_product from public.products where id = v_variant.product_id;
  select o.order_number into v_order
    from public.order_items i join public.orders o on o.id = i.order_id where i.id = v_pickup.order_item_id;
  v_old_g := v_variant.weight_g;
  v_old_cents := coalesce(v_variant.price_cents, v_product.price_cents);

  update public.product_variants
     set weight_g = p_grams, weight_source = 'weighed',
         weight_note = left(format('Weighed at the hub, order %s', coalesce(v_order, '?')), 200)
   where id = v_variant.id;

  -- the same piece's other sizes and colours that still guess (none, a matching item's, an estimate, a class, or a
  -- packed weight of the same net quantity: another flavour, D-133); never a pack
  if not (v_variant.options ? 'pack') then
    update public.product_variants s
       set weight_g = p_grams, weight_source = 'similar',
           weight_note = left(format('Option %s weighed at the hub: %s g', v_variant.label, p_grams), 200)
     where s.product_id = v_variant.product_id and s.id <> v_variant.id and not (s.options ? 'pack')
       and (s.weight_g is null or s.weight_source in ('similar', 'estimated', 'class')
            or (s.weight_source = 'packed' and s.net_qty is not distinct from v_variant.net_qty));
  end if;

  -- the reprice triggers (D-128) have run; read the price the next customer pays
  select coalesce(v.price_cents, p.price_cents) into v_new_cents
    from public.product_variants v join public.products p on p.id = v.product_id where v.id = v_variant.id;
  v_pct := case when v_old_g > 0 then round((p_grams - v_old_g) * 100.0 / v_old_g)::integer end;
  v_note := format('Weighed %s g', p_grams)
            || case when v_old_g is null then ' (it had no weight)'
                    when v_pct = 0 then format(' (listed %s g)', v_old_g)
                    else format(' (listed %s g, %s%s%%)', v_old_g, case when v_pct > 0 then '+' else '' end, v_pct) end
            || case when not v_product.price_auto then ': the price is set by hand, unchanged'
                    when v_new_cents is distinct from v_old_cents
                      then format(': price now %s, was %s', public._usd(v_new_cents), public._usd(v_old_cents))
                    else format(': price %s, unchanged', public._usd(v_new_cents)) end;

  update public.pickups set weighed_g = p_grams, weigh_note = left(v_note, 300) where id = p_pickup;
  return jsonb_build_object('weighed_g', p_grams, 'listed_g', v_old_g, 'change_pct', v_pct,
                            'old_cents', v_old_cents, 'new_cents', v_new_cents, 'note', v_note,
                            'big_change', coalesce(abs(v_pct) > 10, true));
end $$;

-- -----------------------------------------------------------------------------
-- The runner's new food listings keep their packed weight and net quantity (D-133). Otherwise as 20261015160000_weights.
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
                      or (v_item ->> 'weight_source' = 'packed' and t.product_type = 'food')
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
