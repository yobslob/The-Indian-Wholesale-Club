-- =============================================================================
-- What Stripe says after a payment reaches the order (launch QA F-3, flows.md §3).
--
-- Refunds made in the Stripe dashboard, disputes (chargebacks) and failed payments were never seen. The webhook now
-- also handles charge.refunded, charge.dispute.created / .closed and payment_intent.payment_failed:
--   - record_stripe_refund(): the order's refunded total catches up with Stripe's (never down, never past the total),
--     its payment shows refunded or partially refunded, and a customer-visible 'item_refunded' event queues the refund
--     email we already send (order_events trigger, migration 20261006090000). A refund the admin made itself is
--     already counted, so nothing changes and no second email goes out.
--   - payment_disputes: one row per dispute, service role only; record_payment_dispute() keeps it current and says
--     whether it is new (the founder is alerted once).
--   - failed_reconciliations: one open row per PaymentIntent. The browser and the webhook (and the sweep) can each
--     reach the same refused order; the second record is skipped, so Today counts it once and one alert goes out.
--   - admin_attention() adds disputes_open for Today's red count.
-- =============================================================================

-- ---------------------------------------------------------------- disputes
create table public.payment_disputes (
  dispute_id text primary key,
  payment_intent_id text,
  charge_id text,
  order_id uuid references public.orders (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  reason text,
  status text not null,
  evidence_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table public.payment_disputes is
  'Stripe disputes (chargebacks), from the webhook (F-3). Service role only; Today shows the open count.';
create index payment_disputes_open_idx on public.payment_disputes (created_at) where closed_at is null;

alter table public.payment_disputes enable row level security;
revoke all on public.payment_disputes from public, anon, authenticated;
grant all on public.payment_disputes to service_role;

-- Both functions below are for the webhook (service role) only: execute is granted to nobody else (end of file).

-- Stripe's closing statuses: won, lost, warning_closed (an inquiry that went no further).
create function public.record_payment_dispute(
  p_dispute_id text, p_payment_intent text, p_charge text, p_amount_cents integer, p_currency text, p_reason text,
  p_status text, p_evidence_due timestamptz)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_new boolean;
  v_closed boolean := p_status in ('won', 'lost', 'warning_closed');
begin
  if p_payment_intent is not null then
    select * into v_order from public.orders where payment_intent_id = p_payment_intent;
  end if;
  insert into public.payment_disputes as d (dispute_id, payment_intent_id, charge_id, order_id, amount_cents, currency,
                                            reason, status, evidence_due_at, closed_at)
  values (p_dispute_id, p_payment_intent, p_charge, v_order.id, greatest(coalesce(p_amount_cents, 0), 0),
          coalesce(p_currency, 'usd'), p_reason, p_status, p_evidence_due, case when v_closed then now() end)
  on conflict (dispute_id) do update
    set status = excluded.status, reason = coalesce(excluded.reason, d.reason),
        evidence_due_at = coalesce(excluded.evidence_due_at, d.evidence_due_at), updated_at = now(),
        closed_at = case when v_closed then coalesce(d.closed_at, now()) else null end
  returning (xmax = 0) into v_new;
  return jsonb_build_object('is_new', v_new, 'order_number', v_order.order_number, 'closed', v_closed);
end $$;

-- ---------------------------------------------------------------- refunds made in Stripe
create function public.record_stripe_refund(p_payment_intent text, p_refunded_cents integer, p_refund_id text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders%rowtype;
  v_total integer;
begin
  select * into v_order from public.orders where payment_intent_id = p_payment_intent for update;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  v_total := least(greatest(coalesce(p_refunded_cents, 0), 0), v_order.total_cents);
  if v_total <= v_order.refunded_cents then
    return jsonb_build_object('found', true, 'order_number', v_order.order_number, 'applied_cents', 0,
                              'refunded_cents', v_order.refunded_cents, 'total_cents', v_order.total_cents);
  end if;
  update public.orders
     set refunded_cents = v_total,
         payment_status = case when v_total = total_cents then 'refunded' else 'partially_refunded' end::public.payment_status
   where id = v_order.id;
  -- Customer-visible: queues the refund email (order_update / item_refunded). The note stays internal.
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (v_order.id, 'item_refunded', true,
          'Refunded in Stripe (' || coalesce(left(p_refund_id, 60), '?') || '), '
          || (v_total - v_order.refunded_cents) || ' cents');
  return jsonb_build_object('found', true, 'order_number', v_order.order_number,
                            'applied_cents', v_total - v_order.refunded_cents,
                            'refunded_cents', v_total, 'total_cents', v_order.total_cents);
end $$;

-- ---------------------------------------------------------------- one open failed reconciliation per PaymentIntent
create index failed_reconciliations_open_idx on public.failed_reconciliations (payment_intent_id)
  where resolved_at is null;

-- The lock makes two callers at once (browser and webhook) wait for each other, so only one row is written.
create function public._failed_reconciliation_once() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('failed_reconciliation:' || new.payment_intent_id, 0));
  if exists (select 1 from public.failed_reconciliations
             where payment_intent_id = new.payment_intent_id and resolved_at is null) then
    return null;
  end if;
  return new;
end $$;

create trigger failed_reconciliations_once
  before insert on public.failed_reconciliations
  for each row execute function public._failed_reconciliation_once();

-- ---------------------------------------------------------------- Today's counts
create or replace function public.admin_attention()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'errors_24h', (select count(*) from public.admin_error_events where created_at > now() - interval '24 hours'),
    'payments_to_check', (select count(*) from public.failed_reconciliations where resolved_at is null),
    'disputes_open', (select count(*) from public.payment_disputes where closed_at is null),
    'emails_stuck', (select count(*) from public.email_outbox
                     where status = 'dead_letter' or (status = 'pending' and created_at < now() - interval '1 hour')));
end $$;

revoke all on function public.record_payment_dispute(text, text, text, integer, text, text, text, timestamptz),
  public.record_stripe_refund(text, integer, text), public._failed_reconciliation_once()
  from public, anon, authenticated;
grant execute on function public.record_payment_dispute(text, text, text, integer, text, text, text, timestamptz),
  public.record_stripe_refund(text, integer, text) to service_role;
