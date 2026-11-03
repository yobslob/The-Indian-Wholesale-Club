-- =============================================================================
-- Webhook claims that expire (launch QA F-1, flows.md §3).
--
-- The Stripe webhook claims an event in webhook_events before it creates the order, so a second delivery of the same
-- event does nothing. The claim was a plain row, removed only when the handler caught an error: a function killed
-- between claim and finish (a timeout, as in INC-1) left it forever, every Stripe retry answered "duplicate" and the
-- paid customer's order was never created. Now a claim is 'processing' with the time it was taken; the handler marks
-- it 'done' after the order exists, and a retry takes over a claim still 'processing' after 2 minutes (longer than the
-- webhook may run: its route stops at 60 s). Taking over is safe even if the first handler were still alive: an order
-- is created once per PaymentIntent (orders.payment_intent_id is unique), so the second one finds it.
-- =============================================================================

-- Every event already recorded was finished (or handled the old way): it stays a duplicate.
alter table public.webhook_events
  add column status text not null default 'done' check (status in ('processing', 'done')),
  add column claimed_at timestamptz not null default now();
alter table public.webhook_events alter column status set default 'processing';

comment on column public.webhook_events.status is
  'processing = a handler claimed it (taken over after 2 minutes); done = the handler finished (F-1)';

-- True when this call may process the event: the first delivery, or a retry of one whose claim was never finished.
-- One statement, so two deliveries at once cannot both win (the row is locked by the insert or the update).
create function public.claim_webhook_event(p_event_id text, p_event_type text)
returns boolean
language plpgsql set search_path = public, pg_temp as $$
declare
  v_claimed boolean;
begin
  insert into public.webhook_events as w (event_id, event_type, status, claimed_at, processed_at)
  values (p_event_id, p_event_type, 'processing', now(), now())
  on conflict (event_id) do update
    set status = 'processing', claimed_at = now(), processed_at = now()
    where w.status = 'processing' and w.claimed_at < now() - interval '2 minutes'
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end $$;

revoke all on function public.claim_webhook_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_webhook_event(text, text) to service_role;
