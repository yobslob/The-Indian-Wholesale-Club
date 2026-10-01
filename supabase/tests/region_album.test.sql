-- The region album (migration 20261001120000, D-051, D-052): admin-only photos, read by the store only through
-- store_region_page(), in order, with nothing but the path and the alt text.
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.region_photos (region_id, storage_path, alt_text, sort_order) values
  (tests.id('region'), 'regions/test-region/album/b.jpg', 'Second photo', 2),
  (tests.id('region'), 'regions/test-region/album/a.jpg', 'First photo', 1),
  (tests.id('region'), 'regions/test-region/album/c.jpg', 'Third photo', 3);
select tests.assert((select count(*) from public.region_photos where region_id = tests.id('region')) = 3,
  'an admin adds album photos');
select tests.assert_fails(
  format('insert into public.region_photos (region_id, storage_path, alt_text) values (%L, %L, %L)',
         tests.id('region'), 'products/x/y.jpg', 'Wrong folder'),
  '23514', 'album photos live under regions/<slug>/album/');
select tests.assert_fails(
  format('insert into public.region_photos (region_id, storage_path, alt_text) values (%L, %L, %L)',
         tests.id('region'), 'regions/test-region/album/d.jpg', '  '),
  '23514', 'every album photo has alt text');

select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.region_photos) = 0, 'a customer sees no album rows directly');
select tests.assert_fails(
  format('insert into public.region_photos (region_id, storage_path, alt_text) values (%L, %L, %L)',
         tests.id('region'), 'regions/test-region/album/e.jpg', 'Sneaky'),
  '42501', 'a customer cannot add album photos');
reset role;

set local role anon;
select tests.assert_fails('select count(*) from public.region_photos', '42501', 'anon cannot read the table');
select tests.assert(
  (select array_agg(p ->> 'alt_text' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'album') with ordinality as x(p, ord))
  = array['First photo', 'Second photo', 'Third photo'],
  'store_region_page lists the album in the admin''s order');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_region_page('test-region') -> 'album') p,
                            jsonb_object_keys(p) k
              where k not in ('storage_path', 'alt_text')),
  'INV-1: an album photo carries only its path and alt text');
reset role;

rollback;
