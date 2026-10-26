-- =============================================================================
-- D-163 (founder 2026-10-27): every listing's photos are made again on the founder's laptop GPU
-- (tools/photo-redo + tools/photo-worker/redo.py): clothing gets a house model's face and skin (the garment's pixels
-- untouched), food's main photo a tempting scene around the untouched pack, home & gifts a new main photo in a room
-- (a wall, a shelf, a table) with the plain photo kept second.
--  - product_media.redo: what was done to a photo (face, food, scene) or `kept` (looked at, nothing to change: a
--    clothing photo with no person in it, the plain photo behind a home scene). Null: not done yet.
--  - worker_photo_redo_plan(type, after, limit): the listings with photos still to do, by id after `after` (the
--    tool pages through them), and the active house models. Stored photos only (their copies are in the photo store).
--  - worker_photo_redo_set(media, old_path, new_path, redo): a photo's new path (face, food) or `kept`; only while the
--    row still has `old_path` and no redo, so a photo changed meanwhile (an admin, the runner) is left alone.
--  - worker_photo_redo_scene(media, old_path, new_path, alt): home: the scene becomes the main photo, the plain one
--    second.
--  - worker_photo_stems_in_use(stems): which stored photos (paths without their extension) a listing still shows: the
--    tool deletes a replaced photo's copies, and `pnpm photos:redo audit` the store's files, only when none does.
-- Size: one short text per photo (null until done). Egress: a page of plan rows per call. Page cache: none (store
-- pages pick up a new path within their 5-minute fallback). Tests: photo_redo.test.sql.
-- =============================================================================

alter table public.product_media add column redo text check (redo in ('face', 'food', 'scene', 'kept'));

/** A listing's main photo: the primary one, else the first. */
create function public._main_photo(p_product uuid) returns uuid
language sql stable set search_path = public, pg_temp as $$
  select m.id from public.product_media m where m.product_id = p_product
   order by m.is_primary desc, m.sort_order, m.created_at limit 1;
$$;

/** Whether a photo is one the redo does for its listing's type: every clothing photo (not the vendor AI ones, made on a
    house model already), food's and home's main photo. Stored photos only. */
create function public._redo_wanted(p_media public.product_media, p_type public.product_type) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select p_media.redo is null
     and p_media.storage_path ~ '/s/[^/]+\.(jpe?g|png|webp|avif)$'
     and case p_type when 'clothing' then not p_media.is_ai
                     else p_media.id = public._main_photo(p_media.product_id) end;
$$;

create function public.worker_photo_redo_plan(p_type public.product_type, p_after uuid default null,
                                              p_limit integer default 50)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'house_models', coalesce((select jsonb_agg(jsonb_build_object('slug', h.slug, 'wears', h.wears)
                                               order by h.sort_order, h.slug)
                                from public.house_models h where h.is_active), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', p.id, 'name', p.name, 'category', c.slug, 'wears', p.wears,
               'photos', (select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'alt', m.alt_text,
                                                              'main', m.id = public._main_photo(p.id))
                                           order by m.is_primary desc, m.sort_order, m.created_at)
                            from public.product_media m
                           where m.product_id = p.id and public._redo_wanted(m, p.product_type)))
             order by p.id)
        from (select p.* from public.products p
               where p.product_type = p_type and not p.is_placeholder and p.status <> 'archived'
                 and p.id > coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid)
                 -- kids are never shown on a house model (D-102): their photos wait
                 and (p_type <> 'clothing' or coalesce(p.wears, '') <> 'kids')
                 and exists (select 1 from public.product_media m
                              where m.product_id = p.id and public._redo_wanted(m, p.product_type))
               order by p.id
               limit least(greatest(p_limit, 1), 200)) p
        join public.categories c on c.id = p.category_id), '[]'::jsonb));
end $$;

create function public.worker_photo_redo_set(p_media uuid, p_old_path text, p_new_path text, p_redo text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_product uuid;
  v_type public.product_type;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select m.product_id, p.product_type into v_product, v_type
    from public.product_media m join public.products p on p.id = m.product_id where m.id = p_media;
  if v_product is null then
    return false;
  end if;
  if p_redo = 'kept' then
    if p_new_path is not null then
      raise exception 'kept_has_no_path' using errcode = '22023';
    end if;
  elsif not ((p_redo = 'face' and v_type = 'clothing') or (p_redo = 'food' and v_type = 'food')) then
    raise exception 'redo_not_for_type' using errcode = '22023';
  elsif p_new_path is null or p_new_path !~ ('^products/' || v_product || '/s/[^/]+\.(jpg|png|webp)$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.product_media
     set storage_path = coalesce(p_new_path, storage_path), redo = p_redo
   where id = p_media and storage_path = p_old_path and redo is null;
  return found;
end $$;

create function public.worker_photo_redo_scene(p_media uuid, p_old_path text, p_new_path text, p_alt text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_product uuid;
  v_first integer;
  v_id uuid;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select m.product_id into v_product
    from public.product_media m join public.products p on p.id = m.product_id
   where m.id = p_media and m.storage_path = p_old_path and m.redo is null and p.product_type = 'home'
     and m.id = public._main_photo(m.product_id);
  if v_product is null then
    return null;
  end if;
  if p_new_path is null or p_new_path !~ ('^products/' || v_product || '/s/[^/]+\.(jpg|png|webp)$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  select min(sort_order) into v_first from public.product_media where product_id = v_product;
  update public.product_media set is_primary = false, redo = 'kept' where id = p_media;
  update public.product_media set sort_order = sort_order + 1 where product_id = v_product;
  insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary, redo)
  values (v_product, p_new_path, left(coalesce(p_alt, ''), 200), v_first, true, 'scene')
  returning id into v_id;
  return v_id;
end $$;

create function public.worker_photo_stems_in_use(p_stems text[])
returns text[]
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if cardinality(p_stems) > 1000 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  return coalesce((select array_agg(distinct s.stem)
                     from public.product_media m
                     cross join lateral (select regexp_replace(m.storage_path, '\.[A-Za-z0-9]+$', '') as stem) s
                    where s.stem = any(p_stems)), '{}');
end $$;

revoke all on function public._main_photo(uuid), public._redo_wanted(public.product_media, public.product_type)
  from public, anon, authenticated;
revoke all on function public.worker_photo_redo_plan(public.product_type, uuid, integer),
  public.worker_photo_redo_set(uuid, text, text, text), public.worker_photo_redo_scene(uuid, text, text, text),
  public.worker_photo_stems_in_use(text[]) from public, anon;
grant execute on function public.worker_photo_redo_plan(public.product_type, uuid, integer),
  public.worker_photo_redo_set(uuid, text, text, text), public.worker_photo_redo_scene(uuid, text, text, text),
  public.worker_photo_stems_in_use(text[]) to authenticated;
