-- INV-7: admin = role 'admin' AND email on the allowlist (D-006). Customers can
-- never promote themselves (fixes the pre-IWC hole where the "update own
-- profile" policy let any user set their own role).
begin;
select tests.setup();

set local role authenticated;

select tests.act_as(tests.id('admin'));
select tests.assert(public.is_admin(), 'INV-7: role admin + allowlisted email is an admin');
select tests.assert((select count(*) from public.pricing_settings) = 1, 'admin can read the settings');
select tests.assert((select count(*) from public.orders) >= 2, 'admin can read all orders');
select tests.assert(
  tests.rows_affected('update public.pricing_settings set stale_listing_days = 9 where id = 1') = 1,
  'admin can update a setting');

select tests.act_as(tests.id('fake_admin'));
select tests.assert(not public.is_admin(), 'INV-7: role admin WITHOUT allowlisted email is not an admin');
select tests.assert((select count(*) from public.pricing_settings) = 0, 'INV-7: non-allowlisted "admin" sees no settings');
select tests.assert_fails('select public.admin_order_counts()', 'admin_only',
  'INV-7: non-allowlisted "admin" gets no admin answer');

select tests.act_as(tests.id('cust_a'));
select tests.assert(not public.is_admin(), 'a customer is not an admin');
select tests.assert_fails(format('update public.profiles set role = %L where id = %L', 'admin', tests.id('cust_a')),
  '42501', 'a customer cannot change their own role');
select tests.assert_fails(format('update public.profiles set desk = %L where id = %L', 'us', tests.id('cust_a')),
  '42501', 'a customer cannot set a desk');
select tests.assert(
  tests.rows_affected(format('update public.profiles set full_name = %L where id = %L', 'A. Customer', tests.id('cust_a'))) = 1,
  'a customer can edit their own name');
select tests.assert(
  tests.rows_affected(format('update public.profiles set full_name = %L where id = %L', 'Hacked', tests.id('cust_b'))) = 0,
  'a customer cannot edit someone else''s profile');
select tests.assert_fails(format('select public.mark_pickup(%L, %L)', gen_random_uuid(), 'picked'), 'admin_only',
  'a customer cannot mark pickups');
reset role;

select tests.assert((select role::text from public.profiles where id = tests.id('cust_a')) = 'customer',
  'customer A is still a customer');

rollback;
