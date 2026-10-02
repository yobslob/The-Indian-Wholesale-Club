-- Moving orders between cycles and the faster-delivery offer (migration 14; flows.md §6b, D-045, D-064, INV-6).
begin;
select tests.setup();

-- An earlier cycle still collecting (cycle 5 in D-045's example); the open test cycle is cycle 6. Its arrival
-- slips after both orders were placed (they were promised arrival + 3..7 = today + 23..27).
insert into public.cycles (code, status, cutoff_at, est_export_on, est_arrival_on)
values ('TEST-EARLY', 'collecting', now() - interval '1 day', current_date + 2, current_date + 10)
returning tests.remember('early', id);
update public.cycles set est_arrival_on = current_date + 25 where id = tests.id('cycle');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.move_order(%L, %L)', tests.id('order_a'), tests.id('early')),
  'admin_only', 'a customer cannot move an order');
select tests.assert((select count(*) from public.order_moves) = 0, 'customers cannot read moves');

select tests.act_as(tests.id('admin'));
select tests.remember('m1', public.move_order(tests.id('order_a'), tests.id('early')));
select tests.assert(
  (select cycle_id = tests.id('early') and status = 'collecting'
          and est_delivery_from = current_date + 23 and est_delivery_to = current_date + 27
   from public.orders where id = tests.id('order_a')),
  'D-064: moved earlier, the order follows the cycle but keeps its promised window');
select tests.assert(
  (select count(*) from public.pickups p join public.order_items oi on oi.id = p.order_item_id
   where oi.order_id = tests.id('order_a') and p.cycle_id = tests.id('early')) = 1,
  'joining a cycle past its cutoff puts its piece on that pickup list');
select tests.assert((select earlier from public.order_moves where id = tests.id('m1')), 'the move is recorded as earlier');
select tests.assert(
  exists (select 1 from public.order_events where order_id = tests.id('order_a') and kind = 'preparing' and visible_to_customer)
  and exists (select 1 from public.order_events where order_id = tests.id('order_a') and kind = 'moved_to_cycle'
              and not visible_to_customer),
  'the customer sees "preparing"; the move itself is internal (D-003)');

-- Missed that export after all: back to the open cycle, whose arrival slipped.
select tests.remember('m2', public.move_order(tests.id('order_a'), tests.id('cycle'), 'missed the export'));
select tests.assert(
  (select cycle_id = tests.id('cycle') and status = 'collecting'
          and est_delivery_from = current_date + 28 and est_delivery_to = current_date + 32
   from public.orders where id = tests.id('order_a')),
  'D-008: moved later, the window changes (the piece stays on the pickup list)');
select tests.assert(
  exists (select 1 from public.order_events where order_id = tests.id('order_a')
          and kind = 'delivery_window_changed' and visible_to_customer),
  'INV-6: a later window is never silent');
select tests.assert(
  (select count(*) from public.pickups p join public.order_items oi on oi.id = p.order_item_id
   where oi.order_id = tests.id('order_a') and p.cycle_id = tests.id('cycle')) = 1,
  'its piece moves with it, not duplicated');
select tests.assert_fails(format('select public.confirm_move_shipped(%L)', tests.id('m1')), 'move_superseded',
  'an older move of an order cannot be confirmed');
select tests.assert_fails(format('select public.move_order(%L, %L)', tests.id('order_a'), tests.id('cycle')),
  'same_cycle', 'an order cannot move to its own cycle');

-- Both orders squeezed into the earlier export.
select tests.remember('m3', public.move_order(tests.id('order_a'), tests.id('early')));
select tests.remember('m4', public.move_order(tests.id('order_b'), tests.id('early')));
select tests.assert_fails(format('select public.confirm_move_shipped(%L)', tests.id('m4')), 'cycle_not_exported',
  'D-045: nothing is offered before the export has really left');
select public.advance_cycle(tests.id('early'));
select public.advance_cycle(tests.id('early'));
select tests.assert_fails(format('select public.move_order(%L, %L)', tests.id('order_a'), tests.id('cycle')),
  'order_cannot_move', 'an order in transit cannot move');

select tests.assert(public.confirm_move_shipped(tests.id('m3')) = 'none',
  'D-064: with no offer price set, no offer is made');
select tests.assert_fails(format('select public.confirm_move_shipped(%L)', tests.id('m3')), 'move_not_pending',
  'a move is confirmed once');
reset role;

update public.pricing_settings set fast_offer_cents = 500 where id = 1;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.confirm_move_shipped(tests.id('m4')) = 'offered',
  'D-064: confirmed shipped earlier, the customer is offered the earlier window');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_b'));
select tests.assert(
  (select public.store_my_order(o.order_number) -> 'offer' from public.store_orders o where o.id = tests.id('order_b'))
  = jsonb_build_object('price_cents', 500, 'est_delivery_from', current_date + 13, 'est_delivery_to', current_date + 17),
  'the customer sees the offer: its price and the earlier window, nothing else (D-003)');
select tests.assert(
  (select est_delivery_to from public.store_orders where id = tests.id('order_b')) = current_date + 27,
  'until they take it, the promised window stays');
select tests.assert(exists (select 1 from public.store_order_events where order_id = tests.id('order_b')
                            and kind = 'faster_delivery_offer'), 'the offer is an update on the order');
select tests.assert_fails(format('select public.accept_fast_offer(%L, %L)', tests.id('m4'), 'pi_x'), '42501',
  'only the server accepts an offer, after Stripe confirmed the payment');
reset role;

select tests.assert(
  (select g -> 'offer' -> 'price_cents' = '500'::jsonb
   from public.guest_order_lookup((select order_number from public.orders where id = tests.id('order_b')),
                                  'cust.b@example.test') g),
  'guests see the same offer');

select public.accept_fast_offer(tests.id('m4'), 'pi_fast_offer');
select tests.assert(
  (select est_delivery_from = current_date + 13 and est_delivery_to = current_date + 17
   from public.orders where id = tests.id('order_b')),
  'D-064: paid, the window moves to the one offered');
select tests.assert(
  (select offer_status = 'accepted' and payment_intent_id = 'pi_fast_offer' from public.order_moves where id = tests.id('m4')),
  'the payment is recorded on the move');
select tests.assert(
  exists (select 1 from public.order_events where order_id = tests.id('order_b')
          and kind = 'faster_delivery_accepted' and visible_to_customer),
  'the new window is a visible update (INV-6)');
select tests.assert(public._order_offer(tests.id('order_b')) is null, 'an accepted offer is no longer shown');
select tests.assert_fails(format('select public.accept_fast_offer(%L, %L)', tests.id('m4'), 'pi_again'),
  'offer_not_open', 'an offer is taken once');

-- In the US: order A (no offer) hears it came sooner; order B paid for it, so no second note.
update public.orders set status = 'shipped' where id in (tests.id('order_a'), tests.id('order_b'));
select tests.assert(
  exists (select 1 from public.order_events where order_id = tests.id('order_a') and kind = 'arriving_sooner'
          and visible_to_customer),
  'D-064: shipped early without taking an offer, the customer is told it came sooner');
select tests.assert(
  not exists (select 1 from public.order_events where order_id = tests.id('order_b') and kind = 'arriving_sooner'),
  'no "sooner" note after they paid for it');

rollback;
