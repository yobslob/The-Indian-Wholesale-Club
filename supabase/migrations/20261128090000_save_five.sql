-- D-208, D-209: IWC no longer sends a customer's money anywhere. Every order saves 5% of its goods, paid by IWC, and the
-- customer picks one outcome: IWC sends it home in rupees through the Send home desk, or it goes into their Coins.
-- Coupons go (their rows stay for past orders). The customer pays exactly what they would without the saving.
-- Size: one small row per paid order (order_savings), one integer on profiles and on home_gifts; no page-cache writes.

-- ---------------------------------------------------------------- settings

alter table public.pricing_settings
  add column save_pct numeric(5, 2) check (save_pct is null or (save_pct > 0 and save_pct <= 50));
update public.pricing_settings set save_pct = 5, send_home_keep_pct = 0 where id = 1;  -- the founder, 2026-11-24 (D-208)
comment on column public.pricing_settings.save_pct is
  'D-208: the % of every order''s goods IWC gives back, sent home or kept as Coins (5). Empty = no saving.';

-- Coupons go (D-208): none offered or accepted any more; past orders keep their coupon lines.
update public.promo_codes set is_active = false where is_active;

-- ---------------------------------------------------------------- Coins that are spent (D-208)

-- D-191's Coins are never spent down (an order uses them all and the wallet only grows). Kept Coins from a saving are
-- money, so they are spent: saved_coins is the part of profiles.coins that an order uses up. create_order spends the
-- saved part of the coins an order used (p_order -> 'coins_used'); the D-191 part and its refill stay as they always did.
alter table public.profiles add column saved_coins integer not null default 0 check (saved_coins >= 0);
comment on column public.profiles.saved_coins is
  'D-208: the part of coins that came from kept savings; spent by the next order that uses coins.';
comment on column public.profiles.coins is
  'D-191: one coin is one cent off an order. Changed by _refill_coins and, for kept savings (D-208), _credit_saving.';

-- ---------------------------------------------------------------- the saving, one per order

alter table public.home_gifts
  add column funded_by text not null default 'customer' check (funded_by in ('customer', 'iwc'));
comment on column public.home_gifts.funded_by is
  'D-208: customer = a gift paid with the order (D-205, before 2026-11-24); iwc = an order''s 5% saving sent home by IWC.';

