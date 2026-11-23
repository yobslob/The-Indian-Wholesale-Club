-- D-204, recipes for everyone (founder 2026-11-23): every drafted recipe can go live at once, with a placeholder
-- drawing until its photo comes; each IWC line takes the cheapest live listing that matches by default; dry swaps
-- for fresh things (coriander powder for fresh coriander); Home shows a row of recipes instead of the windows.

-- A swap: an IWC line offered in place of a fresh, local one ("instead of fresh coriander"). Not in the kit's total,
-- never blocks a publish, shown only when it can be bought.
alter table public.recipe_ingredients
  add column instead_of text check (instead_of is null or length(instead_of) between 1 and 80),
  add constraint recipe_ingredients_swap_is_iwc check (instead_of is null or source = 'iwc');

-- The publish rule, as D-204 has it: approved words and at least one main piece from IWC with a live listing. No
-- photo needed (the kadai drawing stands in); a line with no listing yet shows on the page as one to buy locally.
create or replace function public._recipe_blockers(p_id uuid) returns text[]
language sql stable security definer set search_path = public, pg_temp as $$
  select array_remove(array[
    case when r.content_status <> 'approved' then 'words_not_approved' end,
    case when not exists (
           select 1 from public.recipe_ingredients i
           join public.product_variants v on v.id = i.variant_id and v.is_active
           join public.products p on p.id = v.product_id and p.status = 'live' and p.product_type = 'food'
           where i.recipe_id = r.id and i.source = 'iwc' and i.instead_of is null)
         then 'no_iwc_line' end], null)
  from public.recipes r where r.id = p_id;
$$;

create or replace function public._recipe_publish_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_why text[] := '{}';
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    if new.content_status <> 'approved' then v_why := v_why || 'words_not_approved'; end if;
    if tg_op = 'INSERT' then
      v_why := v_why || 'no_iwc_line'::text;
    else
      v_why := v_why || coalesce(array(
        select x from unnest(public._recipe_blockers(new.id)) x where x <> 'words_not_approved'), '{}');
    end if;
    if cardinality(v_why) > 0 then
      raise exception 'recipe_not_ready: %', array_to_string(v_why, ', ') using errcode = '23514';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status <> 'live' then new.home_rank := null; end if;
  return new;
end $$;

-- The kit is the main lines only; a swap is the customer's to tick.
create or replace function public._store_recipe_kit(p_id uuid) returns table (kit_cents integer, kit_count integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(sv.price_cents), 0)::integer, count(sv.id)::integer
  from public.recipe_ingredients i
  join public.store_variants sv on sv.id = i.variant_id and sv.available > 0
  join public.store_products sp on sp.id = sv.product_id and sp.product_type = 'food'
  where i.recipe_id = p_id and i.source = 'iwc' and i.instead_of is null;
$$;

-- One recipe and its lines. A main IWC line whose listing isn't in the store reads as a local line (buy it down the
-- road); a sold-out one stays in the kit as unavailable; a swap shows only when it can be bought.
create or replace function public.store_recipe(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'slug', r.slug, 'name', r.name, 'kind', r.kind, 'blurb', r.blurb, 'minutes', r.minutes,
    'soak_hours', r.soak_hours, 'serves', r.serves, 'effort', r.effort, 'photo_path', r.photo_path,
    'region_slug', g.slug, 'region_name', g.name, 'steps', r.steps, 'published_at', r.published_at,
    'updated_at', r.updated_at, 'kit_cents', k.kit_cents, 'kit_count', k.kit_count,
    'lines', coalesce((
      select jsonb_agg(case when i.source = 'local' or sp.id is null then
               jsonb_build_object('source', 'local', 'label', i.label, 'amount', i.amount)
             else jsonb_build_object(
               'source', 'iwc', 'label', i.label, 'amount', i.amount, 'instead_of', i.instead_of,
               'available', sv.available > 0,
               'variant_id', sv.id, 'product_id', sp.id, 'product_name', sp.name, 'product_slug', sp.slug,
               'region_slug', sp.region_slug, 'region_name', sp.region_name, 'variant_label', sv.label,
               'net_qty', sv.net_qty, 'price_cents', sv.price_cents, 'image_path', sp.primary_image_path,
               'product_type', sp.product_type,
               'option_count', (select count(*) from public.store_variants o where o.product_id = sp.id))
             end order by i.sort, i.label)
      from public.recipe_ingredients i
      left join public.store_variants sv on sv.id = i.variant_id
      left join public.store_products sp on sp.id = sv.product_id and sp.product_type = 'food'
      where i.recipe_id = r.id
        and (i.instead_of is null or coalesce(sv.available, 0) > 0)), '[]'::jsonb))
  from public.recipes r
  left join public.regions g on g.id = r.region_id
  cross join lateral public._store_recipe_kit(r.id) k
  where r.slug = p_slug and r.status = 'live' and r.content_status = 'approved'
    and (not r.is_placeholder or public.dev_preview()) and k.kit_count > 0;
$$;

