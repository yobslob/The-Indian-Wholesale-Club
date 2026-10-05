-- =============================================================================
-- C8, a shared rate limiter (B-3): every server instance counts against the same table, and nothing resets on a cold
-- start. Fixed one-minute windows; keys are "<hashed caller>:<rule>" (the website hashes the IP first, so no address
-- is stored). Old windows are swept now and then. Service role only.
-- =============================================================================

create unlogged table public.rate_limit_hits (
  key text not null check (length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key (key, window_start)
);
alter table public.rate_limit_hits enable row level security;   -- no policies: service role only
revoke all on public.rate_limit_hits from anon, authenticated;

-- One more hit for a key; says whether it is allowed and, when not, how many seconds until the window resets.
create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limit_hits (key, window_start) values (p_key, v_start)
  on conflict (key, window_start) do update set hits = public.rate_limit_hits.hits + 1
  returning hits into v_hits;
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 hour';
  end if;
  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'retry_after', greatest(1, ceil(extract(epoch from v_start + make_interval(secs => p_window_seconds) - now())))::int);
end $$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
