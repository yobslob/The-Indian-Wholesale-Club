-- Migration 20260928000004 (D-041 shipping options, D-042 refunds): express is
-- offered only once its days are set, orders keep their option, refund amounts
-- follow the rules exactly, cancelling releases stock, and only admins record refunds.
begin;
select tests.setup();
select tests.remember('item_a', (select id from public.order_items where order_id = tests.id('order_a')));

select tests.assert(
  (select shipping_flat_cents = 0 and express_shipping_cents = 800 from public.pricing_settings where id = 1),
  'D-041: standard shipping is free and express costs $8');

-- Express is not offered while its delivery days are unknown (Q-18).
update public.pricing_settings set express_days_min = null, express_days_max = null where id = 1;
set local role service_role;
select tests.assert(public.checkout_context(array[tests.id('v_live')]) -> 'express' = 'null'::jsonb,
  'no express option while the express days are not set');
reset role;
select tests.assert_fails(
  $q$select * from public.create_order(jsonb_build_object(
       'email', 'x@example.test', 'shipping_method', 'express',
       'shipping_address', jsonb_build_object('fullName', 'X'),
       'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1, 'unit_price_cents', 5000)),
       'subtotal_cents', 5000, 'shipping_cents', 800, 'total_cents', 5800, 'payment_intent_id', 'pi_test_express_x'))$q$,
  'express_unavailable', 'an express order is refused while express is not set up');

-- Once the days are set, express windows come from the open cycle + express days.
update public.pricing_settings set express_days_min = 1, express_days_max = 2 where id = 1;
update public.product_variants set qty_listed = 10 where id in (tests.id('v_live'), tests.id('v_live2'));
set local role service_role;
select tests.assert(
  (select (e ->> 'price_cents')::int = 800
          and (e ->> 'est_delivery_from')::date = (select est_arrival_on + 1 from public.cycles where id = tests.id('cycle'))
          and (e ->> 'est_delivery_to')::date = (select est_arrival_on + 2 from public.cycles where id = tests.id('cycle'))
   from (select public.checkout_context(array[tests.id('v_live')]) -> 'express' as e) x),
  'express option: $8, window = estimated arrival + express days');
reset role;

-- Order C: 2 × v_live (5000) + 1 × v_live2 (6000), 10% promo, express, 8% tax on 15200
select tests.remember('order_c', (select order_id from public.create_order(jsonb_build_object(
  'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'), 'shipping_method', 'express',
  'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                         'state', 'TX', 'zipCode', '73301'),
  'items', jsonb_build_array(
     jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 2, 'unit_price_cents', 5000),
     jsonb_build_object('variant_id', tests.id('v_live2'), 'quantity', 1, 'unit_price_cents', 6000)),
  'subtotal_cents', 16000, 'discount_cents', 1600, 'shipping_cents', 800, 'tax_cents', 1216,
  'total_cents', 16416, 'payment_intent_id', 'pi_test_order_c'))));
select tests.assert(
  (select shipping_method = 'express'
          and est_delivery_to = (select est_arrival_on + 2 from public.cycles where id = tests.id('cycle'))
   from public.orders where id = tests.id('order_c')),
  'the order keeps its option and gets the express window');

-- Only admins read or record refunds
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(public.cancel_refund_cents(tests.id('order_a'), 'our_fault') is null
  and public.item_refund_cents(tests.id('item_a')) is null,
  'a customer gets no refund amounts');
select tests.assert_fails(format('select public.cancel_order(%L, %L, 5400, null)', tests.id('order_a'), 'our_fault'),
  'admin_only', 'a customer cannot cancel through the admin function');
select tests.assert(
  (select customer_status = 'confirmed' and shipping_method = 'standard' and refunded_cents = 0
   from public.store_orders where id = tests.id('order_a')),
  'customers see their shipping option and refunded amount');

-- D-042 cancel before cutoff
select tests.act_as(tests.id('admin'));
select tests.assert(public.cancel_refund_cents(tests.id('order_a'), 'customer_request') = 5000,
  'customer''s own cancel: everything except the tax (5400 − 400)');
select tests.assert(public.cancel_refund_cents(tests.id('order_b'), 'our_fault') = 6000,
  'cancel because of us: everything');
select tests.assert_fails(format('select public.cancel_order(%L, %L, 5400, null)', tests.id('order_a'), 'customer_request'),
  'refund_amount_mismatch', 'the refund must match the rule');
