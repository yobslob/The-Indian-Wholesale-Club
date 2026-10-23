-- D-154 step 4: the 7-day store (migration 20261026090000). See all's "Delivery: in 7 days" and its count, the 7-day
-- store's search, its front page (tiles, Most ordered this week, Under $5, New this week) and the store's 7-day line.
-- No shop ever reaches the customer (D-003).
begin;
select tests.setup();

update public.pricing_settings
   set quick_delivery_days_min = 7, quick_delivery_days_max = 7, food_cleared = true, quick_delivery_min_cents = 4999,
       quick_delivery_paused = false
 where id = 1;
insert into public.categories (product_type, slug, name) values ('food', 'qs-snacks', 'Snacks')
  on conflict (slug) do nothing;
insert into public.categories (product_type, slug, name) values ('food', 'qs-tea', 'Tea')
  on conflict (slug) do nothing;

-- Three Blinkit pieces (two snacks, one tea) and one food piece from a shop in India.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, source_url, source_site)
select s, n, 'food', null, (select id from public.categories where slug = c), tests.id('vendor'), cents, 'live',
       now() - (age || ' days')::interval, 'https://blinkit.com/prn/x/prid/' || s, site
  from (values ('qs-chips', 'Qsearch banana chips', 'qs-snacks', 399, 1, 'blinkit.com'),
               ('qs-mixture', 'Qsearch mixture', 'qs-snacks', 899, 20, 'blinkit.com'),
               ('qs-chai', 'Qsearch chai', 'qs-tea', 649, 2, 'blinkit.com'),
               ('qs-halwa', 'Qsearch halwa', 'qs-snacks', 450, 1, 'shop.example.in')) v(s, n, c, cents, age, site);
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, upper(slug), '100 g', 5, 100 from public.products where slug like 'qs-%';
insert into public.product_media (product_id, storage_path, is_primary)
select id, 'qs/' || slug || '.jpg', true from public.products where slug like 'qs-%';

select tests.assert(
  has_function_privilege('anon', 'public.store_quick_front()', 'execute')
  and has_function_privilege('anon', 'public.store_browse(text, text, text, integer, integer, integer, integer, text, text, text, boolean)', 'execute')
  and has_function_privilege('anon', 'public.store_search(text, integer, integer, boolean, boolean)', 'execute'),
  'customers read the 7-day store through store_* only (D-017)');

-- See all: the filter and its count
create temp table sa on commit drop as
  select public.store_browse('food', null, null, 0, 24) as plain,
         public.store_browse('food', null, null, 0, 24, null, null, null, null, null, true) as quick;
select tests.assert((select (plain ->> 'quick_total')::int = 3 from sa), 'See all counts the 7-day pieces for the filter');
select tests.assert(
  (select array_agg(p ->> 'slug' order by p ->> 'slug') from sa, jsonb_array_elements(quick -> 'products') p
    where p ->> 'slug' like 'qs-%') = array['qs-chai', 'qs-chips', 'qs-mixture']
  and (select (quick ->> 'total')::int = 3 from sa),
  'Delivery: in 7 days shows only the 7-day pieces');
select tests.assert(
  (select (c ->> 'count')::int from sa, jsonb_array_elements(quick -> 'categories') c where c ->> 'slug' = 'qs-snacks') = 2,
  'the other filters count within the 7-day pieces');
select tests.assert(
  (select (plain ->> 'all_total') = (quick ->> 'all_total') from sa),
  'the page''s own total stays the whole type (an empty filter never empties the page)');
select tests.assert(
  (select count(*) from sa, jsonb_array_elements(plain -> 'products') p where p ->> 'slug' = 'qs-halwa') = 1,
  'without the filter every piece is there');

-- Search
select tests.assert((select count(*) from public.store_search('qsearch', 0, 24, false)) = 4
  and (select count(*) from public.store_search('qsearch', 0, 24, false, true)) = 3
  and not exists (select 1 from public.store_search('qsearch halwa', 0, 24, false, true)),
  'the 7-day store''s search finds only 7-day pieces');

-- The front page
create temp table qf on commit drop as select public.store_quick_front() as f;
select tests.assert((select (f ->> 'days_max')::int = 7 and (f ->> 'min_cents')::int = 4999 and (f ->> 'total')::int = 3
                     from qf), 'the front page: its days, its line and its count');
select tests.assert(
  (select jsonb_agg(c - 'count' order by c ->> 'slug') from qf, jsonb_array_elements(f -> 'categories') c)
  = '[{"slug": "qs-snacks", "name": "Snacks", "image_path": "qs/qs-chips.jpg"},
      {"slug": "qs-tea", "name": "Tea", "image_path": "qs/qs-chai.jpg"}]'::jsonb,
  'tiles: each category with the photo of its newest piece');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n) from qf, jsonb_array_elements(f -> 'under_5') with ordinality x(p, n))
  = array['qs-chips'], 'Under $5: the 7-day pieces under $5, cheapest first');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n) from qf, jsonb_array_elements(f -> 'new_this_week') with ordinality x(p, n))
  = array['qs-chips', 'qs-chai'], 'New this week: listed in the last 7 days, newest first');
select tests.assert((select f -> 'most_ordered' = '[]'::jsonb from qf), 'Most ordered: empty with no orders this week');
select tests.assert((select f::text !~* 'blinkit|shop\.example|source|weight' from qf), 'the front page names no shop (D-003)');

-- A paid order this week puts its piece first in Most ordered
insert into public.orders (order_number, email, status, payment_status, subtotal_cents, total_cents, shipping_address)
values ('IWC-QS-1', 'qs@example.test', 'confirmed', 'paid', 1298, 1298, '{"line1": "1 Main St"}'::jsonb);
insert into public.order_items (order_id, variant_id, product_id, product_name, variant_label, region_name, quantity,
                                unit_price_cents, total_price_cents)
select (select id from public.orders where order_number = 'IWC-QS-1'), v.id, p.id, p.name, v.label, 'India', 2, 649, 1298
  from public.products p join public.product_variants v on v.product_id = p.id where p.slug = 'qs-chai';
select tests.assert(
  (select jsonb_agg(p ->> 'slug') from jsonb_array_elements(public.store_quick_front() -> 'most_ordered') p)
  = '["qs-chai"]'::jsonb,
  'Most ordered this week: by units ordered, the counts never shown');

-- The policy and the pause
select tests.assert(
  (select (p ->> 'quick_delivery_min_cents')::int = 4999 and (p ->> 'quick_delivery_on')::boolean from public.store_policy() p),
  'the store''s policy carries the 7-day line and that the store is open');
update public.pricing_settings set quick_delivery_paused = true where id = 1;
select tests.assert(public.store_quick_front() is null
  and not (select (p ->> 'quick_delivery_on')::boolean from public.store_policy() p)
  and (select (public.store_browse('food') ->> 'quick_total')::int) = 0,
  'paused: no 7-day store, and no piece counts as 7-day');

rollback;
