-- INV-2: customers can read their own orders (via store_*) but can never
-- create, change or delete orders, items or events. Fixes the pre-IWC hole
-- (old migration 20260926000007 let customers UPDATE/DELETE their own orders).
begin;
select tests.setup();

insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
values (tests.id('order_a'), 'internal_check', false, 'admin-only note');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));

select tests.assert((select count(*) from public.store_orders) = 1, 'customer A sees exactly their own order');
select tests.assert((select customer_status from public.store_orders where id = tests.id('order_a')) = 'confirmed',
  'customer status is the customer-facing label');
select tests.assert((select count(*) from public.store_order_items where order_id = tests.id('order_a')) = 1,
  'customer A sees their order items');
select tests.assert((select count(*) from public.store_orders where id = tests.id('order_b')) = 0,
  'customer A cannot see customer B''s order');
select tests.assert(
  (select array_agg(kind order by kind) from public.store_order_events where order_id = tests.id('order_a'))
    = array['order_confirmed'],
  'customers see only customer-visible events');

select tests.assert(
  tests.rows_affected(format('update public.orders set status = %L, payment_status = %L where id = %L',
                             'refunded', 'refunded', tests.id('order_a'))) = 0,
  'INV-2: customer cannot update their order');
select tests.assert(tests.rows_affected(format('delete from public.orders where id = %L', tests.id('order_a'))) = 0,
  'INV-2: customer cannot delete their order');
select tests.assert(
  tests.rows_affected(format('update public.order_items set unit_price_cents = 1, total_price_cents = 1 where order_id = %L',
                             tests.id('order_a'))) = 0,
  'INV-2: customer cannot change order items');
select tests.assert(
  tests.rows_affected(format('delete from public.order_events where order_id = %L', tests.id('order_a'))) = 0,
  'INV-2: customer cannot delete order events');
select tests.assert_fails(
  format('insert into public.orders (email, subtotal_cents, total_cents, shipping_address, user_id)
          values (%L, 0, 0, %L, %L)', 'cust.a@example.test', '{}', tests.id('cust_a')),
  '42501', 'INV-2: customer cannot insert orders');
select tests.assert_fails(
  format('select * from public.create_order(%L::jsonb)', '{}'),
  '42501', 'INV-2: customer cannot call create_order');
reset role;

select tests.assert((select status::text from public.orders where id = tests.id('order_a')) = 'confirmed',
  'INV-2: order A is unchanged after the attempts');
select tests.assert((select payment_status::text from public.orders where id = tests.id('order_a')) = 'paid',
  'INV-2: payment status is unchanged after the attempts');

rollback;
