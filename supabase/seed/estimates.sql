-- =============================================================================
-- Claude's high-end PLACEHOLDERS for the pilot shipment (D-069), checked on 2026-10-06, each labelled in
-- pricing_estimates with its basis so Settings shows it as a placeholder until the founder saves their own number
-- (which removes the label). Empty settings and Claude's older placeholders are filled; a number the founder set
-- is never touched. The full list with where to change each: docs/pilot-numbers.md.
-- Applied by `supabase db reset` (local) and `pnpm dev:estimates` (the current local database, no reset); for the
-- hosted database, run this file in the SQL editor. The launch check lists every placeholder left.
-- =============================================================================

select public._load_pricing_estimates(jsonb_build_array(
  -- Exchange rate: fetched every day (D-075); this is only the starting value.
  jsonb_build_object('setting', 'fx_inr_per_usd', 'value', 96.30,
    'source', 'ECB reference rate on 2026-10-05 via Frankfurter (96.30); open.er-api 96.38. Updated by itself every day.',
    'url', 'https://api.frankfurter.dev/v1/latest?from=USD&to=INR'),
  jsonb_build_object('setting', 'fx_buffer_pct', 'value', 4,
    'source', 'High end: prices assume a rupee 4% weaker than today. It fell about 9% over the past year, so 4% covers about five months.',
    'url', null),
  -- India side, per piece
  jsonb_build_object('setting', 'india_handling_paise', 'value', 20000,
    'source', 'High end: ₹200 per piece for pickup from the shop, local transport to Mumbai, packing material and labour.',
    'url', null),
  -- Air freight, standard (Mumbai to a US airport, D-070)
  jsonb_build_object('setting', 'freight_cents_per_kg', 'value', 750,
    'source', 'High end of forwarder air rates India to US: $3.50 to 5.50/kg for 45 to 100 kg plus 15 to 25% fuel surcharge, plus terminal handling (bifpl.com, Freightos, 2026).',
    'url', 'https://www.freightos.com/shipping-routes/shipping-from-india-to-the-united-states/'),
  jsonb_build_object('setting', 'volumetric_pct', 'value', 130,
    'source', 'Airlines charge the larger of real and volume weight; folded clothing in cartons usually bills 20 to 40% over its real weight.',
    'url', null),
  jsonb_build_object('setting', 'broker_cents_per_shipment', 'value', 40000,
    'source', 'High end per export: customs broker entry $150 to 300, Merchandise Processing Fee (minimum about $33), a single-entry bond $50 to 100.',
    'url', null),
  jsonb_build_object('setting', 'shipment_kg', 'value', 40,
    'source', 'A small pilot shipment of about 40 billed kg shares the per-export costs by weight. A heavier export lowers every price.',
    'url', null),
  jsonb_build_object('setting', 'duty_pct', 'value', 26.5,
    'source', 'High end of US duty on clothing from India: the normal (MFN) rate up to 16.5% plus the 10% Section 301 tier for India since 2026-07-24 (PIB, tariffstool).',
    'url', 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2289348'),
  -- US side, per piece
  jsonb_build_object('setting', 'us_handling_cents', 'value', 300,
    'source', 'High end: $3 per piece to receive, check, repack and label at the US warehouse.',
    'url', null),
  jsonb_build_object('setting', 'us_last_mile_cents_per_kg', 'value', 1000,
    'source', 'High end of USPS Ground Advantage to the farthest zone: about $9 to 11 for 1 to 2 lb. Standard shipping is free, so the price carries it, by weight.',
    'url', 'https://www.usps.com/ship/ground-advantage.htm'),
  jsonb_build_object('setting', 'us_last_mile_min_cents', 'value', 500,
    'source', 'The smallest US parcel still costs about $5 to the farthest zone.',
    'url', null),
  -- Risk, margin, fees
  jsonb_build_object('setting', 'returns_allowance_pct', 'value', 5,
    'source', 'Set aside for returns and damage (D-071): 5% of the landed cost.',
    'url', null),
  jsonb_build_object('setting', 'margin_pct', 'value', 100,
    'source', 'Keystone: twice the landed cost (a 50% gross margin), the usual floor for clothing retail; direct online brands run 3 to 3.5 times (AIMS360).',
    'url', 'https://www.aims360.com/fashion-business-resources/how-to-calculate-profit-margin'),
  jsonb_build_object('setting', 'card_fee_pct', 'value', 3.4,
    'source', 'Stripe US cards cost 2.9% + 30 cents; 3.4% leaves room for international and premium cards.',
    'url', 'https://stripe.com/pricing'),
  jsonb_build_object('setting', 'card_fee_fixed_cents', 'value', 30,
    'source', 'Stripe: 30 cents per successful card payment.',
    'url', 'https://stripe.com/pricing'),
  -- Express: Mumbai to the customer's door by international courier (D-070)
  jsonb_build_object('setting', 'express_courier_cents_per_kg', 'value', 2200,
    'source', 'High end of DHL / FedEx express India to US for small parcels: about ₹1,400 to 1,800/kg plus a 25% fuel surcharge.',
    'url', 'https://www.clickpost.ai/blog/courier-charges-for-usa'),
  jsonb_build_object('setting', 'express_base_cents', 'value', 1500,
    'source', 'High end per express order: courier pickup in Mumbai, export paperwork and duty-paid delivery handling.',
    'url', null),
  jsonb_build_object('setting', 'express_min_kg', 'value', 1,
    'source', 'Couriers bill at least 0.5 to 1 kg; 1 kg is the safe floor.',
    'url', null),
  jsonb_build_object('setting', 'express_days_min', 'value', 15,
    'source', 'D-048 and D-070: 15 to 18 days from the order (pickup, courier, customs).',
    'url', null),
  jsonb_build_object('setting', 'express_days_max', 'value', 18,
    'source', 'D-048 and D-070.',
    'url', null),
  -- Cycles and offers
  jsonb_build_object('setting', 'cycle_days', 'value', 21,
    'source', 'D-005: one export every 20 to 23 days; 21 is the middle.',
    'url', null),
  jsonb_build_object('setting', 'fast_offer_cents', 'value', 600,
    'source', 'Below the express fee, so the earlier window feels like a deal (D-064).',
    'url', null),
  jsonb_build_object('setting', 'stale_listing_days', 'value', 14,
    'source', 'Half of a 20 to 23 day cycle (D-005), so every shop gets its quantities re-checked at least once per cycle.',
    'url', null)
), date '2026-10-06');
