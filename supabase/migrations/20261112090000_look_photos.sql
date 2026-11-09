-- =============================================================================
-- D-194, docs/plan-look-photos.md Phase 3: `pnpm sourcing looks` gives each look of a live listing its own photo.
-- Worker functions only. Nothing a customer reads changes, and no store function or view is touched.
--  - worker_look_photo_plan: live listings of a type with 2+ looks and a look without a photo, 25 at most per call.
--  - worker_look_photos_add: a look's new photos, after the listing's others, never the main photo.
--  - worker_look_photo_tag: an untagged photo becomes the look's (null takes the tag off again).
--  - worker_look_photos_undo: removes photos this command added and answers their paths for the store.
-- A look is a variant's options without `size` (packages/shared looks.ts).
-- Size: about 250 B per photo row, 2 MB at the plan's 7,000 photos. Egress: plan rows only. Page cache: none (no
-- refresh; pages pick the rows up on their own refresh). Tests: look_photos.test.sql.
-- =============================================================================

create function public.worker_look_photo_plan(p_type public.product_type, p_after uuid default null, p_limit integer default 25)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return jsonb_build_object('listings', coalesce((
    select jsonb_agg(to_jsonb(r) order by r.id)
    from (
      select p.id, p.name, p.source_url, p.source_site,
             coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'storage_path', m.storage_path,
                                                           'variant_id', m.variant_id, 'is_primary', m.is_primary)
                                        order by m.is_primary desc, m.sort_order)
                         from public.product_media m where m.product_id = p.id), '[]'::jsonb) as photos,
             coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label, 'options', v.options,
                                                           'item_key', s.item_key, 'item_url', s.item_url, 'site', s.site)
                                        order by v.sort_order, v.label)
                         from public.product_variants v
                         left join lateral (select ps.item_key, ps.item_url, ps.site from public.product_sources ps
                                             where ps.variant_id = v.id order by ps.created_at limit 1) s on true
                        where v.product_id = p.id and v.is_active), '[]'::jsonb) as variants
        from public.products p
       where p.product_type = p_type and p.status = 'live' and not p.is_placeholder
         and p.source_url is not null
         and (p_after is null or p.id > p_after)
         and exists (
           select 1
             from (select v.options - 'size' as look,
                          bool_or(exists (select 1 from public.product_media m where m.variant_id = v.id)) as has_photo
                     from public.product_variants v
                    where v.product_id = p.id and v.is_active group by 1) l
           having count(*) > 1 and bool_or(not l.has_photo))
       order by p.id
       limit least(greatest(coalesce(p_limit, 25), 1), 25)
    ) r), '[]'::jsonb));
end $$;

create function public.worker_look_photos_add(p_product uuid, p_media jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_type public.product_type;
  v_next integer;
  v_item jsonb;
  v_variant uuid;
  v_look jsonb;
  v_id uuid;
  v_ids jsonb := '[]'::jsonb;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select p.product_type into v_type from public.products p where p.id = p_product and not p.is_placeholder;
  if v_type is null then
    raise exception 'product_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_media) is distinct from 'array' or jsonb_array_length(p_media) not between 1 and 12
     or exists (select 1 from jsonb_array_elements(p_media) m
                 where coalesce(m ->> 'path', '') !~ ('^products/' || p_product::text || '/s/[^/]+$')
                    or (m ->> 'redo' is not null
                        and not (m ->> 'redo' = 'fresh' or (m ->> 'redo' = 'face' and v_type = 'clothing')))) then
    raise exception 'media_invalid' using errcode = 'P0001';
  end if;
  -- one listing's rows only: two runs on a listing wait for each other here
  perform 1 from public.products where id = p_product for update;
  select coalesce(max(sort_order), -1) + 1 into v_next from public.product_media where product_id = p_product;
  for v_item in select * from jsonb_array_elements(p_media) loop
    v_variant := (v_item ->> 'variant_id')::uuid;
    select v.options - 'size' into v_look from public.product_variants v
     where v.id = v_variant and v.product_id = p_product and v.is_active;
    if v_look is null then
      raise exception 'variant_not_on_listing' using errcode = 'P0001';
    end if;
    if (select count(*) from public.product_media m join public.product_variants v on v.id = m.variant_id
         where m.product_id = p_product and v.options - 'size' = v_look) >= 2 then
      raise exception 'look_has_enough_photos' using errcode = 'P0001';
    end if;
    if (select count(*) from public.product_media m where m.product_id = p_product) >= 24 then
      raise exception 'listing_has_enough_photos' using errcode = 'P0001';
    end if;
    insert into public.product_media (product_id, variant_id, storage_path, alt_text, sort_order, is_primary, redo)
    values (p_product, v_variant, v_item ->> 'path', left(coalesce(v_item ->> 'alt_text', ''), 200), v_next, false, v_item ->> 'redo')
    returning id into v_id;
    v_ids := v_ids || to_jsonb(v_id);
    v_next := v_next + 1;
  end loop;
  return v_ids;
end $$;

create function public.worker_look_photo_tag(p_product uuid, p_media uuid, p_variant uuid)
returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_variant is null then
    update public.product_media set variant_id = null
     where id = p_media and product_id = p_product and variant_id is not null;
    return found;
  end if;
  if not exists (select 1 from public.product_variants v
                  where v.id = p_variant and v.product_id = p_product and v.is_active) then
    raise exception 'variant_not_on_listing' using errcode = 'P0001';
  end if;
  update public.product_media set variant_id = p_variant
   where id = p_media and product_id = p_product and variant_id is null;
  return found;
end $$;

create function public.worker_look_photos_undo(p_media uuid[])
returns text[]
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_paths text[];
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_media), 0) > 500 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  with gone as (
    delete from public.product_media m
     where m.id = any (p_media) and m.variant_id is not null and not m.is_primary
       -- the main photo stays, so a listing always keeps a photo
       and exists (select 1 from public.product_media o where o.product_id = m.product_id and o.is_primary)
    returning m.storage_path)
  select coalesce(array_agg(storage_path), '{}') into v_paths from gone;
  return v_paths;
end $$;

revoke all on function public.worker_look_photo_plan(public.product_type, uuid, integer) from public, anon;
revoke all on function public.worker_look_photos_add(uuid, jsonb) from public, anon;
revoke all on function public.worker_look_photo_tag(uuid, uuid, uuid) from public, anon;
revoke all on function public.worker_look_photos_undo(uuid[]) from public, anon;
grant execute on function public.worker_look_photo_plan(public.product_type, uuid, integer) to authenticated;
grant execute on function public.worker_look_photos_add(uuid, jsonb) to authenticated;
grant execute on function public.worker_look_photo_tag(uuid, uuid, uuid) to authenticated;
grant execute on function public.worker_look_photos_undo(uuid[]) to authenticated;

notify pgrst, 'reload schema';
