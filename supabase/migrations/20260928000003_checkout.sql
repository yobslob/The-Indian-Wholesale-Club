-- =============================================================================
-- R5: checkout support.
-- 1. Shipping charge settings. NULL until the founder answers Q-16; checkout
--    refuses to run while flat shipping is NULL (never a guessed fee, D-012).
-- 2. checkout_context(): everything the server needs to price a cart in ONE
--    round trip (engineering.md PR-2): the variants as customers can buy them
--    (through store_* only, so hidden or placeholder products are excluded),
--    the promo code if it is currently usable, the shipping settings and the
--    next delivery window. Service role only (it reads promo_codes).
-- =============================================================================

alter table public.pricing_settings
  add column shipping_flat_cents integer check (shipping_flat_cents >= 0),
  add column free_shipping_min_cents integer check (free_shipping_min_cents >= 0);

comment on column public.pricing_settings.shipping_flat_cents is
  'Shipping charged per order in USD cents. NULL = not decided (Q-16): checkout is unavailable.';
comment on column public.pricing_settings.free_shipping_min_cents is
  'Orders at or above this discounted subtotal ship free. NULL = never free (Q-16).';

create function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents)
      from public.promo_codes c
      where nullif(trim(p_promo_code), '') is not null
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$$;

revoke all on function public.checkout_context(uuid[], text) from public, anon, authenticated;
grant execute on function public.checkout_context(uuid[], text) to service_role;

-- -----------------------------------------------------------------------------
-- flows.md §1 + §6: move a cycle one step forward after cutoff, together with
-- its orders, atomically. open → collecting is cutoff_cycle() (it creates the
-- pickups); this function covers collecting → packed → exported → arrived →
-- fulfilling → closed. Each affected order gets an INTERNAL event (customers
-- keep seeing "Preparing your order", D-034). Admin or service role only.
-- -----------------------------------------------------------------------------
create function public.advance_cycle(p_cycle uuid)
returns public.cycle_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_from public.cycle_status;
  v_to public.cycle_status;
  v_order_from public.order_status;
  v_order_to public.order_status;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  select status into v_from from public.cycles where id = p_cycle for update;
  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0001';
  end if;

  case v_from
    when 'collecting' then v_to := 'packed';     v_order_from := 'collecting'; v_order_to := 'packed';
    when 'packed'     then v_to := 'exported';   v_order_from := 'packed';     v_order_to := 'in_transit';
    when 'exported'   then v_to := 'arrived';    v_order_from := 'in_transit'; v_order_to := 'arrived';
    when 'arrived'    then v_to := 'fulfilling';
    when 'fulfilling' then v_to := 'closed';
    else
      -- 'open' must go through cutoff_cycle(); 'closed' is final.
      raise exception 'cycle_cannot_advance:%', v_from using errcode = 'P0001';
  end case;

  if v_to = 'closed' and exists (
    select 1 from public.orders
    where cycle_id = p_cycle and status not in ('delivered', 'cancelled', 'refunded')
  ) then
    raise exception 'cycle_has_open_orders' using errcode = 'P0001';
  end if;

  update public.cycles
     set status = v_to,
         exported_at = case when v_to = 'exported' then now() else exported_at end,
         arrived_at = case when v_to = 'arrived' then now() else arrived_at end,
         closed_at = case when v_to = 'closed' then now() else closed_at end
   where id = p_cycle;

  if v_order_to is not null then
    update public.orders set status = v_order_to where cycle_id = p_cycle and status = v_order_from;
  end if;

  insert into public.order_events (order_id, kind, visible_to_customer, actor)
  select o.id, 'cycle_' || v_to::text, false, auth.uid()
  from public.orders o
  where o.cycle_id = p_cycle and o.status not in ('cancelled', 'refunded');

  return v_to;
end $$;

revoke all on function public.advance_cycle(uuid) from public, anon, authenticated;
grant execute on function public.advance_cycle(uuid) to authenticated, service_role;
