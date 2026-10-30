-- Imported pieces (D-171, migration 20261105100000): a Savana or NEWME piece made in China is listed with its country,
-- customers see only that it is not made in India, a shop's own usual days (10) are its delivery limit, and only the
-- worker sets a listing's country.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.pricing_settings set fx_inr_per_usd = 100, fx_auto = false where id = 1;

set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.sourcing_targets (name, query, product_type, category_id, region_id, tier, sites)
values ('Savana dresses', 'collection:12825 pages:1-3', 'clothing', tests.id('cat_clothing'), null, 1, '{savana.com}')
returning tests.remember('target', id);

select tests.act_as(tests.id('worker'));
select tests.assert((select bool_and(s ->> 'delivery_days' = '10')
                       from jsonb_array_elements(public.worker_sourcing_plan() -> 'shops') s
                      where s ->> 'site' in ('savana.com', 'newme.asia')), 'Savana and NEWME bring a piece in 10 days');
-- A Savana dress: its page promises no date, so the shop's 10 days apply (past Settings' 3).
select tests.remember('product', (public.worker_sourcing_add(tests.id('target'), jsonb_build_object(
  'site', 'savana.com', 'shop_label', 'Savana', 'page_url', 'https://www.savana.com/details/co-ord-set-2111972',
  'name', 'Apricot co-ord set', 'slug', 'apricot-co-ord-set-test', 'attributes', '{}'::jsonb,
  'variants', jsonb_build_array(
    jsonb_build_object('item_key', '1136346', 'item_url', 'https://www.savana.com/details/co-ord-set-2111972',
                       'label', 'Apricot · S', 'options', jsonb_build_object('colour', 'Apricot', 'size', 'S'),
                       'price_paise', 160600, 'mrp_paise', 189000, 'in_stock', true, 'delivery_days', null,
                       'weight_g', 600)))
  ) ->> 'product_id')::uuid);
select tests.assert(public.worker_set_origin(tests.id('product'), 'China'), 'the runner sets the country its page states');
select tests.assert_fails(format('select public.worker_set_origin(%L, %L)', tests.id('product'), ' '), 'origin_invalid',
  'a country is a name');
select tests.assert(not public.worker_set_origin(tests.id('p_live'), 'China'),
  'a listing the runner did not make keeps its country');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.worker_set_origin(%L, %L)', tests.id('product'), 'India'), 'worker_only',
  'customers cannot change a country');
reset role;

select tests.assert((select made_in from public.products where id = tests.id('product')) = 'China', 'stored as stated');
select tests.assert((select v.qty_listed > 0 and s.site = 'savana.com'
                       from public.product_variants v join public.product_sources s on s.id = v.source_id
                      where v.product_id = tests.id('product')),
  'a 10-day Savana source is used: its own days are its limit');
-- Amazon keeps Settings' 3 days: a 10-day Amazon backup is still too slow
select tests.assert(public._quick_sourceable(tests.id('product')) = false, 'not a 7-day piece');

-- Customers: "Imported", never "Made in India".
update public.products set status = 'live', published_at = now(), wears = 'women',
       attributes = '{"fibre_content": "Twill woven", "care": "Hand wash"}' where id = tests.id('product');
set local role anon;
select tests.assert((select made_in_india = false from public.store_products where id = tests.id('product')),
  'customers see it is not made in India');
select tests.assert((select made_in_india from public.store_products where id = tests.id('p_live')),
  'every other listing is still made in India');
select tests.assert((select count(*) = 0 from information_schema.columns
                      where table_schema = 'public' and table_name = 'store_products' and column_name = 'made_in'),
  'the country itself stays admin-only');
reset role;


rollback;
