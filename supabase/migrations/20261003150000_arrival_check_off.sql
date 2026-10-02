-- =============================================================================
-- C4, arrival check-off (flows.md §6 step 3): when an export reaches the US, the founder ticks off each order's
-- pieces as they come out of the box. pickups.arrived_at records it (only for picked pieces, only once the cycle has
-- arrived). Export details (AWB, forwarder, freight, duty, FX) already live on cycles and are entered on the
-- cycle's admin page.
-- =============================================================================

alter table public.pickups
  add column arrived_at timestamptz,
  add column arrived_by uuid references public.profiles (id) on delete set null,
  add constraint pickups_arrived_only_when_picked check (arrived_at is null or status = 'picked');

create function public.check_off_arrival(p_pickup uuid, p_arrived boolean default true)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_pickup public.pickups;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_pickup from public.pickups where id = p_pickup for update;
  if not found or v_pickup.status <> 'picked' then
    raise exception 'pickup_not_picked' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.cycles where id = v_pickup.cycle_id and status in ('arrived', 'fulfilling')) then
    raise exception 'cycle_not_arrived' using errcode = 'P0001';
  end if;
  update public.pickups
     set arrived_at = case when p_arrived then now() end,
         arrived_by = case when p_arrived then auth.uid() end
   where id = p_pickup;
end $$;

revoke all on function public.check_off_arrival(uuid, boolean) from public, anon, authenticated;
grant execute on function public.check_off_arrival(uuid, boolean) to authenticated, service_role;
