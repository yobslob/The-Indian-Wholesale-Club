-- 20261106090000_admin_rls_once: the admin policies check is_admin() once per query, and still let only an admin in.
begin;
select tests.setup();

select tests.assert(
  not exists (select 1 from pg_policies where schemaname = 'public' and (qual = 'is_admin()' or with_check = 'is_admin()')),
  'no public policy calls is_admin() row by row');
select tests.assert(
  (select qual = '( SELECT is_admin() AS is_admin)' and with_check = qual
     from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'admin_all'),
  'the products policy asks once per query');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert((select count(*) from public.products where id = tests.id('p_draft')) = 1, 'an admin reads a draft');
select tests.assert((select count(*) from public.product_variants where product_id = tests.id('p_live')) = 2,
  'an admin reads its options');
select tests.act_as(tests.id('fake_admin'));
select tests.assert((select count(*) from public.products) = 0, 'the admin role without the allowlist reads nothing');
select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.products) = 0, 'a customer reads no product rows');
reset role;
rollback;
