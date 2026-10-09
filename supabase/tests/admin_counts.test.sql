-- admin_order_counts and admin_cycle_totals (migration 31, D-099): the admin's counts made in SQL agree with the rows
-- themselves, and only an admin gets them.
begin;
select tests.setup();

-- The truth, read as the owner (no RLS, no API row cap).
create temp table truth on commit drop as
select (select jsonb_object_agg(status, n) from (select status, count(*) as n from public.orders group by status) s) as by_status,
       (select count(distinct vendor_id) from public.pickups where status = 'picked' and payout_id is null) as shops_owed,
       (select cycle_id from public.orders where id = tests.id('order_a')) as cycle_id;
create temp table cycle_truth on commit drop as
select count(distinct o.id) as orders, coalesce(sum(i.quantity) filter (where i.status = 'active'), 0) as pieces,
       coalesce(sum(i.total_price_cents) filter (where i.status = 'active'), 0) as sales_cents
from public.orders o left join public.order_items i on i.order_id = o.id
where o.cycle_id = (select cycle_id from truth) and o.status not in ('pending_payment', 'cancelled', 'refunded');
grant select on truth, cycle_truth to authenticated;

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert((select public.admin_order_counts() -> 'by_status' = by_status from truth),
  'orders by status match the orders table');
select tests.assert((select (public.admin_order_counts() ->> 'shops_owed')::int = shops_owed from truth),
  'shops owed match the unpaid picked pieces');
select tests.assert(
  (select (t ->> 'orders')::int = c.orders and (t ->> 'pieces')::int = c.pieces
          and (t ->> 'sales_cents')::int = c.sales_cents and (t ->> 'orders')::int >= 2
   from cycle_truth c, lateral (select public.admin_cycle_totals((select cycle_id from truth)) as t) x),
  'the cycle card counts the cycle''s paid orders, pieces and sales');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_order_counts()', 'admin_only', 'customers get no order counts');
select tests.assert_fails(format('select public.admin_cycle_totals(%L)', (select cycle_id from truth)), 'admin_only',
  'customers get no cycle totals');
reset role;
rollback;
