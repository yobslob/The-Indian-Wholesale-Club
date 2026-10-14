-- All-India listings and the optional state (migration 20261014140000, D-121): no invented state, every state's page
-- and browse filter carry them after the state's own pieces, /states/india/<slug>, orders without a state, one online
-- vendor for all India, targets without a state; home & gifts priced from an estimated weight.
begin;
select tests.setup();

insert into public.regions (slug, name) values ('test-other-region', 'Test other region');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values ('test-all-india', 'Test all-India kurta', 'clothing', null, tests.id('cat_clothing'), tests.id('vendor'), 4500,
        'live', now() + interval '1 day');
select tests.remember('india', (select id from public.products where slug = 'test-all-india'));
insert into public.product_variants (product_id, sku, label, qty_listed) values (tests.id('india'), 'TEST-INDIA-1', 'M', 4);
select tests.remember('v_india', (select id from public.product_variants where sku = 'TEST-INDIA-1'));
update public.products set published_at = now() where id = tests.id('p_live');

set local role anon;
select tests.assert((select region_slug is null and region_name is null from public.store_products
                      where id = tests.id('india')), 'an all-India piece has no state, none invented');
select tests.assert(
  (select array_agg(c ->> 'slug' order by n)
     from jsonb_array_elements(public.store_region_page('test-region') -> 'products') with ordinality x(c, n))
  = array['test-live', 'test-all-india'],
  'a state''s page shows its own piece first, then the all-India one (even though the all-India one is newer)');
select tests.assert(
  (select count(*) from jsonb_array_elements(public.store_region_page('test-other-region') -> 'products') c
    where c ->> 'slug' = 'test-all-india') = 1,
  'the all-India piece fills every state, also one with nothing of its own');
select tests.assert(
  (select (c ->> 'count')::int from jsonb_array_elements(public.store_region_page('test-region') -> 'category_counts') c
    where c ->> 'slug' = 'test-clothing') = 2,
  'the state''s category count includes it');
select tests.assert(public.store_product_page('india', 'test-all-india') -> 'product' ->> 'name' = 'Test all-India kurta',
  'its page is /states/india/<slug>');
select tests.assert(public.store_product_page('test-region', 'test-all-india') is null,
  'it is not dressed up as a state''s piece');
select tests.assert((public.store_browse('clothing', 'test-other-region') ->> 'total')::int = 1,
  'browse filtered by any state includes it');
select tests.assert(
  (select bool_and(r ->> 'slug' is not null) from jsonb_array_elements(public.store_browse('clothing') -> 'regions') r),
  'the state list never shows "no state"');
select tests.assert(
  (select (r ->> 'count')::int from jsonb_array_elements(public.store_browse('clothing') -> 'regions') r
    where r ->> 'slug' = 'test-region') = 2,
  'a state''s count in browse includes the all-India pieces');
reset role;

-- An order of it keeps no state.
select tests.remember('o', (select order_id from public.create_order(jsonb_build_object(
  'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
  'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                         'state', 'TX', 'zipCode', '73301'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_india'), 'quantity', 1,
                                                'unit_price_cents', 4500)),
  'subtotal_cents', 4500, 'total_cents', 4500, 'payment_intent_id', 'pi_test_all_india'))));
select tests.assert((select region_name is null from public.order_items where order_id = tests.id('o')),
  'the order line has no state');

-- One online vendor for all India per shop; a state's online vendor stays its own.
select tests.assert(public._online_vendor('myntra.com', 'Myntra', null) = public._online_vendor('myntra.com', 'Myntra', null),
  'one all-India vendor per online shop');
select tests.assert(public._online_vendor('myntra.com', 'Myntra', null)
                    <> public._online_vendor('myntra.com', 'Myntra', tests.id('region')),
  'a state''s online vendor is another row');
select tests.assert_fails($$insert into public.vendors (shop_name, status) values ('No state, not online', 'active')$$,
  'vendors_region_or_online', 'a shop in person still needs its state');

-- Targets: all states, a shop list, a band; the same name twice for all states is one target.
insert into public.sourcing_targets (name, query, product_type, category_id, sites, min_price_paise, max_price_paise, listings)
values ('Kurta sets', 'kurta set women', 'clothing', tests.id('cat_clothing'), '{myntra.com}', 60000, 160000, 15);
select tests.assert_fails($$insert into public.sourcing_targets (name, query, product_type, category_id)
  values ('kurta sets', 'kurta set', 'clothing', '$$ || tests.id('cat_clothing') || $$')$$,
  'sourcing_targets_name_key', 'an all-states target name is unique');
select tests.assert_fails($$insert into public.sourcing_targets (name, query, product_type, category_id, min_price_paise, max_price_paise)
  values ('Odd band', 'x y', 'clothing', '$$ || tests.id('cat_clothing') || $$', 200000, 100000)$$,
  'sourcing_targets_band', 'a band runs low to high');

-- Home & gifts without a weight: shop ₹ × 1.5 g, at least 200 g, at most the category's weight.
insert into public.categories (product_type, slug, name, default_weight_g) values ('home', 'test-home', 'Test home', 1500);
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, shop_price_paise,
                             price_auto, status)
values ('test-basket', 'Test basket', 'home', null, (select id from public.categories where slug = 'test-home'),
        tests.id('vendor'), 100, 20000, true, 'draft');
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, 'TEST-BASKET-1', 'One size', 2 from public.products where slug = 'test-basket';
select tests.assert((select price_cents from public.products where slug = 'test-basket')
                    = public._auto_price_cents(20000, 300, 'home'),
  'a ₹200 basket is priced at 300 g, not the category''s 1.5 kg');
select tests.assert(public._auto_price_cents(20000, 300, 'home') < 2500
                    and public._auto_price_cents(20000, 1500, 'home') > 5000,
  'which is under $25 instead of over $50');
update public.products set shop_price_paise = 300000 where slug = 'test-basket';
select tests.assert((select price_cents from public.products where slug = 'test-basket')
                    = public._auto_price_cents(300000, 1500, 'home'),
  'a dear piece is never estimated heavier than its category');
update public.product_variants set weight_g = 800 where sku = 'TEST-BASKET-1';
select tests.assert((select price_cents from public.products where slug = 'test-basket')
                    = public._auto_price_cents(300000, 800, 'home'),
  'its own weight always wins');
update public.pricing_settings set home_est_g_per_rupee = null where id = 1;
select tests.assert(public._fallback_weight_g('home', 20000, (select id from public.categories where slug = 'test-home')) = 1500,
  'without the setting the category''s weight counts again');
select tests.assert(public._fallback_weight_g('clothing', 20000, tests.id('cat_clothing')) is not distinct from
                    (select default_weight_g from public.categories where id = tests.id('cat_clothing')),
  'clothing and food keep their category''s weight');

rollback;
