-- =============================================================================
-- D-154 step 5 (founder, 2026-10-23): watching the 7-day promise in Insights.
--  - order_shipments.promised_to: the last day promised when the order was placed. A delay moves est_delivery_to (the
--    customer's new date); the promise kept here is what "on time" is measured against. Existing shipments take their
--    current date (none was moved for a 7-day shipment before this).
--  - admin_quick_insights(since): for paid orders placed since then (all time when null):
--      the share of orders with a 7-day shipment, and of those split into two;
--      orders whose 7-day pieces (after the promo, as the line counts them) stop just past the line: within $5, $5 to
--      $15, more;
--      per kind of shipment: due (delivered, or past its promised day), delivered on time, late, late with a delay
--      notice sent before the promised day, still open past it;
--      7-day pieces refunded as unavailable (D-042), pieces and $;
--      the split's extra courier cost: two parcels against the one they would have made (the courier's ₹ a kg in
--      Settings, at least 1 kg then by the half kg, food at its billed %; D-126), in paise.
--    Admin only; numbers computed here, never estimated (C7).
-- Tests: seven_day_insights.test.sql.
-- =============================================================================

alter table public.order_shipments add column promised_to date;
update public.order_shipments set promised_to = est_delivery_to;
comment on column public.order_shipments.promised_to is
  'D-154: the last day promised when the order was placed; a delay moves est_delivery_to, never this.';

create function public._shipment_promise() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.promised_to := coalesce(new.promised_to, new.est_delivery_to);
  return new;
end $$;
revoke all on function public._shipment_promise() from public, anon, authenticated;
create trigger order_shipments_promise before insert on public.order_shipments
  for each row execute function public._shipment_promise();

-- What the courier charges for a parcel of these grams, in paise (at least 1 kg, then by the half kg).
create function public._courier_paise(p_grams numeric) returns numeric
language sql stable set search_path = public, pg_temp as $$
  select case when s.courier_first_kg_paise is null or s.courier_next_kg_paise is null then null
              else s.courier_first_kg_paise
                   + (ceil(greatest(coalesce(p_grams, 0) / 1000.0, 1) * 2) / 2 - 1) * s.courier_next_kg_paise end
  from public.pricing_settings s where s.id = 1
$$;
revoke all on function public._courier_paise(numeric) from public, anon, authenticated;

create function public.admin_quick_insights(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_line integer;
  v_result jsonb;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select quick_delivery_min_cents into v_line from public.pricing_settings where id = 1;

  with paid as (
    select o.id, o.subtotal_cents, coalesce(o.discount_cents, 0) as discount_cents
    from public.orders o
    where o.payment_status in ('paid', 'partially_refunded')
      and o.status not in ('pending_payment')
      and (p_since is null or o.created_at >= p_since)),
  sh as (
    select s.*, (select count(*) from public.order_shipments x
                 where x.order_id = s.order_id and x.status <> 'cancelled') as live
    from public.order_shipments s
    join paid p on p.id = s.order_id),
  -- each order's 7-day pieces after its promo (spread by value, as the line counts them)
  quick_net as (
    select p.id, sum(oi.total_price_cents)
                 - case when p.subtotal_cents > 0
                        then least(p.discount_cents, p.subtotal_cents) * sum(oi.total_price_cents) / p.subtotal_cents
                        else 0 end as cents
    from paid p
    join sh on sh.order_id = p.id and sh.kind = 'quick'
    join public.order_items oi on oi.shipment_id = sh.id
    group by p.id, p.subtotal_cents, p.discount_cents),
  -- when each shipment was delivered (its delivered event), on the US calendar
  done as (
    select e.shipment_id, min((e.created_at at time zone 'America/New_York')::date) as on_day
    from public.order_events e
    where e.kind = 'delivered' and e.shipment_id is not null
    group by e.shipment_id),
  graded as (
    select sh.kind, sh.status, sh.promised_to, d.on_day,
           (sh.status = 'delivered' or (sh.status in ('open', 'shipped') and sh.promised_to < current_date)) as due,
           (sh.status = 'delivered' and d.on_day <= sh.promised_to) as on_time,
           ((sh.status = 'delivered' and (d.on_day is null or d.on_day > sh.promised_to))
             or (sh.status in ('open', 'shipped') and sh.promised_to < current_date)) as late,
           exists (select 1 from public.order_events e
                   where e.order_id = sh.order_id and e.kind = 'delivery_window_changed'
                     and (e.shipment_id = sh.id or (e.shipment_id is null and sh.live = 1))
                     and (e.created_at at time zone 'America/New_York')::date <= sh.promised_to) as noticed
    from sh
    left join done d on d.shipment_id = sh.id
    where sh.status <> 'cancelled' and sh.promised_to is not null),
  -- grams per shipment of a split order, as the courier bills them
  split_grams as (
    select sh.order_id, sh.id,
           sum(oi.quantity * coalesce(pv.weight_g, public._pricing_weight_g(pr.id), 0)
               * case when pr.product_type = 'food' then coalesce(s.food_billed_pct, 100) / 100.0 else 1 end) as grams
    from sh
    join public.order_items oi on oi.shipment_id = sh.id and oi.status <> 'refunded'
    left join public.product_variants pv on pv.id = oi.variant_id
    left join public.products pr on pr.id = oi.product_id
    cross join public.pricing_settings s
    where s.id = 1 and sh.status <> 'cancelled'
      and sh.order_id in (select order_id from sh where kind = 'quick')
      and sh.order_id in (select order_id from sh where kind <> 'quick' and status <> 'cancelled')
    group by sh.order_id, sh.id),
  split_cost as (
    select order_id, sum(public._courier_paise(grams)) - public._courier_paise(sum(grams)) as extra
    from split_grams group by order_id)
  select jsonb_build_object(
    'line_cents', v_line,
    'orders', (select count(*) from paid),
    'with_quick', (select count(distinct order_id) from sh where kind = 'quick'),
    'split', (select count(*) from split_cost),
    'past_line', jsonb_build_object(
      'within_5', (select count(*) from quick_net where cents >= v_line and cents < v_line + 500),
      'within_15', (select count(*) from quick_net where cents >= v_line + 500 and cents < v_line + 1500),
      'more', (select count(*) from quick_net where cents >= v_line + 1500)),
    'shipments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', g.kind, 'due', g.due_n, 'on_time', g.on_time_n, 'late', g.late_n,
               'late_noticed', g.noticed_n, 'overdue', g.overdue_n)
             order by case g.kind when 'quick' then 0 when 'standard' then 1 else 2 end)
      from (select kind,
                   count(*) filter (where due) as due_n,
                   count(*) filter (where on_time) as on_time_n,
                   count(*) filter (where late) as late_n,
                   count(*) filter (where late and noticed) as noticed_n,
                   count(*) filter (where status in ('open', 'shipped') and promised_to < current_date) as overdue_n
            from graded group by kind) g), '[]'::jsonb),
    'unavailable', (
      select jsonb_build_object('pieces', coalesce(sum(oi.quantity), 0), 'cents', coalesce(sum(oi.total_price_cents), 0))
      from public.order_items oi
      join sh on sh.id = oi.shipment_id and sh.kind = 'quick'
      where oi.status = 'unavailable'),
    'split_extra_paise', (select coalesce(round(sum(extra)), 0) from split_cost))
  into v_result;
  return v_result;
end $$;
revoke all on function public.admin_quick_insights(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_quick_insights(timestamptz) to authenticated, service_role;
