-- Stripe refunds, disputes and one failed reconciliation per payment (migration 20261108090300, launch QA F-3).
begin;
select tests.setup();

-- ---------------------------------------------------------------- one open failed reconciliation per PaymentIntent
insert into public.failed_reconciliations (payment_intent_id, error_reason) values ('pi_test_twice', 'refused (browser)');
insert into public.failed_reconciliations (payment_intent_id, error_reason) values ('pi_test_twice', 'refused (webhook)');
select tests.assert((select count(*) = 1 from public.failed_reconciliations where payment_intent_id = 'pi_test_twice'),
  'a second record for the same payment is skipped while the first is open');
update public.failed_reconciliations set resolved_at = now(), resolved_by = 'test' where payment_intent_id = 'pi_test_twice';
insert into public.failed_reconciliations (payment_intent_id, error_reason) values ('pi_test_twice', 'again later');
select tests.assert((select count(*) = 2 from public.failed_reconciliations where payment_intent_id = 'pi_test_twice'),
  'once resolved, a new problem with the payment is recorded');

-- ---------------------------------------------------------------- refunds made in Stripe (order_a: 5400 cents)
set local role service_role;
select set_config('tests.r1', public.record_stripe_refund('pi_test_order_a', 1000, 're_test_1')::text, true);
select tests.assert(
  (current_setting('tests.r1')::jsonb ->> 'applied_cents')::int = 1000
  and (select refunded_cents = 1000 and payment_status = 'partially_refunded' from public.orders where id = tests.id('order_a')),
  'a partial refund in Stripe is counted on the order');
select tests.assert(
  (select count(*) = 1 from public.order_events
   where order_id = tests.id('order_a') and kind = 'item_refunded' and visible_to_customer),
  'the customer sees one refund event');
select tests.assert(
  (select count(*) = 1 from public.email_outbox e join public.orders o on o.order_number = e.payload ->> 'orderNumber'
   where o.id = tests.id('order_a') and e.kind = 'order_update' and e.payload ->> 'kind' = 'item_refunded'),
  'and gets the refund email we already send');

select public.record_stripe_refund('pi_test_order_a', 1000, 're_test_1');
select public.record_stripe_refund('pi_test_order_a', 500, 're_test_old');
select tests.assert(
  (select refunded_cents = 1000 from public.orders where id = tests.id('order_a'))
  and (select count(*) = 1 from public.order_events where order_id = tests.id('order_a') and kind = 'item_refunded'),
  'the same or an older total changes nothing and sends nothing (a retry, or a refund the admin already recorded)');

select public.record_stripe_refund('pi_test_order_a', 999999, 're_test_all');
select tests.assert(
  (select refunded_cents = total_cents and payment_status = 'refunded' from public.orders where id = tests.id('order_a')),
  'a full refund marks the payment refunded and never counts past the total');
select tests.assert(
  (public.record_stripe_refund('pi_test_unknown', 100, 're_x') ->> 'found')::boolean = false,
  'a payment without an order (refused and refunded at checkout) is left alone');

-- ---------------------------------------------------------------- disputes
select tests.assert(
  (select (d ->> 'is_new')::boolean and d ->> 'order_number' is not null
   from public.record_payment_dispute('dp_test_1', 'pi_test_order_b', 'ch_test', 5400, 'usd', 'fraudulent',
                                      'needs_response', now() + interval '7 days') d),
  'a new dispute is recorded with its order');
select tests.assert(
  (select not (d ->> 'is_new')::boolean
   from public.record_payment_dispute('dp_test_1', 'pi_test_order_b', 'ch_test', 5400, 'usd', null,
                                      'under_review', null) d),
  'an update to a dispute is not new (no second alert)');
select tests.assert(
  (select status = 'under_review' and reason = 'fraudulent' and closed_at is null
   from public.payment_disputes where dispute_id = 'dp_test_1'),
  'and keeps what it knew');
reset role;

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select (a ->> 'disputes_open')::int = 1 and (a ->> 'payments_to_check')::int >= 1 from public.admin_attention() a),
  'Today counts the open dispute and the payment to check');
select tests.assert_fails('select count(*) from public.payment_disputes', '42501',
  'the disputes table itself stays service-role only');
select tests.assert_fails($$select public.record_stripe_refund('pi_test_order_a', 1, 'x')$$, '42501',
  'an admin session cannot record a Stripe refund directly');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails($$select public.record_payment_dispute('dp_x', null, null, 1, 'usd', null, 'won', null)$$,
  '42501', 'customers cannot record disputes');
reset role;

set local role service_role;
select public.record_payment_dispute('dp_test_1', 'pi_test_order_b', 'ch_test', 5400, 'usd', null, 'won', null);
reset role;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert((select (a ->> 'disputes_open')::int = 0 from public.admin_attention() a),
  'a won dispute is closed and leaves the count');
reset role;
rollback;
