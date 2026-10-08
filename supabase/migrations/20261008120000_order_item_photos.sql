-- =============================================================================
-- Order tracking from the design pass (D-088): a photo on each item. Both customer paths return the item's product
-- photo (the same pick as store_products.primary_image_path: the primary photo, else the first by sort order), or
-- null when the product has none or is gone. A product photo is already public (the product-media bucket), so nothing
-- new is revealed (D-003). store_my_order reads the view as-is; guest_order_lookup builds the same keys by hand, and
-- store_pages.test.sql checks the two stay identical.
-- =============================================================================

-- Same columns as migration 1, image_path appended (create or replace keeps grants and column order).
create or replace view public.store_order_items as
select oi.id, oi.order_id, oi.product_id, oi.product_name, oi.variant_label, oi.region_name, oi.quantity,
       oi.unit_price_cents, oi.total_price_cents, oi.status,
       (select m.storage_path from public.product_media m
         where m.product_id = oi.product_id order by m.is_primary desc, m.sort_order limit 1) as image_path
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.user_id = auth.uid();

-- As defined by migration 4 (shipping and refunds) and later, with image_path added to each item.
create or replace function public.guest_order_lookup(p_order_number text, p_email text)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
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
      'tracking_number', o.tracking_number, 'carrier', o.carrier, 'created_at', o.created_at,
      'shipping_method', o.shipping_method, 'refunded_cents', o.refunded_cents),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'order_id', i.order_id, 'product_id', i.product_id, 'product_name', i.product_name,
               'variant_label', i.variant_label, 'region_name', i.region_name, 'quantity', i.quantity,
               'unit_price_cents', i.unit_price_cents, 'total_price_cents', i.total_price_cents, 'status', i.status,
               'image_path', (select m.storage_path from public.product_media m
                               where m.product_id = i.product_id order by m.is_primary desc, m.sort_order limit 1))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at)
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb),
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;
