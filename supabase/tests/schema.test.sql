-- INV-9 + structural guarantees that the other invariants rely on.
begin;

select tests.assert(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and (column_name like '%\_cents' or column_name like '%\_paise')
      and data_type not in ('integer', 'bigint')),
  'INV-9: every *_cents / *_paise column is an integer');

select tests.assert(
  (select count(*) from information_schema.columns c
   join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
   where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
     and (c.column_name like '%\_cents' or c.column_name like '%\_paise')) >= 15,
  'INV-9: money columns exist (guards against the check above passing vacuously)');

select tests.assert(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'every public table has row level security enabled');

select tests.assert(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and table_name in ('webhook_events', 'pending_orders', 'failed_reconciliations', 'email_outbox',
                         'admin_error_events', 'newsletter_subscribers', 'admin_emails')),
  'operations tables and the admin allowlist are service-role only');

select tests.assert(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and table_name not like 'store\_%'
      and table_name <> 'variant_availability'),
  'anon can only read store_* views and variant_availability');

-- Future migrations get Supabase's default "grant all on functions"; this catches
-- any public function that becomes callable by the wrong role.
select tests.assert(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute'))
  = array['dev_preview', 'is_product_visible', 'store_browse', 'store_home', 'store_next_delivery', 'store_product_page',
          'store_region_page', 'store_search', 'store_type_rows'],
  'anon can execute only the store-facing functions');

select tests.assert(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute'))
  = array['admin_attention', 'admin_create_listing', 'admin_demand', 'admin_price_preview', 'admin_sales', 'admin_set_listed_qty', 'admin_stale_variants', 'advance_cycle', 'cancel_after_delay', 'cancel_order', 'cancel_refund_cents', 'change_delivery_window',
          'check_off_arrival', 'confirm_move_shipped', 'cutoff_cycle', 'deliver_order', 'dev_preview', 'is_admin', 'is_product_visible', 'item_refund_cents', 'keep_after_delay', 'mark_pickup', 'move_order',
          'record_payout', 'refund_order_item', 'review_eligibility', 'ship_order', 'store_browse', 'store_home', 'store_my_order', 'store_next_delivery',
          'store_product_page', 'store_region_page', 'store_search', 'store_type_rows'],
  'signed-in users can execute only store + admin-checked functions (never create_order)');

rollback;
