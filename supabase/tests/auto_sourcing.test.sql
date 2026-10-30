-- Auto-sourcing (D-118, migrations 20261013090000-0200): targets, the runner's listings with a price per variant,
-- backups, the weekly check (prices, stock, the price-jump guard, new flavours, unreadable pages), the admin's review,
-- and none of it reaching customers (D-003).
begin;
select tests.setup();

-- Simple numbers: ₹100 per $, no margin or fees, ₹1,000 a kg shipping. ₹100 at 500 g = $1 + $5 = $6.00 -> $6.29.
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, india_handling_pct = 0, ship_alloc_paise_per_kg = 100000,
  margin_pct = 0, margin_food_pct = 0, card_fee_pct = 0, card_fee_fixed_cents = 0,
  -- D-119's food recipe with simple numbers: ₹1,000 per kg, no fee, the label's weight, no guard
  courier_first_kg_paise = 100000, courier_next_kg_paise = 100000, food_parcel_kg = 1, parcel_fixed_paise = 0,
  food_fee_paise = 0, food_billed_pct = 100, duty_food_pct = 0, min_profit_food_cents = 0, min_profit_food_pct = 0,
  guard_card_fee_pct = 0, food_ship_share_pct = null,
  beta_pricing = false  -- the full formula (D-127's beta is tested in pricing_engine)
 where id = 1;
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

-- The admin queues a target.
set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.sourcing_targets (name, query, must_match, product_type, category_id, region_id, tier)
values ('Test chikki', 'chikki', 'chikki', 'food', tests.id('cat_food'), tests.id('region'), 1)
returning tests.remember('target', id);
select tests.assert_fails(
  format('insert into public.sourcing_targets (name, query, product_type, category_id, region_id) values (%L, %L, %L, %L, %L)',
         'TEST CHIKKI', 'chikki', 'food', tests.id('cat_food'), tests.id('region')),
  '23505', 'one target per name and state');
select tests.assert_fails(
  format('insert into public.sourcing_targets (name, query, product_type, category_id, region_id) values (%L, %L, %L, %L, %L)',
         'Wrong type', 'chikki', 'clothing', tests.id('cat_food'), tests.id('region')),
  '23503', 'a target''s category has its type');

-- Nobody else gets in.
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.worker_sourcing_plan()', 'worker_only', 'a customer cannot run sourcing');
select tests.assert((select count(*) from public.sourcing_targets) = 0, 'customers cannot read targets');
select tests.assert_fails(format('select public.admin_sourcing_review(%L, true)', gen_random_uuid()), 'admin_only',
  'a customer cannot review sources');

-- The runner takes the target.
select tests.act_as(tests.id('worker'));
select tests.remember('plan_target', (public.worker_sourcing_plan() -> 'targets' -> 0 ->> 'id')::uuid);
select tests.assert(tests.id('plan_target') = tests.id('target'), 'the plan hands out the queued target');
select tests.assert(jsonb_array_length(public.worker_sourcing_plan() -> 'targets') = 0, 'a held target is not handed out twice');
select tests.assert(jsonb_array_length(public.worker_sourcing_plan() -> 'shops') = 10, 'the ten shops the founder named');

-- It adds two flavours (one sold out on the shop) and a cheaper backup that takes 5 days.
select tests.remember('product', (public.worker_sourcing_add(tests.id('target'), jsonb_build_object(
  'site', 'amazon.in', 'shop_label', 'Amazon India', 'page_url', 'https://www.amazon.in/dp/B0TEST0001',
  'name', 'Test chikki', 'slug', 'test-chikki', 'summary', 'Crunchy', 'attributes', '{}'::jsonb,
  'variants', jsonb_build_array(
    jsonb_build_object('item_key', 'B0TEST0001', 'item_url', 'https://www.amazon.in/dp/B0TEST0001', 'label', 'Malai',
                       'options', jsonb_build_object('flavour', 'Malai'), 'price_paise', 10000, 'in_stock', true,
                       'delivery_days', 2, 'weight_g', 500),
    jsonb_build_object('item_key', 'B0TEST0002', 'item_url', 'https://www.amazon.in/dp/B0TEST0002', 'label', 'Mawa',
                       'options', jsonb_build_object('flavour', 'Mawa'), 'price_paise', 20000, 'in_stock', false,
                       'delivery_days', 2, 'weight_g', 500)),
  'backups', jsonb_build_array(
    jsonb_build_object('variant', 1, 'site', 'flipkart.com', 'page_url', 'https://www.flipkart.com/x/p/itm1',
                       'item_url', 'https://www.flipkart.com/x/p/itm1?pid=TEST1', 'item_key', 'TEST1',
                       'price_paise', 9000, 'in_stock', true, 'delivery_days', 5)))) ->> 'product_id')::uuid);
reset role;
select tests.remember('malai', (select id from public.product_variants where product_id = tests.id('product') and label = 'Malai'));
select tests.remember('mawa', (select id from public.product_variants where product_id = tests.id('product') and label = 'Mawa'));
select tests.assert((select status = 'draft' and region_id = tests.id('region') and sourcing_target_id = tests.id('target')
                       from public.products where id = tests.id('product')), 'a draft in the target''s state');
select tests.assert((select price_cents from public.product_variants where id = tests.id('malai')) = 629,
  'each flavour has its own price ($1 + $5 -> $6.29)');
select tests.assert((select price_cents from public.product_variants where id = tests.id('mawa')) = 729,
  'the dearer flavour costs more ($2 + $5 -> $7.29)');
select tests.assert((select price_cents from public.products where id = tests.id('product')) = 629,
  'the product shows the lowest flavour price');
select tests.assert((select qty_listed - qty_reserved from public.product_variants where id = tests.id('malai')) = 5
                    and (select qty_listed from public.product_variants where id = tests.id('mawa')) = 0,
  'in stock: the set number on sale; sold out on the shop: none');
select tests.assert((select s.site from public.product_variants v join public.product_sources s on s.id = v.source_id
                      where v.id = tests.id('malai')) = 'amazon.in',
  'the 5-day backup is cheaper but too slow, so the desk orders from Amazon');
select tests.assert((select found_count from public.sourcing_targets where id = tests.id('target')) = 1, 'the target counts it');
select tests.assert((select count(*) from public.vendors where online_site = 'amazon.in' and region_id = tests.id('region')) = 1,
  'the shop''s vendor for the state');

set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert((public.worker_sourcing_add(tests.id('target'), jsonb_build_object(
  'site', 'amazon.in', 'page_url', 'https://www.amazon.in/dp/B0OTHER', 'name', 'Again', 'slug', 'again',
  'variants', jsonb_build_array(jsonb_build_object('item_key', 'B0TEST0002', 'item_url', 'https://www.amazon.in/dp/B0TEST0002',
                                                   'label', 'Mawa', 'price_paise', 20000, 'in_stock', true))))
                     ->> 'created')::boolean = false, 'an item already listed is not listed twice');
select tests.assert_fails(format('select public.worker_sourcing_add(%L, %L)', tests.id('target'),
  jsonb_build_object('site', 'amazon.in', 'page_url', 'https://www.amazon.in/dp/B0NEW', 'name', 'No price', 'slug', 'np',
                     'variants', jsonb_build_array(jsonb_build_object('item_key', 'B0NEW', 'item_url', 'https://www.amazon.in/dp/B0NEW', 'label', 'One')))),
  'listing_invalid', 'every item needs a price');

-- Photos: only under products/<id>/, only once; drafts stay drafts while auto-publish is off.
select tests.assert_fails(format('select public.worker_sourcing_media(%L, %L, true)', tests.id('product'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/a.jpg'))),
  'media_invalid', 'photos go only to the listing''s own folder');
select tests.assert_fails(format('select public.worker_sourcing_media(%L, %L, true)', tests.id('product'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('product') || '/x/a.jpg'))),
  'media_invalid', 'and no other folder in it than s/');
select tests.assert(public.worker_product_wears(tests.id('product')) is null, 'a food listing is for no one in particular');
select tests.assert(public.worker_product_wears(tests.id('p_live')) is null, 'and a listing the runner did not make says nothing');
-- D-168: a photo made again before upload carries its mark; a face is for clothing only, and nothing else is a mark
select tests.assert_fails(format('select public.worker_sourcing_media(%L, %L, true)', tests.id('product'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('product') || '/s/a.jpg', 'redo', 'face'))),
  'media_invalid', 'a face is never a food photo''s mark');
select tests.assert_fails(format('select public.worker_sourcing_media(%L, %L, true)', tests.id('product'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('product') || '/s/a.jpg', 'redo', 'kept'))),
  'media_invalid', 'only face and fresh are marks the runner sets');
