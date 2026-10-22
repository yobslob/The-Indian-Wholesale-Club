-- =============================================================================
-- D-146: every listing gets a weight, then everything goes live; Weights to check, Names to tidy and Drafts each
-- clear in one press. The founder: "assign all the check weights … if some aren't assigned then make a better system
-- which can assign them, I want everything assigned and then published, also add a button similar to publish all in
-- check weights and tidy names. Also we will have to handle all drafts so that we can start new batches."
--  - admin_weight_plan() names the listings with an option that has no weight; the website works out the ones its
--    rules can read (clothing by class, D-132; food by the net quantity on its label, D-135) and
--    admin_assign_weights() writes them. An option no rule reads gets the median weight of the 7 most similar pieces
--    of its category already weighed by a trusted source (the same words in the name, the closest shop price), else
--    the category's usual weight; source 'estimated', the note says which. The runner's page reads and the hub's
--    scale still replace an estimate (D-129, D-130, D-134).
--  - product_variants.weight_checked_at: an admin accepted the weight Weights to check showed (a matching item's, one
--    recorded before sources were kept, an unusual one, a doubted shop weight). A new weight clears it.
--    admin_accept_weights() accepts them all, in batches.
--  - admin_rename_listings() renames many listings in one statement (Names to tidy → Rename all), keeping each old
--    name as the shop title (D-140).
--  - admin_publish_drafts() takes a batch size (500 by default) and says how many ready drafts are left, so the
--    website publishes thousands in steps, each well inside the database's statement time limit.
--  - admin_archive_unready_drafts() archives the drafts that cannot go live (no photo, no active option, nothing to
--    sell), so Drafts empties for the next batch; archived listings can be published again by hand.
-- Placeholders and US clearance pieces are never touched (as D-129).
-- =============================================================================

alter table public.product_variants add column weight_checked_at timestamptz;
comment on column public.product_variants.weight_checked_at is
  'D-146: when an admin accepted this weight in Weights to check; cleared when the weight changes. Admin only';

create function public._variant_weight_checked() returns trigger
language plpgsql as $$
begin
  if new.weight_g is distinct from old.weight_g and new.weight_checked_at is not distinct from old.weight_checked_at then
    new.weight_checked_at := null;
  end if;
  return new;
end $$;

create trigger product_variants_weight_checked
  before update of weight_g on public.product_variants
  for each row execute function public._variant_weight_checked();

-- As 20261016090000_clothing_classes, except that a weight an admin accepted no longer needs a check.
create or replace function public._weight_needs_check(v public.product_variants, p_type public.product_type, p_category_g integer)
returns boolean language sql immutable as $$
  select v.is_active and (
    v.weight_g is null
    or (v.weight_checked_at is null and (
      v.weight_source is null or v.weight_source = 'similar'
      or (p_type <> 'food' and p_category_g is not null
          and v.weight_source not in ('weighed', 'admin', 'class')
          and (v.weight_g * 4 < p_category_g or v.weight_g > p_category_g * 4))
      or (v.weight_source = 'shop' and v.weight_estimate_g is not null
          and abs(v.weight_estimate_g - v.weight_g) * 3 > v.weight_g))))
$$;

-- The words of a name that say what a piece is, for finding similar pieces: three letters or more, without the words
-- every listing has.
create function public._weight_words(p_name text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}')
    from regexp_split_to_table(lower(coalesce(p_name, '')), '[^a-z]+') as w
   where length(w) >= 3
     and w <> all (array['for', 'the', 'and', 'with', 'set', 'pack', 'home', 'decor', 'decoration', 'decorative',
                         'diwali', 'gift', 'gifts', 'item', 'items', 'from', 'piece', 'pcs', 'pieces', 'women',
                         'men', 'size', 'free', 'best', 'new', 'india', 'indian'])
$$;

-- The listings with an active (or held) option that has no weight: live first, then the oldest. Up to 200 a call.
create function public.admin_weight_plan(p_limit integer default 100)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'left', (select count(distinct v.product_id)
               from public.product_variants v join public.products p on p.id = v.product_id
              where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived' and v.weight_g is null
                and (v.is_active or v.weight_note = public._weight_held_note())),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'product_id', p.id, 'name', p.name, 'product_type', p.product_type,
               'category_slug', c.slug, 'description', left(coalesce(p.description, ''), 600),
               'variants', (select jsonb_agg(jsonb_build_object(
                                     'id', v.id, 'label', v.label, 'options', v.options, 'weight_g', v.weight_g,
                                     'weight_source', v.weight_source, 'weight_note', v.weight_note,
                                     'net_qty', v.net_qty, 'is_active', v.is_active)
                                   order by v.sort_order, v.label)
                              from public.product_variants v where v.product_id = p.id))
             order by (p.status = 'live') desc, p.created_at, p.id)
        from (select p.* from public.products p
               where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
                 and exists (select 1 from public.product_variants v
                              where v.product_id = p.id and v.weight_g is null
                                and (v.is_active or v.weight_note = public._weight_held_note()))
               order by (p.status = 'live') desc, p.created_at, p.id
               limit least(greatest(p_limit, 0), 200)) p
        join public.categories c on c.id = p.category_id), '[]'::jsonb));
