-- =============================================================================
-- DEV ONLY. NEVER run against production (INV-8, data-model.md §Seed).
-- Every row here is fake: is_placeholder = true. Numbers below (prices,
-- quantities, delivery days, dates) are DEV PLACEHOLDERS, not business decisions.
-- =============================================================================

-- Let store_* views show placeholder products and draft region text locally.
update public.app_settings set value = 'true'::jsonb where key = 'dev_preview';

-- DEV PLACEHOLDER delivery days so checkout can compute a window locally.
update public.pricing_settings set domestic_days_min = 3, domestic_days_max = 7 where id = 1;

-- Express days come from seed/estimates.sql (15 to 18, D-070), not from here.

update public.regions set is_live = true where slug in ('kerala', 'rajasthan', 'punjab');

insert into public.vendors (id, shop_name, region_id, status, is_placeholder)
select v.id::uuid, v.shop_name, r.id, 'active', true
from (values
  ('00000000-0000-4000-8000-000000000101', 'Demo shop (Kerala)', 'kerala'),
  ('00000000-0000-4000-8000-000000000102', 'Demo shop (Rajasthan)', 'rajasthan'),
  ('00000000-0000-4000-8000-000000000103', 'Demo shop (Punjab)', 'punjab')
) as v (id, shop_name, region_slug)
join public.regions r on r.slug = v.region_slug;

insert into public.products (id, slug, name, product_type, region_id, category_id, vendor_id,
                             summary, price_cents, shop_price_paise, status, is_placeholder, published_at)
select p.id::uuid, p.slug, p.name, 'clothing', r.id, c.id, p.vendor_id::uuid,
       'Demo product for local development.', p.price_cents, p.shop_price_paise, 'live', true, now()
from (values
  ('00000000-0000-4000-8000-000000000201', 'demo-kerala-kasavu-saree', 'Demo Kasavu Saree', 'kerala', 'sarees',
   '00000000-0000-4000-8000-000000000101', 9900, 250000),
  ('00000000-0000-4000-8000-000000000202', 'demo-kerala-mundu', 'Demo Mundu', 'kerala', 'dhotis-and-mundus',
   '00000000-0000-4000-8000-000000000101', 3900, 90000),
  ('00000000-0000-4000-8000-000000000203', 'demo-rajasthan-bandhani-dupatta', 'Demo Bandhani Dupatta', 'rajasthan',
   'dupattas-and-stoles', '00000000-0000-4000-8000-000000000102', 4900, 120000),
  ('00000000-0000-4000-8000-000000000204', 'demo-punjab-phulkari-dupatta', 'Demo Phulkari Dupatta', 'punjab',
   'dupattas-and-stoles', '00000000-0000-4000-8000-000000000103', 5900, 150000)
) as p (id, slug, name, region_slug, category_slug, vendor_id, price_cents, shop_price_paise)
join public.regions r on r.slug = p.region_slug
join public.categories c on c.slug = p.category_slug;

insert into public.product_variants (product_id, sku, label, options, qty_listed)
values
  ('00000000-0000-4000-8000-000000000201', 'DEMO-KER-SAR-1', 'Free size', '{"size": "Free size"}', 3),
  ('00000000-0000-4000-8000-000000000202', 'DEMO-KER-MUN-1', 'Free size', '{"size": "Free size"}', 5),
  ('00000000-0000-4000-8000-000000000203', 'DEMO-RAJ-DUP-1', 'Red', '{"colour": "Red"}', 4),
  ('00000000-0000-4000-8000-000000000204', 'DEMO-PUN-DUP-1', 'Orange', '{"colour": "Orange"}', 2);

-- DEV: one Curated for you pick (D-056) so the section shows locally.
update public.products set is_curated = true where id = '00000000-0000-4000-8000-000000000202';

-- DEV PLACEHOLDER open cycle (dates relative to "now").
insert into public.cycles (code, status, cutoff_at, est_export_on, est_arrival_on)
values ('DEV-OPEN', 'open', now() + interval '7 days', current_date + 10, current_date + 30);
