-- D-205, Send home: a gift in rupees to a loved one in India, paid with the order (docs/plan-send-home.md §5).
-- The gift sits beside the goods and never inside them (non-negotiable 5): its own column on the order, added to the total
-- last, never part of the subtotal, a saving, Shipping or tax. Customers read only their own rows, through store_*
-- objects (D-017); the India desk pays by hand and records it here. An empty rate turns it off everywhere (D-047).
-- Size: two small tables (a row per gift and per loved one); no page-cache writes (the bag, checkout and account are
-- dynamic).

-- ---------------------------------------------------------------- settings (empty = not decided, Q-65, Q-66)

alter table public.pricing_settings
  add column send_home_inr_per_usd numeric(6, 2) check (send_home_inr_per_usd is null or send_home_inr_per_usd > 0),
  add column send_home_max_cents integer check (send_home_max_cents is null or send_home_max_cents > 0),
  add column send_home_month_cap_cents integer check (send_home_month_cap_cents is null or send_home_month_cap_cents > 0),
  add column send_home_hold_hours integer check (send_home_hold_hours is null or send_home_hold_hours between 0 and 720);
comment on column public.pricing_settings.send_home_inr_per_usd is
  'D-205: rupees a gift dollar promises. Empty = Send home is off everywhere.';

-- The account's switch (plan §4.7): off = the bag's card starts removed.
alter table public.profiles add column send_home_in_bag boolean not null default true;
grant update (send_home_in_bag) on public.profiles to authenticated;

-- ---------------------------------------------------------------- the tables

-- The UPI check is upiOf's (packages/shared/src/domain/send-home.ts): a UPI ID or a 10-digit Indian mobile, normalised.
create table public.loved_ones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  relation text not null check (relation in ('maa', 'papa', 'dadi', 'nani', 'dada', 'nana', 'bhaiya', 'didi', 'other')),
  call_name text not null check (length(btrim(call_name)) between 1 and 20),
  upi text not null check (upi ~ '^([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,63}|[6-9][0-9]{9})$'),
  region_id uuid references public.regions (id) on delete set null,
  note text not null default '' check (length(note) <= 30),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
comment on table public.loved_ones is 'D-205: the people in India a signed-in customer sends home gifts to. Owner only.';
create unique index loved_ones_upi_idx on public.loved_ones (profile_id, upi) where archived_at is null;

create table public.home_gifts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,  -- one gift per order
  profile_id uuid references public.profiles (id) on delete set null,             -- null for a guest
  loved_one_id uuid references public.loved_ones (id) on delete set null,
  -- the snapshot the desk pays and the customer sees, whatever the loved one becomes later
  call_name text not null check (length(btrim(call_name)) between 1 and 20),
  relation text not null check (relation in ('maa', 'papa', 'dadi', 'nani', 'dada', 'nana', 'bhaiya', 'didi', 'other')),
  upi text not null check (upi ~ '^([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,63}|[6-9][0-9]{9})$'),
  region_name text,
  note text not null default '' check (length(note) <= 30),
  sender_first_name text not null default '' check (length(sender_first_name) <= 40),
  usd_cents integer not null check (usd_cents > 0),
  inr_per_usd numeric(6, 2) not null check (inr_per_usd > 0),
  inr_paise integer not null check (inr_paise > 0 and inr_paise % 100 = 0),       -- promised at payment, to the rupee
  status text not null check (status in ('on_hold', 'to_send', 'sent', 'failed', 'refunded', 'cancelled')),
  hold_until timestamptz,
  sent_at timestamptz,
  sent_by uuid references public.profiles (id) on delete set null,
  utr text check (utr is null or utr ~ '^[A-Za-z0-9]{6,35}$'),
  failed_reason text check (length(failed_reason) <= 200),
  refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_gifts_sent_has_utr check (status <> 'sent' or (utr is not null and sent_at is not null))
);
comment on table public.home_gifts is
  'D-205: one order''s gift to one loved one. Admin only; customers read store_home_gifts and their order''s gift.';
