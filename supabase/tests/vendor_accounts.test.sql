-- INV-10 (D-102, D-103): a vendor account sees only its own vendor, through vendor_* functions, and never a buyer, an
-- order number, the customer price or IWC's costs. Sign-in codes work once. The worker and customers stay out.
begin;
select tests.setup();

-- a second vendor with its own product, and the accounts
insert into public.vendors (shop_name, region_id, status) values ('Other Shop', tests.id('region'), 'active')
returning tests.remember('vendor_b', id);
select tests.create_user('vend_a', 'vendor-a@vendors.example.test');
select tests.create_user('vend_b', 'vendor-b@vendors.example.test');
select tests.create_user('worker', 'worker@example.test');
select public._link_vendor_account(tests.id('vend_a'), tests.id('vendor'), 'ml', tests.id('admin'));
select public._link_vendor_account(tests.id('vend_b'), tests.id('vendor_b'), 'hi', tests.id('admin'));
update public.profiles set role = 'worker' where id = tests.id('worker');

select tests.assert_fails(format('select public._link_vendor_account(%L, %L, %L, %L)', tests.id('admin'),
  tests.id('vendor'), 'en', tests.id('admin')), 'not_a_vendor_account', 'an admin can never become a vendor account');
select tests.assert(not has_function_privilege('authenticated', 'public._link_vendor_account(uuid, uuid, text, uuid)',
  'execute'), 'only the server links accounts');
select tests.assert(not has_function_privilege('authenticated', 'public._redeem_vendor_code(text)', 'execute'),
  'only the server redeems codes');

set local role authenticated;

-- --- who is a vendor --------------------------------------------------------------------------------------------
select tests.act_as(tests.id('cust_a'));
select tests.assert(not public.is_vendor(), 'a customer is not a vendor');
select tests.assert_fails('select public.vendor_me()', 'vendor_only', 'a customer cannot read vendor screens');
select tests.assert_fails('select public.vendor_new_submission()', 'vendor_only', 'a customer cannot upload');
select tests.assert_fails(format('select public.admin_vendor_sign_in_code(%L)', tests.id('vend_a')), 'admin_only',
  'a customer cannot make sign-in codes');
select tests.assert_fails('select public.worker_claim_job()', 'worker_only', 'a customer cannot take photo jobs');

select tests.act_as(tests.id('vend_a'));
select tests.assert(public.is_vendor() and not public.is_admin(), 'INV-10: a linked account is a vendor, not an admin');
select tests.assert(public.my_vendor_id() = tests.id('vendor'), 'INV-10: the vendor is its own shop');
select tests.assert((public.vendor_me() ->> 'shop_name') = 'Test Shop' and (public.vendor_me() ->> 'language') = 'ml',
  'a vendor reads its own shop and language');
select tests.assert((select count(*) from public.vendors) = 0 and (select count(*) from public.products) = 0
  and (select count(*) from public.orders) = 0 and (select count(*) from public.order_items) = 0
  and (select count(*) from public.pickups) = 0 and (select count(*) from public.vendor_payouts) = 0
  and (select count(*) from public.vendor_submissions) = 0 and (select count(*) from public.vendor_applications) = 0,
  'INV-10: a vendor reads no base table directly');
select tests.assert((select count(*) from public.vendor_accounts) = 1, 'a vendor sees only its own account row');
select tests.assert_fails(format('update public.profiles set role = %L where id = %L', 'admin', tests.id('vend_a')),
  '42501', 'a vendor cannot change its role');
select tests.assert_fails('select public.worker_claim_job()', 'worker_only', 'a vendor cannot take photo jobs');

-- --- keep ready and money: the piece and count, never who bought it ---------------------------------------------
select tests.assert(jsonb_array_length(public.vendor_keep_ready()) = 2
  and (select sum((k ->> 'quantity')::integer) from jsonb_array_elements(public.vendor_keep_ready()) k) = 2,
  'the vendor sees the ordered pieces to keep ready (order_a and order_b, one piece each, two sizes)');

-- --- a submission from photos to sent -------------------------------------------------------------------------
select tests.remember('sub_a', public.vendor_new_submission());
select tests.assert(public.vendor_may_upload(tests.id('vendor') || '/' || tests.id('sub_a') || '/front.jpg'),
  'a vendor may upload into its own open submission');
select tests.assert(not public.vendor_may_upload(tests.id('vendor_b') || '/' || tests.id('sub_a') || '/front.jpg'),
  'INV-10: not into another vendor''s folder');
select tests.assert(not public.vendor_may_upload(tests.id('vendor') || '/' || tests.id('sub_a') || '/x/front.jpg'),
  'not into a sub-folder');
select public.vendor_add_photo(tests.id('sub_a'), 'front', tests.id('vendor') || '/' || tests.id('sub_a') || '/front.jpg');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('category_id', tests.id('cat_clothing'), 'shop_price_paise', 120000,
                     'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 2)))),
  'photos_missing', 'clothing needs front, back and close-up');
