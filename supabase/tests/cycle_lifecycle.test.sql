-- C4's "done when": one cycle runs from open to closed, by itself where it should and by admin action elsewhere
-- (flows.md §1, §4, §6, §6b; D-045, D-063, D-064, D-066). Every step is a real function call.
begin;
select tests.setup();
update public.pricing_settings set cycle_days = 21, fast_offer_cents = null where id = 1;

-- Open: two orders are in (fixture). The cutoff passes.
update public.cycles set cutoff_at = now() - interval '1 minute' where id = tests.id('cycle');
select tests.assert(public.roll_cycles() = 1, '1. at its cutoff the cycle closes by itself');
select tests.assert((select status = 'collecting' from public.cycles where id = tests.id('cycle')), '   …and collects');
select tests.remember('next', (select id from public.cycles where status = 'open'));
select tests.assert(tests.id('next') is not null, '2. the next cycle is open for orders');

set local role authenticated;
select tests.act_as(tests.id('admin'));

-- India desk: pick what the shops have; one piece is gone.
select public.mark_pickup(p.id, case when oi.order_id = tests.id('order_a') then 'picked' else 'unavailable' end::public.pickup_status)
from public.pickups p join public.order_items oi on oi.id = p.order_item_id
where p.cycle_id = tests.id('cycle');
select tests.assert((select count(*) from public.pickups where cycle_id = tests.id('cycle') and status = 'pending') = 0,
  '3. every piece is picked or unavailable');
reset role;
-- order B's only piece was unavailable: refunded in full (refund_order_item needs Stripe; its own test covers it)
update public.orders set status = 'refunded', payment_status = 'refunded' where id = tests.id('order_b');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.advance_cycle(tests.id('cycle'));   -- packed
update public.cycles set awb = 'AWB-123', forwarder = 'Test Forwarder', freight_cents = 12000, duty_cents = 3000,
                         fx_inr_per_usd = 83.5
 where id = tests.id('cycle');
select public.advance_cycle(tests.id('cycle'));   -- exported
select tests.assert((select status = 'exported' and awb = 'AWB-123' and exported_at is not null from public.cycles
                     where id = tests.id('cycle')), '4. packed, export details recorded, exported');
select public.advance_cycle(tests.id('cycle'));   -- arrived

-- US desk: check off, ship, deliver.
select public.check_off_arrival(p.id) from public.pickups p where p.cycle_id = tests.id('cycle') and p.status = 'picked';
select public.advance_cycle(tests.id('cycle'));   -- fulfilling
select public.ship_order(tests.id('order_a'), 'UPS', '1Z999AA10123456784');
select tests.assert_fails(format('select public.advance_cycle(%L)', tests.id('cycle')), 'cycle_has_open_orders',
  '5. the cycle cannot close while an order is on its way');
select public.deliver_order(tests.id('order_a'));
select tests.assert(public.advance_cycle(tests.id('cycle')) = 'closed', '6. every order delivered or refunded: closed');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select array_agg(kind order by created_at) from public.store_order_events where order_id = tests.id('order_a'))
  = array['order_confirmed', 'preparing', 'shipped', 'delivered'],
  '7. the customer saw confirmed → preparing → shipped → delivered, nothing internal (D-003, D-034)');
reset role;

rollback;
