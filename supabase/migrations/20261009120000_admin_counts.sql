-- =============================================================================
-- Admin counts made in the database (D-099). The Orders chips, Today's order counts, the shops to pay and the open
-- cycle's card counted rows the API had sent over, but the API sends at most 1,000 rows (config.toml max_rows): past
-- 1,000 orders (or 1,000 unpaid pieces, or 1,000 orders in a cycle) they came out too low, without an error. Each is
-- now one count in SQL: a few numbers on the wire instead of up to 1,000 rows. Admin only, under the tables' RLS.
-- Plus indexes for the admin's busiest filters, so these stay quick as the orders grow.
-- =============================================================================

-- Every order by status, express orders still to send (D-070) and the shops owed for picked pieces (flows.md §5).
create function public.admin_order_counts()
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_status', coalesce((
      select jsonb_object_agg(s.status, s.n)
      from (select o.status, count(*) as n from public.orders o group by o.status) s), '{}'::jsonb),
    'express_to_send', (
      select count(*) from public.orders o
      where o.shipping_method = 'express' and o.cycle_id is null and o.status in ('confirmed', 'collecting')),
    'shops_owed', (
      select count(distinct p.vendor_id) from public.pickups p
      where p.status = 'picked' and p.payout_id is null));
end $$;

-- Today's cycle card (D-096): the cycle's paid orders, and their active pieces, shops and sales (the pieces' prices,
-- before tax and shipping, as Insights counts them).
create function public.admin_cycle_totals(p_cycle uuid)
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'orders', count(distinct o.id),
      'pieces', coalesce(sum(i.quantity) filter (where i.status = 'active'), 0),
      'shops', count(distinct p.vendor_id) filter (where i.status = 'active'),
      'sales_cents', coalesce(sum(i.total_price_cents) filter (where i.status = 'active'), 0))
    from public.orders o
    left join public.order_items i on i.order_id = o.id
    left join public.products p on p.id = i.product_id
    where o.cycle_id = p_cycle
      and o.status not in ('pending_payment', 'cancelled', 'refunded'));
end $$;

revoke all on function public.admin_order_counts(), public.admin_cycle_totals(uuid) from public, anon, authenticated;
grant execute on function public.admin_order_counts(), public.admin_cycle_totals(uuid) to authenticated, service_role;

-- Orders filtered by a chip, newest first (the Orders page, pages of 50).
create index orders_status_created_idx on public.orders (status, created_at desc);
-- Pickups to do and picked pieces across cycles (Today, the sidebar counts).
create index pickups_status_idx on public.pickups (status);
-- What each shop is owed (Payouts): picked pieces not yet paid.
create index pickups_owed_idx on public.pickups (vendor_id, picked_at) where status = 'picked' and payout_id is null;
-- The pieces a payout paid for.
create index pickups_payout_idx on public.pickups (payout_id) where payout_id is not null;
