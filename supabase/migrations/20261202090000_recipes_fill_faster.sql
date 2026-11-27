-- D-214, Publish all in production (founder 2026-11-27): "TimeoutError: Database request timed out after 8000 ms". The
-- one-lookup batch of 20261201090000 still compared every line with every listing through a subquery per pair: on 20,000
-- food listings a batch of 15 recipes took 7.5 s and an import of 100 took 48 s (measured on a local copy). Now each
-- distinct set of match words is looked up once, with one LIKE ALL per listing ("% word%" on the name's words, the same
-- start-of-a-word rule): 0.2 s for 15 recipes, 0.5 s for 100. Nothing else changes. No new rows, reads or page writes.

create or replace function public._recipe_fill_cheapest(p_ids uuid[], p_to_local boolean) returns integer[]
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_filled integer;
  v_moved integer := 0;
begin
  with lines as (
    select i.id, btrim(regexp_replace(lower(i.match_words), '[^a-z0-9]+', ' ', 'g')) as words
    from public.recipe_ingredients i
    where i.recipe_id = any (p_ids) and i.source = 'iwc'
      and not exists (
        select 1 from public.product_variants v join public.products p on p.id = v.product_id
        where v.id = i.variant_id and v.is_active and p.status = 'live' and v.qty_listed - v.qty_reserved > 0)
  ),
  wanted as materialized (
    select words, array(select '% ' || w || '%' from regexp_split_to_table(words, ' ') w where w <> '') as pats
    from (select distinct words from lines where words <> '') d
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
    select distinct on (w.words) w.words, c.variant_id
    from wanted w join listings c on c.words like all (w.pats)
    order by w.words, c.price_cents, c.name, c.variant_id
  )
  update public.recipe_ingredients i set variant_id = pick.variant_id, product_id = null
  from lines l join pick on pick.words = l.words
  where i.id = l.id;
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

notify pgrst, 'reload schema';