-- Home's Cook at home row: the pinned recipe first, then the shelf's order; 12 cards (Home is cached once: keep it
-- small).
create function public._store_home_recipes() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(x.c order by x.c_rank, x.c_sort, x.c_name), '[]'::jsonb) from (
    select jsonb_build_object(
             'slug', r.slug, 'name', r.name, 'kind', r.kind, 'blurb', r.blurb, 'minutes', r.minutes,
             'soak_hours', r.soak_hours, 'serves', r.serves, 'effort', r.effort, 'photo_path', r.photo_path,
             'region_slug', g.slug, 'region_name', g.name, 'kit_cents', k.kit_cents, 'kit_count', k.kit_count) as c,
           coalesce(r.home_rank, 1000000) as c_rank, r.sort as c_sort, r.name as c_name
    from public.recipes r
    left join public.regions g on g.id = r.region_id
    cross join lateral public._store_recipe_kit(r.id) k
    where r.status = 'live' and r.content_status = 'approved'
      and (not r.is_placeholder or public.dev_preview()) and k.kit_count > 0
    order by coalesce(r.home_rank, 1000000), r.sort, r.name
    limit 12) x;
$$;
revoke all on function public._store_home_recipes() from public, anon, authenticated;

-- The cheapest option on the store that matches a line's words (every word in the listing's name): the default
-- pick (D-204). The store's own views, so it is a price the customer would see.
create function public._recipe_cheapest_variant(p_words text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select sv.id
  from public.store_products sp
  join public.store_variants sv on sv.product_id = sp.id and sv.available > 0
  where sp.product_type = 'food' and length(btrim(coalesce(p_words, ''))) > 0
    and not exists (
      select 1 from regexp_split_to_table(lower(btrim(p_words)), '\s+') w
      where position(w in lower(sp.name)) = 0)
  order by sv.price_cents, sp.name, sv.id
  limit 1;
$$;
revoke all on function public._recipe_cheapest_variant(text) from public, anon, authenticated;

-- Publish all (D-204): for draft recipes after p_after (by slug), p_limit at a time (D-146: the page repeats it), each
-- IWC line without an in-stock listing takes the cheapest match, the words are approved and the recipe goes live when
-- it has a piece to sell. A line nothing matches stays as it is (it reads as a local line on the page).
create function public.admin_recipes_publish_all(p_after text default null, p_limit integer default 15)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
  r record;
  n integer;
  v_seen integer := 0;
  v_filled integer := 0;
  v_why text[];
  v_last text;
  v_published text[] := '{}';
  v_blocked jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  for r in
    select id, slug from public.recipes
    where status = 'draft' and slug > coalesce(p_after, '')
    order by slug limit v_limit
  loop
    v_seen := v_seen + 1;
    v_last := r.slug;
    with pick as (
      select i.id, public._recipe_cheapest_variant(i.match_words) as variant_id
      from public.recipe_ingredients i
      where i.recipe_id = r.id and i.source = 'iwc'
        and not exists (select 1 from public.store_variants sv where sv.id = i.variant_id and sv.available > 0))
    update public.recipe_ingredients i set variant_id = pick.variant_id, product_id = null
    from pick where pick.id = i.id and pick.variant_id is not null;
    get diagnostics n = row_count;
    v_filled := v_filled + n;
    v_why := array(select x from unnest(public._recipe_blockers(r.id)) x where x <> 'words_not_approved');
    if cardinality(v_why) = 0 then
      update public.recipes set content_status = 'approved', status = 'live' where id = r.id;
      v_published := v_published || r.slug;
    else
      v_blocked := v_blocked || jsonb_build_object('slug', r.slug, 'why', to_jsonb(v_why));
    end if;
  end loop;
  return jsonb_build_object(
    'published', to_jsonb(v_published), 'blocked', v_blocked, 'lines_filled', v_filled,
    'next', case when v_seen = v_limit then v_last end);
end $$;
revoke all on function public.admin_recipes_publish_all(text, integer) from public, anon;
grant execute on function public.admin_recipes_publish_all(text, integer) to authenticated;

-- Today's item: live recipes whose main piece's listing went or sold out. A line never matched is the list's "missing"
-- count, not Today's (after Publish all there are many, D-204); a swap only hides.
create or replace function public.admin_recipes_missing_piece() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.recipes r
  where public.is_admin() and r.status = 'live' and exists (
    select 1 from public.recipe_ingredients i
    left join public.product_variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
    where i.recipe_id = r.id and i.source = 'iwc' and i.instead_of is null and i.variant_id is not null
      and (v.id is null or not v.is_active or p.status <> 'live' or v.qty_listed - v.qty_reserved <= 0));
$$;

-- store_home() as in 20261124090000_recipes.sql, with `recipes` (Home's row) in place of `recipe` (the window).
create or replace function public.store_home() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with ranked as (
    select p.id, p.product_type, p.published_at, p.name,
           row_number() over (partition by p.published_at, bp.source_site, p.category_slug order by md5(p.id::text)) as turn,
           md5(coalesce(bp.source_site, '') || coalesce(p.category_slug, '')) as lane
    from public.store_products p
    join public.products bp on bp.id = p.id),
  newest as (
    select x.*,
           row_number() over (partition by x.product_type order by x.published_at desc nulls last, x.turn, x.lane, x.name) as k,
           row_number() over (order by x.published_at desc nulls last, x.name) as overall
    from ranked x),
  -- The tiles (D-190, D-191; their photos: apps/web/features/home/tile-photos.ts), each with its count, biggest first. A
  -- tile with a `who` counts as that filter does: pieces for them and unisex pieces.
  tile_list (category_slug, label, who) as (
    values ('snacks-and-namkeen', null, null), ('bakery-and-biscuits', null, null), ('sweets', null, null),
           ('rice-flours-and-staples', null, null), ('masala-blends', null, null), ('pickles-and-chutneys', null, null),
           ('whole-spices', null, null), ('tea-and-drinks', null, null), ('papad-and-wadi', null, null),
           ('pooja-and-spiritual', null, null), ('thaali-and-serveware', null, null), ('handicrafts-and-decor', null, null),
           ('shirts-and-tops', 'Shirts', 'men'), ('shirts-and-tops', 'Tops', 'women'),
           ('jeans-and-trousers', 'Pants', null), ('co-ords-and-dresses', 'Dresses', null),
           ('kurtas', 'Kurtis', 'women'), ('sarees', 'Sarees', null)),
  tiles as (
    select l.category_slug, coalesce(l.label, min(p.category_name)) as category_name, min(p.product_type::text)::public.product_type as product_type,
           l.who, count(*) as n,
           -- the photo of its newest piece that has one
           (array_agg(p.primary_image_path order by p.published_at desc nulls last, p.id)
              filter (where p.primary_image_path is not null))[1] as image_path
    from tile_list l
    join public.store_products p on p.category_slug = l.category_slug
    join public.products bp on bp.id = p.id
    where l.who is null or bp.wears in (l.who, 'unisex')
    group by l.category_slug, l.label, l.who),
  -- Pieces ordered this week (paid, not cancelled), only to order the row: the counts never leave (D-003)
  ordered as (
    select oi.product_id as id, sum(oi.quantity) as n, max(p.published_at) as published_at
    from public.order_items oi
    join public.orders od on od.id = oi.order_id
    join public.products p on p.id = oi.product_id
    where od.created_at >= now() - interval '7 days'
      and od.payment_status in ('paid', 'partially_refunded')
      and od.status not in ('pending_payment', 'cancelled', 'refunded')
      and oi.status = 'active'
      and p.status = 'live' and (not p.is_placeholder or public.dev_preview())
    group by oi.product_id
    order by n desc, published_at desc nulls last, oi.product_id
    limit 12),
  cheap as (
    select p.id, p.price_cents
    from public.store_products p
    where p.price_cents < 500
    order by p.price_cents, p.id
    limit 12)
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    -- D-169: the founder's Home photos only, in the admin's order
    'album', coalesce((
      select jsonb_agg(jsonb_build_object('storage_path', a.storage_path, 'alt_text', a.alt_text)
                       order by a.sort_order, a.created_at)
      from (select h.storage_path, h.alt_text, h.sort_order, h.created_at
            from public.home_photos h
            order by h.sort_order, h.created_at
            limit 60) a), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', t.category_slug, 'name', t.category_name, 'product_type', t.product_type, 'count', t.n,
               'for', t.who, 'image_path', t.image_path)
             order by t.n desc, t.category_name)
      from tiles t), '[]'::jsonb),
    'most_ordered', coalesce((
      select jsonb_agg(public._store_product_card(o.id) order by o.n desc, o.published_at desc nulls last, o.id)
      from ordered o), '[]'::jsonb),
    'under_5', coalesce((
      select jsonb_agg(public._store_product_card(c.id) order by c.price_cents, c.id)
      from cheap c), '[]'::jsonb),
    'just_listed', coalesce((  -- TODO(D-187): drop when app <next version> is the minimum (its Home's only row)
      select jsonb_agg(public._store_product_card(n.id) order by n.overall)
      from newest n where n.overall <= 12), '[]'::jsonb),
    'just_listed_types', (
      select jsonb_object_agg(t.product_type, coalesce((
               select jsonb_agg(public._store_product_card(n.id) order by n.k)
               from newest n where n.product_type = t.product_type and n.k <= 12), '[]'::jsonb))
      from (values ('clothing'::public.product_type), ('home'::public.product_type)) t(product_type)),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),  -- TODO(D-187): drop when app <next version> is the minimum
    -- D-140 (L7): the band under Just listed, from the same numbers as the Shipping & returns page
    'band', (select jsonb_build_object('free_min_cents', p -> 'free_shipping_min_cents',
                                       'return_claim_days', p -> 'return_claim_days')
             from public.store_policy() p),
    -- D-204: Home's Cook at home row
    'recipes', public._store_home_recipes()
  );
$$;
drop function public._store_home_recipe();

notify pgrst, 'reload schema';
