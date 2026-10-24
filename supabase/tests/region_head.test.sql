-- A state's page head (migration 20261029090000, D-157): the region, its album, each type's count, Most wanted and
-- Picked for you, as store_region_page() gives them, without the card lists; anon may read it; nothing internal.
begin;
select tests.setup();
-- Generic test clothing: D-140's "who it is for" rule has its own test (wears_and_rows.test.sql).
alter table public.products disable trigger products_wears;

-- An all-India piece and a curated one in the test region
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, is_placeholder, is_curated)
values
  ('rh-all-india', 'From all of India', 'clothing', null, tests.id('cat_clothing'), tests.id('vendor'), 3000, 'live',
   now() - interval '1 day', false, false),
  ('rh-curated', 'Picked', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'live',
   now(), false, true);
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, upper(slug), 'Free size', 5 from public.products where slug like 'rh-%';
insert into public.region_photos (region_id, storage_path, alt_text, sort_order)
  values (tests.id('region'), 'regions/test-region/album/a.jpg', 'First photo', 1);

set local role anon;
select tests.assert(public.store_region_head('test-region') is not null, 'anon reads a state''s head');
select tests.assert(public.store_region_head('no-such-state') is null, 'an unknown state has none');
select tests.assert(
  (select array_agg(k order by k) from jsonb_object_keys(public.store_region_head('test-region')) k)
  = array['album', 'curated', 'most_wanted', 'region', 'type_counts'],
  'the head only: no card lists (products, category_counts, leaving_soon)');
select tests.assert(
  public.store_region_head('test-region') -> 'region' = public.store_region_page('test-region') -> 'region'
  and public.store_region_head('test-region') -> 'album' = public.store_region_page('test-region') -> 'album'
  and public.store_region_head('test-region') -> 'curated' = public.store_region_page('test-region') -> 'curated'
  and public.store_region_head('test-region') -> 'most_wanted' = public.store_region_page('test-region') -> 'most_wanted',
  'its region, album, Picked for you and Most wanted are store_region_page''s');
select tests.assert(
  (public.store_region_head('test-region') -> 'curated' -> 0 ->> 'slug') = 'rh-curated',
  'Picked for you holds the curated piece');
select tests.assert(
  (public.store_region_head('test-region') -> 'type_counts' ->> 'clothing')::int
  = (select count(*) from public.store_products p
     where p.product_type = 'clothing'
       and (p.region_id = tests.id('region') or p.region_id is null)),
  'each type''s count is the state''s own pieces and the all-India ones (D-121)');
select tests.assert(
  (select count(*) from jsonb_object_keys(public.store_region_head('test-region') -> 'type_counts'))
  = (select count(*) from unnest(enum_range(null::public.product_type))),
  'every type has a count, 0 when it has none');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_region_head('test-region')) k where k = any (tests.forbidden_keys())),
  'INV-1: nothing internal in the head');
reset role;

rollback;
