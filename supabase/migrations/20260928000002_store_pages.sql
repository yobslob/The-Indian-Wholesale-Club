-- =============================================================================
-- R4: one-round-trip page reads (engineering.md PR-2) + admin stock correction.
-- Every store_* function reads ONLY store_* views, so it can never expose more
-- than the views' whitelist (D-017, INV-1). Each returns NULL when not found.
-- =============================================================================

-- Home + /states: every region (card fields only) and the next delivery window.
create function public.store_home()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', r.slug, 'name', r.name, 'is_live', r.is_live, 'accent_color', r.accent_color,
               'hero_image_path', r.hero_image_path, 'greeting_native', r.greeting_native,
               'greeting_script', r.greeting_script, 'greeting_latin', r.greeting_latin, 'tagline', r.tagline)
             order by r.sort_order, r.name)
      from public.store_regions r), '[]'::jsonb),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  );
$$;

-- /states/[region]: the region and its live products (card fields + total availability).
create function public.store_region_page(p_region_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'region', to_jsonb(r),
    'products', coalesce((
      select jsonb_agg(
               (to_jsonb(p) - 'search' - 'description' - 'story' - 'attributes')
               || jsonb_build_object('available',
                    (select coalesce(sum(v.available), 0) from public.store_variants v where v.product_id = p.id))
             order by p.product_type, p.name)
      from public.store_products p
      where p.region_id = r.id), '[]'::jsonb)
  )
  from public.store_regions r
  where r.slug = p_region_slug;
$$;

-- /states/[region]/[product]: product, variants, media and the next delivery window.
create function public.store_product_page(p_region_slug text, p_product_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'product', to_jsonb(p) - 'search',
    'variants', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.sort_order, v.label)
      from public.store_variants v where v.product_id = p.id), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.is_primary desc, m.sort_order)
      from public.store_media m where m.product_id = p.id), '[]'::jsonb),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1)
  )
  from public.store_products p
  where p.region_slug = p_region_slug and p.slug = p_product_slug;
$$;

-- /account/orders/[number]: the signed-in customer's own order with items and
-- customer-visible events (the views already filter by auth.uid()).
create function public.store_my_order(p_order_number text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order', to_jsonb(o),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.product_name)
      from public.store_order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.created_at)
      from public.store_order_events e where e.order_id = o.id), '[]'::jsonb)
  )
  from public.store_orders o
  where o.order_number = p_order_number;
$$;

-- Guest order lookup (/orders/lookup): order number + email, same customer-safe
-- shape as store_my_order. Server-only (service role); the route adds rate limiting.
create function public.guest_order_lookup(p_order_number text, p_email text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id, 'order_number', o.order_number, 'email', o.email,
      'customer_status', case o.status
         when 'pending_payment' then 'pending'
         when 'confirmed' then 'confirmed'
         when 'shipped' then 'shipped'
         when 'delivered' then 'delivered'
         when 'cancelled' then 'cancelled'
         when 'refunded' then 'refunded'
         else 'preparing' end,
      'est_delivery_from', o.est_delivery_from, 'est_delivery_to', o.est_delivery_to,
      'subtotal_cents', o.subtotal_cents, 'discount_cents', o.discount_cents, 'shipping_cents', o.shipping_cents,
      'tax_cents', o.tax_cents, 'total_cents', o.total_cents, 'currency', o.currency,
      'payment_status', o.payment_status, 'shipping_address', o.shipping_address,
      'tracking_number', o.tracking_number, 'carrier', o.carrier, 'created_at', o.created_at),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
               'variant_label', i.variant_label, 'region_name', i.region_name, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'total_price_cents', i.total_price_cents, 'status', i.status)
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at)
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;

-- Admin correction of a variant's listed quantity, with a note in the ledger (INV-4).
create function public.admin_set_listed_qty(p_variant uuid, p_qty_listed integer, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  -- Setting the listed qty counts as a fresh confirmation with the shop (qty_confirmed_at).
  perform public._set_stock_context('adjusted', null, null, p_note);
  update public.product_variants
     set qty_listed = p_qty_listed, qty_confirmed_at = now()
   where id = p_variant;
  if not found then
    raise exception 'variant_not_found' using errcode = 'P0001';
  end if;
  perform public._set_stock_context(null, null, null, null);
end $$;

-- Privileges (Supabase grants new functions to everyone by default).
revoke all on function public.store_home(), public.store_region_page(text), public.store_product_page(text, text),
  public.store_my_order(text), public.guest_order_lookup(text, text), public.admin_set_listed_qty(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.store_home(), public.store_region_page(text), public.store_product_page(text, text)
  to anon, authenticated;
grant execute on function public.store_my_order(text), public.admin_set_listed_qty(uuid, integer, text) to authenticated;
grant execute on function public.store_home(), public.store_region_page(text), public.store_product_page(text, text),
  public.store_my_order(text), public.guest_order_lookup(text, text), public.admin_set_listed_qty(uuid, integer, text)
  to service_role;