select tests.assert((public.worker_sourcing_media(tests.id('product'), jsonb_build_array(
  jsonb_build_object('path', 'products/' || tests.id('product') || '/a.jpg', 'alt_text', 'Chikki'),
  jsonb_build_object('path', 'products/' || tests.id('product') || '/s/b.jpg', 'item_key', 'B0TEST0002',
                     'redo', 'fresh')), true)
  ->> 'published')::boolean = false, 'auto-publish is off: it waits as a draft');
select tests.assert_fails(format('select public.worker_sourcing_media(%L, %L, false)', tests.id('product'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('product') || '/c.jpg'))),
  'product_not_open', 'the runner never replaces photos');
select tests.assert(public.worker_may_add_photos(tests.id('product')::text) = false, 'no more uploads once it has photos');
reset role;
select tests.assert((select variant_id from public.product_media where storage_path like '%/b.jpg') = tests.id('mawa'),
  'a flavour''s photo belongs to that flavour');
select tests.assert((select is_primary from public.product_media where storage_path like '%/a.jpg'), 'the first photo is the main one');
select tests.assert((select redo from public.product_media where storage_path like '%/s/b.jpg') = 'fresh'
                    and (select redo from public.product_media where storage_path like '%/a.jpg') is null,
  'a photo made again before upload keeps its mark; one sent as it is has none (the redo takes it later)');

