-- D-122 (migration 20261014160000): a food card carries its pack size; browse counts every piece once; footwear's
-- typical weight.
begin;
select tests.setup();
update public.pricing_settings set food_cleared = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values ('test-bhujia', 'Test Bikaneri Bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 399, 'live', now()),
       ('test-sev', 'Test Ratlami Sev 400g', 'food', null, tests.id('cat_food'), tests.id('vendor'), 849, 'live', now());
insert into public.product_variants (product_id, sku, label, options, qty_listed, price_cents)
select id, 'TEST-BHUJIA-1', '1 kg', '{"pack": "1 kg"}'::jsonb, 3, 2049 from public.products where slug = 'test-bhujia'
union all
select id, 'TEST-BHUJIA-2', '200 g', '{"pack": "200 g"}'::jsonb, 3, 399 from public.products where slug = 'test-bhujia'
union all
select id, 'TEST-SEV-1', 'One size', '{}'::jsonb, 2, null from public.products where slug = 'test-sev';

set local role anon;
select tests.assert(
  (select c ->> 'pack' from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
    where c ->> 'slug' = 'test-bhujia') = '200 g',
  'the card shows the pack of the price it shows (the cheapest option)');
select tests.assert(
  (select c ->> 'pack' from jsonb_array_elements(public.store_browse('food') -> 'products') c
    where c ->> 'slug' = 'test-sev') = '400 g',
  'without a pack option, the weight in its name');
select tests.assert(
  (select c -> 'pack' from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
    where c ->> 'slug' = 'test-live') = 'null'::jsonb,
  'clothing has no pack');
select tests.assert((public.store_browse('food') ->> 'all_total')::int = 2,
  'all_total counts each piece once (the all-India one is also in every state''s count)');
select tests.assert((public.store_browse('food', 'test-region') ->> 'all_total')::int = 2,
  'all_total ignores the filters');
reset role;

select tests.assert(public._store_pack(tests.id('p_live'), 'Kurta 500g', 'clothing') is null, 'only food has a pack');
rollback;