create index home_gifts_queue_idx on public.home_gifts (created_at) where status in ('on_hold', 'to_send');
create index home_gifts_profile_idx on public.home_gifts (profile_id, created_at) where profile_id is not null;
create trigger home_gifts_updated_at before update on public.home_gifts
  for each row execute function public.set_updated_at();

alter table public.loved_ones enable row level security;
alter table public.home_gifts enable row level security;
create policy loved_ones_own on public.loved_ones for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy admin_all on public.loved_ones for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_read on public.home_gifts for select to authenticated using ((select public.is_admin()));
revoke all on public.loved_ones, public.home_gifts from anon, authenticated;
grant select, insert, update, delete on public.loved_ones to authenticated;  -- RLS narrows to the owner
grant select on public.home_gifts to authenticated;                         -- the admin; writes through functions

-- ---------------------------------------------------------------- the order carries it, beside the goods

alter table public.orders add column home_gift_cents integer not null default 0 check (home_gift_cents >= 0);
comment on column public.orders.home_gift_cents is 'D-205: the Send home gift inside total_cents, never part of the goods.';
alter table public.orders drop constraint orders_total_matches;
alter table public.orders add constraint orders_total_matches
  check (total_cents = subtotal_cents - discount_cents + shipping_cents + tax_cents + home_gift_cents);

create or replace view public.store_orders as
select o.id, o.order_number, o.email,
       case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'collecting' then 'preparing'
         when 'packed' then 'preparing'
         when 'in_transit' then 'preparing'
         when 'arrived' then 'preparing'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
       end as customer_status,
       o.est_delivery_from, o.est_delivery_to,
       o.subtotal_cents, o.discount_cents, o.shipping_cents, o.tax_cents, o.total_cents, o.currency,
       o.payment_status, o.shipping_address, o.tracking_number, o.carrier, o.created_at,
       o.shipping_method, o.refunded_cents, o.home_gift_cents
from public.orders o
where o.user_id = auth.uid();

-- A sent gift stays sent: no cancel or refund of the goods gives it back (plan §2 rule 12, Q-66).
create function public._sent_gift_cents(p_order uuid) returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select g.usd_cents from public.home_gifts g where g.order_id = p_order and g.status = 'sent'), 0);
$$;