select public.vendor_add_photo(tests.id('sub_a'), 'back', tests.id('vendor') || '/' || tests.id('sub_a') || '/back.jpg');
select public.vendor_add_photo(tests.id('sub_a'), 'closeup',
  tests.id('vendor') || '/' || tests.id('sub_a') || '/closeup.jpg', '{"sharpness": 140}');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('shop_price_paise', 120000, 'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 2)))),
  'category_needed', 'a category is needed');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('category_id', tests.id('cat_clothing'), 'shop_price_paise', 120000, 'variants', '[]'::jsonb)),
  'sizes_needed', 'at least one size is needed');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('category_id', tests.id('cat_clothing'), 'shop_price_paise', 120000,
                     'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 0)))),
  'size_invalid', 'a size needs at least one piece');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('category_id', tests.id('cat_clothing'),
                     'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 2)))),
  'price_needed', 'the shop price is needed');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'),
  jsonb_build_object('category_id', tests.id('cat_clothing'), 'shop_price_paise', 120000, 'wears', 'everyone',
                     'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 2)))),
  'wears_needed', 'who wears it is one of women, men, kids, unisex');
select public.vendor_submit(tests.id('sub_a'), jsonb_build_object(
  'category_id', tests.id('cat_clothing'), 'wears', 'women', 'shop_price_paise', 120000, 'fabric', 'Cotton',
  'secret', 'dropped',
  'variants', jsonb_build_array(jsonb_build_object('label', 'M', 'qty', 2), jsonb_build_object('label', 'L', 'qty', 1))));
select tests.assert((public.vendor_submission(tests.id('sub_a')) ->> 'status') = 'waiting',
  'a sent clothing piece waits for its AI photos');
select tests.assert(not (public.vendor_submission(tests.id('sub_a')) -> 'details') ? 'secret'
  and (public.vendor_submission(tests.id('sub_a')) -> 'details' ->> 'wears') = 'women',
  'only the known detail keys are kept');
select tests.assert(not public.vendor_may_upload(tests.id('vendor') || '/' || tests.id('sub_a') || '/front2.jpg'),
  'no uploads into a sent submission');
select tests.assert_fails(format('select public.vendor_delete_submission(%L)', tests.id('sub_a')), 'cannot_delete',
  'a sent piece cannot be deleted by the vendor');

-- vendor B sees none of it
select tests.act_as(tests.id('vend_b'));
select tests.assert(public.vendor_submission(tests.id('sub_a')) is null, 'INV-10: vendor B cannot read A''s piece');
select tests.assert((public.vendor_pieces() ->> 'total')::integer = 0, 'INV-10: vendor B has no pieces of A');
select tests.assert(jsonb_array_length(public.vendor_keep_ready()) = 0, 'INV-10: vendor B keeps nothing of A ready');
select tests.assert_fails(format('select public.vendor_add_photo(%L, %L, %L)', tests.id('sub_a'), 'front',
  tests.id('vendor') || '/' || tests.id('sub_a') || '/front.jpg'), 'not_your_submission',
  'INV-10: vendor B cannot attach photos to A''s piece');
select tests.assert_fails(format('select public.vendor_submit(%L, %L)', tests.id('sub_a'), '{}'),
  'not_your_submission', 'INV-10: vendor B cannot send A''s piece');

-- --- the worker ---------------------------------------------------------------------------------------------------
select tests.act_as(tests.id('worker'));
select tests.assert((select count(*) from public.vendor_submissions) = 0 and (select count(*) from public.orders) = 0,
  'the worker reads no base table directly');
select tests.remember('job_1', (public.worker_claim_job() ->> 'job_id')::uuid);
select tests.remember('job_2', (public.worker_claim_job() ->> 'job_id')::uuid);
select tests.assert(public.worker_claim_job() is null, 'two jobs (front and back), then nothing');
select tests.assert_fails(format('select public.worker_finish_job(%L, %L)', tests.id('job_1'),
  array[tests.id('job_2') || '/0.jpg']), 'candidate_path_invalid', 'candidates only under the job''s own folder');
select public.worker_finish_job(tests.id('job_1'), array[tests.id('job_1') || '/0.jpg', tests.id('job_1') || '/1.jpg']);
select public.worker_finish_job(tests.id('job_2'), array[tests.id('job_2') || '/0.jpg']);
reset role;
select tests.assert((select status::text from public.vendor_submissions where id = tests.id('sub_a')) = 'photos_ready',
  'both views done: the piece waits for an admin');
set local role authenticated;

-- --- the admin approves -------------------------------------------------------------------------------------------
select tests.act_as(tests.id('vend_a'));
select tests.assert_fails(format('select public.admin_approve_submission(%L, %L, %L)', tests.id('sub_a'), '{}', '[]'),
  'admin_only', 'a vendor cannot approve its own piece');
