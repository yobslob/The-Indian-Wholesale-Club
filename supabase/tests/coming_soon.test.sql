-- Coming soon (migration 20261016200000, D-135): the worker's liquid check archives a liquid listing and shows it to
-- customers as coming soon: its card and page, no price to buy, no quick add, no variants, its photos; a checked
-- listing is not checked again; putting it back on sale ends its coming soon; clothing is never checked.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.pricing_settings set food_cleared = true, beta_pricing = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             price_auto, shop_price_paise, published_at)
values ('cs-juice', 'Sea buckthorn juice', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900,
        'draft', true, 20000, now()),
       ('cs-pickle', 'Mango pickle in mustard oil', 'food', tests.id('region'), tests.id('cat_food'),
        tests.id('vendor'), 900, 'draft', true, 20000, now());
select tests.remember('juice', (select id from public.products where slug = 'cs-juice'));
select tests.remember('pickle', (select id from public.products where slug = 'cs-pickle'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source)
values (tests.id('juice'), 'CS-J', '500 ml', '{"pack": "500 ml"}', 5, 500, 'shop'),
       (tests.id('pickle'), 'CS-P', '500 g', '{"pack": "500 g"}', 5, 500, 'shop');
insert into public.product_media (product_id, storage_path, sort_order, is_primary)
values (tests.id('juice'), 'products/cs-juice/1.jpg', 1, true);
update public.products set status = 'live' where id in (tests.id('juice'), tests.id('pickle'));

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_liquid_plan()', 'worker_only', 'an admin cannot read the liquid plan');
select tests.assert_fails('select public.worker_set_liquids(''[]'')', 'worker_only', 'nor archive liquids');

-- The check: both are read; the juice is archived as coming soon, the pickle stays on sale.
select tests.act_as(tests.id('worker'));
select tests.assert((select count(*) from jsonb_array_elements(public.worker_liquid_plan(null, 200)) p
                      where (p ->> 'product_id')::uuid in (tests.id('juice'), tests.id('pickle'))) = 2,
  'both listings are to check');
select tests.assert(public.worker_set_liquids(jsonb_build_array(
    jsonb_build_object('product_id', tests.id('juice'), 'liquid', true, 'note', 'its name says "juice"'),
    jsonb_build_object('product_id', tests.id('pickle'), 'liquid', false))) = 1,
  'one liquid archived');
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_liquid_plan(null, 200)) p
                                 where (p ->> 'product_id')::uuid in (tests.id('juice'), tests.id('pickle'))),
  'a checked listing is not checked again');
reset role;
select tests.assert((select status = 'archived' and coming_soon and coming_soon_note like 'Liquid: its name says%'
                       from public.products where id = tests.id('juice'))
                    and (select status = 'live' and not coming_soon from public.products where id = tests.id('pickle')),
  'the juice is archived as coming soon, the pickle stays live');

-- Customers see it as coming soon and cannot buy it.
set local role anon;
select tests.assert((select coming_soon from public.store_products where id = tests.id('juice'))
                    and (select not coming_soon from public.store_products where id = tests.id('pickle')),
  'the store lists it, marked coming soon');
select tests.assert(not exists (select 1 from public.store_variants where product_id = tests.id('juice')),
  'it has nothing to buy');
select tests.assert(exists (select 1 from public.store_media where product_id = tests.id('juice')),
  'its photos show');
select tests.assert((select (p -> 'product' ->> 'coming_soon')::boolean and jsonb_array_length(p -> 'variants') = 0
                       from (select public.store_product_page('test-region', 'cs-juice') p) x),
  'its page says coming soon, with no options');
select tests.assert(exists (select 1 from jsonb_array_elements(public.store_browse('food') -> 'products') b
                             where b ->> 'slug' = 'cs-juice' and (b ->> 'coming_soon')::boolean),
  'See all lists it as coming soon');
reset role;
select tests.assert((select (c ->> 'coming_soon')::boolean and c -> 'quick_add' = 'null'::jsonb
                       from (select public._store_product_card(tests.id('juice')) c) x),
  'its card says coming soon, no quick add');

-- Put back on sale by an admin: no longer coming soon, and the check leaves it alone.
update public.products set status = 'live' where id = tests.id('juice');
select tests.assert((select status = 'live' and not coming_soon from public.products where id = tests.id('juice')),
  'putting it on sale ends its coming soon');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_liquid_plan(null, 200)) p
                                 where (p ->> 'product_id')::uuid = tests.id('juice')),
  'the check does not undo the admin');
reset role;

-- An archived listing that is not coming soon stays hidden.
update public.products set status = 'archived' where id = tests.id('pickle');
set local role anon;
select tests.assert(not exists (select 1 from public.store_products where id = tests.id('pickle')),
  'a plain archived listing is not shown');
reset role;

rollback;
