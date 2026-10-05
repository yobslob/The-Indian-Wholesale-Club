-- =============================================================================
-- DEV ONLY: Claude's researched ESTIMATES for the pricing settings (D-047, C6), checked on 2026-10-06. Each one is
-- labelled in pricing_estimates with its source, so Settings shows it as an estimate until the founder saves their own
-- number (which removes the label). Only EMPTY settings are filled: a value the founder already set is never touched.
-- Applied by `supabase db reset` (local) and `pnpm dev:estimates` (the current local database, no reset); for the
-- hosted dev database, run this file in the SQL editor. Never in production: the launch check refuses estimates (C8).
-- =============================================================================

select public._load_pricing_estimates(
  jsonb_build_array(
    jsonb_build_object(
      'setting', 'fx_inr_per_usd', 'value', 96.48,
      'source', 'USD/INR market rate on 2026-10-05 (96.48, Trading Economics); the FBIL reference rate was 95.97 on '
                || '2026-09-28. The rupee fell about 9% over the past year: re-check before each pricing round.',
      'url', 'https://tradingeconomics.com/india/currency'),
    jsonb_build_object(
      'setting', 'freight_cents_per_kg', 'value', 600,
      'source', 'Air freight India to US: $3.50 to $5.50/kg for 45 to 100 kg plus 15 to 25% fuel surcharge '
                || '(bifpl.com, 2026); about $3/kg for 150 to 500 kg (Freightos, October 2026). $6/kg covers a small '
                || 'consolidated export with surcharges; customs brokerage and US clearance fees are not included.',
      'url', 'https://www.freightos.com/shipping-routes/shipping-from-india-to-the-united-states/'),
    jsonb_build_object(
      'setting', 'duty_pct', 'value', 22,
      'source', 'US duty on clothing from India: the normal (MFN) rate, about 12 to 16.5% depending on the garment '
                || '(HTS chapters 61 and 62), plus the 10% Section 301 forced-labour tariff, India''s tier since '
                || '2026-07-24 (Government of India, PIB). Silk and fabric lines can be lower; a customs broker '
                || 'confirms each HTS code (Q-30).',
      'url', 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2289348'),
    jsonb_build_object(
      'setting', 'margin_pct', 'value', 100,
      'source', 'Keystone: twice the landed cost (a 50% gross margin) is the usual floor for clothing retail; brands '
                || 'selling direct online run about 3 to 3.5 times cost (AIMS360, 2026). A business choice for the founder.',
      'url', 'https://www.aims360.com/fashion-business-resources/how-to-calculate-profit-margin'),
    jsonb_build_object(
      'setting', 'stale_listing_days', 'value', 14,
      'source', 'No outside source: half of the 20 to 23 day cycle (D-005), so every shop''s quantities are re-checked '
                || 'at least once per cycle.',
      'url', null)
  ),
  date '2026-10-06');
