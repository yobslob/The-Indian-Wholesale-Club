-- =============================================================================
-- D-132: clothing is weighed by class, the founder's four weights (the founder: "classify category light350g(...),
-- medium750g(...) pants, jeans, footwear can be taken as 800gm and heavy1.5kg(...) let's globalize this for all
-- clothing and assign everything this weight accordingly"). The class is read from each listing's name and category
-- (packages/shared/src/sourcing/estimate/classes.ts) by tools/weight-estimator (`pnpm weights classes`) and, for new
-- listings, by the sourcing runner; this migration stores it:
--  - weight_source 'class'; worker_clothing_plan() and worker_set_class_weights() (worker account only).
--  - A class weight replaces a shop's, a matching item's or an estimate; never one weighed at the hub or typed by an
--    admin. The runner's shop pages and the estimator leave it alone; the hub's scale replaces it (D-130).
--  - The estimator (D-131) weighs food and home & gifts only; Weights to check does not call a class weight unusual.
-- =============================================================================

alter table public.product_variants drop constraint product_variants_weight_source_check;
alter table public.product_variants
  add constraint product_variants_weight_source_check
    check (weight_source in ('weighed', 'admin', 'shop', 'similar', 'estimated', 'class'));

comment on column public.product_variants.weight_source is
  'D-129, D-131, D-132: where weight_g came from: weighed, admin (typed), shop (its own page), similar (a matching item), estimated (the weight estimator), class (clothing by the founder''s classes); null with a weight = recorded before D-129';

-- As 20261015180000_weight_estimates, except that a class weight is the founder's rule, never "unusual".
create or replace function public._weight_needs_check(v public.product_variants, p_type public.product_type, p_category_g integer)
returns boolean language sql immutable as $$
  select v.is_active and (
    v.weight_g is null
    or v.weight_source is null or v.weight_source = 'similar'
    or (p_type <> 'food' and p_category_g is not null
        and v.weight_source not in ('weighed', 'admin', 'class')
        and (v.weight_g * 4 < p_category_g or v.weight_g > p_category_g * 4))
    or (v.weight_source = 'shop' and v.weight_estimate_g is not null
        and abs(v.weight_estimate_g - v.weight_g) * 3 > v.weight_g))
$$;

-- As 20261015180000_weight_estimates, without clothing (D-132: it is weighed by class).
create or replace function public.worker_estimate_plan(p_after uuid default null, p_limit integer default 100,
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
               and p.product_type <> 'clothing'
               and (p_after is null or p.id > p_after)
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id and public._estimate_wanted(v, p_mode))
             order by p.id
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;

-- -----------------------------------------------------------------------------
-- The clothing listings to sort, 200 at most per call, in id order after p_after: those with an option whose weight
-- is missing or not a person's or a class's (p_all: also a class's, to sort again after the rules change).
-- -----------------------------------------------------------------------------
create function public.worker_clothing_plan(p_after uuid default null, p_limit integer default 200,
                                            p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'category_slug', c.slug, 'category', c.name,
             'summary', p.summary, 'attributes', p.attributes,
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source)
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where p.product_type = 'clothing' and not p.is_placeholder and not p.is_us_stock
               and p.status <> 'archived'
               and (p_after is null or p.id > p_after)
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id
                              and coalesce(v.weight_source, '') not in ('weighed', 'admin')
                              and (p_all or coalesce(v.weight_source, '') <> 'class'))
             order by p.id
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_clothing_plan(uuid, integer, boolean) from public, anon;
grant execute on function public.worker_clothing_plan(uuid, integer, boolean) to authenticated;

-- p_weights: [{variant_id, weight_g, note}], 500 at most: a clothing option takes its class's weight, unless a person
-- weighed or typed it. Returns how many options changed.
create function public.worker_set_class_weights(p_weights jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  v_g integer;
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
    if v_g is null or v_g not between 1 and 50000 then
      continue;
    end if;
    update public.product_variants v
       set weight_g = v_g, weight_source = 'class',
           weight_note = nullif(left(coalesce(w ->> 'note', ''), 200), '')
      from public.products p
     where v.id = nullif(w ->> 'variant_id', '')::uuid and p.id = v.product_id and p.product_type = 'clothing'
       and coalesce(v.weight_source, '') not in ('weighed', 'admin')
       and (v.weight_g is distinct from v_g or v.weight_source is distinct from 'class'
            or v.weight_note is distinct from nullif(left(coalesce(w ->> 'note', ''), 200), ''));
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.worker_set_class_weights(jsonb) from public, anon;
grant execute on function public.worker_set_class_weights(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Weighing at the hub (D-130) also replaces the other sizes' class weights. Otherwise as 20261015180000.
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

  -- the same piece's other sizes and colours that still guess (none, a matching item's, an estimate, a class); never a pack
  if not (v_variant.options ? 'pack') then
    update public.product_variants s
       set weight_g = p_grams, weight_source = 'similar',
           weight_note = left(format('Option %s weighed at the hub: %s g', v_variant.label, p_grams), 200)
     where s.product_id = v_variant.product_id and s.id <> v_variant.id and not (s.options ? 'pack')
       and (s.weight_g is null or s.weight_source in ('similar', 'estimated', 'class'));
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
