-- D-203, Cook at home: recipes with a one-tap kit (docs/plan-recipes.md §5.1).
-- A kit is a shortcut to food the store already sells: its price is the sum of its available pieces' store prices,
-- worked out on every read and never stored; nothing about pricing, the bag or checkout changes (D-140 rule 0.2).
-- Customers read recipes only through the store_* functions below (D-017); the tables are the admin's.

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 80),
  region_id uuid references public.regions (id) on delete set null,  -- null = All of India (D-121)
  kind text not null check (kind in ('snacks', 'breakfast', 'dinner', 'sweets', 'drinks')),
  blurb text not null default '' check (length(blurb) <= 200),
  minutes integer not null default 30 check (minutes between 1 and 1440),
  soak_hours numeric(4, 1) check (soak_hours is null or soak_hours between 0 and 48),
  serves integer not null default 4 check (serves between 1 and 50),
  effort text not null default 'easy' check (effort in ('easy', 'medium', 'weekend')),
  photo_path text,  -- R2 `s/` path (D-141), the founder's photo (D-203 answer 4)
  steps jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  content_status text not null default 'draft' check (content_status in ('draft', 'approved')),  -- D-012
  home_rank integer check (home_rank is null or home_rank > 0),  -- null = not on Home's window
  sort integer not null default 1000,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

-- Steps are [{text, minutes}] with minutes a number or null. A check can't hold a subquery, and a function in it would
-- need the writer's execute grant, so a JSON path.
alter table public.recipes add constraint recipes_steps_shape check (
  jsonb_typeof(steps) = 'array' and not jsonb_path_exists(steps,
    '$[*] ? (@.type() != "object" || !exists(@.text) || @.text.type() != "string" || @.text like_regex "^ *$"
             || (exists(@.minutes) && @.minutes.type() != "number" && @.minutes.type() != "null"))'));

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  sort integer not null default 0,
  label text not null check (length(label) between 1 and 80),
  amount text not null default '' check (length(amount) <= 40),
  source text not null check (source in ('iwc', 'local')),
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  match_words text not null default '' check (length(match_words) <= 120),
  grams_used numeric(8, 1) check (grams_used is null or grams_used > 0),  -- plan §8: a later cost-per-plate line
  constraint recipe_ingredients_local_has_no_listing
    check (source = 'iwc' or (product_id is null and variant_id is null))
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, sort);
create index recipe_ingredients_product_idx on public.recipe_ingredients (product_id) where product_id is not null;
create index recipes_home_idx on public.recipes (home_rank) where home_rank is not null;

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

-- An IWC line points at a food listing; its product follows its variant (rule 4 of the plan).
create function public._recipe_ingredient_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.variant_id is not null then
    select v.product_id into new.product_id from public.product_variants v where v.id = new.variant_id;
  end if;
  if new.product_id is not null
     and not exists (select 1 from public.products p where p.id = new.product_id and p.product_type = 'food') then
    raise exception 'recipe_line_not_food' using errcode = '23514',
      hint = 'A kit holds only food listings (D-203).';
  end if;
  return new;
end $$;
create trigger recipe_ingredients_guard before insert or update on public.recipe_ingredients
  for each row execute function public._recipe_ingredient_guard();

-- Why a recipe can't go live yet, or an empty array (the publish rule, plan §5.1). Kept in the database so the form
-- isn't the only guard.
create function public._recipe_blockers(p_id uuid) returns text[]
language sql stable security definer set search_path = public, pg_temp as $$
  select array_remove(array[
    case when r.content_status <> 'approved' then 'words_not_approved' end,
    case when r.photo_path is null then 'no_photo' end,
    case when not exists (select 1 from public.recipe_ingredients i where i.recipe_id = r.id and i.source = 'iwc')
         then 'no_iwc_line' end,
    case when exists (
           select 1 from public.recipe_ingredients i
           left join public.product_variants v on v.id = i.variant_id
           left join public.products p on p.id = v.product_id
           where i.recipe_id = r.id and i.source = 'iwc'
             and (v.id is null or not v.is_active or p.status <> 'live' or p.product_type <> 'food'))
         then 'line_without_live_listing' end], null)
  from public.recipes r where r.id = p_id;
