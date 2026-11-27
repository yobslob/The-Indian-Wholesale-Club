-- D-213 (founder 2026-11-27): "On admin's recipe, publish all is not working, a recipe is not taking the cheapest listing
-- by default. If no listing is found move it to local shop."
--
-- Publish all looked each line up on its own through the store views (one scan of every food listing per line): a
-- batch of 15 recipes is about 90 scans, past the 8 s statement limit (D-146), so a batch failed whole and nothing
-- went live. Now one batch is one lookup: the in-stock food listings are read once, and every line takes the cheapest
-- whose name has each of its words at the start of a word ("dal" finds "Toor Dal", no longer "Sandalwood"). Imported
-- drafts take their cheapest listings straight away (admin_recipes_fill_cheapest), so the editor opens on them; at
-- Publish all a main line still without one becomes a line for the local shop. A swap with no listing stays hidden.

-- The cheapest in-stock listing for every IWC line of these recipes that has none in stock; then, with p_to_local, the
-- main lines still without one become local lines (their words kept, should the listing come later). {filled, moved}.
create function public._recipe_fill_cheapest(p_ids uuid[], p_to_local boolean) returns integer[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_filled integer;
  v_moved integer := 0;
begin
  with lines as (
    select i.id,
           array(select ' ' || w from regexp_split_to_table(
                   btrim(regexp_replace(lower(i.match_words), '[^a-z0-9]+', ' ', 'g')), ' ') w
                 where w <> '') as words
    from public.recipe_ingredients i
    where i.recipe_id = any (p_ids) and i.source = 'iwc'
      and not exists (
        select 1 from public.product_variants v join public.products p on p.id = v.product_id
        where v.id = i.variant_id and v.is_active and p.status = 'live' and v.qty_listed - v.qty_reserved > 0)
  ),
  listings as materialized (
    select v.id as variant_id, coalesce(v.price_cents, p.price_cents) as price_cents, p.name,
           ' ' || regexp_replace(lower(p.name), '[^a-z0-9]+', ' ', 'g') as words
    from public.products p
    join public.product_variants v on v.product_id = p.id and v.is_active
    where p.status = 'live' and p.product_type = 'food' and v.qty_listed - v.qty_reserved > 0
      and coalesce(v.price_cents, p.price_cents) is not null
      and (not p.is_placeholder or public.dev_preview())
  ),
  pick as (
    select distinct on (l.id) l.id, c.variant_id
    from lines l
    join listings c on cardinality(l.words) > 0
      and not exists (select 1 from unnest(l.words) w where position(w in c.words) = 0)
    order by l.id, c.price_cents, c.name, c.variant_id
  )
  update public.recipe_ingredients i set variant_id = pick.variant_id, product_id = null
  from pick where pick.id = i.id;
  get diagnostics v_filled = row_count;

  if p_to_local then
    update public.recipe_ingredients i set source = 'local', variant_id = null, product_id = null
    where i.recipe_id = any (p_ids) and i.source = 'iwc' and i.instead_of is null
      and not exists (
        select 1 from public.product_variants v join public.products p on p.id = v.product_id
        where v.id = i.variant_id and v.is_active and p.status = 'live' and v.qty_listed - v.qty_reserved > 0);
    get diagnostics v_moved = row_count;
  end if;
  return array[v_filled, v_moved];
end $$;
revoke all on function public._recipe_fill_cheapest(uuid[], boolean) from public, anon, authenticated;

-- After an import (drafts only, at most 100 a call): each IWC line takes its cheapest listing; nothing moves to local
-- yet, so a listing that comes before Publish all is still found.
create function public.admin_recipes_fill_cheapest(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if cardinality(p_ids) > 100 then
    raise exception 'too_many' using errcode = '22023', hint = 'At most 100 recipes a call (D-146).';
  end if;
  return (public._recipe_fill_cheapest(
    array(select id from public.recipes where id = any (p_ids) and status = 'draft'), false))[1];
end $$;
revoke all on function public.admin_recipes_fill_cheapest(uuid[]) from public, anon;
grant execute on function public.admin_recipes_fill_cheapest(uuid[]) to authenticated;

-- Publish all, one batch: the cheapest listing for every line without one in stock, the rest of the main lines to the
-- local shop, then each recipe with a piece to sell goes live (its words approved). `lines_local` counts the moves.
drop function public._recipe_cheapest_variant(text);
create or replace function public.admin_recipes_publish_all(p_after text default null, p_limit integer default 15)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
  v_ids uuid[];
  v_last text;
  v_done integer[];
  r record;
  v_why text[];
  v_published text[] := '{}';
  v_blocked jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select array_agg(id order by slug), max(slug) into v_ids, v_last
  from (select id, slug from public.recipes
        where status = 'draft' and slug > coalesce(p_after, '')
        order by slug limit v_limit) b;
  if v_ids is null then
    return jsonb_build_object('published', '[]'::jsonb, 'blocked', '[]'::jsonb, 'lines_filled', 0,
                              'lines_local', 0, 'next', null);
  end if;
  v_done := public._recipe_fill_cheapest(v_ids, true);
  for r in select id, slug from public.recipes where id = any (v_ids) order by slug loop
    v_why := array(select x from unnest(public._recipe_blockers(r.id)) x where x <> 'words_not_approved');
    if cardinality(v_why) = 0 then
      update public.recipes set content_status = 'approved', status = 'live' where id = r.id;
      v_published := v_published || r.slug;
    else
      v_blocked := v_blocked || jsonb_build_object('slug', r.slug, 'why', to_jsonb(v_why));
    end if;
  end loop;
  return jsonb_build_object(
    'published', to_jsonb(v_published), 'blocked', v_blocked, 'lines_filled', v_done[1], 'lines_local', v_done[2],
    'next', case when cardinality(v_ids) = v_limit then v_last end);
end $$;
