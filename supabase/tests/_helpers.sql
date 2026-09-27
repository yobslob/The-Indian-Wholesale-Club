-- =============================================================================
-- Test helpers for supabase/tests/*.test.sql (run by `node scripts/check.mjs db`).
-- Local/test databases only: the runner creates schema `tests` and drops it again.
-- Each test file runs in its own transaction and ROLLS BACK, so the database is
-- unchanged afterwards. Role switching mimics real requests:
--   set local role anon;                          -- signed-out visitor
--   set local role authenticated; select tests.act_as(tests.id('cust_a'));
--   reset role;                                    -- back to the DB owner
-- =============================================================================

drop schema if exists tests cascade;
create schema tests;

create function tests.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'ASSERTION FAILED: %', p_msg using errcode = 'P0002';
  end if;
end $$;

-- Passes only if p_sql raises an error whose SQLSTATE equals p_expect or whose
-- message contains p_expect.
create function tests.assert_fails(p_sql text, p_expect text, p_msg text) returns void
language plpgsql as $$
declare
  v_state text;
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    v_state := sqlstate;
    v_message := sqlerrm;
  end;
  if v_state is null then
    raise exception 'ASSERTION FAILED: % (expected error "%", but the statement succeeded)', p_msg, p_expect
      using errcode = 'P0002';
  end if;
  if v_state <> p_expect and position(lower(p_expect) in lower(v_message)) = 0 then
    raise exception 'ASSERTION FAILED: % (expected error "%", got % "%")', p_msg, p_expect, v_state, v_message
      using errcode = 'P0002';
  end if;
end $$;

create function tests.rows_affected(p_sql text) returns integer
language plpgsql as $$
declare
  v_count integer;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function tests.act_as(p_user uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

create function tests.id(p_name text) returns uuid
language sql stable as $$
  select nullif(current_setting('tests.' || p_name, true), '')::uuid;
$$;

create function tests.remember(p_name text, p_id uuid) returns uuid
language sql as $$
  select set_config('tests.' || p_name, p_id::text, true)::uuid;
$$;

create function tests.create_user(p_name text, p_email text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (v_id, p_email, '{}'::jsonb);
  return tests.remember(p_name, v_id);
end $$;

-- Fixture used by every test file (all rolled back afterwards):
--   users: cust_a, cust_b (customers), admin (role + allowlist), fake_admin (role only)
--   region (draft text), categories, vendor, products: p_live (2 variants),
--   p_draft, p_placeholder; an open cycle; orders order_a (cust_a, v_live x1)
--   and order_b (cust_b, v_live2 x1).
create function tests.setup() returns void
language plpgsql as $$
declare
  v_id uuid;
  v_order record;
begin
  -- a clean slate that does not depend on dev seed data
  update public.cycles set status = 'closed', closed_at = now() where status = 'open';
  update public.app_settings set value = 'false'::jsonb where key = 'dev_preview';
  update public.pricing_settings set domestic_days_min = 3, domestic_days_max = 7 where id = 1;

  perform tests.create_user('cust_a', 'cust.a@example.test');
  perform tests.create_user('cust_b', 'cust.b@example.test');
  perform tests.create_user('admin', 'admin@example.test');
  perform tests.create_user('fake_admin', 'fake.admin@example.test');
  update public.profiles set role = 'admin', desk = 'us' where id in (tests.id('admin'), tests.id('fake_admin'));
  insert into public.admin_emails (email) values ('admin@example.test');

  insert into public.regions (slug, name, greeting_native, greeting_script, greeting_latin)
  values ('test-region', 'Test Region', 'Test greeting', 'Latn', 'Test greeting')
  returning id into v_id;
  perform tests.remember('region', v_id);

  insert into public.categories (product_type, slug, name) values ('clothing', 'test-clothing', 'Test clothing')
  returning id into v_id;
  perform tests.remember('cat_clothing', v_id);
  insert into public.categories (product_type, slug, name) values ('spice', 'test-spice', 'Test spice')
  returning id into v_id;
  perform tests.remember('cat_spice', v_id);

  insert into public.vendors (shop_name, region_id, status) values ('Test Shop', tests.id('region'), 'active')
  returning id into v_id;
  perform tests.remember('vendor', v_id);

  insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents,
                               shop_price_paise, origin_town, status)
  values ('test-live', 'Test live product', 'clothing', tests.id('region'), tests.id('cat_clothing'),
          tests.id('vendor'), 5000, 100000, 'Secret Town', 'live')
  returning id into v_id;
  perform tests.remember('p_live', v_id);

  insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
  values ('test-draft', 'Test draft product', 'clothing', tests.id('region'), tests.id('cat_clothing'),
          tests.id('vendor'), 5000, 'draft')
  returning id into v_id;
  perform tests.remember('p_draft', v_id);

  insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                               is_placeholder)
  values ('test-placeholder', 'Test placeholder product', 'clothing', tests.id('region'), tests.id('cat_clothing'),
          tests.id('vendor'), 5000, 'live', true)
  returning id into v_id;
  perform tests.remember('p_placeholder', v_id);

  insert into public.product_variants (product_id, sku, label, qty_listed)
  values (tests.id('p_live'), 'TEST-LIVE-1', 'Free size', 2) returning id into v_id;
  perform tests.remember('v_live', v_id);
  insert into public.product_variants (product_id, sku, label, qty_listed, price_cents)
  values (tests.id('p_live'), 'TEST-LIVE-2', 'Large', 1, 6000) returning id into v_id;
  perform tests.remember('v_live2', v_id);
  insert into public.product_variants (product_id, sku, label, qty_listed)
  values (tests.id('p_placeholder'), 'TEST-PH-1', 'Free size', 5) returning id into v_id;
  perform tests.remember('v_placeholder', v_id);

  insert into public.cycles (code, status, cutoff_at, est_arrival_on)
  values ('TEST-CYCLE', 'open', now() + interval '5 days', current_date + 20) returning id into v_id;
  perform tests.remember('cycle', v_id);

  select * into v_order from public.create_order(jsonb_build_object(
    'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
    'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1,
                                                  'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'tax_cents', 400, 'total_cents', 5400, 'payment_intent_id', 'pi_test_order_a'));
  perform tests.remember('order_a', v_order.order_id);

  select * into v_order from public.create_order(jsonb_build_object(
    'email', 'cust.b@example.test', 'user_id', tests.id('cust_b'),
    'shipping_address', jsonb_build_object('fullName', 'Cust B', 'line1', '2 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live2'), 'quantity', 1,
                                                  'unit_price_cents', 6000)),
    'subtotal_cents', 6000, 'total_cents', 6000, 'payment_intent_id', 'pi_test_order_b'));
  perform tests.remember('order_b', v_order.order_id);
end $$;

grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;
