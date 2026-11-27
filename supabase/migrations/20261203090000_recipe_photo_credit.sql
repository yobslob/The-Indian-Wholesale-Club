-- D-214 (founder 2026-11-27, "Yes, with credits"): a recipe photo found on Openverse (Flickr, Wikimedia Commons)
-- under CC BY or BY-SA is shown with its credit: title, author, where it is published, licence. Set with the photo by
-- Admin -> Recipes -> Add photos by name (from the runner's credits.csv); a photo pushed without one clears it.
-- Database size: one small object per recipe with such a photo (925 at most).

alter table public.recipes add column photo_credit jsonb
  check (photo_credit is null or (jsonb_typeof(photo_credit) = 'object' and photo_credit ? 'author'
         and photo_credit ? 'licence' and photo_credit ? 'source_url' and octet_length(photo_credit::text) <= 2000));

comment on column public.recipes.photo_credit is
  'D-214: the photo''s credit when its licence asks for one: {title, author, source_url, licence, licence_url}.';

-- One recipe and its lines. A main IWC line whose listing isn't in the store reads as a local line (buy it down the
-- road); a sold-out one stays in the kit as unavailable; a swap shows only when it can be bought.
create or replace function public.store_recipe(p_slug text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'slug', r.slug, 'name', r.name, 'kind', r.kind, 'blurb', r.blurb, 'minutes', r.minutes,
    'soak_hours', r.soak_hours, 'serves', r.serves, 'effort', r.effort, 'photo_path', r.photo_path,
    'photo_credit', r.photo_credit,
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

notify pgrst, 'reload schema';