select tests.act_as(tests.id('admin'));
select tests.remember('p_from_sub', public.admin_approve_submission(tests.id('sub_a'),
  jsonb_build_object('name', 'Cotton kurta', 'slug', 'cotton-kurta-from-vendor', 'price_cents', 4800),
  jsonb_build_array(jsonb_build_object('path', 'products/x/front.jpg', 'alt_text', 'Cotton kurta, front'),
                    jsonb_build_object('path', 'products/x/closeup.jpg', 'alt_text', 'Cotton kurta, close-up'))));
select tests.assert((select vendor_id = tests.id('vendor') and status = 'draft' and shop_price_paise = 120000
                     from public.products where id = tests.id('p_from_sub')),
  'approval makes a draft product of the vendor, with its shop price');
select tests.assert((select count(*) from public.product_variants where product_id = tests.id('p_from_sub')) = 2,
  'with the vendor''s sizes');
select tests.assert((select storage_path from public.product_media where product_id = tests.id('p_from_sub')
                     and is_primary) = 'products/x/front.jpg', 'the first picked photo is the main one');

select tests.act_as(tests.id('vend_a'));
select tests.assert((public.vendor_submission(tests.id('sub_a')) -> 'product' ->> 'status') = 'draft',
  'the vendor sees its piece became a product');
select tests.assert(exists (select 1 from jsonb_array_elements(public.vendor_pieces() -> 'items') i
                            where i ->> 'id' = tests.id('p_from_sub')::text),
  'the product is in the vendor''s pieces');

-- --- money ---------------------------------------------------------------------------------------------------------
reset role;
insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, shop_price_paise, status, picked_at)
select oi.id, tests.id('cycle'), tests.id('vendor'), oi.variant_id, oi.quantity, 100000, 'picked', now()
from public.order_items oi where oi.order_id = tests.id('order_a');
set local role authenticated;
select tests.act_as(tests.id('vend_a'));
select tests.assert((public.vendor_money() ->> 'owed_paise')::integer = 100000, 'a collected piece is owed in rupees');
select tests.assert(jsonb_array_length(public.vendor_keep_ready()) = 1, 'a collected piece is no longer kept ready');
select tests.act_as(tests.id('vend_b'));
select tests.assert((public.vendor_money() ->> 'owed_paise')::integer = 0, 'INV-10: vendor B is owed nothing of A''s');

-- --- INV-10: nothing a vendor reads names a buyer, an order, a customer price or a cost structure ----------------
select tests.act_as(tests.id('vend_a'));
select tests.assert(not exists (
  select 1 from (
    select tests.json_keys(public.vendor_me()) k
    union all select tests.json_keys(public.vendor_keep_ready())
    union all select tests.json_keys(public.vendor_money())
    union all select tests.json_keys(public.vendor_pieces())
    union all select tests.json_keys(public.vendor_submission(tests.id('sub_a')))) keys
  where k in ('email', 'phone', 'full_name', 'user_id', 'order_id', 'number', 'order_number', 'shipping_address',
              'price_cents', 'unit_price_cents', 'total_price_cents', 'subtotal_cents', 'total_cents',
              'margin_pct', 'fx_rate', 'admin_note', 'vendor_id', 'receipt_path', 'payment_intent_id')),
  'INV-10: no buyer, order, customer price, cost or admin note in any vendor read');
select tests.assert(position('cust.a@example.test' in (public.vendor_keep_ready()::text || public.vendor_money()::text
  || public.vendor_pieces()::text)) = 0, 'INV-10: the buyer''s email appears nowhere');

-- --- sign-in codes -------------------------------------------------------------------------------------------------
select tests.act_as(tests.id('admin'));
select set_config('tests.code', public.admin_vendor_sign_in_code(tests.id('vend_a'), 7), true);
select set_config('tests.code2', public.admin_vendor_sign_in_code(tests.id('vend_a'), 7), true);
reset role;
select tests.assert_fails(format('select public._redeem_vendor_code(%L)', current_setting('tests.code')),
  'code_not_valid', 'a new code replaces the older unused one');
select tests.assert(public._redeem_vendor_code(current_setting('tests.code2')) = tests.id('vend_a'),
  'a fresh code signs its vendor in');
select tests.assert_fails(format('select public._redeem_vendor_code(%L)', current_setting('tests.code2')),
  'code_not_valid', 'a code works once');
select tests.assert(not exists (select 1 from public.vendor_sign_in_codes
                                where code_hash = convert_to(current_setting('tests.code2'), 'UTF8')),
  'the code itself is never stored');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select set_config('tests.code3', public.admin_vendor_sign_in_code(tests.id('vend_b'), 1), true);
reset role;
update public.vendor_sign_in_codes set expires_at = now() - interval '1 minute' where user_id = tests.id('vend_b');
select tests.assert_fails(format('select public._redeem_vendor_code(%L)', current_setting('tests.code3')),
  'code_not_valid', 'an expired code fails');
update public.vendor_accounts set is_active = false where user_id = tests.id('vend_b');
set local role authenticated;
select tests.act_as(tests.id('vend_b'));
select tests.assert(not public.is_vendor(), 'a switched-off account is no longer a vendor');
select tests.assert_fails('select public.vendor_me()', 'vendor_only', 'and reads nothing');

rollback;