$$;

-- The guard checks the new row's own photo and words (they may be set in the same update as the publish) and reads
-- the stored lines for the rest. Security definer: it runs inside the admin's write, and the blockers are the owner's
-- alone (no one else may call them).
create function public._recipe_publish_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_why text[] := '{}';
begin
  if new.status = 'live' and (tg_op = 'INSERT' or old.status is distinct from 'live') then
    if new.content_status <> 'approved' then v_why := v_why || 'words_not_approved'; end if;
    if new.photo_path is null then v_why := v_why || 'no_photo'; end if;
    v_why := v_why || coalesce(array(
      select x from unnest(public._recipe_blockers(new.id)) x
      where x not in ('words_not_approved', 'no_photo')), '{}');
    if tg_op = 'INSERT' then v_why := v_why || 'no_iwc_line'::text; end if;
    if cardinality(v_why) > 0 then
      raise exception 'recipe_not_ready: %', array_to_string(v_why, ', ') using errcode = '23514';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status <> 'live' then new.home_rank := null; end if;
  return new;
end $$;
create trigger recipes_publish_guard before insert or update on public.recipes
  for each row execute function public._recipe_publish_guard();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy admin_all on public.recipes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.recipe_ingredients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.recipes, public.recipe_ingredients from anon, authenticated;
grant select, insert, update, delete on public.recipes, public.recipe_ingredients to authenticated;
revoke all on function public._recipe_ingredient_guard(), public._recipe_blockers(uuid),
  public._recipe_publish_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Store reads (security definer, D-017). A line is available when its option is live, active and has stock.
-- ---------------------------------------------------------------------------------------------------------------

create function public._store_recipe_kit(p_id uuid) returns table (kit_cents integer, kit_count integer)
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(sv.price_cents), 0)::integer, count(sv.id)::integer
  from public.recipe_ingredients i
  join public.store_variants sv on sv.id = i.variant_id and sv.available > 0
  join public.store_products sp on sp.id = sv.product_id and sp.product_type = 'food'
  where i.recipe_id = p_id and i.source = 'iwc';
$$;
revoke all on function public._store_recipe_kit(uuid) from public, anon, authenticated;

-- Live recipes with approved words and at least one available piece, as cards (the shelf, More to cook).
create function public.store_recipes(p_kind text default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'slug', r.slug, 'name', r.name, 'kind', r.kind, 'blurb', r.blurb, 'minutes', r.minutes,
           'soak_hours', r.soak_hours, 'serves', r.serves, 'effort', r.effort, 'photo_path', r.photo_path,
           'region_slug', g.slug, 'region_name', g.name, 'kit_cents', k.kit_cents, 'kit_count', k.kit_count)
         order by r.sort, r.name), '[]'::jsonb)
  from public.recipes r
  left join public.regions g on g.id = r.region_id
  cross join lateral public._store_recipe_kit(r.id) k
  where r.status = 'live' and r.content_status = 'approved' and (not r.is_placeholder or public.dev_preview())
    and k.kit_count > 0 and (p_kind is null or r.kind = p_kind);
$$;

