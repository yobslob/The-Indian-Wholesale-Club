-- admin_attention (migration 22, B-8): counts for Today, admin only, the tables themselves stay closed.
begin;
select tests.setup();
insert into public.admin_error_events (event, context) values ('test.error', '{}'), ('test.old', '{}');
update public.admin_error_events set created_at = now() - interval '2 days' where event = 'test.old';
insert into public.failed_reconciliations (payment_intent_id, error_reason) values ('pi_test_attention', 'test');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select (a ->> 'errors_24h')::int >= 1 and (a ->> 'payments_to_check')::int >= 1 from public.admin_attention() a),
  'Today counts recent server errors and payments to check');
select tests.assert_fails('select count(*) from public.admin_error_events', '42501',
  'the error log itself stays service-role only');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_attention()', 'admin_only', 'customers get nothing');
reset role;
rollback;
