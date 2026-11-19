-- D-202 (founder, 2026-11-19): food weights come from where they are written, not from similar names.
--  1. The runner's page re-read moves through the whole backlog: each listing it tries is marked (weight_tried_at)
--     and goes to the back of the queue, so the same 40 failures are no longer read again on every run.
--  2. Matching items on other shops that agree may replace an estimate (they only filled empty weights before).
--  3. Customers see only a weight someone read or weighed (the label, the shop's page, the hub, an admin): no more
--     "About 140 g" from an estimate. Prices still use every weight (D-128); a corrected weight reprices at once
--     through the existing triggers.
--  4. Two reads for the founder's laptop: the label reader's plan (photos of food whose weight nobody read) and the
--     food price list for the price check (an estimate far from what similar labelled items cost a kilo).
-- Cost: two timestamps on products (a few hundred KB), no page-cache writes beyond the reprices the weights cause.

alter table public.products add column weight_tried_at timestamptz;
alter table public.products add column label_tried_at timestamptz;
comment on column public.products.weight_tried_at is
  'D-202: when the sourcing runner last re-read this listing''s shop pages for a weight (the queue goes oldest-tried first).';
comment on column public.products.label_tried_at is
  'D-202: when the label reader (tools/weight-estimator, pnpm weights labels) last read this listing''s photos.';

-- ---------------------------------------------------------------- 1. the re-read queue

drop function public.worker_weight_plan(integer);
create function public.worker_weight_plan(p_limit integer default 40, p_types public.product_type[] default null)
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
           order by p.missing desc, p.weight_tried_at nulls first, (p.status = 'live') desc, p.created_at)
      from (select p.*, exists (select 1 from public.product_variants v
                                 where v.product_id = p.id and v.weight_g is null) as missing
              from public.products p
             where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and (p_types is null or p.product_type = any (p_types))
               and exists (select 1 from public.product_variants v
                            where v.product_id = p.id
                              and (v.weight_g is null or v.weight_source in ('similar', 'estimated')
                                   or v.weight_note = public._weight_held_note()))
             -- D-202: never tried first, then the longest ago, so every listing gets its turn
             order by missing desc, p.weight_tried_at nulls first, (p.status = 'live') desc, p.created_at
             limit least(greatest(p_limit, 0), 200)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_weight_plan(integer, public.product_type[]) from public, anon;
grant execute on function public.worker_weight_plan(integer, public.product_type[]) to authenticated;

-- p_what: 'page' (the runner read its shop pages) or 'label' (the label reader read its photos). Returns how many.
create function public.worker_weights_tried(p_products uuid[], p_what text)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_what not in ('page', 'label') or cardinality(p_products) > 500 then
    raise exception 'tried_invalid' using errcode = 'P0001';
  end if;
  if p_what = 'page' then
    update public.products set weight_tried_at = now() where id = any (p_products);
  else
    update public.products set label_tried_at = now() where id = any (p_products);
  end if;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.worker_weights_tried(uuid[], text) from public, anon;
grant execute on function public.worker_weights_tried(uuid[], text) to authenticated;

-- ---------------------------------------------------------------- 2. matching items over an estimate

-- As 20261015180000_weight_estimates, except that matching items that agree (source 'similar') also replace an
-- estimate (D-202): several shops' pages are a better witness than a guess from similar names.
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
       and (v.weight_g is null
            or (v.weight_source in ('similar', 'estimated') and w ->> 'source' = 'shop')
            or (v.weight_source = 'estimated' and w ->> 'source' = 'similar'));
    if found then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ---------------------------------------------------------------- 3. customers see only a weight someone read

-- As 20261111090100_subcategories_popular_packs, except that an estimate is no longer shown as "About …" (D-202):
-- only a weight read from the label or the shop's page, weighed at the hub or typed by an admin. The pack's words,
-- the net quantity and the name are still read first (_store_pack). Never the billed weight (D-003).
create or replace function public._pack_by_weight(p_product uuid, p_type public.product_type) returns text
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when known then shown end
  from (select v.weight_source in ('shop', 'admin', 'weighed', 'packed') and v.weight_source is not null as known,
               case when v.weight_g >= 1000 then trim_scale(round(v.weight_g / 1000.0, 2))::text || ' kg'
                    else v.weight_g::text || ' g' end as shown
        from public.product_variants v
        where v.product_id = p_product and v.is_active and v.weight_g > 0
        order by (v.qty_listed - v.qty_reserved > 0) desc, v.price_cents, v.sort_order
        limit 1) x;
$$;

-- ---------------------------------------------------------------- 4. the laptop's reads

-- The label reader's plan: food listings with an active option whose weight nobody read (none, an estimate, a
-- matching item's), with their photos (the main one first), 100 at most per call in id order after p_after.
--   new    not read by the label reader yet (the default)
--   all    every such listing, read or not (after the reader changes)
--   known  listings whose every active option has its label's net quantity from its own words: the reader is
--          measured on these (`pnpm weights labels --eval`) before it writes anything
create function public.worker_label_plan(p_after uuid default null, p_limit integer default 50,
                                         p_mode text default 'new')
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_mode not in ('new', 'all', 'known') then
    raise exception 'mode_invalid' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'category', c.slug, 'shop_price_paise', p.shop_price_paise,
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source, 'net_qty', v.net_qty, 'is_active', v.is_active,
                                   'shop_price_paise', coalesce(v.shop_price_paise, p.shop_price_paise))
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id),
             'photos', coalesce((select jsonb_agg(jsonb_build_object('path', m.storage_path, 'variant_id', m.variant_id)
                                                  order by m.is_primary desc, m.sort_order, m.created_at)
                                   from public.product_media m where m.product_id = p.id), '[]'::jsonb))
           order by p.id)
      from (select p.* from public.products p
             where p.product_type = 'food' and not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and (p_after is null or p.id > p_after)
               and exists (select 1 from public.product_media m where m.product_id = p.id)
               and case p_mode
                     when 'known' then
                       exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
                       and not exists (select 1 from public.product_variants v
                                        where v.product_id = p.id and v.is_active
                                          and (v.weight_source is distinct from 'packed' or v.net_qty is null
                                               or coalesce(v.weight_note, '') like 'Label photo%'))
                     else (p_mode = 'all' or p.label_tried_at is null)
                       and exists (select 1 from public.product_variants v
                                    where v.product_id = p.id and v.is_active
                                      and (v.weight_g is null or v.weight_source is null
                                           or v.weight_source in ('estimated', 'similar')))
                   end
             order by p.id
             limit least(greatest(p_limit, 0), 100)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_label_plan(uuid, integer, text) from public, anon;
grant execute on function public.worker_label_plan(uuid, integer, text) to authenticated;

-- Every food option with its shop price, 500 listings at most per call in id order after p_after: the price check
-- (`pnpm weights prices`) learns what labelled items cost a kilo and finds estimates far from it.
create function public.worker_food_prices(p_after uuid default null, p_limit integer default 500)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'category', c.slug,
             'variants', (select jsonb_agg(jsonb_build_object(
                                   'id', v.id, 'label', v.label, 'weight_g', v.weight_g,
                                   'weight_source', v.weight_source, 'net_qty', v.net_qty, 'is_active', v.is_active,
                                   'shop_price_paise', coalesce(v.shop_price_paise, p.shop_price_paise))
                                 order by v.sort_order, v.label)
                            from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where p.product_type = 'food' and not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
               and (p_after is null or p.id > p_after)
             order by p.id
             limit least(greatest(p_limit, 0), 500)) p
      join public.categories c on c.id = p.category_id), '[]'::jsonb);
end $$;
revoke all on function public.worker_food_prices(uuid, integer) from public, anon;
grant execute on function public.worker_food_prices(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
