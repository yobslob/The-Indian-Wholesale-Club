-- =============================================================================
-- D-135: liquids are not sent (the founder: "insert a check if the scraped item is liquid put it in coming soon(which
-- has a like button instead of add) on frontend(in archives in backend) because we are not sending liquids but we are
-- sending pickles. Also move every live liquid product to archives."). A listing can be archived and still shown to
-- customers as "Coming soon": its card and page show it, with the heart (Save) and no price, Add or quick add; it
-- cannot be bought (store_variants and create_order keep to live listings).
--  - products.coming_soon (shown as coming soon while archived), coming_soon_note (why: "liquid: its name says
--    'juice'"), liquid_checked_at (the liquid check has looked at it: an admin who puts it back on sale is not undone).
--  - store_products and store_media include archived coming-soon listings; store_products ends with coming_soon;
--    _store_product_card and store_browse send it.
--  - worker_liquid_plan() and worker_set_liquids() (worker account only): the runner's check of every food and home
--    listing not yet checked; a liquid one is archived and shown as coming soon.
--  - Putting a listing back on sale (any status but archived) ends its coming soon.
-- =============================================================================

alter table public.products
  add column coming_soon boolean not null default false,
  add column coming_soon_note text check (char_length(coming_soon_note) <= 200),
  add column liquid_checked_at timestamptz;

comment on column public.products.coming_soon is
  'D-135: archived but shown to customers as "Coming soon" (the heart, no price, cannot be bought)';

create function public._coming_soon_status() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status <> 'archived' and new.coming_soon then
    new.coming_soon := false;
  end if;
  return new;
end $$;
revoke all on function public._coming_soon_status() from public, anon, authenticated;

create trigger products_coming_soon
  before insert or update of status, coming_soon on public.products
  for each row execute function public._coming_soon_status();

-- As 20261014140000_all_india_and_bands, with archived coming-soon listings and coming_soon appended.
create or replace view public.store_products as
select p.id, p.slug, p.name, p.product_type,
       p.region_id, r.slug as region_slug, r.name as region_name,
       p.category_id, c.slug as category_slug, c.name as category_name,
       p.summary, p.description, p.story, p.craft, p.attributes, p.price_cents, p.published_at,
       (select m.storage_path from public.product_media m
         where m.product_id = p.id order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
       p.search,
       p.is_curated,
       p.is_us_stock,
       (p.status = 'archived') as coming_soon
from public.products p
left join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where (p.status = 'live' or (p.status = 'archived' and p.coming_soon))
  and (not p.is_placeholder or public.dev_preview());

-- As 20261010120300_photo_review, with archived coming-soon listings.
create or replace view public.store_media as
select m.id, m.product_id, m.variant_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary, m.credit, m.is_ai
from public.product_media m
join public.products p on p.id = m.product_id
where (p.status = 'live' or (p.status = 'archived' and p.coming_soon))
  and (not p.is_placeholder or public.dev_preview());

-- As 20261014160000_food_share_footwear_pack, with coming_soon (and no quick add or price for it).
CREATE OR REPLACE FUNCTION public._store_product_card(p_product_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
    'region_slug', p.region_slug, 'region_name', p.region_name,
    'category_slug', p.category_slug, 'category_name', p.category_name,
    'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path, 'published_at', p.published_at,
    'pack', public._store_pack(p.id, p.name, p.product_type),
    'available', v.available,
    'coming_soon', p.coming_soon,
    -- With exactly one variant, max() is that variant.
    'quick_add', case when v.n = 1 and v.available > 0 and not p.coming_soon
                      then jsonb_build_object('variant_id', v.one_id, 'label', v.one_label, 'price_cents', v.one_price)
                 end)
  from public.store_products p
  cross join lateral (
    select coalesce(sum(sv.available), 0)::integer as available, count(*) as n,
           max(sv.id::text) as one_id, max(sv.label) as one_label, max(sv.price_cents) as one_price
    from public.store_variants sv
    where sv.product_id = p.id) v
  where p.id = p_product_id;
$function$;

-- As 20261014160000_food_share_footwear_pack, with coming_soon on each product.
CREATE OR REPLACE FUNCTION public.store_browse(p_type text, p_region text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with typed as (
    select p.id, p.slug, p.name, p.product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.primary_image_path, p.published_at, p.coming_soon
    from public.store_products p
    where p.product_type::text = p_type),
  in_region as (select * from typed where p_region is null or region_slug = p_region or region_slug is null),
  shown as (select * from in_region where p_category is null or category_slug = p_category)
  select jsonb_build_object(
    'total', (select count(*) from shown),
    -- D-122: everything of the type (the states' counts each include the all-India pieces)
    'all_total', (select count(*) from typed),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.region_slug, 'name', g.region_name,
                                'count', g.n + (select count(*) from typed where region_slug is null))
             order by g.region_name)
      from (select region_slug, region_name, count(*) as n from typed where region_slug is not null
            group by region_slug, region_name) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.category_slug, 'name', g.category_name, 'count', g.n)
                       order by g.n desc, g.category_name)
      from (select category_slug, category_name, count(*) as n from in_region group by category_slug, category_name) g),
      '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'slug', s.slug, 'name', s.name, 'product_type', s.product_type,
               'region_slug', s.region_slug, 'region_name', s.region_name,
               'category_slug', s.category_slug, 'category_name', s.category_name,
               'price_cents', s.price_cents, 'primary_image_path', s.primary_image_path,
               'pack', public._store_pack(s.id, s.name, s.product_type),
               'coming_soon', s.coming_soon)
             order by s.published_at desc nulls last, s.name, s.id)
      from (select * from shown
            order by published_at desc nulls last, name, id   -- id last: pages never repeat or skip a product
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) s), '[]'::jsonb));
$function$;

