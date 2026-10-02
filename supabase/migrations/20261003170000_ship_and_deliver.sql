-- =============================================================================
-- C4, US pack & ship (flows.md §6 step 4, D-066): shipping and delivering an order become functions with their
-- rules, instead of plain row updates from the admin screens.
--  - ship_order(order, carrier, tracking): only an order whose export has arrived in the US; the carrier is picked
--    (USPS, UPS, FedEx: a tracking link for the customer) or typed; the customer sees "Shipped".
--  - deliver_order(order): only a shipped order; the customer sees "Delivered".
-- Both admin only. The "coming sooner" note of migration 14 still fires on shipping.
-- =============================================================================

create function public.ship_order(p_order uuid, p_carrier text, p_tracking text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_carrier, ''))) not between 2 and 40
     or length(btrim(coalesce(p_tracking, ''))) not between 4 and 60 then
    raise exception 'invalid_tracking' using errcode = 'P0001';
  end if;
  update public.orders
     set status = 'shipped', carrier = btrim(p_carrier), tracking_number = btrim(p_tracking)
   where id = p_order and status = 'arrived';
  if not found then
    raise exception 'order_not_arrived' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, kind, visible_to_customer, actor)
  values (p_order, 'shipped', true, auth.uid());
end $$;

create function public.deliver_order(p_order uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  update public.orders set status = 'delivered' where id = p_order and status = 'shipped';
  if not found then
    raise exception 'order_not_shipped' using errcode = 'P0001';
  end if;
  insert into public.order_events (order_id, kind, visible_to_customer, actor)
  values (p_order, 'delivered', true, auth.uid());
end $$;

revoke all on function public.ship_order(uuid, text, text), public.deliver_order(uuid) from public, anon, authenticated;
grant execute on function public.ship_order(uuid, text, text), public.deliver_order(uuid) to authenticated, service_role;
