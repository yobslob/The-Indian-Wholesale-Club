-- One-round-trip store functions (migration 20260928000002): right content,
-- nothing admin-only inside (INV-1), drafts/placeholders excluded (INV-8).
begin;
select tests.setup();
-- order numbers are what customers type; keep A's for the checks below
select set_config('tests.order_a_number', (select order_number from public.orders where id = tests.id('order_a')), true);

set local role anon;

select tests.assert(
  (select count(*) from jsonb_array_elements(public.store_home() -> 'regions') r where r ->> 'slug' = 'test-region') = 1,
  'store_home lists the region');
select tests.assert((public.store_home() -> 'delivery' ->> 'est_delivery_from') is not null,
  'store_home includes the next delivery window');
select tests.assert(
  (select jsonb_array_length(public.store_region_page('test-region') -> 'products')) = 1,
  'region page lists only the live, non-placeholder product');
select tests.assert(
  (public.store_region_page('test-region') -> 'products' -> 0 ->> 'slug') = 'test-live',
  'region page product is the live one');
select tests.assert(
  (public.store_region_page('test-region') -> 'products' -> 0 ->> 'available')::int = 1,
  'region page shows total availability (1 + 0 after the two setup orders)');
select tests.assert((public.store_region_page('no-such-region')) is null, 'unknown region returns null');

select tests.assert(
  (select jsonb_array_length(public.store_product_page('test-region', 'test-live') -> 'variants')) = 2,
  'product page includes both variants');
select tests.assert((public.store_product_page('test-region', 'test-live') -> 'delivery') is not null,
  'product page includes the delivery window');
select tests.assert(public.store_product_page('test-region', 'test-draft') is null, 'draft product page is null');
select tests.assert(public.store_product_page('test-region', 'test-placeholder') is null,
  'INV-8: placeholder product page is null');
select tests.assert(public.store_product_page('other-region', 'test-live') is null,
  'a product is only reachable under its own region');

-- INV-1 on everything these functions return
select tests.assert(
  not exists (
    select 1 from (
      select tests.json_keys(public.store_home()) as k
      union all select tests.json_keys(public.store_region_page('test-region'))
      union all select tests.json_keys(public.store_product_page('test-region', 'test-live'))
    ) x where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key anywhere in store_home / region page / product page');
select tests.assert(
  position('Secret Town' in public.store_product_page('test-region', 'test-live')::text) = 0
  and position('Test Shop' in public.store_region_page('test-region')::text) = 0,
  'INV-1: shop name and origin town never appear in store output');

select tests.assert_fails(
  format('select public.store_my_order(%L)', current_setting('tests.order_a_number')),
  '42501', 'anon cannot call store_my_order');
select tests.assert_fails(format('select public.admin_set_listed_qty(%L, 5)', tests.id('v_live')), '42501',
  'anon cannot call admin_set_listed_qty');
reset role;

-- Own order page
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select (d -> 'order' ->> 'customer_status') = 'confirmed'
          and jsonb_array_length(d -> 'items') = 1
          and jsonb_array_length(d -> 'events') = 1
   from (select public.store_my_order(current_setting('tests.order_a_number')) as d) x),
  'customer A gets their order with items and visible events');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_my_order(current_setting('tests.order_a_number'))) k
              where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key in store_my_order');
select tests.assert_fails(format('select public.admin_set_listed_qty(%L, 5)', tests.id('v_live')), 'admin_only',
  'a customer cannot correct stock');

select tests.act_as(tests.id('cust_b'));
select tests.assert(public.store_my_order(current_setting('tests.order_a_number')) is null,
  'customer B cannot read customer A''s order through store_my_order');
reset role;

-- Guest lookup (server only): needs the matching email, same safe shape
insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
values (tests.id('order_a'), 'internal_check', false, 'admin-only note');
select tests.assert(
  (select jsonb_agg(e ->> 'kind') from jsonb_array_elements(
     public.guest_order_lookup(current_setting('tests.order_a_number'), 'cust.a@example.test') -> 'events') e)
  = '["order_confirmed"]'::jsonb,
  'guest lookup shows only customer-visible events');
select tests.assert(
  (public.guest_order_lookup(current_setting('tests.order_a_number'), ' Cust.A@Example.test ') -> 'order' ->> 'customer_status')
    = 'confirmed',
  'guest lookup works with the order email (case/space-insensitive)');
select tests.assert(public.guest_order_lookup(current_setting('tests.order_a_number'), 'someone@else.test') is null,
  'guest lookup with the wrong email returns null');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.guest_order_lookup(current_setting('tests.order_a_number'),
                                                                        'cust.a@example.test')) k
              where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key in guest_order_lookup');
select tests.assert(
  (select array_agg(k order by k) from jsonb_object_keys(
     public.guest_order_lookup(current_setting('tests.order_a_number'), 'cust.a@example.test') -> 'order') k)
  = (select array_agg(column_name::text order by column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'store_orders'),
  'guest lookup order fields = exactly the store_orders columns (no drift between the two paths)');
select tests.assert(
  (select array_agg(k order by k) from jsonb_object_keys(
     public.guest_order_lookup(current_setting('tests.order_a_number'), 'cust.a@example.test') -> 'items' -> 0) k)
  = (select array_agg(column_name::text order by column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'store_order_items'),
  'guest lookup item fields = exactly the store_order_items columns');
select tests.assert(
  (select array_agg(k order by k) from jsonb_object_keys(
     public.guest_order_lookup(current_setting('tests.order_a_number'), 'cust.a@example.test') -> 'events' -> 0) k)
  = (select array_agg(column_name::text order by column_name) from information_schema.columns
     where table_schema = 'public' and table_name = 'store_order_events'),
  'guest lookup event fields = exactly the store_order_events columns');
set local role authenticated;
select tests.act_as(tests.id('cust_b'));
select tests.assert_fails(
  format('select public.guest_order_lookup(%L, %L)', current_setting('tests.order_a_number'), 'cust.a@example.test'),
  '42501', 'customers cannot call guest_order_lookup (server only)');
reset role;
set local role anon;
select tests.assert_fails(
  format('select public.guest_order_lookup(%L, %L)', current_setting('tests.order_a_number'), 'cust.a@example.test'),
  '42501', 'anon cannot call guest_order_lookup (server only)');
reset role;

-- Admin stock correction writes a noted ledger row
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.admin_set_listed_qty(tests.id('v_live'), 6, 'recounted at shop');
reset role;
select tests.assert(
  (select qty_listed = 6 and qty_confirmed_at is not null from public.product_variants where id = tests.id('v_live')),
  'admin_set_listed_qty updates the quantity and the confirmation time');
select tests.assert(
  (select reason::text || ':' || delta_listed || ':' || note from public.stock_movements
   where variant_id = tests.id('v_live') order by id desc limit 1) = 'adjusted:4:recounted at shop',
  'INV-4: the correction is logged with its note');

rollback;