create table public.order_savings (
  order_id uuid primary key references public.orders (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,  -- whose Coins; null until a guest's email signs up
  email text not null,
  save_cents integer not null check (save_cents > 0),
  save_pct numeric(5, 2) not null,
  outcome text not null check (outcome in ('gift', 'coins')),
  home_gift_id uuid references public.home_gifts (id) on delete set null,
  credited_at timestamptz,      -- Coins added to the profile
  taken_back_at timestamptz,    -- the order was cancelled or refunded: Coins removed, gift cancelled
  gift_failed boolean not null default false,  -- the desk could not send it, so it became Coins
  created_at timestamptz not null default now()
);
comment on table public.order_savings is
  'D-208: an order''s 5% saving and where it went. Admin only; customers read it through their order.';
create index order_savings_waiting_idx on public.order_savings (email) where credited_at is null and outcome = 'coins';
alter table public.order_savings enable row level security;
create policy admin_read on public.order_savings for select to authenticated using ((select public.is_admin()));
revoke all on public.order_savings from anon, authenticated;
grant select on public.order_savings to authenticated;  -- the admin; writes through functions

-- Coins into a profile (the guest's wait for an account with their email).
create function public._credit_saving(p_order uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_saving public.order_savings;
  v_profile uuid;
begin
  select * into v_saving from public.order_savings where order_id = p_order for update;
  if not found or v_saving.outcome <> 'coins' or v_saving.credited_at is not null or v_saving.taken_back_at is not null then
    return;
  end if;
  v_profile := coalesce(v_saving.profile_id, (select p.id from public.profiles p where lower(p.email) = v_saving.email));
  if v_profile is null then
    return;  -- a guest: credited when an account with this email appears
  end if;
  update public.profiles set coins = coins + v_saving.save_cents, saved_coins = saved_coins + v_saving.save_cents
   where id = v_profile;
  update public.order_savings set profile_id = v_profile, credited_at = now() where order_id = p_order;
end $$;

-- A new account picks up the Coins its email kept as a guest.
create function public._claim_saved_coins() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order uuid;
begin
  if new.email is null then
    return null;
  end if;
  for v_order in
    select s.order_id from public.order_savings s
     where s.email = lower(new.email) and s.outcome = 'coins' and s.credited_at is null and s.taken_back_at is null
  loop
    perform public._credit_saving(v_order);
  end loop;
  return null;
end $$;
create trigger profiles_claim_saved_coins after insert on public.profiles
  for each row execute function public._claim_saved_coins();

-- An order cancelled or refunded takes its saving back: its gift is cancelled (orders_home_gift_cancel already does that
-- for an unsent gift) and its Coins removed, never below what the wallet holds. A sent gift stays sent (Q-66's default).
create function public._saving_follows_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_saving public.order_savings;
  v_back integer;
begin
  select * into v_saving from public.order_savings where order_id = new.id and taken_back_at is null for update;
  if not found then
    return null;
  end if;
  if v_saving.outcome = 'coins' and v_saving.credited_at is not null then
    select least(p.saved_coins, v_saving.save_cents) into v_back from public.profiles p where p.id = v_saving.profile_id for update;
    update public.profiles set coins = greatest(0, coins - coalesce(v_back, 0)), saved_coins = saved_coins - coalesce(v_back, 0)
     where id = v_saving.profile_id;
  end if;
  if v_saving.outcome = 'gift' and exists (
       select 1 from public.home_gifts g where g.id = v_saving.home_gift_id and g.status = 'sent') then
    return null;
  end if;
  update public.order_savings set taken_back_at = now() where order_id = new.id;
  return null;
end $$;
create trigger orders_saving_back
  after update of status on public.orders
  for each row when (new.status in ('cancelled', 'refunded') and old.status is distinct from new.status)
  execute function public._saving_follows_order();

-- ---------------------------------------------------------------- create_order makes the saving with the order

-- p_order -> 'saving' = { cents, pct, outcome: 'gift' | 'coins', gift: <as _add_home_gift reads it> }. The old
-- 'home_gift' (a gift inside the total, D-205) is still taken, for a checkout stored before this change.
create or replace function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_gift jsonb := p_order -> 'home_gift';
  v_saving jsonb := p_order -> 'saving';
  v_goods jsonb := p_order - 'home_gift' - 'saving';
  v_cents integer;
  v_save integer;
  v_outcome text;
  v_id uuid;
  v_number text;
  v_gift_id uuid;
  v_email text;
  v_user uuid;
  v_used integer;
begin
  v_cents := case when jsonb_typeof(v_gift) = 'object' then coalesce((v_gift ->> 'usd_cents')::integer, 0) else 0 end;
  if v_cents > 0 then
    if v_cents > (p_order ->> 'total_cents')::integer - v_cents then
      raise exception 'gift_over_order' using errcode = 'P0001';
    end if;
    select g.order_id, g.order_number into v_id, v_number
      from public._create_order_goods(jsonb_set(v_goods, '{total_cents}',
                                                to_jsonb((p_order ->> 'total_cents')::integer - v_cents))) g;
    update public.orders set home_gift_cents = v_cents, total_cents = total_cents + v_cents where id = v_id;
    perform public._add_home_gift(v_id, v_gift);
  else
    select g.order_id, g.order_number into v_id, v_number from public._create_order_goods(v_goods) g;
  end if;

  -- D-208: the coins this order used spend the kept part first (the website writes coins_used on the order itself)
  v_used := coalesce((p_order ->> 'coins_used')::integer, 0);
  if v_used > 0 then
    update public.profiles p
       set coins = greatest(0, p.coins - least(p.saved_coins, v_used)), saved_coins = p.saved_coins - least(p.saved_coins, v_used)
     where p.id = (select o.user_id from public.orders o where o.id = v_id);
  end if;

  v_save := case when jsonb_typeof(v_saving) = 'object' then coalesce((v_saving ->> 'cents')::integer, 0) else 0 end;
  if v_save > 0 then
    v_outcome := case when v_saving ->> 'outcome' = 'gift' and jsonb_typeof(v_saving -> 'gift') = 'object'
                      then 'gift' else 'coins' end;
    select o.email, o.user_id into v_email, v_user from public.orders o where o.id = v_id;
    if v_outcome = 'gift' then
      perform public._add_home_gift(v_id, (v_saving -> 'gift') || jsonb_build_object('usd_cents', v_save, 'keep_pct', 0));
      update public.home_gifts set funded_by = 'iwc' where home_gifts.order_id = v_id returning id into v_gift_id;
    end if;
    insert into public.order_savings (order_id, profile_id, email, save_cents, save_pct, outcome, home_gift_id)
    values (v_id, v_user, lower(v_email), v_save, coalesce((v_saving ->> 'pct')::numeric, 0), v_outcome, v_gift_id);
    perform public._credit_saving(v_id);
  end if;
  return query select v_id, v_number;
end $$;
revoke all on function public.create_order(jsonb), public._credit_saving(uuid), public._claim_saved_coins(),
  public._saving_follows_order() from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------- the desk: an IWC gift that cannot go becomes Coins

-- A gift from the saving has no card payment to refund: it goes into the customer's Coins instead, and they hear so.
create function public.admin_saving_gift_failed(p_gift uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_gift public.home_gifts;
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select g.* into v_gift from public.home_gifts g where g.id = p_gift;
  if not found or v_gift.funded_by <> 'iwc' then
    raise exception 'gift_not_found' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = v_gift.order_id for update;
  select * into v_gift from public.home_gifts where id = p_gift for update;
  if v_gift.status not in ('on_hold', 'to_send', 'failed') then
    raise exception 'gift_not_open' using errcode = 'P0001';
  end if;
  update public.home_gifts
     set status = 'cancelled', failed_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Could not send'), 200)
   where id = p_gift;
  update public.order_savings set outcome = 'coins', gift_failed = true where order_id = v_order.id;
  perform public._credit_saving(v_order.id);
  insert into public.email_outbox (kind, recipient, payload)
  values ('home_gift_failed', v_order.email, jsonb_build_object('orderNumber', v_order.order_number));
end $$;
revoke all on function public.admin_saving_gift_failed(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_saving_gift_failed(uuid, text) to authenticated;

create or replace function public.admin_send_home(p_tab text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    with open_gifts as materialized (
      select g.*, public._home_gift_held(g) as held from public.home_gifts g where g.status in ('on_hold', 'to_send'))
    select jsonb_build_object(
      'rate', (select jsonb_build_object('inr_per_usd', x.send_home_inr_per_usd, 'at', x.send_home_rate_at,
                                         'keep_pct', x.send_home_keep_pct, 'open', coalesce(x.send_home_open, 0) = 1,
                                         'live', public._send_home_rate() is not null)
                 from public.pricing_settings x where x.id = 1),
      'counts', jsonb_build_object(
        'to_send', (select count(*) from open_gifts where not held),
        'to_send_inr_paise', (select coalesce(sum(inr_paise), 0) from open_gifts where not held),
        'on_hold', (select count(*) from open_gifts where held)),
      'gifts', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.id, 'order_id', g.order_id, 'order_number', o.order_number,
                 'customer', coalesce(nullif(o.shipping_address ->> 'fullName', ''), o.email),
                 'call_name', g.call_name, 'relation', g.relation, 'region_name', g.region_name, 'upi', g.upi,
                 'note', g.note, 'sender_first_name', g.sender_first_name, 'usd_cents', g.usd_cents,
                 'inr_paise', g.inr_paise, 'status', g.status, 'held', public._home_gift_held(g), 'paid_at', g.created_at,
                 'hold_until', g.hold_until, 'sent_at', g.sent_at, 'utr', g.utr, 'failed_reason', g.failed_reason,
                 'funded_by', g.funded_by)
               order by case when p_tab in ('sent', 'failed') then -extract(epoch from coalesce(g.sent_at, g.updated_at))
                             else extract(epoch from g.created_at) end)
        from (select * from public.home_gifts x
               where case p_tab
                       when 'to_send' then x.status in ('on_hold', 'to_send') and not public._home_gift_held(x)
                       when 'on_hold' then public._home_gift_held(x)
                       when 'sent' then x.status = 'sent'
                       when 'failed' then x.status in ('failed', 'refunded')
                                          or (x.status = 'cancelled' and x.failed_reason is not null)
                       else false end
               order by x.created_at desc limit 200) g
        join public.orders o on o.id = g.order_id), '[]'::jsonb))
  );
end $$;

-- ---------------------------------------------------------------- what the store reads

-- The bag's card: the saving's % always (while set), the rate and loved ones only while Send home is open.
create or replace function public.store_send_home() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when s.save_pct is null then null else jsonb_build_object(
    'save_pct', s.save_pct,
    'inr_per_usd', public._send_home_rate(),  -- null: Send home closed, the saving can only be kept
    'signed_in', auth.uid() is not null,
    'in_bag', true,
    'loved_ones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'relation', l.relation, 'call_name', l.call_name, 'region_id', l.region_id,
               'region_name', r.name, 'note', l.note, 'upi_masked', public._mask_upi(l.upi),
               'last_inr_paise', last.inr_paise, 'last_at', last.sent_at)
             order by last.sent_at desc nulls last, l.created_at desc)
      from public.loved_ones l
      left join public.regions r on r.id = l.region_id
      left join lateral (select g.inr_paise, g.sent_at from public.home_gifts g
                          where g.loved_one_id = l.id and g.status = 'sent'
                          order by g.sent_at desc limit 1) last on true
      where l.profile_id = auth.uid() and l.archived_at is null), '[]'::jsonb)) end
  from public.pricing_settings s where s.id = 1;
