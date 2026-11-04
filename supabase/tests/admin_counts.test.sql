-- admin_order_counts (migration 31, D-099): the admin's counts made in SQL agree with the rows themselves, and only an
-- admin gets them.
begin;
select tests.setup();

-- The truth, read as the owner (no RLS, no API row cap).
create temp table truth on commit drop as
select (select jsonb_object_agg(status, n) from (select status, count(*) as n from public.orders group by status) s) as by_status;
grant select on truth to authenticated;

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert((select public.admin_order_counts() -> 'by_status' = by_status from truth),
  'orders by status match the orders table');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_order_counts()', 'admin_only', 'customers get no order counts');
reset role;
rollback;
