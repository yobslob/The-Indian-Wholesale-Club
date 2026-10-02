-- Cycles close and open by themselves (migration 13; flows.md §1, D-045, D-063, D-065): the next cycle's dates,
-- no order after a cutoff, what the store shows meanwhile, late payments, the admin cutoff, the timer.
begin;
select tests.setup();

-- Only test cycles count: every other cycle moves ten years back, and one earlier closed cycle sets the gap.
update public.cycles set cutoff_at = cutoff_at - interval '10 years', est_arrival_on = est_arrival_on - 3650,
                         est_export_on = est_export_on - 3650
 where code <> 'TEST-CYCLE';
update public.pricing_settings set cycle_days = null where id = 1;
insert into public.cycles (code, status, cutoff_at, est_export_on, est_arrival_on)
values ('TEST-PREV', 'closed', now() - interval '1 hour' - interval '20 days', current_date - 17, current_date - 1);
update public.cycles set cutoff_at = now() - interval '1 hour', est_export_on = current_date + 3,
                         est_arrival_on = current_date + 19
 where id = tests.id('cycle');

-- Between the cutoff and the roll, the store already shows the cycle an order would join (D-008).
set local role anon;
select tests.assert((select order_by from public.store_next_delivery()) = now() - interval '1 hour' + interval '20 days',
  'D-063: with no setting, the next cutoff copies the gap between the last two cutoffs (20 days)');
select tests.assert((select est_delivery_from from public.store_next_delivery()) = current_date + 19 + 20 + 3,
  'the window shown moves forward with the arrival date');
reset role;

-- D-065: one payment priced before the cutoff, one after it (priced on the projected cycle).
insert into public.product_variants (product_id, sku, label, qty_listed)
values (tests.id('p_live'), 'TEST-LIVE-3', 'Small', 5) returning tests.remember('v_extra', id);
insert into public.pending_orders (payment_intent_id, checkout_payload, created_at)
values ('pi_late', '{}', now() - interval '2 hours'), ('pi_projected', '{}', now() - interval '30 minutes'),
       ('pi_too_late', '{}', now() - interval '3 hours');

create function pg_temp.order_with(p_intent text) returns uuid language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
    'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_extra'), 'quantity', 1,
                                                  'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000, 'payment_intent_id', p_intent));
$$;

select tests.remember('order_late', pg_temp.order_with('pi_late'));

-- create_order rolled the cycle first: closed with its pickups, the next one open with every date moved forward.
select tests.assert((select status::text from public.cycles where id = tests.id('cycle')) = 'collecting',
  'D-045: the cycle closed at its cutoff without an admin');
select tests.assert((select count(*) from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                     where oi.order_id in (tests.id('order_a'), tests.id('order_b'))) = 2,
  'closing by itself creates the pickups, as an admin cutoff does');
select tests.remember('next', (select id from public.cycles where status = 'open'));
select tests.assert(
  (select cutoff_at = now() - interval '1 hour' + interval '20 days' and est_export_on = current_date + 23
          and est_arrival_on = current_date + 39 and notes like 'Opened by itself%'
   from public.cycles where id = tests.id('next')),
  'D-063: the next cycle opened with cutoff, export and arrival moved forward by the same step');

select tests.assert(
  (select cycle_id = tests.id('cycle') and status = 'collecting'
          and est_delivery_from = current_date + 19 + 3 and est_delivery_to = current_date + 19 + 7
   from public.orders where id = tests.id('order_late')),
  'D-065: priced before the cutoff, paid after: joins that cycle with the window it was shown');
select tests.assert(exists (select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                            where oi.order_id = tests.id('order_late') and p.cycle_id = tests.id('cycle')),
  'D-065: and its piece joins the pickup list');
select tests.assert(exists (select 1 from public.order_events where order_id = tests.id('order_late')
                            and kind = 'preparing' and visible_to_customer),
  'the late order shows "preparing" like the rest of its cycle');

select tests.remember('order_projected', pg_temp.order_with('pi_projected'));
select tests.assert((select cycle_id = tests.id('next') from public.orders where id = tests.id('order_projected')),
  'no order joins a cycle after its cutoff: priced after it, the order joins the next cycle');
select set_config('tests.next_cutoff', (select cutoff_at::text from public.cycles where id = tests.id('next')), true);
set local role anon;
select tests.assert((select order_by from public.store_next_delivery()) = current_setting('tests.next_cutoff')::timestamptz,
  'after the roll the store shows the same cutoff it projected');
reset role;
select tests.assert(public.roll_cycles() = 0, 'nothing more to roll');

-- Once the closed cycle is packed, a payment priced for it can no longer keep its window.
update public.cycles set status = 'packed' where id = tests.id('cycle');
select tests.assert_fails($q$select pg_temp.order_with('pi_too_late')$q$, 'cycle_closed',
  'D-065: once that cycle is packed, the late payment is refused (and the server refunds it)');

-- With the setting, the step is the setting; a long-missed cutoff moves forward until it is ahead.
update public.pricing_settings set cycle_days = 21 where id = 1;
update public.cycles set cutoff_at = now() - interval '50 days' where id = tests.id('next');
select tests.assert(public.roll_cycles() = 1, 'the overdue cycle rolls');
select tests.remember('third', (select id from public.cycles where status = 'open'));
select tests.assert(
  (select cutoff_at = now() - interval '50 days' + interval '63 days' from public.cycles where id = tests.id('third')),
  'D-063: three 21-day steps, the first cutoff that is still ahead');

-- An admin's cutoff closes now and opens the next one too.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.cutoff_cycle(tests.id('third'));
select tests.assert_fails('select public.roll_cycles()', '42501', 'roll_cycles is not callable by signed-in users');
reset role;
select tests.assert((select cutoff_at <= now() from public.cycles where id = tests.id('third')),
  'an early admin cutoff records when ordering really closed');
select tests.assert(
  (select cutoff_at = now() + interval '21 days' from public.cycles where status = 'open'),
  'D-045: and the next cycle opens 21 days on');

-- The timer (pg_cron, where the database has it).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform tests.assert(exists (select 1 from cron.job where jobname = 'iwc-roll-cycles' and schedule = '* * * * *'),
      'the roll runs every minute');
  end if;
end $$;

rollback;
