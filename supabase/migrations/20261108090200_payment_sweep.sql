-- =============================================================================
-- The payment sweep: no paid customer is left without an order (launch QA F-2, flows.md §3).
--
-- The order is created by the customer's device after paying, and by the Stripe webhook. If both fail (a busy
-- database, a killed function), nothing noticed. Every 10 minutes the database now looks for priced checkouts that are
-- still unreconciled 10 minutes after they were made, and only when there are some asks the website's sweep
-- (POST /api/internal/payment-sweep) to check them with Stripe and create the order for each one that was paid.
--
-- Cheap on purpose (production's database is short on disk IO): the check is one index lookup on a partial index of
-- the few unreconciled rows, with no HTTP call when there is nothing to do. A checkout is looked at 10 minutes after
-- it was priced, then at most once an hour for 2 days (most are bags that were never paid: Stripe says so and they
-- are asked again later, in case the customer paid late). Each run takes at most 20.
-- =============================================================================

alter table public.pending_orders
  add column swept_at timestamptz,
  add column sweep_note text;
comment on column public.pending_orders.swept_at is 'when the payment sweep last asked Stripe about it (F-2)';
comment on column public.pending_orders.sweep_note is
  'set when the sweep stopped looking at it: why (payment cancelled, unknown to Stripe, could not be finalized)';

-- The sweep's own reconciliations say so.
alter table public.pending_orders drop constraint pending_orders_reconciled_by_check;
alter table public.pending_orders add constraint pending_orders_reconciled_by_check
  check (reconciled_by in ('browser', 'webhook', 'sweep'));

create index pending_orders_sweep_idx on public.pending_orders (created_at)
  where reconciled_at is null and sweep_note is null;

-- Takes up to p_limit checkouts due a look (the oldest never-looked-at first) and stamps them, so the next run moves
-- on to others and a killed run does not repeat them for an hour. Same condition as _kick_payment_sweep.
create function public.claim_payment_sweep(p_limit integer default 20)
returns table (payment_intent_id text, created_at timestamptz)
language sql set search_path = public, pg_temp as $$
  update public.pending_orders p set swept_at = now()
  where p.id in (
    select d.id from public.pending_orders d
    where d.reconciled_at is null and d.sweep_note is null
      and d.created_at < now() - interval '10 minutes' and d.created_at > now() - interval '2 days'
      and (d.swept_at is null or d.swept_at < now() - interval '1 hour')
    order by d.swept_at nulls first, d.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50))
  returning p.payment_intent_id, p.created_at;
$$;

-- The timer: every 10 minutes, only when a checkout is due and the Vault holds the site URL and the job's secret (the
-- same two as the email timer, ops.md §Email timer).
create function public._kick_payment_sweep()
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.pending_orders d
                 where d.reconciled_at is null and d.sweep_note is null
                   and d.created_at < now() - interval '10 minutes' and d.created_at > now() - interval '2 days'
                   and (d.swept_at is null or d.swept_at < now() - interval '1 hour')) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'iwc_site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'iwc_outbox_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/internal/payment-sweep',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule('iwc-payment-sweep', '*/10 * * * *', 'select public._kick_payment_sweep()');
  end if;
end $$;

revoke all on function public.claim_payment_sweep(integer), public._kick_payment_sweep() from public, anon, authenticated;
grant execute on function public.claim_payment_sweep(integer) to service_role;
