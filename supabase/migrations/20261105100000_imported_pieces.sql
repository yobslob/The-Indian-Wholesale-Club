-- =============================================================================
-- D-171 (founder 2026-10-31: "I want all of savana and newme, It doesn't matter if they are made in china on the
-- products page we will remove the made in India besides Imported and In product details we will remove made in India
-- only for savana products. and for newme orders, It works under 10 days delivery time."):
--  - products.made_in: the country the piece's own page states ('India' for everything listed before; 'China' for a
--    Savana or NEWME piece made there). Admin only: the customs invoice states it (export-documents.ts). Customers see
--    only store_products.made_in_india: a piece not made in India says "Imported", never "Made in India" (D-004).
--  - worker_set_origin(): the sourcing runner sets it right after adding a listing, before its photos publish it.
--  - Savana joins the shops (reader `savana`); NEWME and Savana bring a piece to the hub in up to 10 days. A shop's own
--    usual days now count as its delivery limit when they are longer than Settings' limit (3), so their sources are
--    used (_sourcing_settle, _quick_sourceable); every other shop keeps 3 or less, nothing changes for them.
--  - store_products appends made_in_india (the product page reads the row whole: store_product_page()); so do the
--    customer's order items (store_order_items, guest_order_lookup) for the printed invoice.
-- Size: one text column (a few bytes a listing). Egress: none. Page cache: none by itself (the website's cache key
-- SHAPE moves to v21, so cached store entries are rebuilt once, on their next visit).
-- Tests: imported_pieces.test.sql.
-- =============================================================================

alter table public.sourcing_shops drop constraint sourcing_shops_reader_check;
alter table public.sourcing_shops add constraint sourcing_shops_reader_check
  check (reader in ('amazon', 'flipkart', 'myntra', 'shopify', 'blinkit', 'bigbasket', 'zepto', 'instamart', 'newme',
                    'savana'));
insert into public.sourcing_shops (site, label, reader, product_types, delivery_days, sort_order)
values ('savana.com', 'Savana', 'savana', '{clothing}', 10, 120)
on conflict (site) do nothing;
update public.sourcing_shops set delivery_days = 10 where site = 'newme.asia';

alter table public.products add column made_in text not null default 'India'
  check (length(btrim(made_in)) between 2 and 60);

-- As 20261016200000_coming_soon, with made_in_india appended.
create or replace view public.store_products as
select p.id, p.slug, p.name, p.product_type,
       p.region_id, r.slug as region_slug, r.name as region_name,
       p.category_id, c.slug as category_slug, c.name as category_name,
       p.summary, p.description, p.story, p.craft, p.attributes, p.price_cents, p.published_at,
       (select m.storage_path from public.product_media m
         where m.product_id = p.id order by m.is_primary desc, m.sort_order limit 1) as primary_image_path,
       p.search,
       p.is_curated,
       p.is_us_stock,
       (p.status = 'archived') as coming_soon,
       (p.made_in = 'India') as made_in_india
from public.products p
left join public.regions r on r.id = p.region_id
join public.categories c on c.id = p.category_id
where (p.status = 'live' or (p.status = 'archived' and p.coming_soon))
  and (not p.is_placeholder or public.dev_preview());

-- As 20261101090000_quick_sources, with a shop's own usual days as its limit when longer than Settings'.
create or replace function public._quick_sourceable(p_product uuid) returns boolean
language sql stable set search_path = public, pg_temp as $$
  select exists (select 1 from public.pricing_settings s
                  where s.id = 1 and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null)
     and coalesce((
       select bool_and(x.quick)
         from (select ps.variant_id, bool_or(coalesce(sh.quick_delivery, false)) as quick
                 from public.product_sources ps
                 join public.product_variants v on v.id = ps.variant_id
                 left join public.sourcing_shops sh on sh.site = ps.site
                 cross join public.sourcing_settings ss
                where v.product_id = p_product and v.is_active and ss.id = 1
                  and ps.review is null and ps.fail_count < 2 and ps.in_stock and ps.price_paise is not null
                  and coalesce(ps.delivery_days, sh.delivery_days, 0) <= greatest(ss.max_delivery_days, coalesce(sh.delivery_days, 0))
                group by ps.variant_id) x), false)
$$;
revoke all on function public._quick_sourceable(uuid) from public, anon, authenticated;

