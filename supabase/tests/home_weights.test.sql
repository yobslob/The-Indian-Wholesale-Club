-- Home & gifts weights from their pages (migration 20261016180000, D-134): the worker reads the home listings whose
-- weights to read (none, unrecorded, a matching item's, an estimate) with every page each option is on, and writes
-- what the page states (shop), the piece plus its packing (packed) or another option's (similar); never over the
-- hub's scale or an admin, never on food or clothing; a matching item's weight never over a page's own; customers
-- never see any of it; the runner's new home option keeps its packed weight.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.pricing_settings set beta_pricing = true where id = 1;

insert into public.categories (product_type, slug, name, default_weight_g)
values ('home', 'hw-decor', 'HW decor', 1500) returning tests.remember('cat_home', id);
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             price_auto, shop_price_paise, source_url, source_site)
values ('hw-diya', 'Brass Kerala diya', 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 2000,
        'draft', true, 50000, 'https://www.amazon.in/dp/B0HW000001', 'amazon.in'),
       ('hw-food', 'HW bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft',
        true, 20000, null, null);
select tests.remember('diya', (select id from public.products where slug = 'hw-diya'));
select tests.remember('food', (select id from public.products where slug = 'hw-food'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source,
                                     shop_price_paise)
values (tests.id('diya'), 'HW-S', 'Small', '{"size": "Small"}', 5, null, null, 50000),
       (tests.id('diya'), 'HW-M', 'Medium', '{"size": "Medium"}', 5, 300, null, 60000),
       (tests.id('diya'), 'HW-L', 'Large', '{"size": "Large"}', 5, 900, 'weighed', 90000),
       (tests.id('diya'), 'HW-X', 'XL', '{"size": "XL"}', 5, 400, 'estimated', 99000),
       (tests.id('food'), 'HW-F', '200 g', '{"pack": "200 g"}', 5, 200, null, null);
select tests.remember('vs', (select id from public.product_variants where sku = 'HW-S'));
select tests.remember('vm', (select id from public.product_variants where sku = 'HW-M'));
select tests.remember('vl', (select id from public.product_variants where sku = 'HW-L'));
select tests.remember('vx', (select id from public.product_variants where sku = 'HW-X'));
select tests.remember('vf', (select id from public.product_variants where sku = 'HW-F'));
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise, in_stock)
values (tests.id('diya'), tests.id('vs'), 'amazon.in', 'https://www.amazon.in/dp/B0HW000001',
        'https://www.amazon.in/dp/B0HW000001', 'B0HW000001', 50000, true),
       (tests.id('diya'), tests.id('vm'), 'amazon.in', 'https://www.amazon.in/dp/B0HW000001',
        'https://www.amazon.in/dp/B0HW000002', 'B0HW000002', 60000, true);
create temp table before_price on commit drop as
  select price_cents from public.product_variants where id = tests.id('vm');

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_home_plan()', 'worker_only', 'an admin cannot read the home plan');
select tests.assert_fails('select public.worker_set_home_weights(''[]'')', 'worker_only', 'nor write home weights');

-- What to read: the home listing with each option's own page; not the food one.
select tests.act_as(tests.id('worker'));
create temp table plan_rows on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_home_plan(200)) p;
select tests.assert(exists (select 1 from plan_rows where id = tests.id('diya'))
                    and not exists (select 1 from plan_rows where id = tests.id('food')),
  'the plan has home only');
select tests.assert((select jsonb_array_length(p -> 'sources') = 2 and p ->> 'page_url' like 'https://www.amazon.in/%'
                       from plan_rows where id = tests.id('diya')),
  'with every page an option is on');

-- Writing: missing, unrecorded and estimated weights take the page's; the hub's stays; food is never touched.
select tests.assert(public.worker_set_home_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 640, 'source', 'shop', 'note', 'Package Dimensions: 30 x 20 x 10 cm; 640 g (D-134)'),
    jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 820, 'source', 'packed', 'note', 'Item Weight: 700 g + box and wrapping 144 g (D-134)'),
    jsonb_build_object('variant_id', tests.id('vl'), 'weight_g', 500, 'source', 'shop', 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('vx'), 'weight_g', 640, 'source', 'similar', 'note', 'Another option''s page'),
    jsonb_build_object('variant_id', tests.id('vf'), 'weight_g', 500, 'source', 'shop', 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 640, 'source', 'weighed', 'note', 'x'))) = 3,
  'three home options took their page''s weight; the weighed one, the food one and a bad source did not');
