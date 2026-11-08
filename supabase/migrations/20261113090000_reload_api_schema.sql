-- =============================================================================
-- 2026-11-08: after the Deploy workflow applied 20261112090000_look_photos and 20261112090100_traditional_wear, the
-- runner got "Could not find the function public.worker_look_photo_plan(...) in the schema cache": the API had not
-- reloaded its list of functions, and those two migrations didn't ask it to (the others since 20261109 do). This one
-- only asks. The audit (scripts/docs-audit.mjs) now requires the line in every new migration that makes a function.
-- Size: none. Egress: none. Page cache: none.
-- =============================================================================

notify pgrst, 'reload schema';
