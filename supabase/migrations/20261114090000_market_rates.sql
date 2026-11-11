-- D-197 (founder 2026-11-10): Canada, Australia and New Zealand see every price in their own dollars. Prices stay
-- worked out in US dollars; these are only the rates they are shown at, set in Admin → Settings. Seeded with the
-- mid-market rates of 2026-11-06/07 (XE): USD/CAD 1.4130, AUD/USD 0.6862, NZD/USD 0.5538. Empty = that country sees US
-- dollars. Orders, checkout and Stripe stay in US dollars. Cost: three numbers on one row; no new read (store_policy
-- is the cached read the store layout already makes).

alter table public.pricing_settings
  add column if not exists fx_usd_cad numeric(10, 4) check (fx_usd_cad > 0),
  add column if not exists fx_usd_aud numeric(10, 4) check (fx_usd_aud > 0),
  add column if not exists fx_usd_nzd numeric(10, 4) check (fx_usd_nzd > 0);

update public.pricing_settings
set fx_usd_cad = coalesce(fx_usd_cad, 1.4130),
    fx_usd_aud = coalesce(fx_usd_aud, 1.4570),
    fx_usd_nzd = coalesce(fx_usd_nzd, 1.8060)
where id = 1;

-- as in 20261109090000_simple_rules, plus 'fx'
create or replace function public.store_policy() returns jsonb
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'bulk_saving_from_cents', s.bulk_saving_from_cents,
    'min_order_cents', s.min_order_cents,
    -- clothing and home & gifts, and food: in delivery days (D-187)
    'delivery_days_min', s.delivery_days_min,
    'delivery_days_max', s.delivery_days_max,
    'food_delivery_days_min', s.food_delivery_days_min,
    'food_delivery_days_max', s.food_delivery_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
    -- TODO(D-187): drop when app <next version> is the minimum (it hides its 7-day store on these)
    'express_days_min', null,
    'express_days_max', null,
    'quick_delivery_days_min', null,
    'quick_delivery_days_max', null,
    'quick_delivery_min_cents', null,
    'quick_delivery_on', false,
    -- D-197: US dollars to each currency, for the prices shown in Canada, Australia and New Zealand
    'fx', jsonb_build_object('ca', s.fx_usd_cad, 'au', s.fx_usd_aud, 'nz', s.fx_usd_nzd),
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

notify pgrst, 'reload schema';