select tests.assert_fails(format('select public.cancel_order(%L, %L, 5000, null)', tests.id('order_a'), 'changed_mind'),
  'invalid_cancel_reason', 'only the two known reasons');
select set_config('tests.reserved_before', (select qty_reserved::text from public.product_variants where id = tests.id('v_live')), true);
select public.cancel_order(tests.id('order_a'), 'customer_request', 5000, 're_test_a');
select tests.assert(
  (select status = 'cancelled' and refunded_cents = 5000 and payment_status = 'partially_refunded'
   from public.orders where id = tests.id('order_a')),
  'order A is cancelled with the tax kept (partially refunded)');
select tests.assert(
  (select qty_reserved from public.product_variants where id = tests.id('v_live'))
  = current_setting('tests.reserved_before')::int - 1,
  'INV-3: the cancelled piece is released back to stock');
select tests.assert(
  exists (select 1 from public.stock_movements where ref_id = tests.id('order_a') and reason = 'released'
          and delta_reserved = -1),
  'INV-4: the release is in the stock ledger');
select tests.assert((select bool_and(status = 'refunded') from public.order_items where order_id = tests.id('order_a')),
  'its items are marked refunded');
select public.cancel_order(tests.id('order_b'), 'our_fault', 6000, 're_test_b');
select tests.assert(
  (select status = 'cancelled' and payment_status = 'refunded' from public.orders where id = tests.id('order_b')),
  'order B is fully refunded');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select customer_status = 'cancelled' and refunded_cents = 5000 from public.store_orders where id = tests.id('order_a'))
  and exists (select 1 from public.store_order_events where order_id = tests.id('order_a') and kind = 'order_cancelled')
  and not exists (select 1 from public.store_order_events where message ilike '%re_test%'),
  'the customer sees the cancellation and amount, never the internal refund note');

-- D-030 / D-042: pieces unavailable at pickup
select tests.act_as(tests.id('admin'));
select public.cutoff_cycle(tests.id('cycle'));
select tests.assert_fails(format('select public.cancel_order(%L, %L, 16416, null)', tests.id('order_c'), 'our_fault'),
  'order_not_cancellable', 'after cutoff an order is not cancelled this way');
select tests.remember('item_c2', (select id from public.order_items where order_id = tests.id('order_c')
                                   and variant_id = tests.id('v_live2')));
select tests.remember('item_c1', (select id from public.order_items where order_id = tests.id('order_c')
                                   and variant_id = tests.id('v_live')));
select tests.assert_fails(format('select public.refund_order_item(%L, 1, null)', tests.id('item_c1')),
  'item_not_refundable', 'an item that is still coming cannot be refunded');
select public.mark_pickup((select id from public.pickups where order_item_id = tests.id('item_c2')), 'unavailable');
-- goods = 6000 − 10% share of the discount (600) = 5400; tax share = 1216 × 5400 / 15200 = 432
select tests.assert(public.item_refund_cents(tests.id('item_c2')) = 5832,
  'unavailable piece: its price after discount + its share of the tax');
select tests.assert_fails(format('select public.refund_order_item(%L, 5000, null)', tests.id('item_c2')),
  'refund_amount_mismatch', 'a different amount is refused');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.refund_order_item(%L, 5832, null)', tests.id('item_c2')),
  'admin_only', 'a customer cannot record a refund');
select tests.act_as(tests.id('admin'));
select public.refund_order_item(tests.id('item_c2'), 5832, 're_test_c2');
select tests.assert(
  (select refunded_cents = 5832 and payment_status = 'partially_refunded' and status = 'collecting'
   from public.orders where id = tests.id('order_c')),
  'the order goes on with the other piece, partly refunded');
select public.mark_pickup((select id from public.pickups where order_item_id = tests.id('item_c1')), 'unavailable');
select tests.assert(public.item_refund_cents(tests.id('item_c1')) = 16416 - 5832,
  'the last piece refunds everything left (complete refund incl. express shipping)');
select public.refund_order_item(tests.id('item_c1'), 16416 - 5832, 're_test_c1');
select tests.assert(
  (select refunded_cents = total_cents and payment_status = 'refunded' and status = 'refunded'
   from public.orders where id = tests.id('order_c')),
  'nothing left to ship: the order is refunded in full');
select tests.assert_fails(format('select public.refund_order_item(%L, 1, null)', tests.id('item_c1')),
  'item_not_refundable', 'an item is refunded once');
reset role;
rollback;
