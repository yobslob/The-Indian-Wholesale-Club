-- D-207 (founder, 2026-11-24): food comes in 7 – 12 delivery days, not 7. The store says the days from Settings
-- (non-negotiable 4), so this is the whole change: every page, the bag, checkout and new orders' dates follow it. Orders
-- already placed keep their dates. Only Settings still at the old 7 – 7 move, so a value the founder set is kept.
update public.pricing_settings
   set food_delivery_days_max = 12
 where id = 1 and food_delivery_days_min = 7 and food_delivery_days_max = 7;