create or replace function public._sourcing_settle(p_product uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.sourcing_settings;
  v public.product_variants;
  v_best public.product_sources;
  v_qty integer;
  v_on_sale boolean := false;
  v_prices integer := 0;
  v_stock integer := 0;
  v_quick boolean := public._quick_sourceable(p_product);
begin
  select * into s from public.sourcing_settings where id = 1;
  perform public._set_stock_context('adjusted', 'source_check', p_product, 'Shop check (D-118)');
  for v in select * from public.product_variants where product_id = p_product and is_active order by sort_order for update
  loop
    select ps.* into v_best
      from public.product_sources ps
      left join public.sourcing_shops sh on sh.site = ps.site
     where ps.variant_id = v.id and ps.review is null and ps.fail_count < 2 and ps.in_stock
       and ps.price_paise is not null
       and coalesce(ps.delivery_days, sh.delivery_days, 0) <= greatest(s.max_delivery_days, coalesce(sh.delivery_days, 0))
     order by (v_quick and coalesce(sh.quick_delivery, false)) desc, ps.price_paise, ps.delivery_days nulls last,
              ps.created_at
     limit 1;
    if found then
      v_qty := greatest(v.qty_listed, v.qty_reserved + s.qty_per_variant);
      v_prices := v_prices + (v.shop_price_paise is distinct from v_best.price_paise)::integer;
      v_stock := v_stock + (v_qty <> v.qty_listed)::integer;
      update public.product_variants
         set shop_price_paise = v_best.price_paise, source_id = v_best.id, qty_listed = v_qty, qty_confirmed_at = now()
       where id = v.id;
      v_on_sale := v_on_sale or v_qty > v.qty_reserved;
    elsif exists (select 1 from public.product_sources where variant_id = v.id) then
      if v.qty_listed > v.qty_reserved then
        update public.product_variants set qty_listed = qty_reserved, qty_confirmed_at = now() where id = v.id;
        v_stock := v_stock + 1;
      end if;
    else
      v_on_sale := v_on_sale or v.qty_listed > v.qty_reserved;
    end if;
  end loop;
  perform public._set_stock_context(null, null, null, null);

  update public.products p
     set shop_price_paise = coalesce((select min(x.shop_price_paise) from public.product_variants x
                                       where x.product_id = p.id and x.is_active and x.qty_listed > x.qty_reserved),
                                     p.shop_price_paise),
         source_checked_at = now(),
         source_in_stock = v_on_sale
   where p.id = p_product;
  return jsonb_build_object('price_changes', v_prices, 'stock_changes', v_stock);
end $$;
revoke all on function public._sourcing_settle(uuid) from public, anon, authenticated;

-- p_made_in: the country as the page states it ("China"); 'India' puts the listing back to Made in India. Only a
-- listing the runner made (it has a shop source) is changed. Returns whether one was.
create function public.worker_set_origin(p_product uuid, p_made_in text)
returns boolean
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  if p_made_in is null or length(btrim(p_made_in)) not between 2 and 60 then
    raise exception 'origin_invalid' using errcode = 'P0001';
  end if;
  update public.products p set made_in = btrim(p_made_in)
   where p.id = p_product and exists (select 1 from public.product_sources ps where ps.product_id = p.id);
  return found;
end $$;
revoke all on function public.worker_set_origin(uuid, text) from public, anon;
grant execute on function public.worker_set_origin(uuid, text) to authenticated;

-- As 20261007150000_after_sales, keeping the piece's country on its US clearance copy.
create or replace function public._to_clearance(p_item uuid, p_why text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item public.order_items;
  v_product public.products;
  v_discount numeric;
  v_price integer;
  v_slug text;
  v_id uuid;
  v_weight integer;
begin
  select * into v_item from public.order_items where id = p_item;
  select * into v_product from public.products where id = v_item.product_id;
  if v_product.id is null then
    return null;   -- the product was deleted: nothing to copy
  end if;
  select coalesce(clearance_discount_pct, 0) into v_discount from public.pricing_settings where id = 1;
  v_price := greatest(99, (floor(v_item.unit_price_cents * (1 - v_discount / 100) / 100) * 100 - 1)::integer);
  v_slug := left(v_product.slug, 70) || '-us-' || substr(md5(p_item::text), 1, 6);
  select weight_g into v_weight from public.product_variants where id = v_item.variant_id;

  insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, summary, description, story,
                               craft, attributes, price_cents, price_auto, shop_price_paise, origin_town,
                               has_origin_label, status, is_us_stock, made_in)
  values (v_slug, v_product.name, v_product.product_type, v_product.region_id, v_product.category_id,
          v_product.vendor_id, v_product.summary, v_product.description, v_product.story, v_product.craft,
          v_product.attributes, v_price, false, null, v_product.origin_town, v_product.has_origin_label, 'draft', true,
          v_product.made_in)
  returning id into v_id;
  insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at)
  select v_id, upper(v_slug) || '-1', v_item.variant_label, coalesce(v.options, '{}'::jsonb), v_weight, v_item.quantity, now()
  from (select 1) one left join public.product_variants v on v.id = v_item.variant_id;
  insert into public.product_media (product_id, storage_path, alt_text, sort_order, is_primary)
  select v_id, m.storage_path, m.alt_text, m.sort_order, m.is_primary
  from public.product_media m where m.product_id = v_product.id and m.variant_id is null;
  insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
  values (v_item.order_id, 'note', false,
          v_item.product_name || ' (' || v_item.variant_label || ') → US clearance draft ' || v_slug || ' (' || p_why || ')');
  return v_id;
end $$;

-- As 20261008120000_order_item_photos, with made_in_india appended: the customer's printed invoice says "Imported" for
-- a piece made elsewhere (a deleted product counts as made in India, as every listing before D-171).
create or replace view public.store_order_items as
select oi.id, oi.order_id, oi.product_id, oi.product_name, oi.variant_label, oi.region_name, oi.quantity,
       oi.unit_price_cents, oi.total_price_cents, oi.status,
       (select m.storage_path from public.product_media m
         where m.product_id = oi.product_id order by m.is_primary desc, m.sort_order limit 1) as image_path,
       coalesce((select p.made_in = 'India' from public.products p where p.id = oi.product_id), true) as made_in_india
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.user_id = auth.uid();

-- As 20261024090000_shipment_admin, with made_in_india on each item (the same keys as store_order_items).
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
                               where m.product_id = i.product_id order by m.is_primary desc, m.sort_order limit 1),
               'made_in_india', coalesce((select p.made_in = 'India' from public.products p where p.id = i.product_id), true))
             order by i.product_name)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'order_id', e.order_id, 'kind', e.kind,
                                          'message', e.message, 'created_at', e.created_at,
                                          'shipment', (select sh.seq from public.order_shipments sh where sh.id = e.shipment_id))
             order by e.created_at)
      from public.order_events e where e.order_id = o.id and e.visible_to_customer), '[]'::jsonb),
    'shipments', public._order_shipments_json(o.id),
    'offer', public._order_offer(o.id),
    'actions', public._order_actions(o.id)
  )
  from public.orders o
  where o.order_number = p_order_number and o.email = lower(trim(p_email));
$$;
