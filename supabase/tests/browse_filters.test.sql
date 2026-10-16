-- See all's filters and Home's per-type Just listed (migration 20261016210000, D-136): store_browse() narrows by price,
-- size (food's pack counts as a size) and sorts by price, each filter's counts with the other filters applied;
-- store_home() lists the newest of each type; Download Excel follows the admin's Products filters.
begin;
select tests.setup();

insert into public.categories (product_type, slug, name) values ('home', 'test-home', 'Test home');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values ('bf-cheap', 'BF cheap cushion', 'home', tests.id('region'), (select id from public.categories where slug = 'test-home'),
        tests.id('vendor'), 1500, 'live', now() - interval '2 days'),
       ('bf-mid', 'BF mid cushion', 'home', tests.id('region'), (select id from public.categories where slug = 'test-home'),
        tests.id('vendor'), 4000, 'live', now() - interval '1 day'),
       ('bf-dear', 'BF dear cushion', 'home', tests.id('region'), (select id from public.categories where slug = 'test-home'),
        tests.id('vendor'), 9000, 'live', now());
insert into public.product_variants (product_id, sku, label, options, qty_listed)
select id, 'BF-' || slug || '-' || s, s, jsonb_build_object(case when slug = 'bf-dear' then 'pack' else 'size' end, s), 2
  from public.products, unnest(case slug when 'bf-cheap' then array['Small'] when 'bf-mid' then array['Small', 'Large']
                                         else array['Large'] end) s
 where slug like 'bf-%';

set local role anon;
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('home', 'test-region') -> 'products') with ordinality x(p, n)
    where p ->> 'slug' like 'bf-%') = array['bf-dear', 'bf-mid', 'bf-cheap'],
  'newest first, as before');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('home', 'test-region', null, 0, 24, null, null, null, 'price-asc')
                               -> 'products') with ordinality x(p, n)
    where p ->> 'slug' like 'bf-%') = array['bf-cheap', 'bf-mid', 'bf-dear'],
  'price: low to high');
select tests.assert(
  (select (b ->> 'total')::int = 1 and b -> 'products' -> 0 ->> 'slug' = 'bf-mid'
     from public.store_browse('home', 'test-region', 'test-home', 0, 24, 2000, 5000) b),
  'a price range keeps only the pieces inside it');
select tests.assert(
  (select (b ->> 'total')::int from public.store_browse('home', 'test-region', 'test-home', 0, 24, null, null, 'Large') b) = 2,
  'a size matches any option, and food''s pack counts as one (bf-dear has a Large pack)');
select tests.assert(
  (select (b ->> 'total')::int from public.store_browse('home', 'test-region', 'test-home', 0, 24, null, null, 'Small|Large') b) = 3,
  'two sizes: either one');
select tests.assert(
  (select (s ->> 'count')::int from jsonb_array_elements(
     public.store_browse('home', 'test-region', 'test-home', 0, 24, null, null, 'Large') -> 'sizes') s
    where s ->> 'value' = 'Small') = 2,
  'the size counts ignore the size chosen (Small still shows its 2 pieces)');
select tests.assert(
  (select (b -> 'prices' ->> 'min')::int = 1500 and (b -> 'prices' ->> 'max')::int = 9000
     from public.store_browse('home', 'test-region', 'test-home', 0, 24, 2000, 5000) b),
  'the price bounds ignore the price chosen, so the slider keeps its whole track');
select tests.assert(
  (select (c ->> 'count')::int from jsonb_array_elements(
     public.store_browse('home', 'test-region', null, 0, 24, 2000, 5000) -> 'categories') c
    where c ->> 'slug' = 'test-home') = 1,
  'the category counts follow the price chosen');
select tests.assert(
  (select (b ->> 'states_total')::int <= (b ->> 'all_total')::int
     from public.store_browse('home', null, null, 0, 24, 2000, 5000) b),
  'All states counts the filtered pieces; all_total stays everything (the app)');
select tests.assert(
  (select p ->> 'slug' from jsonb_array_elements(public.store_home() -> 'just_listed_types' -> 'home') p
    where p ->> 'slug' like 'bf-%' limit 1) = 'bf-dear',
  'Home lists the newest of each type');
select tests.assert(
  (select bool_and(p ->> 'product_type' = 'home')
     from jsonb_array_elements(public.store_home() -> 'just_listed_types' -> 'home') p),
  'each type''s list holds only that type');
reset role;

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select count(*) from public.admin_price_sheet(null, false, null, 'home', tests.id('region'), false,
                                                 (select id from public.categories where slug = 'test-home'),
                                                 tests.id('vendor'), 2000, 5000)) = 1,
  'Download Excel follows the Products filters (type, state, category, shop, price)');
select tests.assert(
  (select count(*) from public.admin_price_sheet(null, false, null, 'home', null, true)
    where name like 'BF %') = 0,
  'All-India exports only pieces without a state');
reset role;

rollback;
