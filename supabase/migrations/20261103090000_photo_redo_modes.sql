-- =============================================================================
-- D-164 (founder 2026-10-30, after reviewing the first redo): faces must change without a single photo looking wrong;
-- every other photo only needs a small change of its own.
--  - product_media.redo may be `fresh`: the light refresh (tools/photo-worker/iwc_worker/refresh.py), for any type.
--  - _redo_wanted: every stored photo of every type is planned (clothing: not the vendor AI ones), not only food's and
--    home's main photo.
--  - worker_photo_redo_plan: kids' pieces too (their faces are cut off, never drawn: no house model is a child).
--  - worker_photo_redo_set: `fresh` for any type.
--  - worker_photo_redo_drop(media, old_path): a photo the founder removes on the review page (a portrait whose face
--    cannot be cut away): deleted while the listing keeps another photo; the next one becomes the main photo.
-- Size: none (functions; the mark is the same short text). Egress: unchanged. Page cache: none (store pages pick up
-- the change within their 5-minute fallback). Tests: photo_redo.test.sql.
-- =============================================================================

alter table public.product_media drop constraint product_media_redo_check;
alter table public.product_media
  add constraint product_media_redo_check check (redo in ('face', 'food', 'scene', 'fresh', 'kept'));

create or replace function public._redo_wanted(p_media public.product_media, p_type public.product_type)
returns boolean
language sql stable set search_path = public, pg_temp as $$
  select p_media.redo is null
     and p_media.storage_path ~ '/s/[^/]+\.(jpe?g|png|webp|avif)$'
     and (p_type <> 'clothing' or not p_media.is_ai);
$$;

create or replace function public.worker_photo_redo_plan(p_type public.product_type, p_after uuid default null,
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
                 and exists (select 1 from public.product_media m
                              where m.product_id = p.id and public._redo_wanted(m, p.product_type))
               order by p.id
               limit least(greatest(p_limit, 1), 200)) p
        join public.categories c on c.id = p.category_id), '[]'::jsonb));
end $$;

create or replace function public.worker_photo_redo_set(p_media uuid, p_old_path text, p_new_path text, p_redo text)
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
  elsif not ((p_redo = 'face' and v_type = 'clothing') or (p_redo = 'food' and v_type = 'food')
             or p_redo = 'fresh') then
    raise exception 'redo_not_for_type' using errcode = '22023';
  elsif p_new_path is null or p_new_path !~ ('^products/' || v_product || '/s/[^/]+\.(jpg|png|webp)$') then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  update public.product_media
     set storage_path = coalesce(p_new_path, storage_path), redo = p_redo
   where id = p_media and storage_path = p_old_path and redo is null;
  return found;
end $$;

create function public.worker_photo_redo_drop(p_media uuid, p_old_path text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_product uuid;
  v_primary boolean;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select m.product_id, m.is_primary into v_product, v_primary
    from public.product_media m
   where m.id = p_media and m.storage_path = p_old_path and m.redo is null
     and exists (select 1 from public.product_media o where o.product_id = m.product_id and o.id <> m.id);
  if v_product is null then
    return false;
  end if;
  delete from public.product_media where id = p_media;
  if v_primary then
    update public.product_media set is_primary = true
     where id = public._main_photo(v_product);
  end if;
  return true;
end $$;

revoke all on function public.worker_photo_redo_drop(uuid, text) from public, anon;
grant execute on function public.worker_photo_redo_drop(uuid, text) to authenticated;
