-- =============================================================================
-- C6, pricing help (D-047): the founder's numbers may start as Claude's researched estimates, each labelled with its
-- source and the date it was checked, until the founder replaces them.
--  - pricing_estimates: one row per pricing setting that currently holds an estimate (its source, link, date).
--    No row = the founder's own number (or not set). Admin-only.
--  - A trigger on pricing_settings drops a setting's estimate row as soon as its value changes, so saving your own
--    number in Settings removes the label.
--  - _load_pricing_estimates(): fills only empty settings and labels them (supabase/seed/estimates.sql, dev only).
-- A launch check refuses to go live while any estimate is left (C8).
-- =============================================================================

create table public.pricing_estimates (
  setting text primary key check (setting in ('fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct',
                                              'domestic_days_min', 'domestic_days_max', 'stale_listing_days')),
  source text not null check (length(btrim(source)) > 0),
  source_url text check (source_url is null or source_url ~ '^https://'),
  checked_on date not null,
  created_at timestamptz not null default now()
);

alter table public.pricing_estimates enable row level security;
create policy admin_all on public.pricing_estimates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.pricing_estimates from anon, authenticated;
grant select, insert, update, delete on public.pricing_estimates to authenticated;

create function public._pricing_estimate_replaced() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if coalesce(current_setting('iwc.loading_estimates', true), '') = 'on' then
    return new;
  end if;
  delete from public.pricing_estimates e
  where (e.setting = 'fx_inr_per_usd' and new.fx_inr_per_usd is distinct from old.fx_inr_per_usd)
     or (e.setting = 'freight_cents_per_kg' and new.freight_cents_per_kg is distinct from old.freight_cents_per_kg)
     or (e.setting = 'duty_pct' and new.duty_pct is distinct from old.duty_pct)
     or (e.setting = 'margin_pct' and new.margin_pct is distinct from old.margin_pct)
     or (e.setting = 'domestic_days_min' and new.domestic_days_min is distinct from old.domestic_days_min)
     or (e.setting = 'domestic_days_max' and new.domestic_days_max is distinct from old.domestic_days_max)
     or (e.setting = 'stale_listing_days' and new.stale_listing_days is distinct from old.stale_listing_days);
  return new;
end $$;

create trigger pricing_settings_estimate_replaced
  after update on public.pricing_settings
  for each row execute function public._pricing_estimate_replaced();

-- Loads estimates: [{setting, value, source, url}] at a date. Fills ONLY empty settings (never the founder's own
-- numbers) and labels each one it fills. Returns how many it filled. Run by supabase/seed/estimates.sql (dev only).
create function public._load_pricing_estimates(p_estimates jsonb, p_checked_on date)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item jsonb;
  v_empty boolean;
  v_filled integer := 0;
begin
  perform set_config('iwc.loading_estimates', 'on', true);
  for v_item in select value from jsonb_array_elements(p_estimates)
  loop
    if v_item ->> 'setting' not in ('fx_inr_per_usd', 'freight_cents_per_kg', 'duty_pct', 'margin_pct',
                                    'domestic_days_min', 'domestic_days_max', 'stale_listing_days') then
      raise exception 'unknown_setting:%', v_item ->> 'setting' using errcode = 'P0001';
    end if;
    execute format('select %I is null from public.pricing_settings where id = 1', v_item ->> 'setting') into v_empty;
    if v_empty then
      execute format('update public.pricing_settings set %I = $1 where id = 1', v_item ->> 'setting')
        using (v_item ->> 'value')::numeric;
      insert into public.pricing_estimates (setting, source, source_url, checked_on)
      values (v_item ->> 'setting', v_item ->> 'source', v_item ->> 'url', p_checked_on)
      on conflict (setting) do update
        set source = excluded.source, source_url = excluded.source_url, checked_on = excluded.checked_on;
      v_filled := v_filled + 1;
    end if;
  end loop;
  perform set_config('iwc.loading_estimates', '', true);
  return v_filled;
end $$;

revoke all on function public._pricing_estimate_replaced(), public._load_pricing_estimates(jsonb, date)
  from public, anon, authenticated;
