-- Arrival check-off (migration 15; flows.md §6 step 3): picked pieces only, once the export has arrived, admin only.
begin;
select tests.setup();

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.cutoff_cycle(tests.id('cycle'));
select tests.remember('pick_a', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_a')));
select tests.remember('pick_b', (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                 where oi.order_id = tests.id('order_b')));
select public.mark_pickup(tests.id('pick_a'), 'picked');
select public.mark_pickup(tests.id('pick_b'), 'unavailable');

select tests.assert_fails(format('select public.check_off_arrival(%L)', tests.id('pick_a')), 'cycle_not_arrived',
  'nothing is checked off before the export has arrived');
select public.advance_cycle(tests.id('cycle'));   -- packed
select public.advance_cycle(tests.id('cycle'));   -- exported
select public.advance_cycle(tests.id('cycle'));   -- arrived

select public.check_off_arrival(tests.id('pick_a'));
select tests.assert((select arrived_at is not null and arrived_by = tests.id('admin') from public.pickups
                     where id = tests.id('pick_a')), 'a picked piece is checked off, with who did it');
select public.check_off_arrival(tests.id('pick_a'), false);
select tests.assert((select arrived_at is null from public.pickups where id = tests.id('pick_a')),
  'a tick can be undone');
select tests.assert_fails(format('select public.check_off_arrival(%L)', tests.id('pick_b')), 'pickup_not_picked',
  'a piece that was never picked cannot arrive');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.check_off_arrival(%L)', tests.id('pick_a')), 'admin_only',
  'customers cannot check off pieces');
reset role;
select tests.assert_fails(format('update public.pickups set arrived_at = now() where id = %L', tests.id('pick_b')),
  'pickups_arrived_only_when_picked', 'the table itself refuses an arrival for an unpicked piece');

rollback;