-- The weekly check: a small rise follows the shop; a jump is held; the sold-out flavour comes back.
select tests.remember('src_malai', (select source_id from public.product_variants where id = tests.id('malai')));
select tests.remember('src_mawa', (select source_id from public.product_variants where id = tests.id('mawa')));
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert((public.worker_sourcing_checked(tests.id('product'), jsonb_build_object('sources', jsonb_build_array(
  jsonb_build_object('id', tests.id('src_malai'), 'ok', true, 'price_paise', 11000, 'in_stock', true, 'delivery_days', 2),
  jsonb_build_object('id', tests.id('src_mawa'), 'ok', true, 'price_paise', 20000, 'in_stock', true, 'delivery_days', 1))))
  ->> 'price_changes')::integer = 1, 'one price moved');
reset role;
select tests.assert((select price_cents from public.product_variants where id = tests.id('malai')) = 629
                    and (select shop_price_paise from public.product_variants where id = tests.id('malai')) = 11000,
  'a ₹10 rise follows the shop ($1.10 + $5 still ends at $6.29)');
select tests.assert((select qty_listed - qty_reserved from public.product_variants where id = tests.id('mawa')) = 5,
  'the flavour back in stock is on sale again');
select tests.assert((select reason = 'adjusted' and ref_type = 'source_check' from public.stock_movements
                      where variant_id = tests.id('mawa') order by created_at desc limit 1),
  'the stock ledger says why (INV-4)');

set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert((public.worker_sourcing_checked(tests.id('product'), jsonb_build_object(
  'sources', jsonb_build_array(
    jsonb_build_object('id', tests.id('src_malai'), 'ok', true, 'price_paise', 30000, 'in_stock', true, 'delivery_days', 2),
    jsonb_build_object('id', tests.id('src_mawa'), 'ok', true, 'price_paise', 20000, 'in_stock', false)),
  'added', jsonb_build_array(
    jsonb_build_object('site', 'amazon.in', 'page_url', 'https://www.amazon.in/dp/B0TEST0001',
                       'item_url', 'https://www.amazon.in/dp/B0TEST0003', 'item_key', 'B0TEST0003', 'label', 'Chocolate',
                       'options', jsonb_build_object('flavour', 'Chocolate'), 'price_paise', 15000, 'in_stock', true,
                       'delivery_days', 2)))) ->> 'held')::integer = 1, 'a ₹110 -> ₹300 jump is held');
