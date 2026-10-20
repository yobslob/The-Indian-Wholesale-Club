-- D-140, the photo fix (2026-10-20): photos live in a photo store (Cloudflare R2), recorded with a path in an s/
-- folder (products/<id>/s/<name>.jpg; packages/shared media.ts). The runner's photos may be recorded there, still only
-- in the listing's own folder; album photos may sit in s/ (c/ was the WebP copies of 2026-10-19).

create or replace function public.worker_sourcing_media(p_product uuid, p_media jsonb, p_publish boolean)
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
                 where coalesce(m ->> 'path', '') !~ ('^products/' || p_product::text || '/(s/)?[^/]+$')) then
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

alter table public.region_photos drop constraint region_photos_storage_path_check;
alter table public.region_photos add constraint region_photos_storage_path_check
  check (storage_path ~ '^regions/[a-z0-9-]+/album/([cs]/)?[^/]+$');