reset role;
select tests.assert((select weight_g = 640 and weight_source = 'shop' from public.product_variants where id = tests.id('vs'))
                    and (select weight_g = 820 and weight_source = 'packed' from public.product_variants where id = tests.id('vm'))
                    and (select weight_g = 640 and weight_source = 'similar' from public.product_variants where id = tests.id('vx')),
  'the page''s weight, the piece plus its packing, and another option''s, each marked');
select tests.assert((select weight_g = 900 and weight_source = 'weighed' from public.product_variants where id = tests.id('vl')),
  'the hub''s scale is never replaced');
select tests.assert((select weight_g = 200 and weight_source is null from public.product_variants where id = tests.id('vf')),
  'food is not touched');
select tests.assert((select v.price_cents > b.price_cents from public.product_variants v, before_price b where v.id = tests.id('vm')),
  'the option is repriced on its weight (D-128)');

-- Once read: not asked again (unless all); another option's weight never replaces a page's own.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(public.worker_set_home_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 300, 'source', 'similar', 'note', 'matching items'))) = 0,
  'a matching item''s weight does not replace the page''s');
select tests.assert(exists (select 1 from jsonb_array_elements(public.worker_home_plan(200)) p
                             where (p ->> 'product_id')::uuid = tests.id('diya')),
  'a listing with a similar weight is read again');
select tests.assert(public.worker_set_home_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vx'), 'weight_g', 1100, 'source', 'shop', 'note', 'XL page (D-134)'))) = 1,
  'its own page replaces it');
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_home_plan(200)) p
                                 where (p ->> 'product_id')::uuid = tests.id('diya'))
                    and exists (select 1 from jsonb_array_elements(public.worker_home_plan(200, true)) p
                                 where (p ->> 'product_id')::uuid = tests.id('diya')),
  'once every option is read it is done, unless all are read again');
reset role;

-- Customers never see a home weight.
update public.products set status = 'live', published_at = now() where id = tests.id('diya');
select tests.assert(not exists (select 1 from tests.json_keys(public.store_product_page('test-region', 'hw-diya')) k
                                 where k = any (tests.forbidden_keys()))
                    and (select bool_and(v ->> 'net_qty' is null)
                           from jsonb_array_elements(public.store_product_page('test-region', 'hw-diya') -> 'variants') v),
  'the product page has no weight, source or note, and no net quantity for home');

-- The runner's new home option keeps its packed weight.
set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.sourcing_targets (name, query, product_type, category_id, region_id)
values ('HW urli', 'brass urli', 'home', tests.id('cat_home'), tests.id('region'))
returning tests.remember('target', id);
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_plan();
select tests.remember('added', (public.worker_sourcing_add(tests.id('target'), jsonb_build_object(
  'site', 'amazon.in', 'shop_label', 'Amazon India', 'page_url', 'https://www.amazon.in/dp/B0HW000009',
  'name', 'Brass urli', 'slug', 'hw-brass-urli', 'attributes', '{}'::jsonb,
  'variants', jsonb_build_array(
    jsonb_build_object('item_key', 'B0HW000009', 'item_url', 'https://www.amazon.in/dp/B0HW000009', 'label', 'One size',
                       'options', '{}'::jsonb, 'price_paise', 80000, 'in_stock', true, 'delivery_days', 2,
                       'weight_g', 1405, 'weight_source', 'packed',
                       'weight_note', 'Item Weight: 1.2 Kilograms + box and wrapping 204 g (D-134)')))) ->> 'product_id')::uuid);
reset role;
select tests.assert((select weight_g = 1405 and weight_source = 'packed'
                       from public.product_variants where product_id = tests.id('added')),
  'the runner''s packed home weight is kept');

rollback;
