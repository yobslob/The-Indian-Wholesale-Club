-- =============================================================================
-- Claude's placeholders for the after-sale numbers and the re-check interval, each from its decision. Empty settings
-- are filled; a number the founder set is never touched. The full list with where to change each:
-- docs/pilot-numbers.md. Applied by `supabase db reset` (local) and `pnpm dev:estimates` (the current local database,
-- no reset). The paused price formula's estimates and their labels went with it (D-187, 10 Y-2).
-- =============================================================================

update public.pricing_settings set
  stale_listing_days = coalesce(stale_listing_days, 14),              -- every shop re-checked about twice a month
  cancel_fee_pct = coalesce(cancel_fee_pct, 0),                       -- D-072: no fee while the order is in India
  export_cancel_deduction_pct = coalesce(export_cancel_deduction_pct, 25),  -- D-072: shipping is spent once it left India
  return_claim_days = coalesce(return_claim_days, 7),                 -- D-071: damaged or wrong, within 7 days of delivery
  return_tier1_days = coalesce(return_tier1_days, 7),                 -- D-071: a change of mind within 7 days, 15% kept
  return_tier1_pct = coalesce(return_tier1_pct, 15),
  return_tier2_days = coalesce(return_tier2_days, 14),                -- D-071: within 14 days, 30% kept
  return_tier2_pct = coalesce(return_tier2_pct, 30),
  return_tier3_days = coalesce(return_tier3_days, 30),                -- D-071: within 30 days, 50% kept; then no returns
  return_tier3_pct = coalesce(return_tier3_pct, 50),
  clearance_discount_pct = coalesce(clearance_discount_pct, 30)       -- D-072: sold from the US at 30% off what was paid
where id = 1;
