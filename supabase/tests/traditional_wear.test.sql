-- D-195, migration 20261112090100: store_browse with 'any-state' lists every state's pieces and no all-India one.
begin;
select tests.setup();

-- p_live is Test Region's; an all-India piece beside it
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, shop_price_paise, status, wears, attributes)
values ('test-all-india', 'Test all-India piece', 'clothing', null, tests.id('cat_clothing'), 5000, 100000, 'live', 'women',
        '{"fibre_content": "100% cotton", "care": "Hand wash"}')
returning tests.remember('p_india', id);
insert into public.product_variants (product_id, sku, label, qty_listed) values (tests.id('p_india'), 'TEST-IN-1', 'Free size', 2);
update public.regions set is_live = true where id = tests.id('region');

set local role anon;
select tests.assert(exists (select 1 from jsonb_array_elements(public.store_browse('clothing') -> 'products') x where x ->> 'slug' = 'test-all-india'),
  'All states lists the all-India piece');
select tests.assert(exists (select 1 from jsonb_array_elements(public.store_browse('clothing', 'test-region') -> 'products') x where x ->> 'slug' = 'test-all-india'),
  'a state still lists the all-India pieces after its own');
select tests.assert(not exists (select 1 from jsonb_array_elements(public.store_browse('clothing', 'any-state') -> 'products') x where x ->> 'slug' = 'test-all-india'),
  'every state leaves the all-India piece out');
select tests.assert(exists (select 1 from jsonb_array_elements(public.store_browse('clothing', 'any-state') -> 'products') x where x ->> 'slug' = 'test-live'),
  'every state lists a state''s piece');
select tests.assert((select bool_and(x ->> 'region_name' is not null) from jsonb_array_elements(public.store_browse('clothing', 'any-state') -> 'products') x),
  'each card has its state''s name');
select tests.assert((public.store_browse('clothing', 'any-state') ->> 'total')::int < (public.store_browse('clothing') ->> 'total')::int,
  'fewer pieces than All states');

rollback;
