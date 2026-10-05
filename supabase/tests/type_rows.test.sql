-- store_type_rows (migration 18): one row per category with its total and at most 12 cards, customer-safe.
begin;
select tests.setup();

-- 14 more live pieces in the test clothing category, so the row has more than 12.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
select 'test-many-' || n, 'Test many ' || n, 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
       5000, 'live'
from generate_series(1, 14) n;

set local role anon;
select tests.assert(
  (select (r ->> 'count')::int = 15 and jsonb_array_length(r -> 'products') = 12
   from jsonb_array_elements(public.store_type_rows('clothing')) r where r ->> 'slug' = 'test-clothing'),
  'D-062: a row carries its total and only the first 12 cards');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_type_rows('clothing')) r,
                            jsonb_array_elements(r -> 'products') c
              where c ->> 'slug' in ('test-draft', 'test-placeholder')),
  'drafts and placeholders never appear (store_products only)');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_type_rows('clothing')) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields');
select tests.assert(public.store_type_rows('nonsense') = '[]'::jsonb, 'an unknown type has no rows');
reset role;

rollback;