-- One recipe and its lines. An IWC line carries what the bag's line needs and nothing else from the product
-- (no shop, source or shop price: INV-1).
create function public.store_recipe(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'slug', r.slug, 'name', r.name, 'kind', r.kind, 'blurb', r.blurb, 'minutes', r.minutes,
    'soak_hours', r.soak_hours, 'serves', r.serves, 'effort', r.effort, 'photo_path', r.photo_path,
    'region_slug', g.slug, 'region_name', g.name, 'steps', r.steps, 'published_at', r.published_at,
    'updated_at', r.updated_at, 'kit_cents', k.kit_cents, 'kit_count', k.kit_count,
    'lines', coalesce((
      select jsonb_agg(case when i.source = 'local' then
               jsonb_build_object('source', 'local', 'label', i.label, 'amount', i.amount)
             else jsonb_build_object(
               'source', 'iwc', 'label', i.label, 'amount', i.amount,
               'available', sv.id is not null and sv.available > 0,
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
        -- an IWC line whose listing left the store shows as unavailable without its listing's words
        ), '[]'::jsonb))
  from public.recipes r
  left join public.regions g on g.id = r.region_id
  cross join lateral public._store_recipe_kit(r.id) k
  where r.slug = p_slug and r.status = 'live' and r.content_status = 'approved'
    and (not r.is_placeholder or public.dev_preview()) and k.kit_count > 0;
$$;

-- The recipe on Home's window: the lowest home_rank the shelf would show (Home is cached once: keep it small).
create function public._store_home_recipe() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('slug', r.slug, 'name', r.name, 'blurb', r.blurb, 'region_name', g.name,
                            'photo_path', r.photo_path, 'kit_cents', k.kit_cents)
  from public.recipes r
  left join public.regions g on g.id = r.region_id
  cross join lateral public._store_recipe_kit(r.id) k
  where r.home_rank is not null and r.status = 'live' and r.content_status = 'approved'
    and (not r.is_placeholder or public.dev_preview()) and k.kit_count > 0
  order by r.home_rank, r.sort, r.name
  limit 1;
$$;
revoke all on function public._store_home_recipe() from public, anon, authenticated;

revoke all on function public.store_recipes(text), public.store_recipe(text) from public;
grant execute on function public.store_recipes(text), public.store_recipe(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------------------------------------------

-- One recipe on Home's window at a time (plan §5.3): pinning one clears the rest; null clears all.
create function public.admin_pin_recipe(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_id is not null and not exists (select 1 from public.recipes where id = p_id and status = 'live') then
    raise exception 'recipe_not_live' using errcode = '23514';
  end if;
  update public.recipes set home_rank = null where home_rank is not null and id is distinct from p_id;
  if p_id is not null then
    update public.recipes set home_rank = 1 where id = p_id;
  end if;
end $$;

-- Why a recipe can't go live (the editor's kit-health strip).
create function public.admin_recipe_blockers(p_id uuid) returns text[]
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return coalesce(public._recipe_blockers(p_id), '{}');
end $$;

-- Live, in-stock food options whose names hold every word of the line's match words, cheapest first (Match).
create function public.admin_recipe_matches(p_words text, p_limit integer default 5) returns table (
  product_id uuid, variant_id uuid, product_name text, variant_label text, price_cents integer, available integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select p.id, v.id, p.name, v.label, coalesce(v.price_cents, p.price_cents),
         greatest(v.qty_listed - v.qty_reserved, 0)
  from public.products p
  join public.product_variants v on v.product_id = p.id and v.is_active
  where p.status = 'live' and p.product_type = 'food' and greatest(v.qty_listed - v.qty_reserved, 0) > 0
    and length(btrim(coalesce(p_words, ''))) > 0
    and not exists (
      select 1 from regexp_split_to_table(lower(btrim(p_words)), '\s+') w
      where position(w in lower(p.name)) = 0)
  order by coalesce(v.price_cents, p.price_cents), p.name
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
end $$;

-- Live recipes with a piece that is gone or sold out (Today's attention item, plan §5.1).
create function public.admin_recipes_missing_piece() returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select count(*)::integer from public.recipes r
  where public.is_admin() and r.status = 'live' and exists (
    select 1 from public.recipe_ingredients i
    left join public.product_variants v on v.id = i.variant_id
    left join public.products p on p.id = v.product_id
    where i.recipe_id = r.id and i.source = 'iwc'
      and (v.id is null or not v.is_active or p.status <> 'live' or v.qty_listed - v.qty_reserved <= 0));
$$;

revoke all on function public.admin_pin_recipe(uuid), public.admin_recipe_blockers(uuid),
  public.admin_recipe_matches(text, integer), public.admin_recipes_missing_piece() from public, anon;
grant execute on function public.admin_pin_recipe(uuid), public.admin_recipe_blockers(uuid),
  public.admin_recipe_matches(text, integer), public.admin_recipes_missing_piece() to authenticated;

-- store_home() as in 20261111090100_subcategories_popular_packs.sql, plus `recipe` (plan §5.1).
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
    -- D-203: the recipe on Home's middle window, or null (Home keeps today's windows: ship dark)
    'recipe', public._store_home_recipe()
  );
$$;

notify pgrst, 'reload schema';
