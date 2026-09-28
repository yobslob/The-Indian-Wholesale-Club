-- advance_cycle (migration 20260928000003): cycle + its orders move together,
-- internal events only (customers keep "Preparing your order", D-034), closing
-- needs every order finished, admin only (INV-7).
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'admin_only',
  'a customer cannot advance a cycle');
select tests.act_as(tests.id('fake_admin'));
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'admin_only',
  'INV-7: role admin without an allowlisted email cannot advance a cycle');

select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'cycle_cannot_advance',
  'an open cycle must go through cutoff_cycle (which creates the pickups)');
select public.cutoff_cycle(tests.id('cycle'));

select tests.assert(public.advance_cycle(tests.id('cycle')) = 'packed', 'collecting → packed');
select tests.assert((select bool_and(status = 'packed') from public.orders where cycle_id = tests.id('cycle')),
  'its orders move to packed');
select tests.assert(public.advance_cycle(tests.id('cycle')) = 'exported', 'packed → exported');
select tests.assert(
  (select exported_at is not null from public.cycles where id = tests.id('cycle'))
  and (select bool_and(status = 'in_transit') from public.orders where cycle_id = tests.id('cycle')),
  'exported: timestamp set, orders in transit');
select tests.assert(public.advance_cycle(tests.id('cycle')) = 'arrived', 'exported → arrived');
select tests.assert((select bool_and(status = 'arrived') from public.orders where cycle_id = tests.id('cycle')),
  'its orders arrive');
select tests.assert(public.advance_cycle(tests.id('cycle')) = 'fulfilling', 'arrived → fulfilling');
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'cycle_has_open_orders',
  'a cycle cannot close while an order is not delivered, cancelled or refunded');
reset role;

-- customers still see "preparing" and no internal cycle events
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert((select customer_status from public.store_orders where id = tests.id('order_a')) = 'preparing',
  'D-034: packed / in transit / arrived all show as "preparing"');
select tests.assert(not exists (select 1 from public.store_order_events where kind like 'cycle_%'),
  'D-003: cycle events are internal');
reset role;
select tests.assert(
  (select count(*) from public.order_events where order_id = tests.id('order_a') and kind like 'cycle_%'
     and not visible_to_customer) = 4,
  'one internal event per step for each order (packed, exported, arrived, fulfilling)');

-- finish both orders, then the cycle can close
update public.orders set status = 'delivered' where cycle_id = tests.id('cycle');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.advance_cycle(tests.id('cycle')) = 'closed', 'fulfilling → closed once every order is done');
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'cycle_cannot_advance',
  'closed is final');
reset role;
rollback;
