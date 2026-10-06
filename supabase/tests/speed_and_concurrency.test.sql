-- Speed and concurrency audit (migration 20261006230000): the stock feed only moves with stock, the region page
-- carries only the cards it draws plus the counts, See all in one call, search records once per search, light cards.
-- (Locking in create_order needs two sessions; it was checked by hand, see plan/current.md.)
begin;
select tests.setup();

-- The live stock feed: an edit that does not touch stock leaves its row alone; a stock change moves it.
select set_config('tests.feed_ctid', (select ctid::text from public.variant_availability
                                     where variant_id = tests.id('v_live')), true);
update public.product_variants set label = 'Free size (renamed)', qty_confirmed_at = now() where id = tests.id('v_live');
select tests.assert(
  (select ctid::text from public.variant_availability where variant_id = tests.id('v_live')) = current_setting('tests.feed_ctid'),
  'a label edit or re-confirmation does not rewrite (or broadcast) the stock feed');
update public.product_variants set qty_listed = qty_listed + 3 where id = tests.id('v_live');
select tests.assert(
  (select available from public.variant_availability where variant_id = tests.id('v_live'))
  = (select qty_listed - qty_reserved from public.product_variants where id = tests.id('v_live')),
  'a stock change still reaches the feed');
update public.product_variants set is_active = false where id = tests.id('v_live');
select tests.assert((select available from public.variant_availability where variant_id = tests.id('v_live')) = 0,
  'a deactivated variant shows 0 in the feed');
update public.product_variants set is_active = true where id = tests.id('v_live');

-- 14 more live pieces in the test clothing category and 2 in another: the category has 15 (more than a row).
insert into public.categories (product_type, slug, name) values ('clothing', 'test-second', 'Test second clothing');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
select 'test-many-' || lpad(n::text, 2, '0'), 'Test many ' || n, 'clothing', tests.id('region'), tests.id('cat_clothing'),
       tests.id('vendor'), 5000, 'live', now() - n * interval '1 hour'
from generate_series(1, 14) n;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
select 'test-second-' || n, 'Test second ' || n, 'clothing', tests.id('region'),
       (select id from public.categories where slug = 'test-second'), tests.id('vendor'), 3000, 'live',
       now() - interval '30 days' - n * interval '1 hour'
from generate_series(1, 2) n;

set local role anon;

-- Region page
select tests.assert(
  (select count(*) from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
   where c ->> 'category_slug' = 'test-clothing') = 12,
  'D-062: the region page carries only the first 12 cards of a category (it has 15)');
select tests.assert(
  (select count(*) from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
   where c ->> 'category_slug' = 'test-second') = 2,
  'an older, smaller category still has its cards (its own row), though they are not among the newest 12');
select tests.assert(
  (select (c ->> 'count')::int from jsonb_array_elements(public.store_region_page('test-region') -> 'category_counts') c
   where c ->> 'slug' = 'test-clothing') = 15
  and (select (c ->> 'count')::int from jsonb_array_elements(public.store_region_page('test-region') -> 'category_counts') c
       where c ->> 'slug' = 'test-second') = 2,
  'category_counts carries the real totals (for the pills and See all)');
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'products') with ordinality as x(c, ord))
  = (select array_agg(p.slug order by p.published_at desc nulls last, p.name)
     from public.store_products p where p.region_slug = 'test-region'
       and p.slug not in ('test-many-13', 'test-many-14', 'test-live')),
  'cards stay newest first; only the three oldest of the big category are left out (no date sorts last)');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
              where c ? 'summary' or c ? 'craft'),
  'cards carry no summary or craft (no card shows them)');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_region_page('test-region')) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields on the region page');

-- See all
select tests.assert(
  (public.store_browse('clothing', 'test-region', 'test-clothing') ->> 'total')::int = 15,
  'See all: the total of the filtered list');
select tests.assert(
  jsonb_array_length(public.store_browse('clothing', 'test-region', 'test-clothing') -> 'products') = 15
  and jsonb_array_length(public.store_browse('clothing', 'test-region', 'test-clothing', 0, 10) -> 'products') = 10,
  'See all: a page holds the whole list up to the limit, and at most the limit');
select tests.assert(
  (select count(distinct c ->> 'id') from (
     select jsonb_array_elements(public.store_browse('clothing', 'test-region', 'test-clothing', 0, 10) -> 'products') c
     union all
     select jsonb_array_elements(public.store_browse('clothing', 'test-region', 'test-clothing', 10, 10) -> 'products')) x) = 15,
  'See all: pages never repeat or skip a product');
select tests.assert(
  (select (c ->> 'count')::int from jsonb_array_elements(public.store_browse('clothing') -> 'regions') c
   where c ->> 'slug' = 'test-region')
  = (select count(*) from public.store_products where region_slug = 'test-region' and product_type = 'clothing'),
  'See all: each state with its count, for the state filter');
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_browse('clothing', 'test-region') -> 'categories') with ordinality as x(c, ord))
  @> array['test-clothing', 'test-second'],
  'See all: the categories within the chosen state, for the category filter');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_browse('clothing') -> 'products') c
              where c ->> 'slug' in ('test-draft', 'test-placeholder') or c ? 'available' or c ? 'quick_add'),
  'See all: live, non-placeholder pieces only, as light cards without stock');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_browse('clothing')) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields on See all');
select tests.assert((public.store_browse('nonsense') ->> 'total')::int = 0, 'an unknown type has nothing');

-- Search: 120 more pieces in another state, so a broad search finds more than 100.
reset role;
insert into public.regions (slug, name) values ('test-bulk-region', 'Test bulk region');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
select 'test-bulk-' || n, 'Test bulk ' || n, 'clothing', (select id from public.regions where slug = 'test-bulk-region'),
       tests.id('cat_clothing'), tests.id('vendor'), 1000, 'live'
from generate_series(1, 120) n;
set local role anon;
select tests.assert((select count(*) from public.store_search('test bulk', 0, 200, false)) = 120,
  'search pages may hold more than 100 (the website shows up to 480)');
select count(*) from public.store_search('test many');            -- first page: recorded
select count(*) from public.store_search('test many', 0, 48, false);  -- Show more: not again
select count(*) from public.store_search('test second');
reset role;
select tests.assert(
  (select array_agg(query order by id) from public.search_queries where created_at = now())
  = array['test many', 'test second'],
  'a "Show more" read (p_record = false) does not record the search again');

rollback;
