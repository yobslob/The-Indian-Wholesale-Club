-- =============================================================================
-- The customer-facing policy numbers (D-070 – D-073, D-008), for the Shipping & returns page: the page states the
-- rules with the same numbers the database applies, so a setting changed in the admin changes the page too. Only
-- terms a customer is offered: no cost, margin or customer-care deduction (D-003, D-072).
-- =============================================================================

create function public.store_policy()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'express_days_min', s.express_days_min,
    'express_days_max', s.express_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
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

revoke all on function public.store_policy() from public, anon, authenticated;
grant execute on function public.store_policy() to anon, authenticated, service_role;
