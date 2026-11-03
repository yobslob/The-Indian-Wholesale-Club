-- The payment safety nets (launch QA F-1, F-2; flows.md §3): a webhook claim left unfinished by a killed function is
-- taken over after 2 minutes, and the payment sweep picks only the unreconciled checkouts that are due a look.
begin;

-- F-1: claims ----------------------------------------------------------------------------------------------------
select tests.assert(public.claim_webhook_event('evt_new', 'payment_intent.succeeded'), 'the first delivery is claimed');
select tests.assert((select status = 'processing' and claimed_at = now() from public.webhook_events
                     where event_id = 'evt_new'), 'a claim is processing, with its time');
select tests.assert(not public.claim_webhook_event('evt_new', 'payment_intent.succeeded'),
  'a second delivery while the first is being handled is a duplicate');

update public.webhook_events set claimed_at = now() - interval '90 seconds' where event_id = 'evt_new';
select tests.assert(not public.claim_webhook_event('evt_new', 'payment_intent.succeeded'),
  'a claim under 2 minutes old is not taken over');

update public.webhook_events set claimed_at = now() - interval '3 minutes' where event_id = 'evt_new';
select tests.assert(public.claim_webhook_event('evt_new', 'payment_intent.succeeded'),
  'a claim still processing after 2 minutes (its function was killed) is taken over by the retry');
select tests.assert((select claimed_at = now() and status = 'processing' from public.webhook_events
                     where event_id = 'evt_new'), 'and is now this delivery''s claim');
select tests.assert((select count(*) from public.webhook_events where event_id = 'evt_new') = 1, 'still one row');

update public.webhook_events set status = 'done', claimed_at = now() - interval '1 day' where event_id = 'evt_new';
select tests.assert(not public.claim_webhook_event('evt_new', 'payment_intent.succeeded'),
  'a finished event is never processed again, however old');

insert into public.webhook_events (event_id, event_type, status, claimed_at)
values ('evt_old', 'payment_intent.succeeded', 'done', now() - interval '1 month');
select tests.assert(not public.claim_webhook_event('evt_old', 'payment_intent.succeeded'),
  'events recorded before claims expired count as done');
select tests.assert_fails($$insert into public.webhook_events (event_id, event_type, status) values ('evt_x', 't', 'lost')$$,
  'webhook_events_status_check', 'a claim is processing or done, nothing else');

-- F-2: the sweep -------------------------------------------------------------------------------------------------
delete from public.pending_orders;
insert into public.pending_orders (payment_intent_id, checkout_payload, created_at, reconciled_at, swept_at, sweep_note)
values ('pi_due', '{}', now() - interval '15 minutes', null, null, null),
       ('pi_due_older', '{}', now() - interval '5 hours', null, null, null),
       ('pi_asked_long_ago', '{}', now() - interval '6 hours', null, now() - interval '2 hours', null),
       ('pi_too_new', '{}', now() - interval '5 minutes', null, null, null),
       ('pi_reconciled', '{}', now() - interval '1 hour', now() - interval '59 minutes', null, null),
       ('pi_asked_recently', '{}', now() - interval '3 hours', null, now() - interval '20 minutes', null),
       ('pi_given_up', '{}', now() - interval '3 hours', null, null, 'payment cancelled'),
       ('pi_too_old', '{}', now() - interval '3 days', null, null, null);

select tests.assert(
  (select array_agg(payment_intent_id order by payment_intent_id) from public.claim_payment_sweep(20))
  = array['pi_asked_long_ago', 'pi_due', 'pi_due_older'],
  'the sweep takes unreconciled checkouts 10 minutes to 2 days old, not looked at in the last hour, not given up on');
select tests.assert(
  (select count(*) from public.pending_orders where swept_at = now()) = 3, 'and stamps them');
select tests.assert(not exists (select 1 from public.claim_payment_sweep(20)),
  'so the next run does not take them again within the hour');

update public.pending_orders set swept_at = null where payment_intent_id in ('pi_due', 'pi_due_older', 'pi_asked_long_ago');
update public.pending_orders set swept_at = now() - interval '2 hours' where payment_intent_id = 'pi_due_older';
select tests.assert(
  (select array_agg(payment_intent_id) from public.claim_payment_sweep(2)) = array['pi_asked_long_ago', 'pi_due'],
  'a run takes at most its limit, the never-looked-at first (oldest first)');

-- The sweep's own reconciliations are recorded as such.
update public.pending_orders set reconciled_at = now(), reconciled_by = 'sweep' where payment_intent_id = 'pi_due';
select tests.assert_fails($$update public.pending_orders set reconciled_by = 'someone' where payment_intent_id = 'pi_due'$$,
  'pending_orders_reconciled_by_check', 'reconciled by the browser, the webhook or the sweep');

-- The timer does nothing without the Vault settings (and nothing at all when no checkout is due).
delete from public.pending_orders;
select public._kick_payment_sweep();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform tests.assert(exists (select 1 from cron.job where jobname = 'iwc-payment-sweep' and schedule = '*/10 * * * *'),
      'the sweep is asked for every 10 minutes');
  end if;
end $$;

-- Service role only.
select tests.assert(not has_function_privilege('authenticated', 'public.claim_webhook_event(text, text)', 'execute')
                    and not has_function_privilege('anon', 'public.claim_payment_sweep(integer)', 'execute')
                    and not has_function_privilege('authenticated', 'public._kick_payment_sweep()', 'execute')
                    and has_function_privilege('service_role', 'public.claim_payment_sweep(integer)', 'execute'),
  'only the website''s server can claim events or sweep');

rollback;
