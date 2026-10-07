-- The demo round (migration 29, D-078): demo reviews and photo credits, shown only while dev_preview is on, and a
-- customer can never write a demo review.
begin;
select tests.setup();

-- A customer tries to pass their review off as a demo one: it is an ordinary review.
set local role authenticated;
select tests.act_as(tests.id('cust_b'));
insert into public.reviews (product_id, user_id, rating, body, display_name, is_placeholder)
values (tests.id('p_live'), tests.id('cust_b'), 4, 'Lovely colour.', 'Ravi', true);
reset role;
select tests.assert((select not is_placeholder from public.reviews where user_id = tests.id('cust_b')),
  'a customer''s review is never a demo review');

-- The demo loader (service role) writes a demo review; an admin approves both.
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
insert into public.reviews (product_id, user_id, rating, body, display_name, is_placeholder)
values (tests.id('p_live'), tests.id('cust_a'), 5, 'Demo text.', 'Demo reviewer', true);
select set_config('request.jwt.claims', '', true);
update public.reviews set status = 'approved' where product_id = tests.id('p_live');
select tests.assert((select is_placeholder from public.reviews where user_id = tests.id('cust_a')),
  'the service role writes a demo review');

set local role anon;
select tests.assert((select count(*) = 1 and bool_and(not is_demo) from public.store_reviews
                     where product_id = tests.id('p_live')),
  'INV-8: without dev_preview the store shows only the real review');
reset role;
update public.app_settings set value = 'true'::jsonb where key = 'dev_preview';
set local role anon;
select tests.assert((select count(*) = 2 and count(*) filter (where is_demo) = 1 from public.store_reviews
                     where product_id = tests.id('p_live')),
  'in the demo round the demo review shows, marked so the store can label it');
reset role;

-- Photo credits reach the product page.
insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary, credit)
values (tests.id('p_live'), 'products/x/1-demo.jpg', 'Test (demo photo)', 0, true, '"Saree" by A. Person is licensed under CC BY 2.0.');
set local role anon;
select tests.assert((select credit like '%CC BY 2.0%' from public.store_media where product_id = tests.id('p_live')),
  'a photo''s credit is in store_media');
reset role;
rollback;
