-- Ordering from the shop, the cost snapshot, invoice C and the admins' new-order email (migration 20261018090000,
-- D-140 plan F3, F4, A1). Admins only.
begin;
select tests.setup();

-- A paid order emails every admin on the allowlist.
select tests.assert((select count(*) = 1 from public.email_outbox
                      where kind = 'admin_new_order' and recipient = 'admin@example.test'
                        and payload ->> 'orderNumber' = (select order_number from public.orders where id = tests.id('order_a'))),
  'a paid order queues one email to each admin');

-- The cost snapshot is taken when the order is placed.
select tests.assert((select shop_price_paise = 100000 and pricing_rule = 'hand' and inr_per_usd = 92
                       from public.order_items where order_id = tests.id('order_a')),
  'an order line keeps the shop price, the rate and the rule (a hand-set price) it was sold at');
update public.product_variants set shop_price_paise = 80000, weight_g = 450, weight_source = 'admin', qty_listed = 5
 where id = tests.id('v_live');
create temp table o2 on commit drop as select * from public.create_order(jsonb_build_object(
  'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
  'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                         'state', 'TX', 'zipCode', '73301'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 2,
                                                'unit_price_cents', 5000)),
  'subtotal_cents', 10000, 'total_cents', 10000, 'payment_intent_id', 'pi_test_order_c'));
select tests.remember('order_c', (select order_id from o2));
select tests.assert((select shop_price_paise = 80000 and weight_g = 450 and weight_source = 'admin'
                       from public.order_items where order_id = tests.id('order_c')),
  'a variant with its own shop price and weight is snapshotted with them');
update public.product_variants set shop_price_paise = 99000, weight_g = 900 where id = tests.id('v_live');
select tests.assert((select shop_price_paise = 80000 and weight_g = 450 from public.order_items where order_id = tests.id('order_c')),
  'a later price or weight change does not move a placed order''s cost');

-- Pickups take the variant's own shop price and its shop item in use.
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise, in_stock, delivery_days)
values (tests.id('p_live'), tests.id('v_live'), 'amazon.in', 'https://www.amazon.in/dp/B0TEST0001',
        'https://www.amazon.in/dp/B0TEST0001', 'B0TEST0001', 99000, true, 3);