-- -----------------------------------------------------------------------------
-- The liquid check (D-135): food and home listings not yet checked (p_all: every one not archived by hand),
-- 200 at most per call in id order after p_after.
-- -----------------------------------------------------------------------------
create function public.worker_liquid_plan(p_after uuid default null, p_limit integer default 200,
                                          p_all boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'product_id', p.id, 'name', p.name, 'product_type', p.product_type, 'status', p.status,
             'labels', (select coalesce(jsonb_agg(v.label order by v.sort_order, v.label), '[]'::jsonb)
                          from public.product_variants v where v.product_id = p.id))
           order by p.id)
      from (select p.* from public.products p
             where p.product_type in ('food', 'home') and not p.is_placeholder and not p.is_us_stock
               and (p.status <> 'archived' or p.coming_soon)
               and (p_all or p.liquid_checked_at is null)
               and (p_after is null or p.id > p_after)
             order by p.id
             limit least(greatest(p_limit, 0), 200)) p), '[]'::jsonb);
end $$;
revoke all on function public.worker_liquid_plan(uuid, integer, boolean) from public, anon;
grant execute on function public.worker_liquid_plan(uuid, integer, boolean) to authenticated;

-- p_items: [{product_id, liquid, note}], 500 at most. Every one is marked checked; a liquid one not yet archived is
-- archived and shown as coming soon. Returns how many were archived.
create function public.worker_set_liquids(p_items jsonb)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  w jsonb;
  v_n integer := 0;
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'items_invalid' using errcode = 'P0001';
  end if;
  for w in select * from jsonb_array_elements(p_items) loop
    if coalesce((w ->> 'liquid')::boolean, false) then
      update public.products p
         set status = 'archived', coming_soon = true, liquid_checked_at = now(),
             coming_soon_note = left('Liquid: ' || coalesce(nullif(w ->> 'note', ''), 'not sent') || ' (D-135)', 200)
       where p.id = nullif(w ->> 'product_id', '')::uuid and p.product_type in ('food', 'home')
         and not p.is_placeholder and (p.status <> 'archived' or p.coming_soon)
         and not (p.status = 'archived' and p.coming_soon);
      if found then
        v_n := v_n + 1;
        continue;
      end if;
    end if;
    update public.products set liquid_checked_at = now()
     where id = nullif(w ->> 'product_id', '')::uuid and product_type in ('food', 'home');
  end loop;
  return v_n;
end $$;
revoke all on function public.worker_set_liquids(jsonb) from public, anon;
grant execute on function public.worker_set_liquids(jsonb) to authenticated;