end $$;

-- Writes weights to options that have none (never over a weight). Each item: variant_id, and either weight_g with its
-- source ('class' for clothing, 'packed' for food, with a note and optionally net_qty) or no weight_g: then the
-- similar pieces' median, else the category's usual weight ('estimated'). Up to 600 items a call.
create function public.admin_assign_weights(p_items jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  it jsonb;
  t record;
  v_g integer;
  v_src text;
  v_note text;
  v_ruled integer := 0;
  v_similar integer := 0;
  v_usual integer := 0;
  v_words text[];
  n record;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 600 then
    raise exception 'items_invalid' using errcode = 'P0001';
  end if;

  -- the trusted weights of the categories in this call, with their words, once
  drop table if exists _pool;
  create temp table _pool on commit drop as
  select p.category_id, v.weight_g, coalesce(v.shop_price_paise, p.shop_price_paise) as price,
         public._weight_words(p.name) as words
    from public.product_variants v
    join public.products p on p.id = v.product_id
   where not p.is_placeholder and v.weight_g > 0
     and v.weight_source in ('weighed', 'admin', 'shop', 'packed', 'class')
     and p.category_id in (select p2.category_id from public.product_variants v2
                             join public.products p2 on p2.id = v2.product_id
                            where v2.id in (select nullif(e ->> 'variant_id', '')::uuid
                                              from jsonb_array_elements(p_items) e));
  create index on _pool (category_id);

  for it in select * from jsonb_array_elements(p_items) loop
    select v.id, v.weight_g, p.product_type, p.category_id, p.name, c.default_weight_g, c.name as category,
           coalesce(v.shop_price_paise, p.shop_price_paise) as price
      into t
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
     where v.id = nullif(it ->> 'variant_id', '')::uuid
       and not p.is_placeholder and not p.is_us_stock and p.status <> 'archived';
    if not found or t.weight_g is not null then
      continue;
    end if;
    v_g := nullif(it ->> 'weight_g', '')::integer;
    v_src := it ->> 'source';
    if v_g is not null and v_g between 1 and 50000
       and ((v_src = 'class' and t.product_type = 'clothing') or (v_src = 'packed' and t.product_type = 'food')) then
      v_note := left(coalesce(it ->> 'note', ''), 200);
      v_ruled := v_ruled + 1;
    else
      v_words := public._weight_words(t.name);
      select percentile_disc(0.5) within group (order by s.weight_g) as grams, count(*) as k,
             min(s.price) as lo, max(s.price) as hi
        into n
        from (select q.weight_g, q.price
                from _pool q
               where q.category_id = t.category_id
               order by (cardinality(array(select unnest(q.words) intersect select unnest(v_words)))::numeric
                         / greatest(cardinality(array(select unnest(q.words) union select unnest(v_words))), 1))
                        - 0.3 * case when t.price > 0 and q.price > 0 then abs(ln(q.price::numeric / t.price)) else 0 end
                        desc
               limit 7) s;
      if n.k >= 3 then
        v_g := greatest(10, round(n.grams / 10.0)::integer * 10);
        v_src := 'estimated';
        v_note := left(format('The middle weight of %s similar %s pieces (₹%s – ₹%s) weighed before (D-146)',
                              n.k, lower(t.category), n.lo / 100, n.hi / 100), 200);
        v_similar := v_similar + 1;
      elsif t.default_weight_g is not null then
        v_g := t.default_weight_g;
        v_src := 'estimated';
        v_note := left(format('The usual weight of %s (D-146): too few similar pieces weighed', lower(t.category)), 200);
        v_usual := v_usual + 1;
      else
        continue;
      end if;
    end if;
    update public.product_variants
       set weight_g = v_g, weight_source = v_src, weight_note = v_note,
           net_qty = case when v_src = 'packed' then coalesce(nullif(left(it ->> 'net_qty', 40), ''), net_qty) else net_qty end
     where id = t.id and weight_g is null;
  end loop;
  return jsonb_build_object('ruled', v_ruled, 'similar', v_similar, 'usual', v_usual);
end $$;

-- Accepts the weights Weights to check shows (every option that has one), up to p_limit options a call.
create function public.admin_accept_weights(p_limit integer default 2000)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  with due as (
    select v.id
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.categories c on c.id = p.category_id
     where not p.is_placeholder and not p.is_us_stock and p.status <> 'archived'
       and v.weight_g is not null and public._weight_needs_check(v, p.product_type, c.default_weight_g)
     limit least(greatest(p_limit, 0), 5000)
  )
  update public.product_variants v set weight_checked_at = now() from due where v.id = due.id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('accepted', v_n);
end $$;

-- Names to tidy → Rename all (D-140, D-143): many names at once; each old name is kept as the shop title when none
-- was kept yet. Up to 500 a call; returns how many changed.
create function public.admin_rename_listings(p_items jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'items_invalid' using errcode = 'P0001';
  end if;
  update public.products p
     set name = i.name, shop_title = coalesce(p.shop_title, left(p.name, 300))
    from (select nullif(e ->> 'id', '')::uuid as id, btrim(e ->> 'name') as name
            from jsonb_array_elements(p_items) e) i
   where p.id = i.id and char_length(i.name) between 2 and 120 and p.name is distinct from i.name;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- As 20261015160000_weights, publishing at most p_limit drafts a call ('left': ready drafts not yet published).
drop function public.admin_publish_drafts();
create function public.admin_publish_drafts(p_limit integer default 500)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_live integer := 0;
  v_left integer := 0;
  v_no_photo integer := 0;
  v_no_option integer := 0;
  v_no_stock integer := 0;
  v_no_weight integer := 0;
  v_refused integer := 0;
  v_missing integer := 0;
  v_note text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  for r in
    select p.id,
           case p.product_type
             when 'clothing' then coalesce(p.attributes ->> 'fibre_content', '') <> ''
                                  and coalesce(p.attributes ->> 'care', '') <> ''
             when 'food' then coalesce(p.attributes ->> 'ingredients', '') <> ''
                              and jsonb_typeof(p.attributes -> 'allergens') = 'array'
                              and p.attributes ? 'shelf_life_days'
             when 'home' then coalesce(p.attributes ->> 'material', '') <> ''
             else true
           end as has_details,
           exists (select 1 from public.product_media m where m.product_id = p.id) as has_photo,
           exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active) as has_option,
           exists (select 1 from public.product_variants v
                    where v.product_id = p.id and v.is_active and v.qty_listed > v.qty_reserved) as has_stock,
           not exists (select 1 from public.product_variants v
                        where v.product_id = p.id and v.is_active and v.weight_g is null) as has_weight
      from public.products p
     where p.status = 'draft' and not p.is_placeholder and not p.is_us_stock
     order by p.created_at
  loop
    if not r.has_photo then
      v_no_photo := v_no_photo + 1;
    elsif not r.has_option then
      v_no_option := v_no_option + 1;
    elsif not r.has_stock then
      v_no_stock := v_no_stock + 1;
    elsif not r.has_weight then
      v_no_weight := v_no_weight + 1;   -- D-129: its price would rest on a guess
    elsif v_live + v_refused >= greatest(coalesce(p_limit, 500), 1) then
      v_left := v_left + 1;
    else
      begin
        update public.products set status = 'live', published_at = now() where id = r.id and status = 'draft';
        v_live := v_live + 1;
        if not r.has_details then
          v_missing := v_missing + 1;
        end if;
      exception when others then
        v_refused := v_refused + 1;
        v_note := left(sqlerrm, 200);   -- e.g. food is not cleared (D-074)
      end;
    end if;
  end loop;
  return jsonb_build_object('published', v_live, 'left', v_left, 'no_photo', v_no_photo, 'no_option', v_no_option,
                            'no_stock', v_no_stock, 'no_weight', v_no_weight, 'refused', v_refused, 'note', v_note,
                            'live_missing_details', v_missing);
end $$;

-- Drafts that cannot go live (no photo, no active option, nothing to sell) are archived, so Drafts holds only the next
-- batch. Returns how many, by reason.
create function public.admin_archive_unready_drafts()
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_photo integer;
  v_option integer;
  v_stock integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  drop table if exists _unready;
  create temp table _unready on commit drop as
  select p.id,
         case
           when not exists (select 1 from public.product_media m where m.product_id = p.id) then 'photo'
           when not exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active) then 'option'
           when not exists (select 1 from public.product_variants v
                             where v.product_id = p.id and v.is_active and v.qty_listed > v.qty_reserved) then 'stock'
         end as why
    from public.products p
   where p.status = 'draft' and not p.is_placeholder and not p.is_us_stock;
  delete from _unready where why is null;
  update public.products p set status = 'archived' from _unready u where p.id = u.id and p.status = 'draft';
  select count(*) filter (where why = 'photo'), count(*) filter (where why = 'option'),
         count(*) filter (where why = 'stock')
    into v_photo, v_option, v_stock from _unready;
  return jsonb_build_object('no_photo', v_photo, 'no_option', v_option, 'no_stock', v_stock);
end $$;

revoke all on function public._weight_words(text), public._variant_weight_checked() from public, anon, authenticated;
revoke all on function public.admin_weight_plan(integer), public.admin_assign_weights(jsonb),
  public.admin_accept_weights(integer), public.admin_publish_drafts(integer), public.admin_rename_listings(jsonb), public.admin_archive_unready_drafts()
  from public, anon;
grant execute on function public.admin_weight_plan(integer), public.admin_assign_weights(jsonb),
  public.admin_accept_weights(integer), public.admin_publish_drafts(integer), public.admin_rename_listings(jsonb), public.admin_archive_unready_drafts()
  to authenticated;
