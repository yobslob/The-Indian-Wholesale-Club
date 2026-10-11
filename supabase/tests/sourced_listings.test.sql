-- Listings imported from online shops (D-110, migration 20261012100000): the importer's writes as the admin, one
-- listing per source page, one online vendor per shop and state, and the source never reaches customers (D-003).
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('admin'));

-- The importer's first save: the shop's vendor for this state, then the listing, then its source.
insert into public.vendors (shop_name, online_site, region_id, status)
values ('Myntra (online)', 'myntra.com', tests.id('region'), 'active')
returning tests.remember('online', id);
select tests.assert_fails(
  format('insert into public.vendors (shop_name, online_site, region_id, status) values (%L, %L, %L, %L)',
         'Myntra again', 'myntra.com', tests.id('region'), 'active'),
  '23505', 'one online vendor per shop and state');

select tests.remember('imported', public.admin_create_listing(jsonb_build_object(
  'vendor_id', tests.id('online'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Woven Banarasi silk saree', 'slug', 'woven-banarasi-silk-saree-ab12', 'shop_price_paise', 174900,
  'price_cents', 9999,
  'attributes', jsonb_build_object('fibre_content', 'Silk blend', 'care', 'Dry clean'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'One size', 'options', '{}'::jsonb, 'qty', 5)))));
update public.products
   set source_url = 'https://www.myntra.com/sarees/x/y/123/buy', source_site = 'myntra.com',
       source_checked_at = now(), source_in_stock = true, status = 'live', published_at = now()
 where id = tests.id('imported');
select tests.assert(
  (select region_id = tests.id('region') and source_site = 'myntra.com' from public.products where id = tests.id('imported')),
  'the listing takes the online vendor''s state and keeps its source');

select tests.assert_fails(
  format('update public.products set source_url = %L where id = %L', 'https://www.myntra.com/sarees/x/y/123/buy', tests.id('p_draft')),
  '23505', 'one listing per source page');
select tests.assert_fails(
  format('update public.products set source_url = %L where id = %L', 'http://shop.example/x', tests.id('p_draft')),
  '23514', 'a source is an https address');

-- Customers see the product, never where it came from.
select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.store_products where id = tests.id('imported')) = 1, 'the imported piece is in the store');
select tests.assert((select count(*) from public.products where source_url is not null) = 0, 'D-003: customers cannot read the source');
select tests.assert((select count(*) from public.vendors where online_site is not null) = 0, 'D-003: customers cannot read online vendors');
reset role;

select tests.assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name like 'store\_%' and column_name like 'source%'),
  'D-003: no store view has a source column');

rollback;
