-- D-115, D-187: every order is made to order: the store's window is today + the delivery days in business days, and an
-- order's pieces are on the buy list at once.
begin;
select tests.setup();

update public.pricing_settings set delivery_days_min = 12, delivery_days_max = 18 where id = 1;

select tests.assert(
  (select order_by is null and est_delivery_from = public._add_business_days(current_date, 12)
          and est_delivery_to = public._add_business_days(current_date, 18)
   from public.store_next_delivery()),
  'the window is today + 12 to 18 business days');

set local role service_role;
select tests.assert(
  public.checkout_context(array[tests.id('v_live')]) -> 'delivery' ->> 'est_delivery_to'
    = public._add_business_days(current_date, 18)::text,
  'checkout prices with the same window');
select tests.remember('pilot_order', (select order_id from public.create_order(jsonb_build_object(
  'email', 'pilot@example.test', 'shipping_address', '{"line1": "1 Main St"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 5000, 'total_cents', 5000))));
reset role;

select tests.assert(
  (select est_delivery_from = public._add_business_days(current_date, 12)
          and est_delivery_to = public._add_business_days(current_date, 18)
   from public.orders where id = tests.id('pilot_order')),
  'the order has the window it was shown');
select tests.assert(
  (select count(*) = 1 from public.pickups pk
   join public.order_items oi on oi.id = pk.order_item_id where oi.order_id = tests.id('pilot_order')),
  'D-115: the piece is on the buy list at once');

-- Empty days: no honest window, so checkout is closed and no order is made.
update public.pricing_settings set delivery_days_min = null where id = 1;
select tests.assert(not exists (select 1 from public.store_next_delivery()), 'no days: no window');
select tests.assert_fails(
  format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000))$q$, tests.id('v_live')),
  'delivery_window_unconfigured', 'no order without its days');

select tests.assert_fails('update public.pricing_settings set delivery_days_min = 20, delivery_days_max = 10',
  '23514', 'the latest day cannot come before the earliest');

rollback;