create or replace function public._customer_cancel_cents(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select o.total_cents - o.refunded_cents - public._sent_gift_cents(o.id)
         - case when o.status = 'confirmed' and not exists (
                  select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                  where oi.order_id = o.id and p.status = 'picked')
                then 0
                else round((o.subtotal_cents - o.discount_cents) * coalesce(s.cancel_fee_pct, 0) / 100)::integer end
  from public.orders o cross join public.pricing_settings s
  where o.id = p_order and s.id = 1;
$$;

create or replace function public._cancel_refund_cents(p_order uuid, p_reason text)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_reason in ('customer_request', 'our_fault')
              then o.total_cents - o.refunded_cents - public._sent_gift_cents(o.id) end
  from public.orders o where o.id = p_order;
$$;

create or replace function public.admin_cancel_after_export_cents(p_order uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(0, o.total_cents - o.refunded_cents - public._sent_gift_cents(o.id)
                     - round((o.subtotal_cents - o.discount_cents) * coalesce(s.export_cancel_deduction_pct, 0) / 100)::integer)
  from public.orders o cross join public.pricing_settings s
  where o.id = p_order and s.id = 1 and public.is_admin()
    and o.status in ('in_transit', 'arrived', 'shipped') and not public._in_india(o);
$$;

-- An order cancelled or refunded before its gift is sent takes the gift with it (its refund already counted it).
create function public._home_gift_follows_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.home_gifts set status = 'cancelled' where order_id = new.id and status in ('on_hold', 'to_send');
  return null;
end $$;
create trigger orders_home_gift_cancel
  after update of status on public.orders
  for each row when (new.status in ('cancelled', 'refunded') and old.status is distinct from new.status)
  execute function public._home_gift_follows_order();

-- ---------------------------------------------------------------- the order is created with its gift

-- The goods part is the order as it always was; create_order wraps it, so device, webhook and sweep all make the order
-- and its gift once, in one transaction.
alter function public.create_order(jsonb) rename to _create_order_goods;
revoke all on function public._create_order_goods(jsonb) from public, anon, authenticated, service_role;

create function public._add_home_gift(p_order uuid, p_gift jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order public.orders;
  v_hold integer;
  v_first boolean;
  v_loved uuid := nullif(p_gift ->> 'loved_one_id', '')::uuid;
  v_upi text := lower(btrim(coalesce(p_gift ->> 'upi', '')));
  v_relation text := coalesce(nullif(p_gift ->> 'relation', ''), 'other');
  v_name text := btrim(coalesce(p_gift ->> 'call_name', ''));
  v_note text := left(coalesce(p_gift ->> 'note', ''), 30);
  v_region uuid := nullif(p_gift ->> 'region_id', '')::uuid;
begin
  select * into v_order from public.orders where id = p_order;
  select send_home_hold_hours into v_hold from public.pricing_settings where id = 1;
  -- a loved one named by id must be this customer's own
  if v_loved is not null and not exists (
       select 1 from public.loved_ones l where l.id = v_loved and l.profile_id = v_order.user_id) then
    v_loved := null;
  end if;
  if v_loved is null and v_order.user_id is not null and coalesce((p_gift ->> 'save')::boolean, false) then
    select l.id into v_loved from public.loved_ones l
     where l.profile_id = v_order.user_id and l.upi = v_upi and l.archived_at is null;
    if v_loved is null then
      insert into public.loved_ones (profile_id, relation, call_name, upi, region_id, note)
      values (v_order.user_id, v_relation, v_name, v_upi, v_region, v_note)
      returning id into v_loved;
    else
      update public.loved_ones set relation = v_relation, call_name = v_name, region_id = v_region, note = v_note
       where id = v_loved;
    end if;
  end if;
  -- rule 11: a customer's first paid order waits the hold before the desk sends its gift
  v_first := not exists (
    select 1 from public.orders o
     where o.id <> p_order and o.payment_status in ('paid', 'partially_refunded')
       and (o.user_id = v_order.user_id or o.email = v_order.email));
  insert into public.home_gifts (order_id, profile_id, loved_one_id, call_name, relation, upi, region_name, note,
                                 sender_first_name, usd_cents, inr_per_usd, inr_paise, status, hold_until)
  values (p_order, v_order.user_id, v_loved, v_name, v_relation, v_upi,
          (select r.name from public.regions r where r.id = v_region), v_note,
          left(coalesce(p_gift ->> 'sender_first_name', ''), 40),
          (p_gift ->> 'usd_cents')::integer, (p_gift ->> 'inr_per_usd')::numeric, (p_gift ->> 'inr_paise')::integer,
          case when v_first and coalesce(v_hold, 0) > 0 then 'on_hold' else 'to_send' end,
          case when v_first and coalesce(v_hold, 0) > 0 then now() + make_interval(hours => v_hold) end);
end $$;

create function public.create_order(p_order jsonb)
returns table (order_id uuid, order_number text)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_gift jsonb := p_order -> 'home_gift';
  v_cents integer;
  v_id uuid;
  v_number text;
begin
  v_cents := case when jsonb_typeof(v_gift) = 'object' then coalesce((v_gift ->> 'usd_cents')::integer, 0) else 0 end;
  if v_cents <= 0 then
    return query select g.order_id, g.order_number from public._create_order_goods(p_order - 'home_gift') g;
    return;
  end if;
  -- the goods are checked exactly as before, on the total without the gift
  select g.order_id, g.order_number into v_id, v_number
    from public._create_order_goods(jsonb_set(p_order - 'home_gift', '{total_cents}',
                                              to_jsonb((p_order ->> 'total_cents')::integer - v_cents))) g;
  update public.orders set home_gift_cents = v_cents, total_cents = total_cents + v_cents where id = v_id;
  perform public._add_home_gift(v_id, v_gift);
  return query select v_id, v_number;
end $$;
revoke all on function public.create_order(jsonb), public._add_home_gift(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb) to service_role;

-- ---------------------------------------------------------------- what the customer sees

create function public._mask_upi(p_upi text) returns text
language sql immutable
as $$
  -- the same as maskUpi: the desk sees the whole ID, the customer only its start
  select case when position('@' in p_upi) = 0 then left(p_upi, 5) || '·····'
              else left(p_upi, least(3, position('@' in p_upi) - 1)) || '···' || substr(p_upi, position('@' in p_upi)) end;
$$;

create function public._gift_customer_status(p_status text) returns text
language sql immutable
as $$
  select case when p_status = 'sent' then 'sent' when p_status in ('on_hold', 'to_send') then 'sending' else 'refunded' end;
$$;

-- Own gifts only; never who sent it on the desk, the rate, the hold or the whole reference (non-negotiable 1).
create view public.store_home_gifts as
select g.id, o.order_number, g.created_at, g.call_name, g.relation, g.region_name, g.inr_paise, g.usd_cents,
       -- inline, as _gift_customer_status and _mask_upi: a view's functions would run as its reader
       case when g.status = 'sent' then 'sent' when g.status in ('on_hold', 'to_send') then 'sending' else 'refunded' end
         as customer_status,
       case when position('@' in g.upi) = 0 then left(g.upi, 5) || '·····'
            else left(g.upi, least(3, position('@' in g.upi) - 1)) || '···' || substr(g.upi, position('@' in g.upi)) end
         as upi_masked,
       right(g.utr, 4) as utr_last4, g.sent_at, g.loved_one_id
from public.home_gifts g
join public.orders o on o.id = g.order_id
where g.profile_id = auth.uid();

-- An order's gift for its page and the thank-you postcard, with what this sender has sent home to this person so far.
create function public._order_home_gift(p_order uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'call_name', g.call_name, 'relation', g.relation, 'region_name', g.region_name, 'note', g.note,
    'usd_cents', g.usd_cents, 'inr_paise', g.inr_paise, 'customer_status', public._gift_customer_status(g.status),
    'upi_masked', public._mask_upi(g.upi), 'utr_last4', right(g.utr, 4), 'sent_at', g.sent_at,
    'so_far', (select jsonb_build_object('inr_paise', coalesce(sum(x.inr_paise), 0), 'times', count(*))
                 from public.home_gifts x join public.orders xo on xo.id = x.order_id
                where x.upi = g.upi and x.status in ('on_hold', 'to_send', 'sent')
                  and (case when g.profile_id is not null then x.profile_id = g.profile_id else xo.email = o.email end)))
  from public.home_gifts g join public.orders o on o.id = g.order_id
  where g.order_id = p_order;
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
    'home_gift', public._order_home_gift(o.id)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

-- The guest's lookup keeps its own body; the gift joins the answer (the number and email were checked there).
alter function public.guest_order_lookup(text, text) rename to _guest_order_lookup_goods;
revoke all on function public._guest_order_lookup_goods(text, text) from public, anon, authenticated, service_role;
create function public.guest_order_lookup(p_order_number text, p_email text) returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case when d is null then null
              else jsonb_set(d, '{order,home_gift_cents}',
                             to_jsonb(coalesce((select o.home_gift_cents from public.orders o
                                                 where o.id = (d -> 'order' ->> 'id')::uuid), 0)))
                   || jsonb_build_object('home_gift', public._order_home_gift((d -> 'order' ->> 'id')::uuid)) end
  from public._guest_order_lookup_goods(p_order_number, p_email) d;
$$;
revoke all on function public.guest_order_lookup(text, text) from public, anon, authenticated;
grant execute on function public.guest_order_lookup(text, text) to service_role;

-- The bag's card: is Send home on, its limits, and a signed-in customer's loved ones with their last gift (plan §4.3).
create function public.store_send_home() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select case when s.send_home_inr_per_usd is null then null else jsonb_build_object(
    'inr_per_usd', s.send_home_inr_per_usd,
    'max_cents', coalesce(s.send_home_max_cents, 10000),  -- Q-65: $100 until the founder sets it
    'signed_in', auth.uid() is not null,
    'in_bag', coalesce((select p.send_home_in_bag from public.profiles p where p.id = auth.uid()), true),
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

-- Account → Your people at home (plan §4.7): one read for the page.
create function public.store_my_people() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'on', s.send_home_inr_per_usd is not null,
    'in_bag', coalesce((select p.send_home_in_bag from public.profiles p where p.id = auth.uid()), true),
    'total', (select jsonb_build_object('inr_paise', coalesce(sum(g.inr_paise), 0), 'times', count(*),
                                        'usd_cents', coalesce(sum(g.usd_cents), 0), 'since', min(g.sent_at))
                from public.home_gifts g where g.profile_id = auth.uid() and g.status = 'sent'),
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

revoke all on function public._sent_gift_cents(uuid), public._home_gift_follows_order(),
  public._mask_upi(text), public._gift_customer_status(text), public._order_home_gift(uuid),
  public.store_send_home(), public.store_my_people() from public, anon, authenticated;
grant execute on function public.store_send_home() to anon, authenticated, service_role;
grant execute on function public.store_my_people() to authenticated;
revoke all on public.store_home_gifts from anon, authenticated;
grant select on public.store_home_gifts to authenticated;
grant select on public.store_orders to authenticated;

-- ---------------------------------------------------------------- checkout's server

-- What the server needs to price a gift (service role only): the settings, this customer's month so far, and a saved
-- loved one when the bag named one. One read, beside checkout's own.
create function public.checkout_send_home(p_user uuid, p_email text, p_loved_one uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'inr_per_usd', s.send_home_inr_per_usd,
    'max_cents', coalesce(s.send_home_max_cents, 10000),
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
revoke all on function public.checkout_send_home(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.checkout_send_home(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------- the India desk (plan §4.8)

-- Held: a first order's hold not yet over, or an open dispute on this customer (rule 11). Read at query time: no cron.
create function public._home_gift_held(p_gift public.home_gifts) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_gift.status in ('on_hold', 'to_send') and (
    (p_gift.status = 'on_hold' and coalesce(p_gift.hold_until, now()) > now())
    or exists (select 1 from public.payment_disputes d
                 join public.orders o on o.id = d.order_id
                 join public.orders mine on mine.id = p_gift.order_id
                where d.closed_at is null
                  and (o.email = mine.email or (p_gift.profile_id is not null and o.user_id = p_gift.profile_id))));
$$;

create function public.admin_send_home(p_tab text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    with open_gifts as materialized (
      select g.*, public._home_gift_held(g) as held from public.home_gifts g where g.status in ('on_hold', 'to_send'))
    select jsonb_build_object(
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
                 'hold_until', g.hold_until, 'sent_at', g.sent_at, 'utr', g.utr, 'failed_reason', g.failed_reason)
               order by case when p_tab in ('sent', 'failed') then -extract(epoch from coalesce(g.sent_at, g.updated_at))
                             else extract(epoch from g.created_at) end)
        from (select * from public.home_gifts x
               where case p_tab
                       when 'to_send' then x.status in ('on_hold', 'to_send') and not public._home_gift_held(x)
                       when 'on_hold' then public._home_gift_held(x)
                       when 'sent' then x.status = 'sent'
                       when 'failed' then x.status in ('failed', 'refunded')
                       else false end
               order by x.created_at desc limit 200) g
        join public.orders o on o.id = g.order_id), '[]'::jsonb))
  );
end $$;

-- Sent by the desk from its UPI app: the reference (UTR) is recorded, and the customer hears it reached them.
create function public.admin_home_gift_sent(p_gift uuid, p_utr text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_gift public.home_gifts;
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select g.* into v_gift from public.home_gifts g where g.id = p_gift;
  if not found then
    raise exception 'gift_not_found' using errcode = 'P0001';
  end if;
  -- the order first, then the gift: the same order of locks as a cancel
  select * into v_order from public.orders where id = v_gift.order_id for update;
  select * into v_gift from public.home_gifts where id = p_gift for update;
  if v_gift.status not in ('on_hold', 'to_send') or v_order.status in ('cancelled', 'refunded') then
    raise exception 'gift_not_open' using errcode = 'P0001';
  end if;
  if public._home_gift_held(v_gift) then
    raise exception 'gift_on_hold' using errcode = 'P0001';
  end if;
  if p_utr is null or btrim(p_utr) !~ '^[A-Za-z0-9]{6,35}$' then
    raise exception 'utr_invalid' using errcode = 'P0001';
  end if;
  update public.home_gifts set status = 'sent', utr = upper(btrim(p_utr)), sent_at = now(), sent_by = auth.uid()
   where id = p_gift;
  insert into public.email_outbox (kind, recipient, payload)
  values ('home_gift_sent', v_order.email, jsonb_build_object('orderNumber', v_order.order_number));
end $$;

-- Couldn't send (a wrong UPI, a closed account): the route refunds the gift alone in Stripe first (D-042), then this
-- records it on the gift and the order, and the customer hears their dollars are back. p_refunded_total is what Stripe
-- says the payment has had back in all, so the refund webhook (record_stripe_refund), whichever comes first, never counts
-- the gift twice.
create function public.admin_home_gift_failed(p_gift uuid, p_reason text, p_refund_id text, p_refunded_total integer)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_gift public.home_gifts;
  v_order public.orders;
  v_paid_back integer;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select g.* into v_gift from public.home_gifts g where g.id = p_gift;
  if not found then
    raise exception 'gift_not_found' using errcode = 'P0001';
  end if;
  select * into v_order from public.orders where id = v_gift.order_id for update;
  select * into v_gift from public.home_gifts where id = p_gift for update;
  if v_gift.status not in ('on_hold', 'to_send', 'failed') then
    raise exception 'gift_not_open' using errcode = 'P0001';
  end if;
  -- Stripe's own total is the truth: never below what is already counted, and the gift only once
  v_paid_back := least(v_order.total_cents,
                       greatest(v_order.refunded_cents, coalesce(p_refunded_total, v_order.refunded_cents + v_gift.usd_cents)));
  update public.home_gifts
     set status = 'refunded', failed_reason = left(coalesce(nullif(btrim(p_reason), ''), 'Could not send'), 200),
         refund_id = p_refund_id
   where id = p_gift;
  update public.orders
     set refunded_cents = v_paid_back,
         payment_status = case when v_paid_back >= total_cents then 'refunded'
                               else 'partially_refunded' end::public.payment_status
   where id = v_order.id;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note, actor)
  values (v_order.id, 'refund_issued', false, 'Send home could not be sent, gift refunded ' || coalesce(p_refund_id, '?'),
          auth.uid());
  insert into public.email_outbox (kind, recipient, payload)
  values ('home_gift_failed', v_order.email, jsonb_build_object('orderNumber', v_order.order_number));
end $$;

revoke all on function public._home_gift_held(public.home_gifts), public.admin_send_home(text),
  public.admin_home_gift_sent(uuid, text), public.admin_home_gift_failed(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_send_home(text), public.admin_home_gift_sent(uuid, text),
  public.admin_home_gift_failed(uuid, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
