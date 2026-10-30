-- =============================================================================
-- D-168 (founder 2026-10-30: "one long pipeline which scrapes, modifies, then uploads"): the sourcing runner makes a
-- new listing's photos again before it uploads them (tools/photo-worker/redo_serve.py on the same laptop), so they
-- never wait for the photo redo's fetch, review and publish.
--  - worker_sourcing_media: each photo may carry `redo` (face: clothing only; fresh: any type), recorded as
--    product_media.redo like the redo's own publish (D-163, D-164), so the redo's plan never takes it again. Any other
--    mark is media_invalid. The answer says `redo: true`, so the runner knows the marks were kept (a runner on a
--    database without this migration stops redoing photos for that run).
--  - worker_product_wears(product): who a new clothing listing is for (set by its trigger from the name or category),
--    so a kids' piece never gets a house model's face (D-102); the runner also asks it once to know this migration is
--    deployed before it makes any photo again.
-- Size: none (the same short mark per photo). Egress: unchanged. Page cache: none. Tests: auto_sourcing.test.sql.
-- =============================================================================

create or replace function public.worker_sourcing_media(p_product uuid, p_media jsonb, p_publish boolean)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_note text;
  v_live boolean := false;
  v_type public.product_type;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select p.product_type into v_type from public.products p
   where p.id = p_product and p.sourcing_target_id is not null;
  if v_type is null or exists (select 1 from public.product_media m where m.product_id = p_product) then
    raise exception 'product_not_open' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_media) is distinct from 'array' or jsonb_array_length(p_media) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_media) m
                 where coalesce(m ->> 'path', '') !~ ('^products/' || p_product::text || '/(s/)?[^/]+$')
                    or (m ->> 'redo' is not null
                        and not (m ->> 'redo' = 'fresh' or (m ->> 'redo' = 'face' and v_type = 'clothing')))) then
    raise exception 'media_invalid' using errcode = 'P0001';
  end if;
  insert into public.product_media (product_id, variant_id, storage_path, alt_text, sort_order, is_primary, redo)
  select p_product,
         (select ps.variant_id from public.product_sources ps
           where ps.product_id = p_product and ps.item_key = m ->> 'item_key' limit 1),
         m ->> 'path', left(coalesce(m ->> 'alt_text', ''), 200), (n - 1)::integer, n = 1, m ->> 'redo'
    from jsonb_array_elements(p_media) with ordinality as e(m, n);

  if p_publish and (select auto_publish from public.sourcing_settings where id = 1) then
    begin
      update public.products set status = 'live', published_at = now() where id = p_product and status = 'draft';
      v_live := found;
    exception when others then
      v_note := left(sqlerrm, 200);   -- e.g. food is not cleared yet (D-074): it stays a draft
    end;
  end if;
  return jsonb_build_object('published', v_live, 'note', v_note, 'redo', true);
end $$;

create function public.worker_product_wears(p_product uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return (select p.wears from public.products p where p.id = p_product and p.sourcing_target_id is not null);
end $$;

revoke all on function public.worker_product_wears(uuid) from public, anon;
grant execute on function public.worker_product_wears(uuid) to authenticated;
