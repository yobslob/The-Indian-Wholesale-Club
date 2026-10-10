-- =============================================================================
-- Vendor accounts (D-102, D-103): a vendor's owner signs in with a one-time code (the QR / link an admin makes) and
-- sees only their own: never a customer, another vendor, the customer price or IWC's costs (INV-10).
-- Every vendor read is a function that filters by the caller's vendor; the base tables stay admin-only.
-- =============================================================================

create table public.vendor_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  language text not null default 'en' check (language ~ '^[a-z]{2,3}$'),   -- ISO 639 code of the vendor's screens
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);
create index vendor_accounts_vendor_idx on public.vendor_accounts (vendor_id);

-- One-time sign-in codes. Only the hash is stored; the code is shown once (QR / link) and works once.
create table public.vendor_sign_in_codes (
  code_hash bytea primary key,
  user_id uuid not null references public.vendor_accounts (user_id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index vendor_sign_in_codes_user_idx on public.vendor_sign_in_codes (user_id);

-- "Join as a vendor?" requests, from the vendor sign-in page only (D-102). Written by the server (rate-limited).
create type public.application_status as enum ('new', 'contacted', 'accepted', 'declined');
create table public.vendor_applications (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null check (length(btrim(shop_name)) between 1 and 120),
  owner_name text not null check (length(btrim(owner_name)) between 1 and 120),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{6,24}$'),
  country text not null check (country in ('IN', 'US')),             -- a US store's request waits for Q-35
  region_id uuid references public.regions (id) on delete set null,  -- where a shop in India is
  city text check (length(city) <= 120),
  sells text check (length(sells) <= 1000),                         -- what they sell, in their own words
  language text check (language ~ '^[a-z]{2,3}$'),
  status public.application_status not null default 'new',
  vendor_id uuid references public.vendors (id) on delete set null,   -- once accepted
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_applications_india_has_region check (country <> 'IN' or region_id is not null)
);
create index vendor_applications_status_idx on public.vendor_applications (status, created_at desc);

-- -----------------------------------------------------------------------------
-- Who is calling
-- -----------------------------------------------------------------------------
-- The caller's vendor, or null (not a vendor, the account switched off, or the role changed).
create function public.my_vendor_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.vendor_id
  from public.vendor_accounts a
  join public.profiles p on p.id = a.user_id
  where a.user_id = auth.uid() and a.is_active and p.role = 'vendor';
$$;

create function public.is_vendor() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.my_vendor_id() is not null;
$$;

create function public._vendor_or_raise() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public.my_vendor_id();
begin
  if v_vendor is null then
    raise exception 'vendor_only' using errcode = '42501';
  end if;
  return v_vendor;
end $$;

-- -----------------------------------------------------------------------------
-- Accounts and sign-in (the website's server makes the auth user; only the server links and redeems)
-- -----------------------------------------------------------------------------
-- Service: turn a fresh auth user into a vendor account. Never an admin or the worker.
create function public._link_vendor_account(p_user uuid, p_vendor uuid, p_language text, p_by uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles set role = 'vendor', updated_at = now()
   where id = p_user and role in ('customer', 'vendor');
  if not found then
    raise exception 'not_a_vendor_account' using errcode = 'P0001';
  end if;
  insert into public.vendor_accounts (user_id, vendor_id, language, created_by)
  values (p_user, p_vendor, coalesce(nullif(p_language, ''), 'en'), p_by)
  on conflict (user_id) do update
    set vendor_id = excluded.vendor_id, language = excluded.language, is_active = true;
end $$;

-- Admin: a new one-time code for a vendor account, shown once as a QR code and a link. Older unused codes stop working.
create function public.admin_vendor_sign_in_code(p_user uuid, p_days integer default 7)
returns text
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 30 then
    raise exception 'invalid_days' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.vendor_accounts where user_id = p_user and is_active) then
    raise exception 'account_not_found' using errcode = 'P0001';
  end if;
  -- 32 random bytes (two v4 uuids, 244 random bits), URL-safe base64
  v_code := translate(encode(decode(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'hex'),
                             'base64'), '+/=', '-_');
  delete from public.vendor_sign_in_codes where user_id = p_user and used_at is null;
  insert into public.vendor_sign_in_codes (code_hash, user_id, expires_at, created_by)
  values (sha256(convert_to(v_code, 'UTF8')), p_user, now() + make_interval(days => p_days), auth.uid());
  return v_code;
end $$;

-- Service: a code is good once, before it expires, for an active vendor account. Returns the account's user.
create function public._redeem_vendor_code(p_code text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
begin
  update public.vendor_sign_in_codes c set used_at = now()
   where c.code_hash = sha256(convert_to(coalesce(p_code, ''), 'UTF8'))
     and c.used_at is null and c.expires_at > now()
     and exists (select 1 from public.vendor_accounts a join public.profiles p on p.id = a.user_id
                 where a.user_id = c.user_id and a.is_active and p.role = 'vendor')
  returning c.user_id into v_user;
  if v_user is null then
    raise exception 'code_not_valid' using errcode = 'P0001';
  end if;
  update public.vendor_accounts set last_seen_at = now() where user_id = v_user;
  return v_user;
end $$;

-- -----------------------------------------------------------------------------
-- What a vendor reads (own vendor only; never a buyer, an order number, a customer price or a cost)
-- -----------------------------------------------------------------------------
create function public.vendor_me()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
begin
  return (
    select jsonb_build_object(
      'shop_name', ve.shop_name,
      'owner_name', ve.owner_name,
      'region', jsonb_build_object('slug', r.slug, 'name', r.name, 'languages', to_jsonb(r.languages)),
      'language', a.language)
    from public.vendors ve
    join public.regions r on r.id = ve.region_id
    join public.vendor_accounts a on a.user_id = auth.uid()
    where ve.id = v_vendor);
end $$;

-- Pieces customers ordered that the shop keeps aside until IWC collects them: the piece and how many, never who.
-- "collect_after" is the cycle's cutoff (null for an express order: collected as soon as possible).
create function public.vendor_keep_ready()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
begin
  return coalesce((
    select jsonb_agg(to_jsonb(k) order by k.collect_after nulls first, k.product_name, k.variant_label)
    from (
      select p.id as product_id, p.name as product_name, pv.label as variant_label,
             sum(oi.quantity)::integer as quantity, c.cutoff_at as collect_after,
             (select m.storage_path from public.product_media m where m.product_id = p.id
               order by m.is_primary desc, m.sort_order limit 1) as photo_path
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.product_variants pv on pv.id = oi.variant_id
      join public.products p on p.id = pv.product_id
      left join public.cycles c on c.id = o.cycle_id
      left join public.pickups pk on pk.order_item_id = oi.id
      where p.vendor_id = v_vendor
        and oi.status = 'active'
        and o.status in ('confirmed', 'collecting')
        and coalesce(pk.status, 'pending') = 'pending'
      group by p.id, p.name, pv.id, pv.label, c.cutoff_at
    ) k), '[]'::jsonb);
end $$;

-- Money in rupees: what IWC owes for collected pieces, the latest collected pieces and payouts.
create function public.vendor_money()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_vendor uuid := public._vendor_or_raise();
begin
  return jsonb_build_object(
    'owed_paise', coalesce((select sum(pk.shop_price_paise * pk.quantity) from public.pickups pk
                            where pk.vendor_id = v_vendor and pk.status = 'picked' and pk.payout_id is null), 0),
    'unpriced_pieces', (select count(*) from public.pickups pk
                        where pk.vendor_id = v_vendor and pk.status = 'picked' and pk.payout_id is null
                          and pk.shop_price_paise is null),
    'collected', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.picked_at desc)
      from (select pk.picked_at, p.name as product_name, pv.label as variant_label, pk.quantity,
                   pk.shop_price_paise * pk.quantity as amount_paise, pk.payout_id is not null as paid
            from public.pickups pk
            join public.product_variants pv on pv.id = pk.variant_id
            join public.products p on p.id = pv.product_id
            where pk.vendor_id = v_vendor and pk.status = 'picked'
            order by pk.picked_at desc nulls last limit 20) c), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(y) order by y.paid_at desc)
      from (select vp.paid_at, vp.amount_paise, vp.method, vp.reference
            from public.vendor_payouts vp
            where vp.vendor_id = v_vendor
            order by vp.paid_at desc limit 20) y), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- Row level security and privileges
-- -----------------------------------------------------------------------------
alter table public.vendor_accounts enable row level security;
alter table public.vendor_sign_in_codes enable row level security;
alter table public.vendor_applications enable row level security;

create policy admin_all on public.vendor_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy vendor_accounts_own_select on public.vendor_accounts for select to authenticated
  using (user_id = auth.uid());
create policy admin_all on public.vendor_applications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- vendor_sign_in_codes: no policy, no grant (functions only).

-- Supabase grants new tables to everyone by default: take it back, then grant what RLS narrows down.
revoke all on public.vendor_accounts, public.vendor_sign_in_codes, public.vendor_applications from anon, authenticated;
grant select, insert, update, delete on public.vendor_accounts, public.vendor_applications to authenticated;
grant all on public.vendor_accounts, public.vendor_sign_in_codes, public.vendor_applications to service_role;

revoke all on function public.my_vendor_id(), public.is_vendor(), public._vendor_or_raise(),
  public._link_vendor_account(uuid, uuid, text, uuid), public.admin_vendor_sign_in_code(uuid, integer),
  public._redeem_vendor_code(text), public.vendor_me(), public.vendor_keep_ready(), public.vendor_money()
  from public, anon, authenticated;
grant execute on function public.my_vendor_id(), public.is_vendor(), public.admin_vendor_sign_in_code(uuid, integer),
  public.vendor_me(), public.vendor_keep_ready(), public.vendor_money()
  to authenticated;
grant execute on function public.my_vendor_id(), public.is_vendor(), public._vendor_or_raise(),
  public._link_vendor_account(uuid, uuid, text, uuid), public.admin_vendor_sign_in_code(uuid, integer),
  public._redeem_vendor_code(text), public.vendor_me(), public.vendor_keep_ready(), public.vendor_money()
  to service_role;