$$;

create or replace function public.checkout_send_home(p_user uuid, p_email text, p_loved_one uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'save_pct', s.save_pct,
    'rupees_per_usd', public._send_home_rate(),   -- null = Send home closed
    'inr_per_usd', s.send_home_inr_per_usd,
    'keep_pct', coalesce(s.send_home_keep_pct, 0),
    'month_cap_cents', s.send_home_month_cap_cents,
    'month_used_cents', (select coalesce(sum(g.usd_cents), 0) from public.home_gifts g join public.orders o on o.id = g.order_id
                          where g.status in ('on_hold', 'to_send', 'sent')
                            and g.created_at >= date_trunc('month', now())
                            and (g.profile_id = p_user or o.email = lower(trim(p_email)))),
    'loved_one', (select jsonb_build_object('id', l.id, 'relation', l.relation, 'call_name', l.call_name, 'upi', l.upi,
                                            'region_id', l.region_id, 'note', l.note)
                    from public.loved_ones l
                   where l.id = p_loved_one and l.profile_id = p_user and l.archived_at is null),
    'sender_first_name', (select split_part(btrim(coalesce(p.full_name, '')), ' ', 1) from public.profiles p where p.id = p_user))
  from public.pricing_settings s where s.id = 1;
$$;

-- An order's saving for its page, the thank-you page and the emails.
create function public._order_saving(p_order uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('save_cents', s.save_cents, 'outcome', s.outcome, 'credited', s.credited_at is not null,
                            'taken_back', s.taken_back_at is not null, 'gift_failed', s.gift_failed)
  from public.order_savings s where s.order_id = p_order;
$$;
revoke all on function public._order_saving(uuid) from public, anon, authenticated;

create or replace function public._order_home_gift(p_order uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'call_name', g.call_name, 'relation', g.relation, 'region_name', g.region_name, 'note', g.note,
    'usd_cents', g.usd_cents, 'inr_paise', g.inr_paise, 'customer_status', public._gift_customer_status(g.status),
    'upi_masked', public._mask_upi(g.upi), 'utr_last4', right(g.utr, 4), 'sent_at', g.sent_at,
    'funded_by', g.funded_by,
    'so_far', (select jsonb_build_object('inr_paise', coalesce(sum(x.inr_paise), 0), 'times', count(*))
                 from public.home_gifts x join public.orders xo on xo.id = x.order_id
                where x.upi = g.upi and x.status in ('on_hold', 'to_send', 'sent')
                  and (case when g.profile_id is not null then x.profile_id = g.profile_id else xo.email = o.email end)))
  from public.home_gifts g join public.orders o on o.id = g.order_id
  where g.order_id = p_order and not (g.funded_by = 'iwc' and g.status = 'cancelled');
$$;

create or replace function public.store_my_order(p_order_number text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from public.store_order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.store_order_events e where e.order_id = o.id), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'actions', public._order_actions(o.id),
    'home_gift', public._order_home_gift(o.id),
    'saving', public._order_saving(o.id)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

create or replace function public.guest_order_lookup(p_order_number text, p_email text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when d is null then null
              else jsonb_set(d, '{order,home_gift_cents}',
                             to_jsonb(coalesce((select o.home_gift_cents from public.orders o
                                                 where o.id = (d -> 'order' ->> 'id')::uuid), 0)))
                   || jsonb_build_object('home_gift', public._order_home_gift((d -> 'order' ->> 'id')::uuid),
                                         'saving', public._order_saving((d -> 'order' ->> 'id')::uuid)) end
  from public._guest_order_lookup_goods(p_order_number, p_email) d;
$$;

-- A saving's gift that could not go became Coins: it leaves the gift history (the order says what happened).
create or replace view public.store_home_gifts as
select g.id, o.order_number, g.created_at, g.call_name, g.relation, g.region_name, g.inr_paise, g.usd_cents,
       case when g.status = 'sent' then 'sent' when g.status in ('on_hold', 'to_send') then 'sending' else 'refunded' end
         as customer_status,
       case when position('@' in g.upi) = 0 then left(g.upi, 5) || '·····'
            else left(g.upi, least(3, position('@' in g.upi) - 1)) || '···' || substr(g.upi, position('@' in g.upi)) end
         as upi_masked,
       right(g.utr, 4) as utr_last4, g.sent_at, g.loved_one_id
from public.home_gifts g
join public.orders o on o.id = g.order_id
where g.profile_id = auth.uid() and not (g.funded_by = 'iwc' and g.status = 'cancelled');

-- Account → Your people at home: the gifts as before, plus what the customer kept as Coins.
create or replace function public.store_my_people() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'on', public._send_home_rate() is not null,
    'in_bag', true,
    'total', (select jsonb_build_object('inr_paise', coalesce(sum(g.inr_paise), 0), 'times', count(*),
                                        'usd_cents', coalesce(sum(g.usd_cents), 0), 'since', min(g.sent_at))
                from public.home_gifts g where g.profile_id = auth.uid() and g.status = 'sent'),
    'kept', (select jsonb_build_object('cents', coalesce(sum(k.save_cents), 0), 'times', count(*))
               from public.order_savings k
              where k.profile_id = auth.uid() and k.outcome = 'coins' and k.credited_at is not null
                and k.taken_back_at is null),
    'loved_ones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'relation', l.relation, 'call_name', l.call_name, 'region_id', l.region_id,
               'region_name', r.name, 'note', l.note, 'upi_masked', public._mask_upi(l.upi),
               'sent_inr_paise', coalesce(t.inr_paise, 0), 'times', coalesce(t.times, 0))
             order by l.created_at)
      from public.loved_ones l
      left join public.regions r on r.id = l.region_id
      left join lateral (select sum(g.inr_paise) as inr_paise, count(*) as times from public.home_gifts g
                          where g.loved_one_id = l.id and g.status = 'sent') t on true
      where l.profile_id = auth.uid() and l.archived_at is null), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at desc)
      from (select * from public.store_home_gifts order by created_at desc limit 50) h), '[]'::jsonb))
  from public.pricing_settings s where s.id = 1 and auth.uid() is not null;
$$;

notify pgrst, 'reload schema';
