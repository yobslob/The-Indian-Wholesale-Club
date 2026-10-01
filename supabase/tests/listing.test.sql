-- Listing from the field (migration 20261001170000, flows.md §2, C3): admin_create_listing() and
-- admin_stale_variants().
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('admin'));

select tests.remember('new', public.admin_create_listing(jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Field kurta', 'slug', 'field-kurta', 'summary', 'Listed on a phone',
  'attributes', jsonb_build_object('fibre_content', '100% cotton', 'care', 'Hand wash'),
  'price_cents', 4900, 'shop_price_paise', 120000,
  'variants', jsonb_build_array(
    jsonb_build_object('label', 'Red · M', 'options', jsonb_build_object('colour', 'Red', 'size', 'M'), 'qty', 3),
    jsonb_build_object('label', 'Red · L', 'options', jsonb_build_object('colour', 'Red', 'size', 'L'), 'qty', 2,
                       'weight_g', 400)))));

select tests.assert(
  (select status = 'draft' and region_id = tests.id('region') and created_by = tests.id('admin')
          and price_cents = 4900 and shop_price_paise = 120000
   from public.products where id = tests.id('new')),
  'a listing is a draft in the shop''s region, by the admin who made it');
select tests.assert(
  (select array_agg(sku || ':' || qty_listed order by sort_order) from public.product_variants where product_id = tests.id('new'))
  = array['FIELD-KURTA-1:3', 'FIELD-KURTA-2:2'],
  'its variants carry the shop''s quantities, in order');
select tests.assert(
  (select bool_and(qty_confirmed_at is not null) from public.product_variants where product_id = tests.id('new')),
  'quantities taken at the shop count as confirmed');
select tests.assert(
  (select count(*) from public.stock_movements m join public.product_variants v on v.id = m.variant_id
   where v.product_id = tests.id('new') and m.reason = 'listed') = 2,
  'each quantity is in the stock ledger as listed');

-- All or nothing: a bad second variant leaves no product behind.
select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Half listing', 'slug', 'half-listing', 'price_cents', 4900,
  'variants', jsonb_build_array(jsonb_build_object('label', 'S', 'qty', 1), jsonb_build_object('label', 'M', 'qty', -1)))),
  '23514', 'a bad variant refuses the whole listing');
select tests.assert(not exists (select 1 from public.products where slug = 'half-listing'),
  'and leaves no half listing behind');

select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'vendor_id', gen_random_uuid(), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'No shop', 'slug', 'no-shop', 'price_cents', 4900)),
  'vendor_not_found', 'a listing needs an active shop');

select tests.remember('spice', public.admin_create_listing(jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_spice'), 'product_type', 'spice',
  'name', 'Field masala', 'slug', 'field-masala', 'price_cents', 900,
  'variants', jsonb_build_array(jsonb_build_object('label', '100 g', 'qty', 5)))));
select tests.assert_fails(format('update public.products set status = %L where id = %L', 'live', tests.id('spice')),
  '23514', 'D-032: a spice listing stays a draft');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Sneaky', 'slug', 'sneaky', 'price_cents', 100)),
  '42501', 'INV-7: a customer cannot list');
select tests.assert_fails('select * from public.admin_stale_variants()', '42501', 'INV-7: nor read the re-check list');
reset role;

-- The re-check list: live variants not confirmed within stale_listing_days.
update public.products set status = 'live', published_at = now() where id = tests.id('new');
update public.product_variants set qty_confirmed_at = now() - interval '10 days' where sku = 'FIELD-KURTA-1';
update public.product_variants set qty_confirmed_at = now() - interval '10 days' where product_id = tests.id('spice');
set local role authenticated;
select tests.act_as(tests.id('admin'));
update public.pricing_settings set stale_listing_days = null where id = 1;
select tests.assert(not exists (select 1 from public.admin_stale_variants()),
  'D-047: no list until the founder sets the number of days');
reset role;
update public.pricing_settings set stale_listing_days = 7 where id = 1;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select array_agg(label order by label) from public.admin_stale_variants() where product_id = tests.id('new'))
  = array['Red · M'],
  'a live variant confirmed 10 days ago is listed; one confirmed today is not');
select tests.assert(not exists (select 1 from public.admin_stale_variants() where product_id = tests.id('spice')),
  'drafts are not on the list');
reset role;

rollback;