select tests.remember('src', (select id from public.product_sources where item_key = 'B0TEST0001'));
update public.product_variants set source_id = tests.id('src') where id = tests.id('v_live');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.cutoff_cycle(tests.id('cycle'));
select tests.remember('pick_c', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_c')));
select tests.remember('pick_b', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_b')));
select tests.assert((select shop_price_paise = 99000 and source_id = tests.id('src') from public.pickups where id = tests.id('pick_c')),
  'a pickup carries the variant''s own shop price (not the listing''s) and the shop item in use');

-- To order: every piece not yet ordered, with the shop item's address.
select tests.assert((select item_url = 'https://www.amazon.in/dp/B0TEST0001' and item_key = 'B0TEST0001' and quantity = 2
                       from public.admin_to_order() where pickup_id = tests.id('pick_c')),
  'To order lists the piece with the shop item in use, not the page first imported');
select tests.assert((select count(*) = 3 from public.admin_to_order()
                      where order_id in (tests.id('order_a'), tests.id('order_b'), tests.id('order_c'))),
  'every unordered piece of the three orders is listed');

-- Mark ordered: what was paid defaults to the shop price × quantity; the shop bill's row follows.
select tests.assert(public.admin_mark_ordered(jsonb_build_array(jsonb_build_object('pickup', tests.id('pick_c'))),
                                              '402-1234567', 'shop-bills/test/bill.jpg') = 1,
  'an admin marks a piece ordered');
select tests.assert((select ordered_at is not null and ordered_by = tests.id('admin') and paid_paise = 198000
                            and shop_order_ref = '402-1234567' and status = 'pending'
                       from public.pickups where id = tests.id('pick_c')),
  'the piece is ordered (still to reach the hub), paid at its shop price × 2 by default');
select tests.assert(not exists (select 1 from public.admin_to_order() where pickup_id = tests.id('pick_c')),
  'an ordered piece leaves To order');
select tests.assert((select l.unit_paise = 99000 and l.shop_order_ref = '402-1234567' and l.quantity = 2
                       from public.shop_bill_lines l join public.shop_bills b on b.id = l.bill_id
                      where b.order_id = tests.id('order_c') and l.kind = 'piece'),
  'the order''s shop bill (invoice C) gets the row filled, nothing typed twice');
select tests.assert((select count(*) = 1 from public.shop_bill_photos ph join public.shop_bills b on b.id = ph.bill_id
                      where b.order_id = tests.id('order_c')),
  'the bill photo is kept on the shop bill');
select tests.assert((select count(*) = 1 from public.order_events where order_id = tests.id('order_c') and kind = 'shop_ordered'
                        and not visible_to_customer),
  'the timeline says it was ordered, admins only');
select public.admin_mark_ordered(jsonb_build_array(jsonb_build_object('pickup', tests.id('pick_b'), 'paid_paise', 54321)));
select tests.assert((select paid_paise = 54321 from public.pickups where id = tests.id('pick_b')), 'a typed amount paid is kept');
select public.admin_unmark_ordered(tests.id('pick_b'));
select tests.assert((select ordered_at is null and paid_paise is null from public.pickups where id = tests.id('pick_b')),
  'a wrong Mark ordered can be undone while the piece is not at the hub');
select public.mark_pickup(tests.id('pick_b'), 'picked');
select tests.assert_fails(format('select public.admin_mark_ordered(%L::jsonb)', jsonb_build_array(jsonb_build_object('pickup', tests.id('pick_b')))),
  'pickup_not_pending', 'a piece already at the hub is not marked ordered');

-- Invoice C: a form with extras (a coupon as a minus), locked when final, reopened with a note on the timeline.
select tests.remember('bill', public.admin_shop_bill(tests.id('order_c')));
select tests.assert(public.admin_shop_bill(tests.id('order_c')) = tests.id('bill'), 'one shop bill per order');
select public.admin_save_shop_bill(tests.id('bill'), jsonb_build_array(
  jsonb_build_object('kind', 'piece', 'order_item_id', (select id from public.order_items where order_id = tests.id('order_c')),
                     'label', 'Test live product · Free size', 'quantity', 2, 'unit_paise', 95000, 'shop', 'amazon.in'),
  jsonb_build_object('kind', 'delivery', 'label', 'Delivery', 'unit_paise', 4000),
  jsonb_build_object('kind', 'extra', 'label', 'Coupon', 'unit_paise', -10000)), 'Paid by card');
select tests.assert((select sum(quantity * unit_paise) = 184000 from public.shop_bill_lines where bill_id = tests.id('bill')),
  'the rows add up: 2 × ₹950 + ₹40 delivery − ₹100 coupon');
select public.admin_set_shop_bill_final(tests.id('bill'), true);
select tests.assert_fails(format('select public.admin_save_shop_bill(%L, %L::jsonb)', tests.id('bill'), '[]'), 'shop_bill_final',
  'a final bill cannot be changed');
select tests.assert_fails(format('delete from public.shop_bill_lines where bill_id = %L', tests.id('bill')), 'shop_bill_final',
  'not even its rows directly');
select public.admin_set_shop_bill_final(tests.id('bill'), false);
select tests.assert((select count(*) = 1 from public.order_events where order_id = tests.id('order_c') and kind = 'shop_bill_reopened'),
  'reopening it is logged on the order');

-- The customer's order (the email's and the order page's source) carries none of the cost snapshot or shop fields.
reset role;
select tests.assert(
  not exists (select 1 from tests.json_keys(public.guest_order_lookup(
                (select order_number from public.orders where id = tests.id('order_c')), 'cust.a@example.test')) k
              where k = any (tests.forbidden_keys())),
  'the customer''s order shows no shop price, weight, rate, rule or shop order number (D-003)');
set local role authenticated;

-- Customers never reach any of it.
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select * from public.admin_to_order()', 'admin_only', 'customers cannot list pieces to order');
select tests.assert_fails(format('select public.admin_mark_ordered(%L::jsonb)', jsonb_build_array(jsonb_build_object('pickup', tests.id('pick_c')))),
  'admin_only', 'customers cannot mark pieces ordered');
select tests.assert((select count(*) = 0 from public.shop_bills), 'customers cannot read shop bills');
select tests.assert((select count(*) = 0 from public.shop_bill_lines), 'nor their rows');
select tests.act_as(tests.id('fake_admin'));
select tests.assert_fails(format('select public.admin_shop_bill(%L)', tests.id('order_c')), 'admin_only',
  'nor an admin role without the allowlist');
reset role;

rollback;
