-- =============================================================================
-- D-191 (founder 2026-11-07): coupons and coins.
-- Coupons: the promo codes gain a most-off, a new-customers-only flag and a public flag (public ones fill checkout's
-- coupon box). A coupon replaces the bulk saving; the free line reads the bag before either (packages/shared checkout.ts).
-- Coins: every account holds 30 to 90, one coin is one cent off. An order uses them all and the wallet then holds what it
-- held plus 1 to 8, so nothing is ever spent down and two checkouts at once cannot overspend. orders.coins_used is the only
-- record, no ledger.
-- Cost: 16 bytes a profile, 4 an order, four rows of promo codes; checkout_context stays one read.
-- =============================================================================

alter table public.promo_codes
  add column max_discount_cents integer check (max_discount_cents > 0),
  add column new_customers_only boolean not null default false,
  add column is_public boolean not null default false;

insert into public.promo_codes (code, discount_type, discount_value, min_order_cents, max_discount_cents,
                                new_customers_only, is_public)
values ('WELCOME10', 'percentage', 10, 0, 900, true, true),
       ('SAVE7', 'fixed', 700, 9900, null, false, true),
       ('SAVE12', 'fixed', 1200, 15000, null, false, true),
       ('SAVE20', 'fixed', 2000, 19900, null, false, true)
on conflict (code) do update
  set discount_type = excluded.discount_type, discount_value = excluded.discount_value,
      min_order_cents = excluded.min_order_cents, max_discount_cents = excluded.max_discount_cents,
      new_customers_only = excluded.new_customers_only, is_public = true, is_active = true,
      max_uses = null, valid_from = null, valid_until = null;

-- volatile on purpose: every existing account and every new one draws its own number
alter table public.profiles
  add column coins integer not null default (30 + floor(random() * 61))::integer check (coins >= 0);
comment on column public.profiles.coins is 'D-191: one coin is one cent off an order. Changed only by _refill_coins.';

alter table public.orders add column coins_used integer not null default 0 check (coins_used >= 0);

create function public._refill_coins() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  update public.profiles set coins = coins + 1 + floor(random() * 8)::integer where id = new.user_id;
  return null;
end $$;
revoke all on function public._refill_coins() from public, anon, authenticated;

-- in create_order's own transaction: an order it refuses leaves the wallet as it was
create trigger orders_refill_coins after insert on public.orders
  for each row when (new.user_id is not null) execute function public._refill_coins();

drop function public.checkout_context(uuid[], text, text);

create function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null, p_state text default null,
                                         p_user uuid default null, p_email text default null)
returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  with who as (
    -- D-191: new = no paid order on this account or email yet (a whole refund makes them new again)
    select not exists (
      select 1 from public.orders o
      where o.payment_status in ('paid', 'partially_refunded')
        and (o.user_id = p_user or o.email = lower(trim(p_email)))) as is_new)
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path,
               'tax_class', c.tax_class,
               'courier_cents', 0)  -- TODO(D-187): drop after the release (the old website's schema requires it)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      join public.products pr on pr.id = p.id
      join public.categories c on c.id = pr.category_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    -- §10 Y-3: every line asked about, in the order asked, also when it is no longer on sale: what is left and whether
    -- it can be bought, with its photo and words, so checkout can offer Remove or Keep n before payment.
    'stock', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', a.id,
               'on_sale', coalesce(pv.is_active and pr.status = 'live' and (not pr.is_placeholder or public.dev_preview()), false),
               'available', case when pv.is_active and pr.status = 'live' and (not pr.is_placeholder or public.dev_preview())
                                 then greatest(pv.qty_listed - pv.qty_reserved, 0) else 0 end,
               'product_name', pr.name,
               'label', pv.label,
               'image_path', (select m.storage_path from public.product_media m where m.product_id = pr.id
                               order by m.is_primary desc, m.sort_order limit 1))
             order by a.n)
      from unnest(p_variant_ids) with ordinality a(id, n)
      left join public.product_variants pv on pv.id = a.id
      left join public.products pr on pr.id = pv.product_id), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents,
                                'max_discount_cents', c.max_discount_cents)
      from public.promo_codes c, who
      where nullif(trim(p_promo_code), '') is not null
        and (not c.new_customers_only or who.is_new)
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    -- D-191: the coupon box's list, the customer's standing and their coins (null: no account)
    'coupons', coalesce((
      select jsonb_agg(jsonb_build_object('code', c.code, 'discount_type', c.discount_type,
                                          'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents,
                                          'max_discount_cents', c.max_discount_cents,
                                          'new_customers_only', c.new_customers_only)
                       order by c.new_customers_only desc, c.min_order_cents)
      from public.promo_codes c
      where c.is_public and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())), '[]'::jsonb),
    'is_new_customer', (select is_new from who),
    'coins', (select pf.coins from public.profiles pf where pf.id = p_user),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents,
                                'bulk_saving_from_cents', s.bulk_saving_from_cents,
                                'min_order_cents', s.min_order_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    -- A bag with food: the food shipment's window (the bag's charges say whether the bag has one)
    'food_delivery', (
      select jsonb_build_object('est_delivery_from', public._add_business_days(current_date, s.food_delivery_days_min),
                                'est_delivery_to', public._add_business_days(current_date, s.food_delivery_days_max))
      from public.pricing_settings s
      where s.id = 1 and s.food_delivery_days_min is not null and s.food_delivery_days_max is not null),
    'tax', (
      select jsonb_build_object('state', t.state, 'rate_pct', t.rate_pct, 'taxes_clothing', t.taxes_clothing,
                                'taxes_food', t.taxes_food, 'taxes_general', t.taxes_general)
      from public.tax_rates t where t.state = upper(trim(p_state))),
    -- A bag of only pieces already in the US ships from the warehouse at once: today + the US delivery days (D-072).
    'us_delivery', (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null
        and cardinality(p_variant_ids) > 0
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and not pr.is_us_stock)),
    -- TODO(D-187): drop after the release (the old website's schema requires 'express'; it reads 'quick_delivery')
    'quick_delivery', (
      select jsonb_build_object('est_delivery_from', public._add_business_days(current_date, s.food_delivery_days_min),
                                'est_delivery_to', public._add_business_days(current_date, s.food_delivery_days_max))
      from public.pricing_settings s
      where s.id = 1 and s.food_delivery_days_min is not null and s.food_delivery_days_max is not null),
    'express', null
  );
$$;

revoke all on function public.checkout_context(uuid[], text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.checkout_context(uuid[], text, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
