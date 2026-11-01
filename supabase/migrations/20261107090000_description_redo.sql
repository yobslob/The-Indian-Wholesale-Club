-- =============================================================================
-- D-178 (founder 2026-11-02): every listing's words written again on the founder's laptop
-- (tools/description-redo): new wording in the store's voice with every product fact kept and none invented, and no
-- prices, offers, shop or seller names, links, emojis or India logistics (D-003).
--  - products.description_redo: how a listing's summary and description were last set by the redo: `rewritten` (the
--    redo's new words, approved) or `edited` (the founder's words on the review page). Null: not done yet, so the
--    plan takes it (a listing the runner adds later too).
--  - _description_hash(summary, description): what the tool read, so a write lands only on the words it read.
--  - worker_description_plan(type, after, limit): the listings with words still to do, by id after `after` (the tool
--    pages through them), with what the words can be checked against (attributes, the country it is made in, the
--    shop's title and name, both worker only and never shown).
--  - worker_description_set(product, hash, summary, description, redo): the new words, only while the listing still
--    has the words read and no mark; refuses a price or a link outright.
-- Size: one short text per listing, the new words about the size of the old. Egress: a page of at most 50 listings'
-- words per call. Page cache: none (store pages pick up the words within their cache fallback). Tests:
-- description_redo.test.sql.
-- =============================================================================

alter table public.products add column description_redo text check (description_redo in ('rewritten', 'edited'));

create function public._description_hash(p_summary text, p_description text) returns text
language sql immutable set search_path = public, pg_temp as $$
  select md5(coalesce(p_summary, '') || chr(31) || coalesce(p_description, ''));
$$;

create function public.worker_description_plan(p_type public.product_type default null, p_after uuid default null,
                                               p_limit integer default 25)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'type', p.product_type, 'name', p.name, 'category', c.name, 'wears', p.wears,
             'attributes', p.attributes, 'summary', p.summary, 'description', p.description,
             'shop_title', p.shop_title, 'shop', v.shop_name, 'made_in', p.made_in,
             'hash', public._description_hash(p.summary, p.description))
           order by p.id)
      from (select p.* from public.products p
             where (p_type is null or p.product_type = p_type) and not p.is_placeholder and p.status <> 'archived'
               and p.description_redo is null
               and (coalesce(p.description, '') <> '' or coalesce(p.summary, '') <> '')
               and p.id > coalesce(p_after, '00000000-0000-0000-0000-000000000000'::uuid)
             order by p.id
             limit least(greatest(p_limit, 1), 50)) p
      join public.categories c on c.id = p.category_id
      join public.vendors v on v.id = p.vendor_id), '[]'::jsonb);
end $$;

create function public.worker_description_set(p_product uuid, p_hash text, p_summary text, p_description text,
                                              p_redo text)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_summary text := nullif(btrim(p_summary), '');
  v_description text := nullif(btrim(p_description), '');
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_redo is null or p_redo not in ('rewritten', 'edited') then
    raise exception 'bad_redo' using errcode = '22023';
  end if;
  if length(v_summary) > 300 or length(v_description) > 4000 then
    raise exception 'too_long' using errcode = '22023';
  end if;
  -- the tool checks far more (packages/shared/src/sourcing/describe); a price or a link never reaches a customer
  -- even if it is wrong (D-003)
  if coalesce(v_summary, '') || ' ' || coalesce(v_description, '')
       ~* '(₹|\mrs\.?\s*[0-9]|\minr\M|\mmrp\M|\$\s*[0-9]|[0-9]\s*%\s*off\M|https?://|www\.)' then
    raise exception 'price_or_link' using errcode = '22023';
  end if;
  update public.products
     set summary = v_summary, description = v_description, description_redo = p_redo
   where id = p_product and description_redo is null
     and public._description_hash(summary, description) = p_hash;
  return found;
end $$;

revoke all on function public._description_hash(text, text) from public, anon, authenticated;
revoke all on function public.worker_description_plan(public.product_type, uuid, integer),
  public.worker_description_set(uuid, text, text, text, text) from public, anon;
grant execute on function public.worker_description_plan(public.product_type, uuid, integer),
  public.worker_description_set(uuid, text, text, text, text) to authenticated;
