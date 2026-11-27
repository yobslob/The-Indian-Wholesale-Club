-- =============================================================================
-- Founder, 2026-11-27 (on the 14,113 "correct weights"): an oats pack of 900 g priced on the "27g High Protein" in its
-- name, a Bikaneri sev named only "Samrat", and many live pieces no shop sells any more. One pass of the sourcing runner
-- (`pnpm sourcing verify`, tools/sourcing-runner/src/verify.ts) reads each listing's own shop pages once and fixes
-- the three from what the shop shows:
--  - stock and price: through the existing check (worker_sourcing_checked, D-118): a piece no source has in stock is
--    sold out; the add button shows "Sold out" and checkout refuses it.
--  - the pack's weight: through worker_set_food_weights (D-135, D-202): the shop's own pack field, written as read;
--    a weight weighed at the hub or typed by an admin is never changed.
--  - the shop's title: worker_set_shop_titles below. The runner never kept it (worker_sourcing_add has no shop_title),
--    so a name cut at the title's first "|" could not be made again.
--  - the name: worker_set_food_names below, only where the name is still the one the runner read.
-- Reads: one page of at most 100 listings per call. Size: one title per listing (about 100 bytes). Page cache: none
-- (store pages pick up names within their fallback; stock is checked at checkout). Tests: verify_sources.test.sql.
-- =============================================================================

-- The listings with a shop source, by id after p_after (the runner pages through them and keeps its place). Live and
-- paused only unless p_drafts. Each source with its option, so the existing check (checkPage) can read it; each
-- option with its weight and where it came from.
create function public.worker_verify_plan(p_type public.product_type default null, p_after uuid default null,
                                          p_limit integer default 50, p_drafts boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'status', p.status, 'product_type', p.product_type,
             'shop_title', p.shop_title,
             'sources', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', ps.id, 'variant_id', ps.variant_id, 'site', ps.site,
                                   'page_url', ps.page_url, 'item_url', ps.item_url, 'item_key', ps.item_key,
                                   'label', v.label, 'options', v.options)
                                 order by ps.created_at), '[]'::jsonb)
                           from public.product_sources ps
                           join public.product_variants v on v.id = ps.variant_id
                          where ps.product_id = p.id),
             'variants', (select coalesce(jsonb_agg(jsonb_build_object(
                                    'id', v.id, 'label', v.label, 'weight_g', v.weight_g,
                                    'weight_source', v.weight_source, 'net_qty', v.net_qty,
                                    'is_active', v.is_active)
                                  order by v.sort_order, v.label), '[]'::jsonb)
                            from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where not p.is_placeholder and not p.is_us_stock
               and (p_type is null or p.product_type = p_type)
               and (p.status in ('live', 'paused') or (p_drafts and p.status = 'draft'))
               and (p_after is null or p.id > p_after)
               and exists (select 1 from public.product_sources ps where ps.product_id = p.id)
             order by p.id
             limit least(greatest(p_limit, 1), 100)) p), '[]'::jsonb);
end $$;
revoke all on function public.worker_verify_plan(public.product_type, uuid, integer, boolean) from public, anon;
grant execute on function public.worker_verify_plan(public.product_type, uuid, integer, boolean) to authenticated;

-- p_titles: [{product_id, title}], 500 at most. The title the shop's page shows, kept where none was kept, or where
-- the kept one is only the listing's own name (Rename all copied the name when there was none, D-146). Worker only,
-- never shown to customers. Returns how many listings got one.
create function public.worker_set_shop_titles(p_titles jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_titles) is distinct from 'array' or jsonb_array_length(p_titles) > 500 then
    raise exception 'titles_invalid' using errcode = 'P0001';
  end if;
  update public.products p
     set shop_title = left(btrim(t.title), 300)
    from (select nullif(x ->> 'product_id', '')::uuid as id, x ->> 'title' as title
            from jsonb_array_elements(p_titles) x) t
   where p.id = t.id
     and length(btrim(coalesce(t.title, ''))) >= 3
     and (p.shop_title is null or p.shop_title = left(p.name, 300))
     and p.shop_title is distinct from left(btrim(t.title), 300)
     and exists (select 1 from public.product_sources ps where ps.product_id = p.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.worker_set_shop_titles(jsonb) from public, anon;
grant execute on function public.worker_set_shop_titles(jsonb) to authenticated;

-- p_names: [{product_id, from, to}], 500 at most, food only (D-139 keeps the brand in food names). The name changes
-- only while it is still `from` (an admin's rename since is kept) and the listing came from a shop. Returns how many.
create function public.worker_set_food_names(p_names jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_names) is distinct from 'array' or jsonb_array_length(p_names) > 500 then
    raise exception 'names_invalid' using errcode = 'P0001';
  end if;
  update public.products p
     set name = btrim(t.name_to)
    from (select nullif(x ->> 'product_id', '')::uuid as id, x ->> 'from' as name_from, x ->> 'to' as name_to
            from jsonb_array_elements(p_names) x) t
   where p.id = t.id
     and p.product_type = 'food'
     and p.name = t.name_from
     and length(btrim(coalesce(t.name_to, ''))) between 3 and 120
     and btrim(t.name_to) <> p.name
     and btrim(t.name_to) !~* '(https?://|www\.|₹|\mrs\.?\s*[0-9]|\mmrp\M)'
     and exists (select 1 from public.product_sources ps where ps.product_id = p.id);
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.worker_set_food_names(jsonb) from public, anon;
grant execute on function public.worker_set_food_names(jsonb) to authenticated;

notify pgrst, 'reload schema';
