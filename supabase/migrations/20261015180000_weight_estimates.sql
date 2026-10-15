-- =============================================================================
-- D-131: the weight estimator on the founder's laptop (the founder: "a very smart system on my laptop which goes
-- through each product and assigns them a very realistic weight … it should take little time per product").
-- tools/weight-estimator reads every listing, asks a local model on the laptop's GPU for the packed weight of one
-- unit (in parts: kurta + pyjama + packing), checks it against the weights of the most similar items IWC already
-- knows (weighed at the hub first), and writes it back through the worker account:
--  - product_variants.weight_estimate_g / weight_estimate_note: its latest estimate for every option it looked at.
--  - A sure estimate (a narrow range, agreeing with similar known items) becomes the option's weight, source
--    'estimated', so the listing can be priced and go live; an unsure one stays a suggestion in Weights to check.
--  - It never changes a weight a person weighed or typed, or one a shop's page stated: for those it only keeps its
--    estimate, and Weights to check lists a shop's weight it disagrees with by more than a third.
--  - A shop's own page replaces an estimate (the runner, D-129); the hub's scale replaces it (D-130).
-- Also: a weight rewritten with the same source and a new note keeps its source (a re-estimate stayed 'estimated',
-- a second weighing at the hub left the other sizes 'similar'; before, both turned into the changer's).
-- =============================================================================

alter table public.product_variants drop constraint product_variants_weight_source_check;
alter table public.product_variants
  add constraint product_variants_weight_source_check
    check (weight_source in ('weighed', 'admin', 'shop', 'similar', 'estimated')),
  add column weight_estimate_g integer check (weight_estimate_g between 1 and 50000),
  add column weight_estimate_note text check (char_length(weight_estimate_note) <= 300),
  add column weight_estimated_at timestamptz;

comment on column public.product_variants.weight_source is
  'D-129, D-131: where weight_g came from: weighed, admin (typed), shop (its own page), similar (a matching item), estimated (the weight estimator); null with a weight = recorded before D-129';
comment on column public.product_variants.weight_estimate_g is
  'D-131: the weight estimator''s latest packed weight for one unit (kept after weighing, to measure the estimator)';

-- -----------------------------------------------------------------------------
-- As 20261015160000_weights, except that a weight changed with the same source but a new note keeps its source.
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
-- Weights to check also lists a shop's weight the estimator disagrees with by more than a third (a saffron box the
-- page calls 1 g). Otherwise as 20261015160000_weights.
-- -----------------------------------------------------------------------------
create or replace function public._weight_needs_check(v public.product_variants, p_type public.product_type, p_category_g integer)
returns boolean language sql immutable as $$
  select v.is_active and (
    v.weight_g is null
    or v.weight_source is null or v.weight_source = 'similar'
    or (p_type <> 'food' and p_category_g is not null
        and v.weight_source <> 'weighed' and v.weight_source <> 'admin'
        and (v.weight_g * 4 < p_category_g or v.weight_g > p_category_g * 4))
    or (v.weight_source = 'shop' and v.weight_estimate_g is not null
        and abs(v.weight_estimate_g - v.weight_g) * 3 > v.weight_g))
$$;

-- As 20261015160000_weights, with each option's estimate.
create or replace function public.admin_weights_to_check(p_offset integer default 0, p_limit integer default 50)
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
                                       'weight_note', v.weight_note, 'shop_price_paise', v.shop_price_paise,
                                       'weight_estimate_g', v.weight_estimate_g,
                                       'weight_estimate_note', v.weight_estimate_note)
                                     order by v.sort_order, v.label)
                                from public.product_variants v where v.product_id = d.id))
               order by (d.status = 'live') desc, d.missing desc, d.updated_at desc, d.id)
          from (select * from due
                 order by (status = 'live') desc, missing desc, updated_at desc, id
                 offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 200)) d), '[]'::jsonb)));
end $$;

-- -----------------------------------------------------------------------------
-- The runner (D-129) also reads the own pages of listings priced on an estimate (a shop's statement replaces it),
-- the missing ones first. Otherwise as 20261015160000_weights.
-- -----------------------------------------------------------------------------
create or replace function public.worker_weight_plan(p_limit integer default 40)
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
           order by p.missing desc, (p.status = 'live') desc, p.created_at)
      from (select p.*, exists (select 1 from public.product_variants v
                                 where v.product_id = p.id and v.weight_g is null) as missing
              from public.products p
             where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id
                              and (v.weight_g is null or v.weight_source in ('similar', 'estimated')
                                   or v.weight_note = public._weight_held_note()))
             order by missing desc, (p.status = 'live') desc, p.created_at
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;

-- As 20261015160000_weights, except that a shop's own weight also replaces an estimate.
create or replace function public.worker_set_weights(p_weights jsonb)
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
       and (v.weight_g is null or (v.weight_source in ('similar', 'estimated') and w ->> 'source' = 'shop'));
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- -----------------------------------------------------------------------------
-- The estimator's three functions (worker account only).
-- -----------------------------------------------------------------------------

