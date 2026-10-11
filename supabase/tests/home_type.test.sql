-- Home & gifts (D-106, migrations 36–37): the third product type, taxed as general goods, sold like the others.
begin;
select tests.setup();

select tests.assert(
  (select count(*) = 3 and bool_and(tax_class = 'general') from public.categories where product_type = 'home'),
  'D-106: three home categories, each taxed as general goods');

insert into public.categories (product_type, slug, name, sort_order) values ('home', 'test-home', 'Test home', 9);
select tests.assert((select tax_class = 'general' from public.categories where slug = 'test-home'),
  'D-106: a new home category is taxed as general goods by default');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
select 'test-home-piece', 'Test home piece', 'home', tests.id('region'), c.id, tests.id('vendor'), 5000, 'live'
from public.categories c where c.slug = 'test-home';
select tests.assert(
  (select value <> '' from public.business_details where key = 'hs_home'),
  'D-106: shipping documents have an HS code row for home & gifts');

set local role anon;
select tests.assert(
  exists (select 1 from public.store_products where slug = 'test-home-piece' and product_type = 'home'),
  'D-106: a live home piece is in the store');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.store_type_rows('home')) r where r ->> 'slug' = 'test-home'),
  'D-106: Home & gifts has its category rows');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_type_rows('home')) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields');
reset role;

rollback;