reset role;
select tests.assert((select review = 'price_rise' and review_price_paise = 30000 and price_paise = 11000
                       from public.product_sources where id = tests.id('src_malai')), 'the held price waits; the old one stays');
select tests.assert((select qty_listed = qty_reserved from public.product_variants where id = tests.id('malai')),
  'the held flavour stops selling (its only fast source is held)');
select tests.assert((select qty_listed = qty_reserved from public.product_variants where id = tests.id('mawa')),
  'sold out on the shop: sold out here');
select tests.assert((select qty_listed = 5 and shop_price_paise = 15000 and options ->> 'flavour' = 'Chocolate'
                       from public.product_variants where product_id = tests.id('product') and label = 'Chocolate'),
  'a new flavour on the page becomes a new variant, on sale');
select tests.assert((select shop_price_paise from public.products where id = tests.id('product')) = 15000,
  'the product''s shop price is its cheapest flavour on sale');

-- The admin accepts the new price: on sale again at the new price.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.admin_sourcing_review(tests.id('src_malai'), true);
reset role;
select tests.assert((select shop_price_paise = 30000 and qty_listed - qty_reserved = 5
                       from public.product_variants where id = tests.id('malai')), 'accepted: sold at the new price');

-- A page that can't be read twice in a row stops that source.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_checked(tests.id('product'), jsonb_build_object('sources', jsonb_build_array(
  jsonb_build_object('id', tests.id('src_malai'), 'ok', false, 'error', 'blocked'))));
reset role;
select tests.assert((select qty_listed - qty_reserved from public.product_variants where id = tests.id('malai')) = 5,
  'one failed read changes nothing');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_checked(tests.id('product'), jsonb_build_object('sources', jsonb_build_array(
  jsonb_build_object('id', tests.id('src_malai'), 'ok', false, 'error', 'blocked'))));
reset role;
select tests.assert((select qty_listed = qty_reserved from public.product_variants where id = tests.id('malai')),
  'two in a row: it stops selling');

-- The run ends: the target is done, the log and the shops' health are written.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_target_done(tests.id('target'), null);
select public.worker_sourcing_log(jsonb_build_object('started_at', now(), 'targets_searched', 1, 'listings_added', 1,
  'shops', jsonb_build_object('amazon.in', jsonb_build_object('pages', 4, 'failed', 0),
                              'zepto.com', jsonb_build_object('pages', 1, 'failed', 1, 'error', 'no address set'))));
select tests.assert(jsonb_array_length(public.worker_sourcing_plan() -> 'checks') = 0, 'a product just checked is not due');
reset role;
select tests.assert((select status from public.sourcing_targets where id = tests.id('target')) = 'found', 'found');
select tests.assert((select last_ok_at is not null from public.sourcing_shops where site = 'amazon.in')
                    and (select last_error = 'no address set' from public.sourcing_shops where site = 'zepto.com'),
  'each shop''s health');

-- D-003: none of it reaches customers.
update public.pricing_settings set food_cleared = true where id = 1;
update public.products set status = 'live', published_at = now() where id = tests.id('product');
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.store_products where id = tests.id('product')) = 1, 'the piece is in the store');
select tests.assert((select count(*) from public.product_sources) = 0, 'customers cannot read sources');
select tests.assert((select count(*) from public.sourcing_runs) = 0, 'customers cannot read runs');
reset role;
select tests.assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name like 'store\_%'
                 and (column_name like 'source%' or column_name in ('shop_price_paise', 'sourcing_target_id'))),
  'D-003: no store view has a source, a shop price or a target');

rollback;
