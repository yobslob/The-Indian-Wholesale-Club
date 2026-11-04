-- The product page's Similar items and Curated for you read through their indexes (migration
-- 20261108090400_product_page_reads): the same lists in the same order, also for an all-India piece, whose state
-- (none) matches only all-India pieces.
begin;
select tests.setup();
-- Generic test clothing: D-140's "who it is for" rule has its own test (wears_and_rows.test.sql).
alter table public.products disable trigger products_wears;

insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status,
                             published_at, is_curated)
values
  ('pr-india', 'All-India piece', 'clothing', null, tests.id('cat_clothing'), 4000, 'live',
   now() - interval '3 days', false),
  ('pr-india-old', 'All-India, older', 'clothing', null, tests.id('cat_clothing'), 4000, 'live',
   now() - interval '5 days', true),
  ('pr-india-new', 'All-India, newer', 'clothing', null, tests.id('cat_clothing'), 4000, 'live',
   now() - interval '1 day', true),
  ('pr-state-newest', 'A state''s piece, newest of all', 'clothing', tests.id('region'), tests.id('cat_clothing'),
   4000, 'live', now() + interval '1 day', true);

set local role anon;
select tests.assert(
  (select array_agg(c ->> 'slug' order by n)
     from jsonb_array_elements(public.store_product_page('india', 'pr-india') -> 'similar') with ordinality x(c, n))
  = (select (array['pr-india-new', 'pr-india-old']
             || array_agg(o.slug order by o.published_at desc nulls last, o.name))[1:12]
       from public.store_products o
      where o.category_id = tests.id('cat_clothing') and o.region_id is not null),
  'an all-India piece''s similar items: the all-India ones newest first, then the states'' (even a newer one)');
select tests.assert(
  (select array_agg(c ->> 'slug' order by n)
     from jsonb_array_elements(public.store_product_page('india', 'pr-india') -> 'curated') with ordinality x(c, n))
  = array['pr-india-new', 'pr-india-old'],
  'an all-India piece''s curated: only curated all-India pieces, newest first, never a state''s');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(
                public.store_product_page('test-region', 'pr-state-newest') -> 'curated') c
              where c ->> 'slug' like 'pr-india%'),
  'a state''s piece''s curated: none from all India');
reset role;

rollback;
