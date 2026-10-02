-- US pack & ship (migration 16; flows.md §6.4, D-066): only arrived orders ship, only shipped orders are delivered.
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('select public.ship_order(%L, %L, %L)', tests.id('order_a'), 'USPS', '9400100000000000000000'),
  'order_not_arrived', 'an order still in India cannot ship');

select public.cutoff_cycle(tests.id('cycle'));
select public.advance_cycle(tests.id('cycle'));   -- packed
select public.advance_cycle(tests.id('cycle'));   -- exported
select public.advance_cycle(tests.id('cycle'));   -- arrived

select tests.assert_fails(format('select public.deliver_order(%L)', tests.id('order_a')), 'order_not_shipped',
  'an order is shipped before it is delivered');
select tests.assert_fails(format('select public.ship_order(%L, %L, %L)', tests.id('order_a'), 'USPS', ' 12 '),
  'invalid_tracking', 'a tracking number is required');

select public.ship_order(tests.id('order_a'), ' USPS ', ' 9400100000000000000000 ');
select tests.assert(
  (select status = 'shipped' and carrier = 'USPS' and tracking_number = '9400100000000000000000'
   from public.orders where id = tests.id('order_a')),
  'shipped with the carrier and tracking number, trimmed');
select tests.assert_fails(format('select public.ship_order(%L, %L, %L)', tests.id('order_a'), 'UPS', '1Z999AA10123456784'),
  'order_not_arrived', 'an order ships once');

select tests.act_as(tests.id('cust_a'));
select tests.assert((select customer_status = 'shipped' and carrier = 'USPS' from public.store_orders
                     where id = tests.id('order_a')), 'the customer sees "Shipped" and the carrier');
select tests.assert(exists (select 1 from public.store_order_events where order_id = tests.id('order_a') and kind = 'shipped'),
  'the customer gets a "Shipped" update');
select tests.assert_fails(format('select public.deliver_order(%L)', tests.id('order_a')), 'admin_only',
  'customers cannot mark their order delivered');

select tests.act_as(tests.id('admin'));
select public.deliver_order(tests.id('order_a'));
reset role;
select tests.assert((select status = 'delivered' from public.orders where id = tests.id('order_a')), 'delivered');
select tests.assert(exists (select 1 from public.order_events where order_id = tests.id('order_a') and kind = 'delivered'
                            and visible_to_customer), 'the customer gets a "Delivered" update');

rollback;
