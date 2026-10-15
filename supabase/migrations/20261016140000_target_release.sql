-- =============================================================================
-- A target whose search failed on every shop (Nishorama answered "429 Too Many Requests", 2026-10-16) goes back to
-- the queue instead of being marked "nothing fit": worker_sourcing_target_release(). Before, all 18 Nishorama
-- targets were used up by one blocked run. Worker only; only a target this runner is searching.
-- =============================================================================

create function public.worker_sourcing_target_release(p_target uuid, p_note text default null)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.is_worker() then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  update public.sourcing_targets
     set status = 'queued', claimed_at = null, note = left(p_note, 500)
   where id = p_target and status = 'searching';
end $$;
revoke all on function public.worker_sourcing_target_release(uuid, text) from public, anon;
grant execute on function public.worker_sourcing_target_release(uuid, text) to authenticated;