-- The listings to estimate, 200 at most per call, in id order after p_after. p_mode:
--   missing  options with no weight never estimated (the default)
--   redo     options with no weight or an estimated one (after many weighings: better references)
--   audit    also options with a shop's or a matching item's weight (only kept as an estimate, never changed)
-- Every option of the listing is returned; `wanted` marks the ones to estimate.
create function public.worker_estimate_plan(p_after uuid default null, p_limit integer default 100,
                                            p_mode text default 'missing')
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_mode not in ('missing', 'redo', 'audit') then
    raise exception 'mode_invalid' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'product_type', p.product_type, 'category', c.name,
             'category_weight_g', c.default_weight_g, 'summary', p.summary,
             'description', left(coalesce(p.description, ''), 400), 'attributes', p.attributes,
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source, 'weight_note', v.weight_note,
                                   'wanted', public._estimate_wanted(v, p_mode))
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and (p_after is null or p.id > p_after)
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id and public._estimate_wanted(v, p_mode))
             order by p.id
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;

create function public._estimate_wanted(v public.product_variants, p_mode text)
returns boolean language sql immutable as $$
  select (v.is_active or v.weight_note = public._weight_held_note())
     and coalesce(v.weight_source, '') not in ('weighed', 'admin')
     and case p_mode
           when 'missing' then v.weight_g is null and v.weight_estimate_g is null
           when 'redo' then v.weight_g is null or v.weight_source = 'estimated'
           else true
         end
$$;
revoke all on function public._estimate_wanted(public.product_variants, text) from public, anon, authenticated;
revoke all on function public.worker_estimate_plan(uuid, integer, text) from public, anon;
grant execute on function public.worker_estimate_plan(uuid, integer, text) to authenticated;

-- The weights IWC knows (weighed, typed, a shop's page), 1,000 at most per call in id order after p_after: the
-- estimator's references, and with weight_estimate_g its record against the scale.
create function public.worker_weight_references(p_after uuid default null, p_limit integer default 1000)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'variant_id', v.id, 'product_id', p.id, 'name', p.name, 'product_type', p.product_type,
             'category', c.name, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
             'weight_source', v.weight_source, 'weight_estimate_g', v.weight_estimate_g)
           order by v.id)
      from (select * from public.product_variants v
             where v.weight_g is not null and v.weight_source in ('weighed', 'admin', 'shop')
               and (p_after is null or v.id > p_after)
             order by v.id
             limit least(greatest(p_limit, 0), 1000)) v
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
     where not p.is_placeholder and not p.is_us_stock), '[]'::jsonb);
end $$;
revoke all on function public.worker_weight_references(uuid, integer) from public, anon;
grant execute on function public.worker_weight_references(uuid, integer) to authenticated;

-- p_estimates: [{variant_id, weight_g, sure, note}], 500 at most. Every estimate is kept on its option (never on one
-- a person weighed or typed); a sure one also becomes the weight of an option that has none or only an estimate.
-- Returns {estimates, weights}: how many were kept, and how many became weights.
create function public.worker_set_estimates(p_estimates jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  e jsonb;
  v_g integer;
  v_id uuid;
  v_note text;
  v_kept integer := 0;
  v_weights integer := 0;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_estimates) is distinct from 'array' or jsonb_array_length(p_estimates) > 500 then
    raise exception 'estimates_invalid' using errcode = 'P0001';
  end if;
  for e in select * from jsonb_array_elements(p_estimates) loop
    v_g := case when jsonb_typeof(e -> 'weight_g') = 'number' then (e ->> 'weight_g')::numeric::integer end;
    v_id := nullif(e ->> 'variant_id', '')::uuid;
    v_note := nullif(left(coalesce(e ->> 'note', ''), 300), '');
    if v_g is null or v_g not between 1 and 50000 then
      continue;
    end if;
    update public.product_variants v
       set weight_estimate_g = v_g, weight_estimate_note = v_note, weight_estimated_at = now()
     where v.id = v_id and coalesce(v.weight_source, '') not in ('weighed', 'admin');
    if not found then
      continue;
    end if;
    v_kept := v_kept + 1;
    if (e ->> 'sure')::boolean is true then
      update public.product_variants v
         set weight_g = v_g, weight_source = 'estimated', weight_note = left(coalesce(v_note, 'Estimated'), 200)
       where v.id = v_id and (v.weight_g is null or v.weight_source = 'estimated');
      if found then
        v_weights := v_weights + 1;
      end if;
    end if;
  end loop;
  return jsonb_build_object('estimates', v_kept, 'weights', v_weights);
end $$;
revoke all on function public.worker_set_estimates(jsonb) from public, anon;
grant execute on function public.worker_set_estimates(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Weighing at the hub (D-130) also replaces the other sizes' estimates, and its note names the grams (so a second
-- weighing keeps them 'similar'). Otherwise as 20261015170000_weigh_at_hub.
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

  -- the same piece's other sizes and colours that still guess (none, a matching item's, an estimate); never a pack
  if not (v_variant.options ? 'pack') then
    update public.product_variants s
       set weight_g = p_grams, weight_source = 'similar',
           weight_note = left(format('Option %s weighed at the hub: %s g', v_variant.label, p_grams), 200)
     where s.product_id = v_variant.product_id and s.id <> v_variant.id and not (s.options ? 'pack')
       and (s.weight_g is null or s.weight_source in ('similar', 'estimated'));
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
