-- =============================================================================
-- D-140 (design plan F3, F4, A1): ordering a sold piece from its shop, what an order cost us, and telling the admins.
--  - Each order line keeps a snapshot of its cost when it is placed (shop price, weight and its source, the rupee
--    rate, the pricing rule), so its cost no longer moves when the piece is reweighed (D-130) or its shop price changes.
--  - A pickup records the shop item it is ordered from (the variant's source in use, D-118) and the variant's own shop
--    price (pickups used the listing's price, wrong for a flavour or pack priced on its own), and, once the India desk
--    has ordered it, when, by whom, what was paid, the shop's order number and a photo of the shop's bill.
--    The piece then reads To order → Ordered → At the hub (picked) without a new pickup status.
--  - Invoice C, the shop bill: one per order, a form the desk fills (rows per piece at the shop's price, delivery,
--    extras such as a packing fee or a coupon as a minus), photos of the shop's bill in the private vendor-docs
--    bucket, draft until marked final (an admin can reopen it; the order's timeline says so).
--  - Every paid order queues an email to each admin (the allowlist), so nobody has to watch the panel.
-- Admin only throughout (RLS is_admin()); none of it reaches a store_* view or the customer (D-003).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The cost snapshot on each order line (F4)
-- -----------------------------------------------------------------------------
alter table public.order_items
  add column shop_price_paise integer check (shop_price_paise >= 0),
  add column weight_g integer check (weight_g between 1 and 50000),
  add column weight_source text check (char_length(weight_source) <= 40),
  add column inr_per_usd numeric(8, 2) check (inr_per_usd > 0),
  add column pricing_rule text check (pricing_rule in ('beta', 'full', 'hand'));

comment on column public.order_items.shop_price_paise is
  'D-140: the shop''s price of one piece when the order was placed (the variant''s own price, else the listing''s). Admin only.';
comment on column public.order_items.pricing_rule is
  'D-140: how the price was made when the order was placed: beta (D-128), full (the archived formula) or hand (set by an admin).';

create function public._order_item_snapshot() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v record;
  s public.pricing_settings;
begin
  select coalesce(pv.shop_price_paise, p.shop_price_paise) as shop_paise, pv.weight_g, pv.weight_source, p.price_auto
    into v
    from public.product_variants pv join public.products p on p.id = pv.product_id
   where pv.id = new.variant_id;
  select * into s from public.pricing_settings where id = 1;
  new.shop_price_paise := coalesce(new.shop_price_paise, v.shop_paise);
  new.weight_g := coalesce(new.weight_g, v.weight_g);
  new.weight_source := coalesce(new.weight_source, v.weight_source);
  -- D-128: the beta divides by a fixed ₹92 whatever the day's rate in Settings
  new.inr_per_usd := coalesce(new.inr_per_usd, case when s.beta_pricing then 92 else s.fx_inr_per_usd end);
  new.pricing_rule := coalesce(new.pricing_rule,
    case when v.price_auto is false then 'hand' when s.beta_pricing then 'beta' else 'full' end);
  return new;
end $$;
revoke all on function public._order_item_snapshot() from public, anon, authenticated;

create trigger order_items_snapshot before insert on public.order_items
  for each row execute function public._order_item_snapshot();

-- Orders placed before today: the closest record there is (the pickup's price and scale, else today's listing). Their
-- rate and rule stay empty (unknown); invoice B reads them as the beta's ₹92.
update public.order_items oi
   set shop_price_paise = coalesce((select pk.shop_price_paise from public.pickups pk where pk.order_item_id = oi.id),
                                   pv.shop_price_paise, p.shop_price_paise),
       weight_g = coalesce((select pk.weighed_g from public.pickups pk where pk.order_item_id = oi.id), pv.weight_g),
       weight_source = case when exists (select 1 from public.pickups pk where pk.order_item_id = oi.id and pk.weighed_g is not null)
                            then 'weighed' else pv.weight_source end
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
 where pv.id = oi.variant_id and oi.shop_price_paise is null;

-- -----------------------------------------------------------------------------
-- 2. Ordering from the shop (F3)
-- -----------------------------------------------------------------------------
alter table public.pickups
  add column source_id uuid references public.product_sources (id) on delete set null,
  add column ordered_at timestamptz,
  add column ordered_by uuid references public.profiles (id) on delete set null,
  add column paid_paise integer check (paid_paise >= 0),
  add column shop_order_ref text check (char_length(shop_order_ref) between 1 and 120),
  add column shop_bill_path text check (shop_bill_path ~ '^shop-bills/' and char_length(shop_bill_path) <= 300);

comment on column public.pickups.ordered_at is
  'D-140: when the India desk ordered this piece from its shop (to the hub). Pending + ordered_at = Ordered; picked = at the hub.';

create index pickups_to_order_idx on public.pickups (created_at) where status = 'pending' and ordered_at is null;

-- The variant's own shop price and the shop item in use, whichever way a pickup is made (an order, a cutoff, a move).
create function public._pickup_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v public.product_variants;
begin
  select * into v from public.product_variants where id = new.variant_id;
  new.shop_price_paise := coalesce(v.shop_price_paise, new.shop_price_paise);
  new.source_id := coalesce(new.source_id, v.source_id);
  return new;
end $$;
revoke all on function public._pickup_source() from public, anon, authenticated;

create trigger pickups_source before insert on public.pickups
  for each row execute function public._pickup_source();

-- Pieces still to order: the shop item in use and the variant's own price.
update public.pickups pk
   set source_id = coalesce(pk.source_id, pv.source_id),
       shop_price_paise = coalesce(pv.shop_price_paise, pk.shop_price_paise)
  from public.product_variants pv
 where pv.id = pk.variant_id and pk.status = 'pending';

-- -----------------------------------------------------------------------------
-- 3. Invoice C: the shop bill (F4)
-- -----------------------------------------------------------------------------
create table public.shop_bills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'final')),
  note text check (char_length(note) <= 1000),
  finalized_at timestamptz,
  finalized_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_bill_lines (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.shop_bills (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  kind text not null check (kind in ('piece', 'delivery', 'extra')),
  label text not null check (char_length(label) between 1 and 200),
  quantity integer not null default 1 check (quantity between 1 and 999),
  -- one piece's price as paid; a coupon or discount is a minus
  unit_paise integer not null check (unit_paise between -10000000 and 10000000),
  shop text check (char_length(shop) <= 120),
  shop_order_ref text check (char_length(shop_order_ref) <= 120),
  sort_order smallint not null default 0,
  unique (bill_id, order_item_id)
);
create index shop_bill_lines_bill_idx on public.shop_bill_lines (bill_id, sort_order);

create table public.shop_bill_photos (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.shop_bills (id) on delete cascade,
  storage_path text not null check (storage_path ~ '^shop-bills/' and char_length(storage_path) <= 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index shop_bill_photos_bill_idx on public.shop_bill_photos (bill_id, created_at);

alter table public.shop_bills enable row level security;
alter table public.shop_bill_lines enable row level security;
alter table public.shop_bill_photos enable row level security;
create policy "admin shop bills" on public.shop_bills for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin shop bill lines" on public.shop_bill_lines for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin shop bill photos" on public.shop_bill_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.shop_bills, public.shop_bill_lines, public.shop_bill_photos from anon;

-- A final bill is locked: its rows and photos change only after an admin reopens it.
create function public._shop_bill_locked() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_bill uuid := coalesce(new.bill_id, old.bill_id);
begin
  if (select status from public.shop_bills where id = v_bill) = 'final' then
    raise exception 'shop_bill_final' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public._shop_bill_locked() from public, anon, authenticated;
create trigger shop_bill_lines_locked before insert or update or delete on public.shop_bill_lines
  for each row execute function public._shop_bill_locked();
create trigger shop_bill_photos_locked before insert or delete on public.shop_bill_photos
  for each row execute function public._shop_bill_locked();

-- The order's shop bill, made on first use with a row per piece at the shop's price when it sold, and a Delivery row.
create function public.admin_shop_bill(p_order uuid)
returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select id into v_id from public.shop_bills where order_id = p_order;
  if v_id is not null then
    return v_id;
  end if;
  if not exists (select 1 from public.orders where id = p_order) then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  insert into public.shop_bills (order_id) values (p_order) returning id into v_id;
  insert into public.shop_bill_lines (bill_id, order_item_id, kind, label, quantity, unit_paise, shop, shop_order_ref, sort_order)
  select v_id, oi.id, 'piece', left(oi.product_name || ' · ' || oi.variant_label, 200), oi.quantity,
         coalesce(case when pk.paid_paise is not null then pk.paid_paise / oi.quantity end,
                  pk.shop_price_paise, oi.shop_price_paise, 0),
         left(coalesce(ps.site, ve.shop_name), 120), pk.shop_order_ref,
         (row_number() over (order by oi.created_at, oi.id))::smallint
    from public.order_items oi
    left join public.pickups pk on pk.order_item_id = oi.id
    left join public.product_sources ps on ps.id = pk.source_id
    left join public.vendors ve on ve.id = pk.vendor_id
   where oi.order_id = p_order and oi.status = 'active';
  insert into public.shop_bill_lines (bill_id, kind, label, unit_paise, sort_order)
  values (v_id, 'delivery', 'Delivery', 0, 900);
  return v_id;
end $$;

-- Save the form: every row at once (rows not sent are removed), while the bill is a draft.
create function public.admin_save_shop_bill(p_bill uuid, p_lines jsonb, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_line jsonb;
  v_i integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) > 200 then
    raise exception 'shop_bill_invalid' using errcode = 'P0001';
  end if;
  update public.shop_bills set note = nullif(trim(p_note), ''), updated_at = now()
   where id = p_bill and status = 'draft';
  if not found then
    raise exception 'shop_bill_final' using errcode = 'P0001';
  end if;
  delete from public.shop_bill_lines where bill_id = p_bill;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_i := v_i + 1;
    insert into public.shop_bill_lines (bill_id, order_item_id, kind, label, quantity, unit_paise, shop, shop_order_ref, sort_order)
    values (p_bill,
            case when v_line ->> 'kind' = 'piece' then (v_line ->> 'order_item_id')::uuid end,
            v_line ->> 'kind', trim(v_line ->> 'label'), coalesce((v_line ->> 'quantity')::integer, 1),
            (v_line ->> 'unit_paise')::integer, nullif(trim(v_line ->> 'shop'), ''),
            nullif(trim(v_line ->> 'shop_order_ref'), ''), v_i);
  end loop;
end $$;

-- Mark final (locked) or reopen it (logged on the order's timeline, admins only).
create function public.admin_set_shop_bill_final(p_bill uuid, p_final boolean)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_bill public.shop_bills;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_bill from public.shop_bills where id = p_bill for update;
  if not found then
    raise exception 'shop_bill_not_found' using errcode = 'P0001';
  end if;
  update public.shop_bills
     set status = case when p_final then 'final' else 'draft' end,
         finalized_at = case when p_final then now() end,
         finalized_by = case when p_final then auth.uid() end,
         updated_at = now()
   where id = p_bill;
  if not p_final and v_bill.status = 'final' then
    insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
    values (v_bill.order_id, 'shop_bill_reopened', false, 'The shop bill (invoice C) was reopened for changes.');
  end if;
end $$;

-- Mark pieces ordered from their shop: each with what was paid (default: the shop's price × quantity), one shop order
-- number and one bill photo for all of them. Fills the matching rows of the order's shop bill while it is a draft.
create function public.admin_mark_ordered(p_lines jsonb, p_shop_order_ref text default null, p_bill_path text default null)
returns integer
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_line jsonb;
  v_pickup public.pickups;
  v_paid integer;
  v_order uuid;
  v_bill uuid;
  v_n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 200 then
    raise exception 'nothing_to_order' using errcode = 'P0001';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    select * into v_pickup from public.pickups where id = (v_line ->> 'pickup')::uuid for update;
    if not found or v_pickup.status <> 'pending' then
      raise exception 'pickup_not_pending' using errcode = 'P0001';
    end if;
    v_paid := coalesce((v_line ->> 'paid_paise')::integer, v_pickup.shop_price_paise * v_pickup.quantity);
    if v_paid is not null and v_paid < 0 then
      raise exception 'amount_invalid' using errcode = 'P0001';
    end if;
    update public.pickups
       set ordered_at = coalesce(ordered_at, now()), ordered_by = auth.uid(), paid_paise = v_paid,
           shop_order_ref = coalesce(nullif(trim(p_shop_order_ref), ''), shop_order_ref),
           shop_bill_path = coalesce(p_bill_path, shop_bill_path), updated_at = now()
     where id = v_pickup.id;
    select oi.order_id into v_order from public.order_items oi where oi.id = v_pickup.order_item_id;
    v_bill := public.admin_shop_bill(v_order);
    if (select status from public.shop_bills where id = v_bill) = 'draft' then
      update public.shop_bill_lines
         set unit_paise = coalesce(v_paid / v_pickup.quantity, unit_paise),
             shop_order_ref = coalesce(nullif(trim(p_shop_order_ref), ''), shop_order_ref)
       where bill_id = v_bill and order_item_id = v_pickup.order_item_id;
      if p_bill_path is not null and not exists (select 1 from public.shop_bill_photos where bill_id = v_bill and storage_path = p_bill_path) then
        insert into public.shop_bill_photos (bill_id, storage_path, created_by) values (v_bill, p_bill_path, auth.uid());
      end if;
    end if;
    insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
    select v_order, 'shop_ordered', false,
           left(format('%s × %s%s', oi.product_name || ' · ' || oi.variant_label, v_pickup.quantity,
                       coalesce(', shop order ' || nullif(trim(p_shop_order_ref), ''), '')), 300)
      from public.order_items oi where oi.id = v_pickup.order_item_id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Undo a Mark ordered (a wrong tap), while the piece is not yet at the hub.
create function public.admin_unmark_ordered(p_pickup uuid)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.pickups
     set ordered_at = null, ordered_by = null, paid_paise = null, shop_order_ref = null, shop_bill_path = null,
         updated_at = now()
   where id = p_pickup and status = 'pending';
  if not found then
    raise exception 'pickup_not_pending' using errcode = 'P0001';
  end if;
end $$;

-- The India desk's To order list: every piece of a paid, open order not yet ordered, oldest first, with the shop item
-- in use and what the shop asks now. Grouping by shop is done by the screen.
create function public.admin_to_order()
returns table (
  pickup_id uuid, order_id uuid, order_number text, ordered_on timestamptz, product_id uuid, product_name text,
  variant_label text, quantity integer, sold_paise integer, site text, item_url text, item_key text, now_paise integer,
  in_stock boolean, delivery_days smallint, vendor_name text, image_path text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return query
  select pk.id, o.id, o.order_number, o.created_at, p.id, oi.product_name, oi.variant_label, pk.quantity,
         pk.shop_price_paise, coalesce(ps.site, p.source_site), coalesce(ps.item_url, p.source_url), ps.item_key,
         ps.price_paise, ps.in_stock, ps.delivery_days, ve.shop_name,
         (select m.storage_path from public.product_media m where m.product_id = p.id
           order by m.is_primary desc, m.sort_order limit 1)
    from public.pickups pk
    join public.order_items oi on oi.id = pk.order_item_id
    join public.orders o on o.id = oi.order_id
    left join public.product_variants pv on pv.id = pk.variant_id
    left join public.products p on p.id = pv.product_id
    left join public.product_sources ps on ps.id = pk.source_id
    left join public.vendors ve on ve.id = pk.vendor_id
   where pk.status = 'pending' and pk.ordered_at is null and oi.status = 'active'
     and o.payment_status in ('paid', 'partially_refunded') and o.status in ('confirmed', 'collecting')
   order by o.created_at, pk.id;
end $$;

revoke all on function public.admin_shop_bill(uuid), public.admin_save_shop_bill(uuid, jsonb, text),
  public.admin_set_shop_bill_final(uuid, boolean), public.admin_mark_ordered(jsonb, text, text),
  public.admin_unmark_ordered(uuid), public.admin_to_order() from public, anon;
grant execute on function public.admin_shop_bill(uuid), public.admin_save_shop_bill(uuid, jsonb, text),
  public.admin_set_shop_bill_final(uuid, boolean), public.admin_mark_ordered(jsonb, text, text),
  public.admin_unmark_ordered(uuid), public.admin_to_order() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. A paid order tells the admins (A1)
-- -----------------------------------------------------------------------------
create function public._queue_admin_new_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.email_outbox (kind, recipient, payload)
  select 'admin_new_order', a.email, jsonb_build_object('orderNumber', o.order_number, 'email', o.email)
    from public.orders o cross join public.admin_emails a
   where o.id = new.order_id;
  return new;
end $$;
revoke all on function public._queue_admin_new_order() from public, anon, authenticated;

create trigger order_events_admin_new_order
  after insert on public.order_events
  for each row when (new.kind = 'order_confirmed')
  execute function public._queue_admin_new_order();
