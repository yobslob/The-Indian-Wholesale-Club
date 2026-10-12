-- D-115: the made-to-order pilot. With its delivery days set, the store's window is today + those days (no "order
-- by"), and a standard order needs no cycle: no cycle on the order, its pieces on the pickup list at once.
begin;
select tests.setup();

update public.pricing_settings set pilot_delivery_days_min = 12, pilot_delivery_days_max = 18 where id = 1;
update public.cycles set status = 'closed', closed_at = now() where status = 'open'; -- no open cycle at all

select tests.assert(
  (select order_by is null and est_delivery_from = current_date + 12 and est_delivery_to = current_date + 18
   from public.store_next_delivery()),
  'D-115: the window is today + 12 to 18 days, with no order-by time');

set local role service_role;
select tests.assert(
  public.checkout_context(array[tests.id('v_live')]) -> 'delivery' ->> 'est_delivery_to' = (current_date + 18)::text,
  'checkout prices with the same window, so it is open without a cycle');
select tests.remember('pilot_order', (select order_id from public.create_order(jsonb_build_object(
  'email', 'pilot@example.test', 'shipping_address', '{"line1": "1 Main St"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 5000, 'total_cents', 5000))));
reset role;

select tests.assert(
  (select cycle_id is null and est_delivery_from = current_date + 12 and est_delivery_to = current_date + 18
   from public.orders where id = tests.id('pilot_order')),
  'D-115: the order has no cycle and the window it was shown');
select tests.assert(
  (select count(*) = 1 and bool_and(pk.cycle_id is null) from public.pickups pk
   join public.order_items oi on oi.id = pk.order_item_id where oi.order_id = tests.id('pilot_order')),
  'D-115: the piece is on the pickup list at once, to be bought now');

-- With the pilot days empty, the cycle model is back (D-008): no open cycle, no order.
update public.pricing_settings set pilot_delivery_days_min = null where id = 1;
select tests.assert(not exists (select 1 from public.store_next_delivery()), 'no pilot and no cycle: no window');
select tests.assert_fails(
  format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000))$q$, tests.id('v_live')),
  'no_open_cycle', 'the cycle model needs an open cycle again');

select tests.assert_fails('update public.pricing_settings set pilot_delivery_days_min = 20, pilot_delivery_days_max = 10',
  '23514', 'the latest day cannot come before the earliest');

rollback;
