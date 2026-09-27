-- INV-6: the delivery window promised at payment is never silently changed (D-008).
begin;
select tests.setup();

select tests.assert(
  (select bool_and(order_number ~ '^IWC-[0-9]{6}-[0-9A-F]{10}$') from public.orders
   where id in (tests.id('order_a'), tests.id('order_b'))),
  'order numbers are IWC-YYMMDD-<10 hex> (40 bits, not enumerable)');

select tests.assert(
  (select est_delivery_from = current_date + 23 and est_delivery_to = current_date + 27
   from public.orders where id = tests.id('order_a')),
  'the window = cycle arrival (+20 days) + domestic days (3..7)');

select tests.assert_fails(
  format('update public.orders set est_delivery_to = est_delivery_to + 10 where id = %L', tests.id('order_a')),
  'change_delivery_window', 'INV-6: a direct window update is rejected');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.change_delivery_window(tests.id('order_a'), current_date + 30, current_date + 35, 'export delayed');
reset role;

select tests.assert(
  (select est_delivery_to = current_date + 35 from public.orders where id = tests.id('order_a')),
  'INV-6: change_delivery_window updates the window');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  exists (select 1 from public.store_order_events
          where order_id = tests.id('order_a') and kind = 'delivery_window_changed'),
  'INV-6 / D-008: the customer sees a delivery-window-changed event');
select tests.assert(
  not exists (select 1 from public.store_order_events where message = 'export delayed'),
  'the internal note is not shown to the customer');
reset role;

update public.pricing_settings set domestic_days_min = null where id = 1;
select tests.assert_fails(
  format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000))$q$, tests.id('v_live')),
  'delivery_window_unconfigured', 'no order without a configured delivery window (never invented)');

update public.cycles set status = 'collecting' where id = tests.id('cycle');
select tests.assert_fails(
  $q$select public.create_order('{"items": [{}]}'::jsonb)$q$,
  'no_open_cycle', 'no order without an open cycle');

rollback;
