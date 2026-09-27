-- INV-1: anon/customers can't read admin-only tables or columns.
-- INV-8: draft region text and placeholder products never reach store_* output.
begin;
select tests.setup();

select tests.assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name like 'store\_%'
      and column_name in ('vendor_id', 'shop_price_paise', 'origin_town', 'cycle_id', 'notes', 'internal_note',
                          'qty_listed', 'qty_reserved', 'qty_confirmed_at', 'is_placeholder', 'has_origin_label',
                          'sku', 'payment_intent_id', 'promo_code_id', 'created_by', 'licences', 'user_id',
                          'visible_to_customer', 'content_status', 'actor')),
  'INV-1: no store_* view exposes an admin-only column');

-- Signed-out visitor
set local role anon;
select tests.assert_fails('select * from public.vendors', '42501', 'INV-1: anon cannot read vendors');
select tests.assert_fails('select * from public.products', '42501', 'INV-1: anon cannot read base products');
select tests.assert_fails('select * from public.product_variants', '42501', 'INV-1: anon cannot read base variants');
select tests.assert_fails('select * from public.pickups', '42501', 'INV-1: anon cannot read pickups');
select tests.assert_fails('select * from public.vendor_payouts', '42501', 'INV-1: anon cannot read payouts');
select tests.assert_fails('select * from public.cycles', '42501', 'INV-1: anon cannot read cycles');
select tests.assert_fails('select * from public.stock_movements', '42501', 'INV-1: anon cannot read the stock ledger');
select tests.assert_fails('select * from public.pricing_settings', '42501', 'INV-1: anon cannot read pricing');
select tests.assert_fails('select * from public.orders', '42501', 'INV-1: anon cannot read orders');

select tests.assert((select count(*) from public.store_products where id = tests.id('p_live')) = 1,
  'a live product is visible in store_products');
select tests.assert((select count(*) from public.store_products
                     where id in (tests.id('p_draft'), tests.id('p_placeholder'))) = 0,
  'INV-8: draft and placeholder products are hidden');
select tests.assert((select count(*) from public.store_variants where id = tests.id('v_placeholder')) = 0,
  'INV-8: placeholder variants are hidden');
select tests.assert((select count(*) from public.variant_availability where variant_id = tests.id('v_placeholder')) = 0,
  'INV-8: placeholder availability is hidden');
select tests.assert((select available from public.store_variants where id = tests.id('v_live')) = 1,
  'store availability = listed (2) - reserved (1)');
select tests.assert((select greeting_native from public.store_regions where id = tests.id('region')) is null,
  'INV-8: draft region text is hidden');
select tests.assert((select name from public.store_regions where id = tests.id('region')) = 'Test Region',
  'region names are always visible');
select tests.assert((select count(*) from public.store_orders) = 0, 'anon sees no orders');
select tests.assert((select count(*) from public.store_next_delivery()) = 1,
  'anon can read the next delivery window (D-035)');
reset role;

-- Signed-in customer: base tables are granted to `authenticated` for admins,
-- but RLS returns nothing to a customer.
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.vendors) = 0, 'INV-1: customer sees no vendors');
select tests.assert((select count(*) from public.products) = 0, 'INV-1: customer sees no base products');
select tests.assert((select count(*) from public.product_variants) = 0, 'INV-1: customer sees no base variants');
select tests.assert((select count(*) from public.pickups) = 0, 'INV-1: customer sees no pickups');
select tests.assert((select count(*) from public.cycles) = 0, 'INV-1: customer sees no cycles');
select tests.assert((select count(*) from public.stock_movements) = 0, 'INV-1: customer sees no stock ledger');
select tests.assert((select count(*) from public.orders) = 0,
  'INV-1: base orders table (holds cycle_id, notes) is hidden; customers use store_orders');
select tests.assert((select count(*) from public.order_events) = 0, 'INV-1: base order_events hidden');
select tests.assert_fails('select * from public.admin_emails', '42501', 'customer cannot read the admin allowlist');
reset role;

-- Approval and dev preview switch visibility on
update public.regions set content_status = 'approved' where id = tests.id('region');
update public.app_settings set value = 'true'::jsonb where key = 'dev_preview';
set local role anon;
select tests.assert((select greeting_native from public.store_regions where id = tests.id('region')) = 'Test greeting',
  'approved region text is visible');
select tests.assert((select count(*) from public.store_products where id = tests.id('p_placeholder')) = 1,
  'dev_preview shows placeholder products (dev only)');
reset role;

rollback;
