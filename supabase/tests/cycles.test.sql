-- INV-5 (one open cycle) + the cycle → pickup → payout flow (flows.md §1, §4, §5).
begin;
select tests.setup();

select tests.assert_fails(
  $q$insert into public.cycles (code, status, cutoff_at, est_arrival_on)
     values ('SECOND-OPEN', 'open', now() + interval '1 day', current_date + 30)$q$,
  '23505', 'INV-5: a second open cycle is rejected');

set local role authenticated;
select tests.act_as(tests.id('admin'));

select tests.assert(public.cutoff_cycle(tests.id('cycle')) = 2, 'cutoff creates one pickup per ordered piece (2)');
select tests.assert((select status::text from public.cycles where id = tests.id('cycle')) = 'collecting',
  'cycle moves to collecting');
select tests.assert_fails(format('select public.cutoff_cycle(%L)', tests.id('cycle')), 'cycle_not_open',
  'a cycle can only be cut off once');

-- piece for order A is picked
select public.mark_pickup((select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                           where oi.order_id = tests.id('order_a')), 'picked');
-- piece for order B is gone from the shop
select public.mark_pickup((select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                           where oi.order_id = tests.id('order_b')), 'unavailable', null, 'sold in shop');

select tests.assert_fails(
  format('select public.mark_pickup(%L, %L)',
         (select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
          where oi.order_id = tests.id('order_a')), 'picked'),
  'pickup_not_pending', 'a pickup can only be marked once');

select tests.assert(
  (select qty_listed || '/' || qty_reserved from public.product_variants where id = tests.id('v_live')) = '1/0',
  'picked: the piece leaves listed and reserved stock');
select tests.assert(
  (select qty_listed || '/' || qty_reserved from public.product_variants where id = tests.id('v_live2')) = '0/0',
  'unavailable: the piece leaves listed and reserved stock');
select tests.assert(
  (select status::text from public.order_items where order_id = tests.id('order_b')) = 'unavailable',
  'D-030: the unavailable item is flagged for refund');

-- payout covers the picked piece; amount is computed, never typed
select tests.remember('payout', public.record_payout(
  tests.id('vendor'),
  array(select p.id from public.pickups p where p.status = 'picked' and p.cycle_id = tests.id('cycle')),
  'upi', 'UPI-REF-1'));
select tests.assert((select amount_paise from public.vendor_payouts where id = tests.id('payout')) = 100000,
  'payout amount = picked quantity x shop price');
select tests.assert_fails(
  format('select public.record_payout(%L, array(select id from public.pickups where payout_id = %L), %L)',
         tests.id('vendor'), tests.id('payout'), 'cash'),
  'invalid_pickups_for_payout', 'a pickup cannot be paid twice');
reset role;

-- customers see "preparing" and the unavailable-item notice, never pickup details
set local role authenticated;
select tests.act_as(tests.id('cust_b'));
select tests.assert((select customer_status from public.store_orders where id = tests.id('order_b')) = 'preparing',
  'D-034: while in India the customer sees "preparing"');
select tests.assert(
  exists (select 1 from public.store_order_events where order_id = tests.id('order_b') and kind = 'item_unavailable'),
  'D-030: the customer is notified that an item is unavailable');
select tests.assert(
  not exists (select 1 from public.store_order_events where message ilike '%shop%'),
  'D-003: customer-visible events never mention the shop');
reset role;

rollback;
