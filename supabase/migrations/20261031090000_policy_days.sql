-- =============================================================================
-- The homesick plan (D-161): the store's policy carries the standard delivery days (the made-to-order pilot's, in
-- Settings), so a cached page can work out "at your door by Nov 11" in the browser, as it already does for the 7-day
-- days (D-154). No new read: store_policy() is already cached; null in cycle mode (the window then comes from the cycle).
-- Latest before: 20261026090000_seven_day_store.
-- =============================================================================
create or replace function public.store_policy()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'min_order_cents', s.min_order_cents,
    'express_days_min', s.express_days_min,
    'express_days_max', s.express_days_max,
    -- D-161: the pilot's standard days (null in cycle mode)
    'delivery_days_min', s.pilot_delivery_days_min,
    'delivery_days_max', s.pilot_delivery_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
    'quick_delivery_days_min', s.quick_delivery_days_min,
    'quick_delivery_days_max', s.quick_delivery_days_max,
    -- D-154: the 7-day line, and whether the 7-day store is open (days set, not paused)
    'quick_delivery_min_cents', s.quick_delivery_min_cents,
    'quick_delivery_on', (s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null
                          and not s.quick_delivery_paused),
    'cancel_fee_pct', s.cancel_fee_pct,
    'return_claim_days', s.return_claim_days,
    'return_tiers', coalesce((
      select jsonb_agg(jsonb_build_object('days', t.days, 'kept_pct', t.pct) order by t.days)
      from (values (s.return_tier1_days, s.return_tier1_pct), (s.return_tier2_days, s.return_tier2_pct),
                   (s.return_tier3_days, s.return_tier3_pct)) t (days, pct)
      where t.days is not null and t.pct is not null), '[]'::jsonb),
    'tax', coalesce((
      select jsonb_agg(jsonb_build_object('state', r.state, 'rate_pct', r.rate_pct, 'clothing', r.taxes_clothing,
                                          'food', r.taxes_food, 'general', r.taxes_general)
                       order by r.state)
      from public.tax_rates r), '[]'::jsonb))
  from public.pricing_settings s
  where s.id = 1;
$$;
